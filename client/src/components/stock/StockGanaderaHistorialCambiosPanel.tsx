import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockGanaderaDispositivoHistorial } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { StockGanaderaDispositivoHistorial } from "../../types";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import {
  agruparHistorialCambios,
  resumenHistorialCambios,
} from "./stock-historial-utils";

interface Props {
  clave: string;
  vid: string;
  eid: string;
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
}

function parseFechaHora(iso: string): { fecha: string; hora: string } | null {
  if (!iso) return null;
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return {
    fecha: d.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

function esValorVacio(valor: string): boolean {
  const t = valor.trim();
  return !t || t === "—" || t === "-";
}

export default function StockGanaderaHistorialCambiosPanel({
  clave,
  vid,
  eid,
  apiOnline,
  onVolver,
  volverLabel = "Volver",
  onError,
}: Props) {
  const [filas, setFilas] = useState<StockGanaderaDispositivoHistorial[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setFilas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockGanaderaDispositivoHistorial(clave);
      setFilas(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar historial");
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, clave, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const resumen = useMemo(() => resumenHistorialCambios(filas), [filas]);
  const grupos = useMemo(() => agruparHistorialCambios(filas), [filas]);

  const backDestination =
    volverLabel.replace(/^Volver al?\s+/i, "").trim() || "Stock Ganadero";
  useHeaderBackStep(true, onVolver, backDestination);

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel={volverLabel}
      title="Historial de cambios"
      description={
        <>
          Auditoría de ficha · VID {vid || "—"} · EID {eid || "—"} · Clave {clave || "—"}
        </>
      }
      cardClassName="subseccion-inline-card--hist"
      footer={
        <div className="stock-hist-page-foot">
          <p className="stock-hist-footer-note muted">
            Incluye empresa, sexo, nacimiento, edad, estado, bajas, guías, observaciones y
            condición por lecturas.
          </p>
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
        </div>
      }
    >
      <div className="stock-hist-inline">
        {loading ? (
          <div className="stock-hist-empty">
            <span className="stock-hist-empty-icon" aria-hidden>
              …
            </span>
            <p>Cargando historial…</p>
          </div>
        ) : !apiOnline ? (
          <div className="stock-hist-empty">
            <p>API no conectada</p>
          </div>
        ) : filas.length === 0 ? (
          <div className="stock-hist-empty">
            <span className="stock-hist-empty-icon" aria-hidden>
              ◷
            </span>
            <p>Todavía no hay cambios registrados en este dispositivo.</p>
            <p className="stock-hist-empty-hint">
              Las ediciones de ficha, importaciones de lecturas, bajas y ventas del simulador
              quedan registradas con fecha, usuario y detalle del cambio.
            </p>
          </div>
        ) : (
          <>
            <div className="stock-hist-summary stock-hist-summary--pro">
              <div className="stock-hist-summary-grid">
                <span className="stock-hist-summary-stat">
                  <strong>{resumen.totalCambios}</strong> cambio
                  {resumen.totalCambios === 1 ? "" : "s"}
                </span>
                <span className="stock-hist-summary-stat">
                  <strong>{resumen.totalSesiones}</strong>{" "}
                  {resumen.totalSesiones === 1 ? "sesión" : "sesiones"}
                </span>
                <span className="stock-hist-summary-stat">
                  <strong>{resumen.totalUsuarios}</strong>{" "}
                  {resumen.totalUsuarios === 1 ? "usuario" : "usuarios"}
                </span>
                <span className="stock-hist-summary-stat">
                  <strong>{resumen.totalCampos}</strong>{" "}
                  {resumen.totalCampos === 1 ? "campo" : "campos"} distintos
                </span>
              </div>
            </div>

            <ol className="stock-hist-timeline">
              {grupos.map((grupo, index) => {
                const dt = parseFechaHora(grupo.creado_en);
                return (
                  <li key={grupo.key} className="stock-hist-grupo">
                    <div className="stock-hist-grupo-rail" aria-hidden>
                      <span className="stock-hist-grupo-dot" />
                      {index < grupos.length - 1 && (
                        <span className="stock-hist-grupo-line" />
                      )}
                    </div>

                    <div className="stock-hist-grupo-card">
                      <header className="stock-hist-grupo-head">
                        <div className="stock-hist-grupo-head-main">
                          <time className="stock-hist-fecha" dateTime={grupo.creado_en}>
                            {dt ? (
                              <>
                                <span className="stock-hist-fecha-dia">{dt.fecha}</span>
                                <span className="stock-hist-fecha-hora">{dt.hora}</span>
                              </>
                            ) : (
                              grupo.creado_en
                            )}
                          </time>
                          <div className="stock-hist-grupo-meta">
                            <span className="stock-hist-user" title="Usuario">
                              <span className="stock-hist-user-icon" aria-hidden>
                                👤
                              </span>
                              {grupo.usuario}
                            </span>
                            <span
                              className={`stock-hist-origen stock-hist-origen--${(grupo.origen || "legacy").toLowerCase()}`}
                            >
                              {grupo.origenLabel}
                            </span>
                          </div>
                        </div>
                        <span className="stock-hist-grupo-badge">
                          {grupo.items.length}{" "}
                          {grupo.items.length === 1 ? "campo" : "campos"}
                        </span>
                      </header>

                      <ul className="stock-hist-cambios">
                        {grupo.items.map((item) => (
                          <li key={item.id} className="stock-hist-item">
                            <div className="stock-hist-item-head">
                              <span className="stock-hist-campo">{item.etiqueta}</span>
                              <span className="stock-hist-campo-meta">
                                #{item.id}
                                {item.campo ? ` · ${item.campo}` : ""}
                              </span>
                            </div>
                            <div className="stock-hist-diff">
                              <span
                                className={`stock-hist-valor stock-hist-valor--antes${
                                  esValorVacio(item.valor_anterior)
                                    ? " stock-hist-valor--vacio"
                                    : ""
                                }`}
                              >
                                {item.valor_anterior}
                              </span>
                              <span className="stock-hist-flecha" aria-hidden>
                                <svg viewBox="0 0 16 16" fill="none">
                                  <path
                                    d="M3 8h10M9 4l4 4-4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </span>
                              <span
                                className={`stock-hist-valor stock-hist-valor--despues${
                                  esValorVacio(item.valor_nuevo)
                                    ? " stock-hist-valor--vacio"
                                    : ""
                                }`}
                              >
                                {item.valor_nuevo}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </SubseccionInlinePanel>
  );
}
