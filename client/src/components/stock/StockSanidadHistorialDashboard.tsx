import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Syringe,
  UserRoundX,
  Users,
} from "lucide-react";
import { fetchStockControlSanitarioResumen, type EmpresaOperativaStock } from "../../api";
import type { StockControlSanitarioResumen, StockControlSanitarioResumenItem } from "../../types";
import { StockControlSanitarioIconSvg } from "./StockControlSanitarioSectionTitle";
import StockSanidadMovimientoDetalleModal from "./StockSanidadMovimientoDetalleModal";

interface Props {
  apiOnline: boolean;
  claves: string[];
  refreshKey?: number;
  empresasOperativas?: EmpresaOperativaStock[];
  onError?: (msg: string) => void;
  modulo?: "ganadero" | "equino";
}

function fmtIsoDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtPeriodoRegistro(r: {
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
}): string {
  const nota = r.admin_periodo_nota.trim();
  if (nota) return nota;
  const ini = r.admin_fecha_inicio.trim();
  const fin = r.admin_fecha_fin.trim();
  if (ini && fin) return `${fmtIsoDate(ini)} – ${fmtIsoDate(fin)}`;
  if (ini) return `Desde ${fmtIsoDate(ini)}`;
  if (fin) return `Hasta ${fmtIsoDate(fin)}`;
  return "";
}

