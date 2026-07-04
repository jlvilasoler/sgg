import { useCallback, useEffect, useState } from "react";
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
          <div className="sg-hub-panel-head">
            <div>
              <p className="sg-hub-panel-kicker">Movimientos recientes</p>
              <h2 id="rrhh-dash-pagos-title" className="sg-hub-panel-title">
                Últimos pagos de sueldos
              </h2>
            </div>
            <button
              type="button"
              className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
              onClick={() => onNavigate("sueldos")}
            >
              Ver todos
            </button>
          </div>

          <div className="rrhh-dash-table-wrap">
            <table className="data-table rrhh-dash-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Funcionario</th>
                  <th>Concepto</th>
                  <th className="num">USD</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      Cargando…
                    </td>
                  </tr>
                ) : !apiOnline ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      API no conectada
                    </td>
                  </tr>
                ) : ultimos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      Sin pagos de sueldos en el ejercicio vigente.
                    </td>
                  </tr>
                ) : (
                  ultimos.map((p) => (
                    <tr key={p.id}>
                      <td className="rrhh-dash-fecha">{fmtDate(p.fecha)}</td>
                      <td>
                        <span className="rrhh-dash-func-nombre">
                          {p.funcionario_nombre ?? "—"}
                        </span>
                        {p.cedula_display ? (
                          <span className="rrhh-dash-func-ci muted">CI {p.cedula_display}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="cell-ellipsis" title={p.concepto}>
                          {p.concepto || "—"}
                        </span>
                        <span className="rrhh-dash-rubro muted">{p.rubro}</span>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(p.saldo_usd)}</strong>
                      </td>
                      <td className="actions-cell">
                        {p.cedula && onVerPago ? (
                          <button
                            type="button"
                            className="rrhh-dash-link-btn"
                            onClick={() => onVerPago(p.cedula!)}
                          >
                            Pagos
                          </button>
                        ) : onEditGasto ? (
                          <button
                            type="button"
                            className="rrhh-dash-link-btn"
                            onClick={() => onEditGasto(p.id)}
                          >
                            Gasto
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
