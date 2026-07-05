import { ArrowRight, FileText, Paperclip, Plus } from "lucide-react";
import type { Presupuesto } from "../../types";
import { fmtDate, fmtNum } from "../../utils/format";
import { formatFechaRelativa } from "../home/home-dashboard-format";
import { usePresupuestoHubDashboard } from "../../hooks/usePresupuestoHubDashboard";
import type { AuthUser } from "../../types";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import { PRESUPUESTO_HUB_ITEMS, type PresupuestoVista } from "./presupuesto-hub-items";
import { empresaCorta } from "../../utils";

interface Props {
  currentUser: AuthUser;
  apiOnline: boolean;
  onNavigate: (id: PresupuestoVista) => void;
  onEdit: (row: Presupuesto) => void;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPromedioDocs(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  }).format(rounded);
}

function tituloGasto(row: Presupuesto): string {
  const proveedor = row.razon_social_proveedor?.trim();
  const concepto = row.concepto?.trim();
  if (proveedor && concepto) return `${proveedor} · ${concepto}`;
  return proveedor || concepto || `Operación #${row.nro_registro}`;
}

export default function PresupuestoHubDashboard({
  currentUser,
  apiOnline,
  onNavigate,
  onEdit,
}: Props) {
  const { recientes, loading, stats, puedeVerCuentaMes } = usePresupuestoHubDashboard(
    currentUser,
    apiOnline
  );
  const ultimo = recientes[0];

  return (
    <div className="presupuesto-hub-dashboard">
      <section className="sg-hub-kpi-strip presupuesto-hub-kpi-strip" aria-label="Resumen del mes">
        {puedeVerCuentaMes ? (
          <SgHubKpi
            variant="dark"
            kicker="Toda la cuenta"
            value={loading || !apiOnline ? "—" : String(stats.cuentaMesCount)}
            hint="Documentos ingresados por el equipo en el mes calendario actual."
            trend={apiOnline && !loading ? "Mes en curso" : undefined}
            bars={<SgMiniBars highlight="last" />}
          />
        ) : null}
        <SgHubKpi
          variant={puedeVerCuentaMes ? "light" : "dark"}
          kicker="Tus documentos"
          value={loading || !apiOnline ? "—" : String(stats.propioMesCount)}
          hint="Gastos que ingresaste vos en el mes calendario actual."
          trend={apiOnline && !loading ? "Solo tus cargas" : undefined}
          bars={<SgMiniBars highlight={puedeVerCuentaMes ? "mid" : "last"} />}
        />
        <SgHubKpi
          kicker="Tu monto USD"
          value={loading || !apiOnline ? "—" : formatUsd(stats.propioMesUsd)}
          hint="Suma de saldo USD de tus gastos del mes."
          bars={<SgMiniBars />}
        />
      </section>

      <div className="presupuesto-hub-metric-row">
        <section
          className="sg-hub-panel presupuesto-hub-metric-panel presupuesto-hub-acumulado-panel"
          aria-label="Acumulado del ejercicio"
        >
          <div className="presupuesto-hub-acumulado-head">
            <div>
              <p className="sg-hub-panel-kicker">Tu ejercicio</p>
              <h2 className="sg-hub-panel-title">Acumulado del año en USD</h2>
              <p className="presupuesto-hub-acumulado-sub muted">
                Gastos que registraste vos en el ejercicio {stats.ejercicioLabel}.
              </p>
            </div>
            <div className="presupuesto-hub-acumulado-chart" aria-hidden>
              <SgMiniBars highlight="last" />
            </div>
          </div>
          <div className="presupuesto-hub-acumulado-body" aria-busy={loading}>
            {loading || !apiOnline ? (
              <>
                <div className="presupuesto-hub-acumulado-loading-pulse" aria-hidden />
                <p className="presupuesto-hub-acumulado-meta muted">Cargando…</p>
              </>
            ) : (
              <>
                <p className="presupuesto-hub-acumulado-value">
                  {formatUsd(stats.propioEjercicioUsd)}
                </p>
                <p className="presupuesto-hub-acumulado-meta">
                  {stats.propioEjercicioCount} documento
                  {stats.propioEjercicioCount === 1 ? "" : "s"} en el ejercicio
                </p>
              </>
            )}
          </div>
        </section>

        <section
          className="sg-hub-panel presupuesto-hub-metric-panel presupuesto-hub-promedio-panel"
          aria-label="Promedio mensual de documentos"
        >
          <div className="presupuesto-hub-acumulado-head">
            <div>
              <p className="sg-hub-panel-kicker">Tu ritmo</p>
              <h2 className="sg-hub-panel-title">Promedio por mes</h2>
              <p className="presupuesto-hub-acumulado-sub muted">
                Documentos que registraste por mes en el ejercicio ({stats.mesesEjercicioTranscurridos}{" "}
                {stats.mesesEjercicioTranscurridos === 1 ? "mes" : "meses"}).
              </p>
            </div>
            <div className="presupuesto-hub-acumulado-chart" aria-hidden>
              <SgMiniBars highlight="mid" />
            </div>
          </div>
          <div className="presupuesto-hub-acumulado-body" aria-busy={loading}>
            {loading || !apiOnline ? (
              <>
                <div className="presupuesto-hub-acumulado-loading-pulse" aria-hidden />
                <p className="presupuesto-hub-acumulado-meta muted">Cargando…</p>
              </>
            ) : (
              <>
                <p className="presupuesto-hub-acumulado-value">
                  {formatPromedioDocs(stats.propioPromedioMesDocs)}
                </p>
                <p className="presupuesto-hub-acumulado-meta">documentos / mes</p>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="presupuesto-hub-dashboard-panels sg-hub-panels">
        <SgHubModuleGrid
          items={PRESUPUESTO_HUB_ITEMS}
          onSelect={(id) => onNavigate(id as PresupuestoVista)}
          title="Secciones"
          kicker="Presupuesto y gastos"
          className="presupuesto-hub-dashboard-modules"
        />

        <section
          className="sg-hub-panel presupuesto-hub-recent-panel"
          aria-label="Tus últimos gastos ingresados"
        >
          <div className="sg-hub-panel-head presupuesto-hub-panel-head-row">
            <div>
              <p className="sg-hub-panel-kicker">Tu actividad</p>
              <h2 className="sg-hub-panel-title">Últimos documentos ingresados</h2>
            </div>
            <button
              type="button"
              className="presupuesto-hub-link"
              onClick={() => onNavigate("listado")}
            >
              Ver presupuesto
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>

          {loading && recientes.length === 0 ? (
            <ul className="presupuesto-hub-recent-skeleton-list" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={`pres-skel-${i}`}>
                  <div className="presupuesto-hub-recent-skeleton-row" aria-hidden>
                    <span className="presupuesto-hub-recent-skeleton-icon" />
                    <span className="presupuesto-hub-recent-skeleton-lines">
                      <span />
                      <span />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : recientes.length === 0 ? (
            <div className="presupuesto-hub-recent-empty">
              <p className="presupuesto-hub-recent-empty-text">
                Todavía no ingresaste gastos en este ejercicio. Cuando cargues documentos, aparecerán
                acá para que veas lo nuevo de un vistazo.
              </p>
              <button
                type="button"
                className="sg-hub-cta presupuesto-hub-recent-cta"
                onClick={() => onNavigate("registro")}
              >
                <Plus size={16} aria-hidden />
                Ingresar gasto
              </button>
            </div>
          ) : (
            <ul className="presupuesto-hub-recent-list">
              {recientes.map((row, index) => {
                const esUltimo = index === 0;
                const tieneDoc = Boolean(row.documento_adjunto?.nombre?.trim());
                const ingresoTs = row.creado_en ?? row.fecha;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`presupuesto-hub-recent-item${esUltimo ? " presupuesto-hub-recent-item--latest" : ""}`}
                      onClick={() => onEdit(row)}
                    >
                      <span className="presupuesto-hub-recent-icon" aria-hidden>
                        {tieneDoc ? <Paperclip size={15} /> : <FileText size={15} />}
                      </span>
                      <span className="presupuesto-hub-recent-body">
                        <span className="presupuesto-hub-recent-top">
                          <span className="presupuesto-hub-recent-title">{tituloGasto(row)}</span>
                          {esUltimo ? (
                            <span className="presupuesto-hub-recent-badge">Último ingreso</span>
                          ) : null}
                        </span>
                        <span className="presupuesto-hub-recent-meta">
                          {empresaCorta(row.empresa)} · {row.rubro || "Sin rubro"} · Op.{" "}
                          {row.nro_registro}
                        </span>
                        <span className="presupuesto-hub-recent-foot">
                          <span>
                            {fmtDate(row.fecha)}
                            {ingresoTs && row.creado_en
                              ? ` · ${formatFechaRelativa(row.creado_en)}`
                              : ""}
                          </span>
                          <span className="presupuesto-hub-recent-usd">
                            USD {fmtNum(row.saldo_usd, 2)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {ultimo && !loading ? (
            <p className="presupuesto-hub-recent-hint muted">
              El más reciente es la operación #{ultimo.nro_registro}
              {ultimo.documento_adjunto?.nombre
                ? ` con «${ultimo.documento_adjunto.nombre}»`
                : ""}
              . Tocá una fila para editarla.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
