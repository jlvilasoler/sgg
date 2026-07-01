import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSimuladorVentaAuditoria } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type {
  SimuladorVentaAuditoriaRow,
  SimuladorVentaAuditoriaTipo,
  SimuladorVentaOperacionSnapshot,
} from "../../types";
import SubseccionInlinePanel from "../SubseccionInlinePanel";
import { fmtDate, fmtNum } from "../divisas/divisas-utils";
import { fmtUsd } from "./simulador-venta-real-utils";
import {
  labelCampoAuditoria,
  SIM_AUDIT_TIPO_LABELS,
} from "./simulador-venta-audit-labels";
import type { SimuladorVentaTipoConfig } from "./simulador-venta-config";

interface Props {
  simulacionId: number;
  numeroOperacion: string;
  config: SimuladorVentaTipoConfig;
  apiOnline: boolean;
  onVolver: () => void;
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

function userInitials(nombre: string): string {
  const clean = nombre.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function tipoClass(tipo: SimuladorVentaAuditoriaTipo): string {
  return tipo.toLowerCase().replace(/_/g, "-");
}

function fmtValor(campo: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (campo.includes("total_usd") && typeof value === "number") return fmtUsd(value);
  if (campo.includes("precio_usd_kg") && typeof value === "number") return fmtNum(value, 2);
  if (
    (campo.includes("kg") || campo.includes("animales")) &&
    typeof value === "number"
  ) {
    return campo.includes("animales") ? fmtNum(value, 0) : fmtNum(value, 1);
  }
  if (campo.includes("fecha") || campo.includes("creado_en")) {
    return fmtDate(String(value));
  }
  return String(value);
}

function getCampoValor(snap: SimuladorVentaOperacionSnapshot, campo: string): unknown {
  if (campo === "categoria") return snap.categoria;
  if (campo === "tipo") return snap.tipo;
  if (campo === "destacada") return snap.destacada;
  if (campo.startsWith("simulacion.")) {
    const key = campo.slice("simulacion.".length) as keyof SimuladorVentaOperacionSnapshot["simulacion"];
    return snap.simulacion[key];
  }
  if (campo.startsWith("venta_real.")) {
    const key = campo.slice("venta_real.".length);
    if (key === "venta_realizada_en") return snap.venta_real?.venta_realizada_en;
    return snap.venta_real?.[key as keyof NonNullable<typeof snap.venta_real>];
  }
  if (campo === "venta_real") return snap.venta_real ? "Registrada" : "—";
  return undefined;
}

function Metric({ label, value, hero = false }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className={`sim-audit-metric${hero ? " sim-audit-metric--hero" : ""}`}>
      <span className="sim-audit-metric-k">{label}</span>
      <span className="sim-audit-metric-v num">{value}</span>
    </div>
  );
}

function SnapshotBlock({
  snap,
  config,
  title,
}: {
  snap: SimuladorVentaOperacionSnapshot;
  config: SimuladorVentaTipoConfig;
  title: string;
}) {
  const catLabel = config.labels[snap.categoria as keyof typeof config.labels] ?? snap.categoria;
  const hasReal = snap.venta_real?.total_usd != null;

  return (
    <div className="sim-audit-snapshot">
      <h4 className="sim-audit-snapshot-title">{title}</h4>
      <div className={`sim-audit-snapshot-panels${hasReal ? " sim-audit-snapshot-panels--dual" : ""}`}>
        <div className="sim-audit-snapshot-panel sim-audit-snapshot-panel--sim">
          <span className="sim-audit-snapshot-panel-tag">Simulación</span>
          <div className="sim-audit-snapshot-grid">
            <Metric label="Categoría" value={catLabel} />
            <Metric
              label="Cabezas"
              value={
                snap.simulacion.cantidad_animales != null
                  ? fmtNum(snap.simulacion.cantidad_animales, 0)
                  : "—"
              }
            />
            <Metric label="Kg" value={fmtNum(snap.simulacion.kg_total, 1)} />
            <Metric label="USD/kg" value={fmtNum(snap.simulacion.precio_usd_kg, 2)} />
            <Metric label="Total USD" value={fmtUsd(snap.simulacion.total_usd)} hero />
          </div>
          {snap.simulacion.notas && (
            <p className="sim-audit-snapshot-notas">
              <span>Notas</span> {snap.simulacion.notas}
            </p>
          )}
        </div>
        {hasReal && (
          <div className="sim-audit-snapshot-panel sim-audit-snapshot-panel--real">
            <span className="sim-audit-snapshot-panel-tag">Venta real</span>
            <div className="sim-audit-snapshot-grid">
              <Metric
                label="Cabezas"
                value={
                  snap.venta_real!.cantidad_animales != null
                    ? fmtNum(snap.venta_real!.cantidad_animales, 0)
                    : "—"
                }
              />
              <Metric
                label="Kg"
                value={
                  snap.venta_real!.kg_total != null ? fmtNum(snap.venta_real!.kg_total, 1) : "—"
                }
              />
              <Metric
                label="USD/kg"
                value={
                  snap.venta_real!.precio_usd_kg != null
                    ? fmtNum(snap.venta_real!.precio_usd_kg, 2)
                    : "—"
                }
              />
              <Metric label="Total USD" value={fmtUsd(snap.venta_real!.total_usd!)} hero />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventoCard({
  evento,
  config,
  tipoLabel,
  isLast,
}: {
  evento: SimuladorVentaAuditoriaRow;
  config: SimuladorVentaTipoConfig;
  tipoLabel: string;
  isLast: boolean;
}) {
  const det = evento.detalle;
  const cambios = det?.cambios ?? [];
  const dt = parseFechaHora(evento.creado_en);
  const userName = evento.user_nombre?.trim() || "Sistema";

  return (
    <li className={`sim-audit-event${isLast ? " sim-audit-event--last" : ""}`}>
      <div className="sim-audit-event-rail" aria-hidden>
        <span className={`sim-audit-event-dot sim-audit-event-dot--${tipoClass(evento.tipo)}`} />
        {!isLast && <span className="sim-audit-event-line" />}
      </div>
      <article className={`sim-audit-event-card sim-audit-event-card--${tipoClass(evento.tipo)}`}>
        <header className="sim-audit-event-head">
          <div className="sim-audit-event-head-main">
            <span className={`sim-audit-tipo sim-audit-tipo--${tipoClass(evento.tipo)}`}>
              {tipoLabel}
            </span>
            <p className="sim-audit-resumen">{evento.resumen}</p>
          </div>
          <time className="sim-audit-fecha" dateTime={evento.creado_en}>
            {dt ? (
              <>
                <span className="sim-audit-fecha-dia">{dt.fecha}</span>
                <span className="sim-audit-fecha-hora">{dt.hora}</span>
              </>
            ) : (
              evento.creado_en
            )}
          </time>
        </header>

        <div className="sim-audit-user-row">
          <span className="sim-audit-user-avatar" aria-hidden>
            {userInitials(userName)}
          </span>
          <div className="sim-audit-user-meta">
            <span className="sim-audit-user-name">{userName}</span>
            {evento.user_email && (
              <span className="sim-audit-user-email">{evento.user_email}</span>
            )}
          </div>
        </div>

        {cambios.length > 0 && det?.antes && det?.despues && (
          <ul className="sim-audit-cambios">
            {cambios.map((campo) => (
              <li key={campo} className="sim-audit-cambio">
                <span className="sim-audit-cambio-campo">{labelCampoAuditoria(campo)}</span>
                <div className="sim-audit-diff">
                  <span className="sim-audit-val sim-audit-val--antes">
                    {fmtValor(campo, getCampoValor(det.antes!, campo))}
                  </span>
                  <span className="sim-audit-diff-arrow" aria-hidden>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path
                        d="M3 8h10M9 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="sim-audit-val sim-audit-val--despues">
                    {fmtValor(campo, getCampoValor(det.despues!, campo))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {det?.despues && evento.tipo === "CREAR" && (
          <SnapshotBlock snap={det.despues} config={config} title="Datos iniciales" />
        )}

        {det?.antes && evento.tipo === "ELIMINAR" && (
          <SnapshotBlock snap={det.antes} config={config} title="Último estado" />
        )}

        {(evento.tipo === "VENTA_REAL_REGISTRADA" ||
          evento.tipo === "VENTA_REAL_ACTUALIZADA") &&
          det?.despues && (
            <SnapshotBlock snap={det.despues} config={config} title="Estado registrado" />
          )}
      </article>
    </li>
  );
}

export default function SimuladorVentaAuditoriaPanel({
  simulacionId,
  numeroOperacion,
  config,
  apiOnline,
  onVolver,
  onError,
}: Props) {
  useHeaderBackStep(true, onVolver, "Simulador de ventas");
  const [filas, setFilas] = useState<SimuladorVentaAuditoriaRow[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>(SIM_AUDIT_TIPO_LABELS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setFilas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchSimuladorVentaAuditoria(simulacionId, 100);
      setFilas(res.data);
      setLabels({ ...SIM_AUDIT_TIPO_LABELS, ...res.labels });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar historial");
      setFilas([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError, simulacionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const simInicial = useMemo(() => {
    const creacion = [...filas].reverse().find((f) => f.tipo === "CREAR");
    return creacion?.detalle?.despues?.simulacion ?? null;
  }, [filas]);

  const opCode = numeroOperacion || `#${simulacionId}`;

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel="Volver al simulador"
      icon={{ source: "app", id: "simulador_venta_ganado" }}
      title="Historial de cambios"
      description={
        <>
          Auditoría de operación · <span className="num">{opCode}</span>
        </>
      }
      cardClassName="subseccion-inline-card--hist sim-audit-page"
      footer={
        <div className="stock-hist-page-foot">
          <p className="stock-hist-footer-note muted">
            Las ediciones, ventas cerradas, cancelaciones y cambios de estado quedan
            archivados con fecha, usuario y detalle.
          </p>
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
        </div>
      }
    >
      <div className="sim-audit-page-content">
        {loading ? (
          <div className="sim-audit-state">
            <span className="sim-audit-spinner" aria-hidden />
            <p>Cargando historial…</p>
          </div>
        ) : !apiOnline ? (
          <div className="sim-audit-state">
            <span className="sim-audit-state-icon" aria-hidden>
              ⚡
            </span>
            <p>API no conectada</p>
          </div>
        ) : filas.length === 0 ? (
          <div className="sim-audit-state">
            <span className="sim-audit-state-icon" aria-hidden>
              ◷
            </span>
            <p>Sin cambios registrados</p>
            <span className="sim-audit-state-hint">
              Las ediciones, ventas cerradas y cancelaciones quedan archivadas acá.
            </span>
          </div>
        ) : (
          <>
            {simInicial && (
              <div className="sim-audit-archivo">
                <div className="sim-audit-archivo-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                    <path
                      d="M5 4h8l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 4v4h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="sim-audit-archivo-text">
                  <strong>Simulación original archivada</strong>
                  <span className="sim-audit-archivo-detail num">
                    {simInicial.cantidad_animales != null
                      ? `${fmtNum(simInicial.cantidad_animales, 0)} cab. · `
                      : ""}
                    {fmtNum(simInicial.kg_total, 1)} kg · {fmtUsd(simInicial.total_usd)}
                  </span>
                </div>
              </div>
            )}

            <div className="sim-audit-stats">
              <span className="sim-audit-stat">
                <strong>{filas.length}</strong>
                {filas.length === 1 ? " evento" : " eventos"}
              </span>
              <span className="sim-audit-stat-sep" aria-hidden>
                ·
              </span>
              <span className="sim-audit-stat">{opCode}</span>
            </div>

            <ol className="sim-audit-timeline">
              {filas.map((evento, index) => (
                <EventoCard
                  key={evento.id}
                  evento={evento}
                  config={config}
                  tipoLabel={labels[evento.tipo] ?? evento.tipo}
                  isLast={index === filas.length - 1}
                />
              ))}
            </ol>
          </>
        )}
      </div>
    </SubseccionInlinePanel>
  );
}

/** @deprecated Usar SimuladorVentaAuditoriaPanel */
export { SimuladorVentaAuditoriaPanel as SimuladorVentaAuditoriaModal };
