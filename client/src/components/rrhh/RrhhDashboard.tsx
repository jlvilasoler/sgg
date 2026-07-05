import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Banknote, UserRound } from "lucide-react";
import { fetchRrhhDashboard } from "../../api";
import type { RrhhDashboardData } from "../../types";
import { fmtDate, fmtNum } from "../../utils";
import { ejercicioVigente, labelEjercicio } from "../../utils/ejercicio-contable";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import { RRHH_HUB_ITEMS } from "./rrhh-hub-items";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onNavigate: (id: string) => void;
  onVerPago?: (cedula: string) => void;
  onEditGasto?: (id: number) => void;
}

const EJERCICIO = ejercicioVigente();

function formatNombreDisplay(nombre: string | null | undefined): string {
  if (!nombre?.trim()) return "Sin funcionario";
  return nombre
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function conceptoLabel(concepto: string): string {
  const t = concepto.trim();
  return t || "Sueldo";
}

export default function RrhhDashboard({
  apiOnline,
  onError,
  onNavigate,
  onVerPago,
  onEditGasto,
}: Props) {
  const [data, setData] = useState<RrhhDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const dash = await fetchRrhhDashboard({
        fecha_desde: EJERCICIO.desde,
        fecha_hasta: EJERCICIO.hasta,
      });
      setData(dash);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar resumen de RRHH");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const periodoLabel = labelEjercicio(EJERCICIO.anioInicio);
  const pagos = data?.pagos_periodo;
  const ultimos = data?.ultimos_pagos ?? [];

  return (
    <div className="rrhh-hub-workspace">
      <p className="rrhh-dash-periodo muted" role="status">
        {loading
          ? "Actualizando resumen…"
          : !apiOnline
            ? "Sin conexión con la API"
            : `Resumen del ejercicio ${periodoLabel}`}
      </p>

      <div className="sg-hub-kpi-strip rrhh-dash-kpi-strip" aria-label="Indicadores de personal">
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Funcionarios activos</p>
          <p className="sg-hub-kpi-value">
            {loading || !data ? "—" : fmtNum(data.funcionarios_activos, 0)}
          </p>
          <p className="sg-hub-kpi-hint">
            {data
              ? `${fmtNum(data.funcionarios_total, 0)} en total · ${fmtNum(data.funcionarios_inactivos, 0)} inactivos`
              : "Personal registrado en el sistema"}
          </p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Pagos de sueldos</p>
          <p className="sg-hub-kpi-value">
            {loading || !pagos ? "—" : fmtNum(pagos.total_registros, 0)}
          </p>
          <p className="sg-hub-kpi-hint">Operaciones en rubros de remuneración</p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Total período · UYU</p>
          <p className="sg-hub-kpi-value">
            {loading || !pagos ? "—" : fmtNum(pagos.total_pesos, 0)}
          </p>
          <p className="sg-hub-kpi-hint">Acumulado en pesos uruguayos</p>
        </article>
        <article className="sg-hub-kpi sg-hub-kpi--dark">
          <p className="sg-hub-kpi-kicker">Total período · USD</p>
          <p className="sg-hub-kpi-value">
            {loading || !pagos ? "—" : fmtNum(pagos.total_saldo_usd, 0)}
          </p>
          <p className="sg-hub-kpi-hint">Equivalente acumulado en dólares</p>
        </article>
      </div>

      <div className="rrhh-dash-grid">
        <section className="sg-hub-panel rrhh-dash-panel" aria-labelledby="rrhh-dash-pagos-title">
          <div className="rrhh-dash-panel-head-row">
            <div>
              <p className="sg-hub-panel-kicker">Movimientos recientes</p>
              <h2 id="rrhh-dash-pagos-title" className="sg-hub-panel-title">
                Últimos pagos de sueldos
              </h2>
            </div>
            <button
              type="button"
              className="rrhh-dash-panel-link"
              onClick={() => onNavigate("sueldos")}
            >
              Ver todos
              <ArrowRight size={14} aria-hidden />
            </button>
          </div>

          {loading && ultimos.length === 0 ? (
            <ul className="rrhh-dash-recent-skeleton-list" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={`rrhh-skel-${i}`}>
                  <div className="rrhh-dash-recent-skeleton-row" aria-hidden>
                    <span className="rrhh-dash-recent-skeleton-icon" />
                    <span className="rrhh-dash-recent-skeleton-lines">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : !apiOnline ? (
            <div className="rrhh-dash-recent-empty">
              <p className="rrhh-dash-recent-empty-text">API no conectada.</p>
            </div>
          ) : ultimos.length === 0 ? (
            <div className="rrhh-dash-recent-empty">
              <p className="rrhh-dash-recent-empty-text">
                Sin pagos de sueldos en el ejercicio vigente. Cuando registres remuneraciones,
                aparecerán acá para un vistazo rápido.
              </p>
              <button
                type="button"
                className="sg-hub-cta rrhh-dash-recent-cta"
                onClick={() => onNavigate("sueldos")}
              >
                Ir a sueldos y jornales
                <ArrowRight size={15} aria-hidden />
              </button>
            </div>
          ) : (
            <ul className="rrhh-dash-recent-list">
              {ultimos.map((p, index) => {
                const esUltimo = index === 0;
                const puedeAbrir = Boolean((p.cedula && onVerPago) || onEditGasto);
                const handleVerPagos = () => {
                  if (p.cedula && onVerPago) onVerPago(p.cedula);
                };

                return (
                  <li key={p.id}>
                    <div
                      className={`rrhh-dash-recent-item${esUltimo ? " rrhh-dash-recent-item--latest" : ""}`}
                    >
                      <span className="rrhh-dash-recent-icon" aria-hidden>
                        <UserRound size={15} />
                      </span>
                      <div className="rrhh-dash-recent-body">
                        <div className="rrhh-dash-recent-top">
                          <span className="rrhh-dash-recent-title">
                            {formatNombreDisplay(p.funcionario_nombre)}
                          </span>
                          {esUltimo ? (
                            <span className="rrhh-dash-recent-badge">Último pago</span>
                          ) : null}
                        </div>
                        <p className="rrhh-dash-recent-meta">
                          {conceptoLabel(p.concepto)} · {p.rubro || "Sueldos y Jornales"}
                          {p.cedula_display ? ` · CI ${p.cedula_display}` : ""}
                        </p>
                        <div className="rrhh-dash-recent-foot">
                          <span>{fmtDate(p.fecha)}</span>
                          <span className="rrhh-dash-recent-usd">
                            USD {fmtNum(p.saldo_usd, 2)}
                          </span>
                        </div>
                      </div>
                      {puedeAbrir ? (
                        <div className="rrhh-dash-recent-actions">
                          {p.cedula && onVerPago ? (
                            <button
                              type="button"
                              className="rrhh-dash-recent-action-btn"
                              onClick={handleVerPagos}
                            >
                              Pagos
                            </button>
                          ) : null}
                          {onEditGasto ? (
                            <button
                              type="button"
                              className="rrhh-dash-recent-action-btn rrhh-dash-recent-action-btn--ghost"
                              onClick={() => onEditGasto(p.id)}
                            >
                              <Banknote size={13} aria-hidden />
                              Gasto
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && ultimos.length > 0 ? (
            <p className="rrhh-dash-recent-hint muted">
              Pagos vinculados a rubros de remuneración en el ejercicio {periodoLabel}.
            </p>
          ) : null}
        </section>

        <div className="rrhh-dash-side">
          {data && data.funcionarios_sin_banco > 0 ? (
            <aside className="rrhh-dash-alert" role="status">
              <strong>{fmtNum(data.funcionarios_sin_banco, 0)}</strong> funcionario
              {data.funcionarios_sin_banco === 1 ? "" : "s"} sin datos bancarios completos.
              <button type="button" className="rrhh-dash-link-btn" onClick={() => onNavigate("funcionarios")}>
                Revisar
              </button>
            </aside>
          ) : null}

          <SgHubModuleGrid
            items={RRHH_HUB_ITEMS}
            onSelect={onNavigate}
            title="Accesos"
            kicker="Gestión de personal"
            className="rrhh-dash-modules"
          />

          {data && pagos ? (
            <section className="sg-hub-panel rrhh-dash-panel rrhh-dash-panel--compact">
              <p className="sg-hub-panel-kicker">Vinculación con gastos</p>
              <h3 className="sg-hub-panel-title">En el ejercicio</h3>
              <ul className="rrhh-dash-stats-list">
                <li>
                  <span>Funcionarios con cédula en pagos</span>
                  <strong>{fmtNum(pagos.funcionarios_con_pagos, 0)}</strong>
                </li>
                <li>
                  <span>Registros de remuneración</span>
                  <strong>{fmtNum(pagos.total_registros, 0)}</strong>
                </li>
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
