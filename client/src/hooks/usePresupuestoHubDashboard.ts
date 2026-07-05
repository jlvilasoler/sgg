import { useEffect, useMemo, useState } from "react";
import { fetchPresupuesto } from "../api";
import type { AuthUser, Presupuesto } from "../types";
import { ejercicioVigente } from "../utils/ejercicio-contable";

const RECIENTES_LIMIT = 6;

function mesActualRango(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const ultimo = new Date(y, m + 1, 0);
  const hasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
  return { desde, hasta };
}

function ordenarPorIngreso(rows: Presupuesto[]): Presupuesto[] {
  return [...rows].sort((a, b) => {
    const aTs = a.creado_en ?? `${a.fecha}T12:00:00`;
    const bTs = b.creado_en ?? `${b.fecha}T12:00:00`;
    return bTs.localeCompare(aTs);
  });
}

function filtrarMesActual(rows: Presupuesto[]): Presupuesto[] {
  const { desde, hasta } = mesActualRango();
  return rows.filter((r) => r.fecha >= desde && r.fecha <= hasta);
}

/** Meses calendario transcurridos del ejercicio vigente hasta hoy (mín. 1). */
function mesesTranscurridosEjercicio(ref = new Date()): number {
  const ej = ejercicioVigente(ref);
  const [sy, sm, sd] = ej.desde.split("-").map(Number);
  const [ey, em, ed] = ej.hasta.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const endEj = new Date(ey, em - 1, ed);
  const until = ref.getTime() < endEj.getTime() ? ref : endEj;
  const months =
    (until.getFullYear() - start.getFullYear()) * 12 + (until.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
}

/** Admin y Gestor N1: KPI de documentos de toda la cuenta en el mes. */
export function canVerPresupuestoKpiCuentaMes(user: AuthUser): boolean {
  return user.rol === "admin" || user.rol === "editor";
}

export interface PresupuestoHubStats {
  cuentaMesCount: number;
  propioMesCount: number;
  propioMesUsd: number;
  propioEjercicioUsd: number;
  propioEjercicioCount: number;
  propioPromedioMesDocs: number;
  mesesEjercicioTranscurridos: number;
  ejercicioLabel: string;
}

export function usePresupuestoHubDashboard(user: AuthUser, apiOnline: boolean) {
  const puedeVerCuentaMes = canVerPresupuestoKpiCuentaMes(user);
  const [rowsPropios, setRowsPropios] = useState<Presupuesto[]>([]);
  const [rowsCuentaMes, setRowsCuentaMes] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(() => apiOnline);

  useEffect(() => {
    if (!apiOnline) {
      setRowsPropios([]);
      setRowsCuentaMes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const ej = ejercicioVigente();
    const mes = mesActualRango();

    const fetchPropios = fetchPresupuesto({
      solo_mios: user.rol === "admin" ? true : undefined,
      fecha_desde: ej.desde,
      fecha_hasta: ej.hasta,
    });

    const fetchCuentaMes = puedeVerCuentaMes
      ? fetchPresupuesto({
          ...(user.rol === "editor" ? { ver_todos: true as const } : {}),
          fecha_desde: mes.desde,
          fecha_hasta: mes.hasta,
        })
      : Promise.resolve([] as Presupuesto[]);

    void Promise.all([fetchPropios, fetchCuentaMes])
      .then(([propios, cuentaMes]) => {
        if (cancelled) return;
        setRowsPropios(propios);
        setRowsCuentaMes(cuentaMes);
      })
      .catch(() => {
        if (!cancelled) {
          setRowsPropios([]);
          setRowsCuentaMes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, user.id, user.email, user.rol, puedeVerCuentaMes]);

  const recientes = useMemo(
    () => ordenarPorIngreso(rowsPropios).slice(0, RECIENTES_LIMIT),
    [rowsPropios]
  );

  const stats = useMemo((): PresupuestoHubStats => {
    const delMesPropio = filtrarMesActual(rowsPropios);
    const ej = ejercicioVigente();
    const mesesEj = mesesTranscurridosEjercicio();
    const propioEjercicioCount = rowsPropios.length;
    return {
      cuentaMesCount: rowsCuentaMes.length,
      propioMesCount: delMesPropio.length,
      propioMesUsd: delMesPropio.reduce((s, r) => s + (Number(r.saldo_usd) || 0), 0),
      propioEjercicioUsd: rowsPropios.reduce((s, r) => s + (Number(r.saldo_usd) || 0), 0),
      propioEjercicioCount,
      propioPromedioMesDocs: propioEjercicioCount / mesesEj,
      mesesEjercicioTranscurridos: mesesEj,
      ejercicioLabel: ej.label,
    };
  }, [rowsPropios, rowsCuentaMes]);

  return { recientes, loading, stats, puedeVerCuentaMes };
}
