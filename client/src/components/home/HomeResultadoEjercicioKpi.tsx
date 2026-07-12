import { BarChart3 } from "lucide-react";
import type { TabId } from "../Header";
import type { HomeResultadoEjercicioData } from "../../hooks/useHomeDashboard";
import { formatUsdSafe, pctSeguro } from "../../utils/home-kpi-normalize";
import { SgMiniBars } from "../stock/SgHubUi";

interface Props {
  data: HomeResultadoEjercicioData;
  onOpen: (tab: TabId) => void;
}

export default function HomeResultadoEjercicioKpi({ data, onOpen }: Props) {
  const { ejercicioLabel, gastosMes, gastosAnio, ventasAnio } = data;
  const total = Math.max(gastosAnio + ventasAnio, 1);

  return (
    <article className="sg-hub-kpi sg-hub-kpi--dark home-resultado-ejercicio-kpi home-exec-kpi">
      <div className="home-ganado-stock-kpi-head">
        <div className="home-ganado-stock-kpi-brand">
          <span className="home-ganado-stock-kpi-icon" aria-hidden>
            <BarChart3 size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="home-ganado-stock-kpi-kicker">Resumen financiero</p>
            <p className="home-ganado-stock-kpi-subtitle">{ejercicioLabel} · acumulado</p>
          </div>
        </div>
        <div className="home-exec-kpi-head-end">
          <SgMiniBars highlight="last" />
        </div>
      </div>

      <div className="home-ganado-stock-kpi-metrics is-count-3">
        <button
          type="button"
          className="home-ganado-stock-kpi-metric"
          onClick={() => onOpen("listado")}
          aria-label={`Gastos del mes: ${formatUsdSafe(gastosMes)}`}
        >
          <span className="home-ganado-stock-kpi-metric-eyebrow">Gastos del mes</span>
          <span className="home-ganado-stock-kpi-metric-value">{formatUsdSafe(gastosMes)}</span>
          <span className="home-ganado-stock-kpi-metric-foot">Mes actual</span>
        </button>
        <button
          type="button"
          className="home-ganado-stock-kpi-metric"
          onClick={() => onOpen("listado")}
          aria-label={`Gastos del año: ${formatUsdSafe(gastosAnio)}`}
        >
          <span className="home-ganado-stock-kpi-metric-eyebrow">Gastos del año</span>
          <span className="home-ganado-stock-kpi-metric-value">{formatUsdSafe(gastosAnio)}</span>
          <span className="home-ganado-stock-kpi-metric-foot">Acumulado del ejercicio</span>
        </button>
        <button
          type="button"
          className="home-ganado-stock-kpi-metric home-ganado-stock-kpi-metric--ok"
          onClick={() => onOpen("resumen")}
          aria-label={`Ventas del año: ${formatUsdSafe(ventasAnio)}`}
        >
          <span className="home-ganado-stock-kpi-metric-eyebrow">Ventas del año</span>
          <span className="home-ganado-stock-kpi-metric-value">{formatUsdSafe(ventasAnio)}</span>
          <span className="home-ganado-stock-kpi-metric-foot">Ventas cobradas</span>
        </button>
      </div>

      <div className="home-exec-kpi-pipeline" aria-hidden>
        <span
          className="home-exec-kpi-pipeline-seg home-exec-kpi-pipeline-seg--venta"
          style={{ width: `${Math.max(pctSeguro(gastosAnio, total), gastosAnio > 0 ? 8 : 0)}%` }}
        />
        <span
          className="home-exec-kpi-pipeline-seg home-exec-kpi-pipeline-seg--realizado"
          style={{ width: `${Math.max(pctSeguro(ventasAnio, total), ventasAnio > 0 ? 8 : 0)}%` }}
        />
      </div>
    </article>
  );
}
