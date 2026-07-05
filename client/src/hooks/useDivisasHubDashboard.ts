import { useEffect, useMemo, useState } from "react";
import { fetchDivisas } from "../api";
import { PAR_DIVISA_LABELS, type ParDivisa, type TipoCambio } from "../types";
import { fmtNum } from "../components/divisas/divisas-utils";

const NOVEDADES_LIMIT = 5;

export interface DivisaPromedioMes {
  mes: string;
  valor: number;
  dias: number;
  /** false cuando se usa el último mes con cotizaciones por falta de datos en el mes actual */
  esMesActual: boolean;
}

export interface DivisaPromedioAnual {
  anio: string;
  valor: number;
  dias: number;
}

export interface DivisaNovedad {
  id: number;
  par: ParDivisa;
  fecha: string;
  valor: number;
  creadoEn: string | null;
  titulo: string;
  subtitulo: string;
}

function mesActualYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function anioActual(): string {
  return String(new Date().getFullYear());
}

function promedioMesEn(rows: TipoCambio[], ym: string): Omit<DivisaPromedioMes, "esMesActual"> | null {
  const vals = rows.filter((r) => r.fecha.startsWith(ym));
  if (vals.length === 0) return null;
  const sum = vals.reduce((acc, r) => acc + r.valor, 0);
  return { mes: ym, valor: sum / vals.length, dias: vals.length };
}

function promedioMes(rows: TipoCambio[]): DivisaPromedioMes | null {
  const actual = promedioMesEn(rows, mesActualYm());
  if (actual) return { ...actual, esMesActual: true };

  const meses = [...new Set(rows.map((r) => r.fecha.slice(0, 7)))].sort().reverse();
  for (const ym of meses) {
    const fallback = promedioMesEn(rows, ym);
    if (fallback) return { ...fallback, esMesActual: false };
  }
  return null;
}

function promedioAnual(rows: TipoCambio[]): DivisaPromedioAnual | null {
  const anio = anioActual();
  const vals = rows.filter((r) => r.fecha.startsWith(anio));
  if (vals.length === 0) return null;
  const sum = vals.reduce((acc, r) => acc + r.valor, 0);
  return { anio, valor: sum / vals.length, dias: vals.length };
}

function tituloNovedad(row: TipoCambio): string {
  const parLabel = PAR_DIVISA_LABELS[row.par];
  return `${parLabel}: ${fmtNum(row.valor, 4)}`;
}

function buildNovedades(rows: TipoCambio[]): DivisaNovedad[] {
  return [...rows]
    .sort((a, b) => {
      const aTs = a.creado_en ?? `${a.fecha}T23:59:59`;
      const bTs = b.creado_en ?? `${b.fecha}T23:59:59`;
      if (bTs !== aTs) return bTs.localeCompare(aTs);
      return b.id - a.id;
    })
    .slice(0, NOVEDADES_LIMIT)
    .map((row) => ({
      id: row.id,
      par: row.par,
      fecha: row.fecha,
      valor: row.valor,
      creadoEn: row.creado_en ?? null,
      titulo: tituloNovedad(row),
      subtitulo: PAR_DIVISA_LABELS[row.par],
    }));
}

export function useDivisasHubDashboard(apiOnline: boolean) {
  const [rows, setRows] = useState<TipoCambio[]>([]);
  const [loading, setLoading] = useState(() => apiOnline);

  useEffect(() => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDivisas()
      .then((res) => {
        if (!cancelled) {
          setRows(res.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  const uyuRows = useMemo(() => rows.filter((r) => r.par === "UYU_USD"), [rows]);
  const brlRows = useMemo(() => rows.filter((r) => r.par === "BRL_USD"), [rows]);
  const promUyu = useMemo(() => promedioMes(uyuRows), [uyuRows]);
  const promBrl = useMemo(() => promedioMes(brlRows), [brlRows]);
  const promAnualUyu = useMemo(() => promedioAnual(uyuRows), [uyuRows]);
  const promAnualBrl = useMemo(() => promedioAnual(brlRows), [brlRows]);
  const novedades = useMemo(() => buildNovedades(rows), [rows]);

  return {
    loading,
    uyuRows,
    brlRows,
    promUyu,
    promBrl,
    promAnualUyu,
    promAnualBrl,
    novedades,
  };
}
