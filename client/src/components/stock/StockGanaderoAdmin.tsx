import { useCallback, useEffect, useState } from "react";
import {
  fetchStockGanaderaBackupInfo,
  fetchStockGanaderoResumen,
  restaurarStockGanaderaDesdeBackup,
  vaciarStockGanaderaCompleto,
} from "../../api";
import type { AuthUser } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { clearStockGanaderaPageCache } from "./stock-ganadera-page-cache";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

function formatFechaBackup(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StockGanaderoAdmin({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
}: Props) {
  const esAdmin = currentUser?.rol === "admin";
  const [loading, setLoading] = useState(false);
  const [vaciando, setVaciando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [backup, setBackup] = useState({
    disponible: false,
    creado_en: null as string | null,
    dispositivos: 0,
    lecturas: 0,
    historial: 0,
    vinculos_sim: 0,
  });
  const [resumen, setResumen] = useState({
    lotes: 0,
    registros: 0,
    dispositivos: 0,
    dispositivos_total: 0,
    ventas_dispositivos: 0,
  });

  const cargarResumen = useCallback(async () => {
    if (!apiOnline) {
      setResumen({
        lotes: 0,
        registros: 0,
        dispositivos: 0,
        dispositivos_total: 0,
        ventas_dispositivos: 0,
      });
      setBackup({
        disponible: false,
        creado_en: null,
        dispositivos: 0,
        lecturas: 0,
        historial: 0,
        vinculos_sim: 0,
      });
      return;
    }
    setLoading(true);
    try {
      const [data, backupInfo] = await Promise.all([
        fetchStockGanaderoResumen(),
        fetchStockGanaderaBackupInfo(),
      ]);
      setResumen(data);
      setBackup(backupInfo);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargarResumen();
  }, [cargarResumen]);

  const baseVacia = resumen.dispositivos_total === 0;

  const restaurarBase = async () => {
    if (!esAdmin || !backup.disponible || !baseVacia) return;
    const ok = await confirmAction({
      title: "Recuperar base eliminada",
      message: `¿Recuperar el respaldo automático con ${backup.dispositivos} dispositivo(s), ${backup.lecturas} lectura(s) y ${backup.historial} cambio(s) en historial? Se restaurará el stock tal como estaba antes del último borrado.`,
      confirmText: "Recuperar base",
      variant: "danger",
    });
    if (!ok) return;
    setRestaurando(true);
    try {
      const result = await restaurarStockGanaderaDesdeBackup();
      clearStockGanaderaPageCache();
      onSuccess(
        `Base recuperada: ${result.dispositivos_restaurados} dispositivo(s), ${result.lecturas_restauradas} lectura(s) y ${result.historial_restaurado} registro(s) de historial`
      );
      await cargarResumen();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al recuperar la base");
    } finally {
      setRestaurando(false);
    }
  };

  const vaciarBase = async () => {
    if (!esAdmin || resumen.dispositivos_total === 0) return;
    const ok1 = await confirmAction({
      title: "Vaciar base de Stock Ganadero",
      message: `¿Eliminar TODOS los ${resumen.dispositivos_total} dispositivo(s) del sistema (incluidas salidas: ventas, muertes y extraviados) junto con sus ${resumen.registros} lectura(s) e historial? También se desvincularán de las ventas del simulador. Esta acción no se puede deshacer.`,
      confirmText: "Continuar",
      variant: "danger",
    });
    if (!ok1) return;

    const ok2 = await confirmAction({
      title: "Confirmación final",
      message: `Última confirmación: se borrará por completo la base de Stock Ganadero (${resumen.dispositivos_total} dispositivo(s), ${resumen.registros} lectura(s), ${resumen.lotes} importación(es)). Para continuar, escribí ELIMINAR.`,
      confirmText: "Sí, eliminar toda la base",
      variant: "danger",
      requireText: "ELIMINAR",
      requireTextLabel: "Escribí ELIMINAR para confirmar el borrado",
    });
    if (!ok2) return;

    setVaciando(true);
    try {
      const result = await vaciarStockGanaderaCompleto();
      clearStockGanaderaPageCache();
      onSuccess(
        `Base vaciada: ${result.dispositivos_eliminados} dispositivo(s), ${result.lecturas_eliminadas} lectura(s) y ${result.vinculos_sim_venta} vínculo(s) con ventas eliminados. Podés recuperarla desde el respaldo automático.`
      );
      await cargarResumen();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al vaciar la base");
    } finally {
      setVaciando(false);
    }
  };

  return (
    <div className="stock-admin-workspace">
      {!esAdmin ? (
        <p className="stock-admin-denied sg-hub-panel" role="status">
          Solo los administradores pueden administrar la base de Stock Ganadero.
        </p>
      ) : (
        <div className="stock-admin-grid">
          <section
            className="stock-admin-card stock-admin-card--recover"
            aria-label="Recuperar base eliminada"
          >
            <header className="stock-admin-card-head">
              <p className="sg-hub-panel-kicker">Respaldo automático</p>
              <h3 className="stock-admin-card-title">Recuperar la Base</h3>
            </header>
            <p className="stock-admin-card-desc">
              Restaura dispositivos, lecturas e historial del{" "}
              <strong>último borrado total</strong>. Se usa el respaldo que se
              guarda antes de cada eliminación.
            </p>

            <div className="stock-admin-stats" role="list">
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Respaldo</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : backup.disponible ? "Disponible" : "—"}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Dispositivos</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : backup.dispositivos}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Lecturas</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : backup.lecturas}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Eliminado el</span>
                <strong className="stock-admin-stat-value stock-admin-stat-value--date">
                  {loading ? "…" : formatFechaBackup(backup.creado_en) || "—"}
                </strong>
              </div>
            </div>

            <footer className="stock-admin-card-foot">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !apiOnline ||
                  loading ||
                  restaurando ||
                  !backup.disponible ||
                  !baseVacia
                }
                onClick={() => void restaurarBase()}
              >
                {restaurando
                  ? "Recuperando…"
                  : `Recuperar base eliminada${
                      backup.disponible ? ` (${backup.dispositivos})` : ""
                    }`}
              </button>
              {!loading && !backup.disponible && (
                <p className="stock-admin-hint">
                  No hay respaldo automático disponible para recuperar.
                </p>
              )}
              {!loading && backup.disponible && !baseVacia && (
                <p className="stock-admin-hint">
                  Solo se puede recuperar cuando la base está vacía. Vaciá la
                  base actual o recuperá después de un borrado.
                </p>
              )}
            </footer>
          </section>

          <section
            className="stock-admin-card stock-admin-card--wipe"
            aria-label="Vaciar base de dispositivos"
          >
            <header className="stock-admin-card-head">
              <p className="sg-hub-panel-kicker">Operación destructiva</p>
              <h3 className="stock-admin-card-title">Base de dispositivos</h3>
            </header>
            <p className="stock-admin-card-desc">
              Elimina todos los dispositivos, lecturas, historial y vínculos con
              ventas. Antes de borrar se guarda un respaldo automático para
              poder recuperarla.
            </p>

            <div className="stock-admin-stats" role="list">
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Dispositivos (total)</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : resumen.dispositivos_total}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Activos</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : resumen.dispositivos}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Lecturas</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : resumen.registros}
                </strong>
              </div>
              <div className="stock-admin-stat" role="listitem">
                <span className="stock-admin-stat-label">Importaciones</span>
                <strong className="stock-admin-stat-value">
                  {loading ? "…" : resumen.lotes}
                </strong>
              </div>
            </div>

            <footer className="stock-admin-card-foot">
              <button
                type="button"
                className="btn btn-danger"
                disabled={
                  !apiOnline || loading || vaciando || resumen.dispositivos_total === 0
                }
                onClick={() => void vaciarBase()}
              >
                {vaciando ? "Eliminando Base…" : "Eliminar toda la Base"}
              </button>
              {resumen.dispositivos_total === 0 && !loading && (
                <p className="stock-admin-hint">La base ya está vacía.</p>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
