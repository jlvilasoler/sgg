import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockGanaderaDispositivoHistorial } from "../../api";
import type { StockGanaderaDispositivoHistorial } from "../../types";

interface Props {
  clave: string;
  vid: string;
  eid: string;
  apiOnline: boolean;
  onClose: () => void;
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

function agruparPorFecha(
  filas: StockGanaderaDispositivoHistorial[]
): { fecha: string; items: StockGanaderaDispositivoHistorial[] }[] {
  const map = new Map<string, StockGanaderaDispositivoHistorial[]>();
  for (const f of filas) {
    const key = f.creado_en;
    const prev = map.get(key);
    if (prev) prev.push(f);
    else map.set(key, [f]);
  }
  return [...map.entries()].map(([fecha, items]) => ({ fecha, items }));
}

export default function StockGanaderaHistorialCambiosModal({
  clave,
  vid,
  eid,
  apiOnline,
  onClose,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const grupos = useMemo(() => agruparPorFecha(filas), [filas]);

  return (
    <div
      className="stock-hist-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="stock-hist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-hist-cambios-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="stock-hist-head">
          <div className="stock-hist-head-main">
            <div className="stock-hist-head-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" className="stock-hist-head-icon-svg">
                <path
                  d="M12 8v4l3 2"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
                <path
                  d="M9 3.5h6"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="stock-hist-head-text">
              <p className="stock-hist-kicker">Auditoría de ficha</p>
              <h2 id="stock-hist-cambios-titulo">Historial de cambios</h2>
              <div className="stock-hist-ids">
                <span className="stock-hist-id-badge num">VID {vid || "—"}</span>
                <span className="stock-hist-id-badge num">EID {eid || "—"}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="stock-ganadera-editar-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="stock-hist-body">
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
              <p>
                Todavía no hay cambios registrados en este dispositivo.
              </p>
              <p className="stock-hist-empty-hint">
                Al guardar la ficha, cada modificación quedará registrada acá.
              </p>
            </div>
          ) : (
            <>
              <div className="stock-hist-summary">
                <span className="stock-hist-summary-stat">
                  <strong>{filas.length}</strong> cambio{filas.length === 1 ? "" : "s"}
                </span>
                <span className="stock-hist-summary-sep" aria-hidden>
                  ·
                </span>
                <span className="stock-hist-summary-stat">
                  <strong>{grupos.length}</strong>{" "}
                  {grupos.length === 1 ? "sesión" : "sesiones"} de edición
                </span>
              </div>

              <ol className="stock-hist-timeline">
                {grupos.map((grupo, index) => {
                  const dt = parseFechaHora(grupo.fecha);
                  return (
                    <li key={grupo.fecha} className="stock-hist-grupo">
                      <div className="stock-hist-grupo-rail" aria-hidden>
                        <span className="stock-hist-grupo-dot" />
                        {index < grupos.length - 1 && (
                          <span className="stock-hist-grupo-line" />
                        )}
                      </div>

                      <div className="stock-hist-grupo-card">
                        <header className="stock-hist-grupo-head">
                          <time className="stock-hist-fecha" dateTime={grupo.fecha}>
                            {dt ? (
                              <>
                                <span className="stock-hist-fecha-dia">{dt.fecha}</span>
                                <span className="stock-hist-fecha-hora">{dt.hora}</span>
                              </>
                            ) : (
                              grupo.fecha
                            )}
                          </time>
                          <span className="stock-hist-grupo-badge">
                            {grupo.items.length}{" "}
                            {grupo.items.length === 1 ? "campo" : "campos"}
                          </span>
                        </header>

                        <ul className="stock-hist-cambios">
                          {grupo.items.map((item) => (
                            <li key={item.id} className="stock-hist-item">
                              <span className="stock-hist-campo">{item.etiqueta}</span>
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

        <footer className="stock-hist-footer">
          <p className="stock-hist-footer-note">
            Registro automático al guardar la ficha del animal
          </p>
          <button type="button" className="btn btn-primary stock-hist-close-btn" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
