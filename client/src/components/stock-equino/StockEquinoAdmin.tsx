import { useCallback, useEffect, useState } from "react";
import {
  fetchStockEquinaBackupInfo,
  fetchStockEquinoResumen,
  restaurarStockEquinaDesdeBackup,
  vaciarStockEquinaCompleto,
} from "../../api";
import type { AuthUser } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { clearStockEquinaPageCache } from "./stock-equina-page-cache";

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

export default function StockEquinoAdmin({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onVolver,
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
        fetchStockEquinoResumen(),
        fetchStockEquinaBackupInfo(),
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
      const result = await restaurarStockEquinaDesdeBackup();
      clearStockEquinaPageCache();
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
      title: "Vaciar base de Stock Equino",
      message: `¿Eliminar TODOS los ${resumen.dispositivos_total} dispositivo(s) del sistema (incluidas salidas: ventas, muertes y extraviados) junto con sus ${resumen.registros} lectura(s) e historial? También se desvincularán de las ventas del simulador. Esta acción no se puede deshacer.`,
      confirmText: "Continuar",
      variant: "danger",
    });
    if (!ok1) return;

    const ok2 = await confirmAction({
      title: "Confirmación final",
      message: `Última confirmación: se borrará por completo la base de Stock Equino (${resumen.dispositivos_total} dispositivo(s), ${resumen.registros} lectura(s), ${resumen.lotes} importación(es)). Para continuar, escribí ELIMINAR.`,
      confirmText: "Sí, eliminar toda la base",
      variant: "danger",
      requireText: "ELIMINAR",
      requireTextLabel: "Escribí ELIMINAR para confirmar el borrado",
    });
    if (!ok2) return;

    setVaciando(true);
    try {
      const result = await vaciarStockEquinaCompleto();
      clearStockEquinaPageCache();
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
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Administración de Stock Equino</h2>
          <p className="muted">
            Herramientas de administración para la base de dispositivos EID.
          </p>
        </div>

        {!esAdmin ? (
          <p className="muted" role="status">
            Solo los administradores pueden administrar la base de Stock Equino.
          </p>
        ) : (
          <>
            <section
              className="stock-admin-revert"
              aria-label="Recuperar base eliminada"
            >
              <h3 className="stock-admin-revert-title">Recuperar la Base</h3>
              <p className="muted stock-admin-wipe-desc">
                Restaura todos los dispositivos, lecturas e historial que se
                eliminaron en el <strong>último borrado total</strong> de la base.
                Se usa el respaldo automático que se guarda antes de cada
                eliminación. Útil cuando se vació la base por error.
              </p>

              <dl className="stock-admin-stats">
                <div>
                  <dt>Respaldo</dt>
                  <dd>
                    {loading ? "…" : backup.disponible ? "Disponible" : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Dispositivos</dt>
                  <dd>{loading ? "…" : backup.dispositivos}</dd>
                </div>
                <div>
                  <dt>Lecturas</dt>
                  <dd>{loading ? "…" : backup.lecturas}</dd>
                </div>
                <div>
                  <dt>Eliminado el</dt>
                  <dd className="stock-admin-stat-fecha">
                    {loading
                      ? "…"
                      : formatFechaBackup(backup.creado_en) || "—"}
                  </dd>
                </div>
              </dl>

              <div className="stock-admin-actions">
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
                  <p className="muted stock-admin-empty">
                    No hay respaldo automático disponible para recuperar.
                  </p>
                )}
                {!loading && backup.disponible && !baseVacia && (
                  <p className="muted stock-admin-empty">
                    Solo se puede recuperar cuando la base está vacía. Vaciá la
                    base actual o recuperá después de un borrado.
                  </p>
                )}
              </div>
            </section>

            <section className="stock-admin-wipe" aria-label="Vaciar base de dispositivos">
              <h3 className="stock-admin-wipe-title">Base de dispositivos</h3>
              <p className="muted stock-admin-wipe-desc">
                Elimina por completo todos los dispositivos, lecturas importadas, historial de
                cambios y vínculos con el simulador de ventas. Antes de borrar se guarda un
                respaldo automático para poder recuperarla.
              </p>

              <dl className="stock-admin-stats">
                <div>
                  <dt>Dispositivos (total)</dt>
                  <dd>{loading ? "…" : resumen.dispositivos_total}</dd>
                </div>
                <div>
                  <dt>Activos</dt>
                  <dd>{loading ? "…" : resumen.dispositivos}</dd>
                </div>
                <div>
                  <dt>Lecturas</dt>
                  <dd>{loading ? "…" : resumen.registros}</dd>
                </div>
                <div>
                  <dt>Importaciones</dt>
                  <dd>{loading ? "…" : resumen.lotes}</dd>
                </div>
              </dl>

              <div className="stock-admin-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!apiOnline || loading || vaciando || resumen.dispositivos_total === 0}
                  onClick={() => void vaciarBase()}
                >
                  {vaciando ? "Eliminando Base…" : "Eliminar toda la Base"}
                </button>
                {resumen.dispositivos_total === 0 && !loading && (
                  <p className="muted stock-admin-empty">La base ya está vacía.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