function fmtCreadoEn(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function maxFrecuencia(items: { cantidad: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(1, ...items.map((i) => i.cantidad));
}

const TIMELINE_PAGE_SIZE = 4;

export default function StockSanidadHistorialDashboard({
  apiOnline,
  claves,
  refreshKey = 0,
  empresasOperativas = [],
  onError,
  modulo = "ganadero",
}: Props) {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const [resumen, setResumen] = useState<StockControlSanitarioResumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [timelinePage, setTimelinePage] = useState(0);
  const [movimientoDetalle, setMovimientoDetalle] =
    useState<StockControlSanitarioResumenItem | null>(null);

  const clavesKey = useMemo(() => [...claves].sort().join(","), [claves]);

  useEffect(() => {
    setTimelinePage(0);
  }, [clavesKey, refreshKey]);

  useEffect(() => {
    if (!apiOnline || claves.length === 0) {
      setResumen(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      void fetchStockControlSanitarioResumen(modulo, claves)
        .then((data) => {
          if (!cancelled) setResumen(data);
        })
        .catch((e) => {
          if (!cancelled) {
            setResumen(null);
            onErrorRef.current?.(
              e instanceof Error ? e.message : "Error al cargar historial sanitario"
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, clavesKey, refreshKey, claves.length]);

  const consultados = resumen?.dispositivos_consultados ?? claves.length;
  const maxProductos = maxFrecuencia(resumen?.productos_frecuentes ?? []);
  const maxMotivos = maxFrecuencia(resumen?.motivos_frecuentes ?? []);
  const promedio =
    resumen && consultados > 0
      ? (resumen.total_registros / consultados).toFixed(1)
      : "0";

  const ultimosRegistros = resumen?.ultimos_registros ?? [];
  const timelineTotalPages = Math.max(1, Math.ceil(ultimosRegistros.length / TIMELINE_PAGE_SIZE));
  const timelinePageSafe = Math.min(timelinePage, timelineTotalPages - 1);
  const timelineCanScroll = ultimosRegistros.length > TIMELINE_PAGE_SIZE;
  const timelineRangeStart =
    ultimosRegistros.length === 0 ? 0 : timelinePageSafe * TIMELINE_PAGE_SIZE + 1;
  const timelineRangeEnd = Math.min(
    ultimosRegistros.length,
    (timelinePageSafe + 1) * TIMELINE_PAGE_SIZE
  );
  const timelineCompact = ultimosRegistros.length <= 2;
  const tieneFrecuencias =
    (resumen?.productos_frecuentes.length ?? 0) > 0 ||
    (resumen?.motivos_frecuentes.length ?? 0) > 0;

  if (claves.length === 0) {
    return (
      <aside className="stock-sanidad-dash stock-sanidad-dash--band" aria-label="Resumen sanitario">
        <div className="stock-sanidad-dash-empty">
          <span className="stock-sanidad-dash-empty-icon" aria-hidden>
            <StockControlSanitarioIconSvg icon="historial" size={22} />
          </span>
          <div className="stock-sanidad-dash-empty-copy">
            <p className="stock-sanidad-dash-empty-title">Historial sanitario</p>
            <p className="muted stock-sanidad-dash-empty-text">
              Seleccioná uno o más animales para ver cuántos controles tienen y un resumen de
              productos aplicados.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="stock-sanidad-dash stock-sanidad-dash--band" aria-label="Resumen sanitario">
      <header className="stock-sanidad-dash-head">
        <span className="stock-sanidad-dash-head-icon" aria-hidden>
          <StockControlSanitarioIconSvg icon="historial" size={18} />
        </span>
        <div className="stock-sanidad-dash-head-copy">
          <h4 className="stock-sanidad-dash-title">Historial del grupo</h4>
          <p className="stock-sanidad-dash-sub muted">
            {claves.length} animal{claves.length === 1 ? "" : "es"} en la selección
            {resumen && resumen.total_registros > 0 ? (
              <>
                {" "}
                · {resumen.total_registros} movimiento{resumen.total_registros === 1 ? "" : "s"}
              </>
            ) : null}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="stock-sanidad-dash-loading-wrap" aria-busy="true">
          <div className="stock-sanidad-dash-loading-skeleton">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="muted stock-sanidad-dash-loading">Cargando historial…</p>
        </div>
      ) : !resumen || resumen.total_registros === 0 ? (
        <div className="stock-sanidad-dash-sin-historial">
          <p>
            <strong>Sin registros sanitarios</strong> en la selección actual.
          </p>
          <p className="muted">
            {consultados} animal{consultados === 1 ? "" : "es"} sin movimientos cargados aún.
          </p>
        </div>
      ) : (
        <div className="stock-sanidad-dash-body">
          {resumen.dispositivos_sin_historial > 0 ? (
            <p className="stock-sanidad-dash-alert muted" role="status">
              {resumen.dispositivos_sin_historial} animal
              {resumen.dispositivos_sin_historial === 1 ? "" : "es"} de la selección aún no tiene
              {resumen.dispositivos_sin_historial === 1 ? "" : "n"} registros sanitarios.
            </p>
          ) : null}

          <div className="stock-sanidad-dash-kpis">
            <div className="stock-sanidad-dash-kpi">
              <span className="stock-sanidad-dash-kpi-icon" aria-hidden>
                <ClipboardList size={17} />
              </span>
              <div className="stock-sanidad-dash-kpi-text">
                <strong>{resumen.total_registros}</strong>
                <span>movimientos</span>
              </div>
            </div>
            <div className="stock-sanidad-dash-kpi">
              <span className="stock-sanidad-dash-kpi-icon" aria-hidden>
                <Users size={17} />
              </span>
              <div className="stock-sanidad-dash-kpi-text">
                <strong>{resumen.dispositivos_con_historial}</strong>
                <span>con historial</span>
              </div>
            </div>
            <div className="stock-sanidad-dash-kpi">
              <span className="stock-sanidad-dash-kpi-icon" aria-hidden>
                <Activity size={17} />
              </span>
              <div className="stock-sanidad-dash-kpi-text">
                <strong>{promedio}</strong>
                <span>prom. / selección</span>
              </div>
            </div>
            <div
              className={`stock-sanidad-dash-kpi${
                resumen.dispositivos_sin_historial > 0 ? " stock-sanidad-dash-kpi--muted" : ""
              }`}
            >
              <span className="stock-sanidad-dash-kpi-icon" aria-hidden>
                <UserRoundX size={17} />
              </span>
              <div className="stock-sanidad-dash-kpi-text">
                <strong>{resumen.dispositivos_sin_historial}</strong>
                <span>sin historial</span>
              </div>
            </div>
          </div>

          <div
            className={`stock-sanidad-dash-main${
              !tieneFrecuencias ? " stock-sanidad-dash-main--solo-timeline" : ""
            }`}
          >
            {tieneFrecuencias ? (
              <div className="stock-sanidad-dash-freq-col">
                {resumen.productos_frecuentes.length > 0 && (
                  <section className="stock-sanidad-dash-block">
                    <h5 className="stock-sanidad-dash-block-title">
                      <Syringe size={14} aria-hidden />
                      Productos más usados
                    </h5>
                    <ul className="stock-sanidad-dash-bars">
                      {resumen.productos_frecuentes.map((p) => (
                        <li key={p.etiqueta}>
                          <div className="stock-sanidad-dash-bar-head">
                            <span className="stock-sanidad-dash-bar-label" title={p.etiqueta}>
                              {p.etiqueta}
                            </span>
                            <span className="stock-sanidad-dash-bar-count">{p.cantidad}</span>
                          </div>
                          <div className="stock-sanidad-dash-bar-track">
                            <span
                              className="stock-sanidad-dash-bar-fill stock-sanidad-dash-bar-fill--producto"
                              style={{
                                width: `${Math.round((p.cantidad / maxProductos) * 100)}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {resumen.motivos_frecuentes.length > 0 && (
                  <section className="stock-sanidad-dash-block">
                    <h5 className="stock-sanidad-dash-block-title">
                      <ClipboardList size={14} aria-hidden />
                      Motivos frecuentes
                    </h5>
                    <ul className="stock-sanidad-dash-bars">
                      {resumen.motivos_frecuentes.map((m) => (
                        <li key={m.etiqueta}>
                          <div className="stock-sanidad-dash-bar-head">
                            <span className="stock-sanidad-dash-bar-label" title={m.etiqueta}>
                              {m.etiqueta}
                            </span>
                            <span className="stock-sanidad-dash-bar-count">{m.cantidad}</span>
                          </div>
                          <div className="stock-sanidad-dash-bar-track">
                            <span
                              className="stock-sanidad-dash-bar-fill stock-sanidad-dash-bar-fill--motivo"
                              style={{ width: `${Math.round((m.cantidad / maxMotivos) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ) : null}

            {ultimosRegistros.length > 0 ? (
              <div className="stock-sanidad-dash-timeline-col">
                <section className="stock-sanidad-dash-block stock-sanidad-dash-block--timeline">
                  <div className="stock-sanidad-dash-timeline-head">
                    <h5 className="stock-sanidad-dash-block-title">Últimos movimientos</h5>
                    {timelineCanScroll ? (
                      <span className="stock-sanidad-dash-timeline-range muted">
                        {timelineRangeStart}–{timelineRangeEnd} de {ultimosRegistros.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="stock-sanidad-dash-timeline-carousel">
                    {timelineCanScroll ? (
                      <button
                        type="button"
                        className="stock-sanidad-dash-timeline-nav-btn"
                        disabled={timelinePageSafe <= 0}
                        aria-label="Movimientos anteriores"
                        onClick={() => setTimelinePage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronUp size={18} aria-hidden />
                      </button>
                    ) : null}
                    <div
                      className={`stock-sanidad-dash-timeline-viewport${
                        timelineCompact ? " stock-sanidad-dash-timeline-viewport--compact" : ""
                      }`}
                    >
                      <div
                        className="stock-sanidad-dash-timeline-track"
                        style={{ ["--timeline-page" as string]: timelinePageSafe }}
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {Array.from({ length: timelineTotalPages }, (_, pageIdx) => {
                          const pageItems = ultimosRegistros.slice(
                            pageIdx * TIMELINE_PAGE_SIZE,
                            pageIdx * TIMELINE_PAGE_SIZE + TIMELINE_PAGE_SIZE
                          );
                          return (
                            <ul
                              key={pageIdx}
                              className="stock-sanidad-dash-timeline stock-sanidad-dash-timeline--carousel stock-sanidad-dash-timeline-page"
                              aria-hidden={pageIdx !== timelinePageSafe}
                            >
                              {pageItems.map((r) => {
                                const periodo = fmtPeriodoRegistro(r);
                                return (
                                  <li
                                    key={`${r.id}-${r.clave}`}
                                    className="stock-sanidad-dash-timeline-item"
                                  >
                                    <button
                                      type="button"
                                      className="stock-sanidad-dash-timeline-card-btn"
                                      title="Ver detalle del movimiento"
                                      onClick={() => setMovimientoDetalle(r)}
                                    >
                                      <article className="stock-sanidad-dash-timeline-card">
                                        <div className="stock-sanidad-dash-timeline-top">
                                          <strong title={r.producto_nombre}>
                                            {r.producto_nombre || "Producto"}
                                          </strong>
                                          <time dateTime={r.creado_en}>
                                            {fmtCreadoEn(r.creado_en)}
                                          </time>
                                        </div>
                                        <p className="stock-sanidad-dash-timeline-id">
                                          {r.animal_id || r.clave}
                                        </p>
                                        {r.control_motivo.trim() ? (
                                          <p className="stock-sanidad-dash-timeline-motivo">
                                            {r.control_motivo}
                                          </p>
                                        ) : null}
                                        {periodo ? (
                                          <p className="stock-sanidad-dash-timeline-periodo">
                                            {periodo}
                                          </p>
                                        ) : null}
                                      </article>
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })}
                      </div>
                    </div>
                    {timelineCanScroll ? (
                      <button
                        type="button"
                        className="stock-sanidad-dash-timeline-nav-btn"
                        disabled={timelinePageSafe >= timelineTotalPages - 1}
                        aria-label="Movimientos siguientes"
                        onClick={() =>
                          setTimelinePage((p) => Math.min(timelineTotalPages - 1, p + 1))
                        }
                      >
                        <ChevronDown size={18} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
      <StockSanidadMovimientoDetalleModal
        open={movimientoDetalle != null}
        item={movimientoDetalle}
        apiOnline={apiOnline}
        empresasOperativas={empresasOperativas}
        onClose={() => setMovimientoDetalle(null)}
        onError={onError}
      />
    </aside>
  );
}

