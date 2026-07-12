import { Beef, TrendingUp } from "lucide-react";
import type { TabId } from "../Header";
import type { HomeGanadoStockData } from "../../hooks/useHomeDashboard";
import { formatEnteroSafe, pctSeguro } from "../../utils/home-kpi-normalize";
import { SgMiniBars } from "../stock/SgHubUi";

interface Props {
  data: HomeGanadoStockData;
  onOpen: (tab: TabId) => void;
}

export default function HomeGanadoStockKpi({ data, onOpen }: Props) {
  const {
    activos,
    lotes,
    ejercicioLabel,
    tieneStock,
    tieneSimulador,
    tieneVendido,
    animalesPorVender,
    porVenderOperaciones,
    animalesVendidosEjercicio,
    vendidoOperacionesEjercicio,
  } = data;

  const metricCount = [tieneStock, tieneVendido, tieneSimulador].filter(Boolean).length;
  const pipelineTotal = Math.max(
    activos + animalesPorVender + animalesVendidosEjercicio,
    1,
  );
  const pctStock = tieneStock ? pctSeguro(activos, pipelineTotal) : 0;
  const pctVendido = tieneVendido ? pctSeguro(animalesVendidosEjercicio, pipelineTotal) : 0;
  const pctPorVender = tieneSimulador ? pctSeguro(animalesPorVender, pipelineTotal) : 0;

  const pipelineAnimales = animalesPorVender + animalesVendidosEjercicio;

  return (
    <article className="sg-hub-kpi sg-hub-kpi--dark home-ganado-stock-kpi home-exec-kpi">
      <div className="home-ganado-stock-kpi-head">
        <div className="home-ganado-stock-kpi-brand">
          <span className="home-ganado-stock-kpi-icon" aria-hidden>
            <Beef size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="home-ganado-stock-kpi-kicker">Ganado</p>
            <p className="home-ganado-stock-kpi-subtitle">
              {ejercicioLabel} · control operativo
            </p>
          </div>
        </div>
        <div className="home-exec-kpi-head-end">
          {tieneStock ? (
            <span className="home-exec-kpi-badge home-exec-kpi-badge--ok">
              {formatEnteroSafe(activos)} cab.
            </span>
          ) : null}
          <SgMiniBars highlight="mid" />
        </div>
      </div>

      {metricCount > 0 ? (
        <div className={`home-ganado-stock-kpi-metrics is-count-${metricCount}`}>
          {tieneStock ? (
            <button
              type="button"
              className="home-ganado-stock-kpi-metric"
              onClick={() => onOpen("stock_ganadero")}
              aria-label={`En stock: ${formatEnteroSafe(activos)} activos`}
            >
              <span className="home-ganado-stock-kpi-metric-eyebrow">En stock</span>
              <span className="home-ganado-stock-kpi-metric-value">{formatEnteroSafe(activos)}</span>
              <span className="home-ganado-stock-kpi-metric-foot">
                {lotes > 0 ? `${lotes} lote(s)` : "Activos vivos"}
              </span>
            </button>
          ) : null}

          {tieneVendido ? (
            <button
              type="button"
              className="home-ganado-stock-kpi-metric home-ganado-stock-kpi-metric--ok"
              onClick={() => onOpen("simulador_venta_ganado")}
              aria-label={`Animales vendidos en el ejercicio: ${formatEnteroSafe(animalesVendidosEjercicio)}`}
            >
              <span className="home-ganado-stock-kpi-metric-eyebrow">Animales vendidos</span>
              <span className="home-ganado-stock-kpi-metric-value">
                {formatEnteroSafe(animalesVendidosEjercicio)}
              </span>
              <span className="home-ganado-stock-kpi-metric-foot">
                <TrendingUp size={11} aria-hidden />
                {vendidoOperacionesEjercicio > 0
                  ? `${vendidoOperacionesEjercicio} venta(s) en ej.`
                  : "Sin ventas en ej."}
              </span>
            </button>
          ) : null}

          {tieneSimulador ? (
            <button
              type="button"
              className="home-ganado-stock-kpi-metric home-ganado-stock-kpi-metric--accent"
              onClick={() => onOpen("simulador_venta_ganado")}
              aria-label={`Animales por vender: ${formatEnteroSafe(animalesPorVender)}`}
            >
              <span className="home-ganado-stock-kpi-metric-eyebrow">Animales por vender</span>
              <span className="home-ganado-stock-kpi-metric-value">
                {formatEnteroSafe(animalesPorVender)}
              </span>
              <span className="home-ganado-stock-kpi-metric-foot">
                {porVenderOperaciones > 0
                  ? `${porVenderOperaciones} op. abierta(s)`
                  : "Sin operaciones abiertas"}
              </span>
            </button>
          ) : null}
        </div>
      ) : (
        <p className="home-exec-kpi-empty">Sin permisos de stock o ventas de ganado.</p>
      )}

      {metricCount > 1 ? (
        <div className="home-exec-kpi-pipeline" aria-hidden>
          {tieneStock ? (
            <span
              className="home-exec-kpi-pipeline-seg home-exec-kpi-pipeline-seg--stock"
              style={{ width: `${Math.max(pctStock, activos > 0 ? 8 : 0)}%` }}
            />
          ) : null}
          {tieneVendido ? (
            <span
              className="home-exec-kpi-pipeline-seg home-exec-kpi-pipeline-seg--realizado"
              style={{
                width: `${Math.max(pctVendido, animalesVendidosEjercicio > 0 ? 8 : 0)}%`,
              }}
            />
          ) : null}
          {tieneSimulador ? (
            <span
              className="home-exec-kpi-pipeline-seg home-exec-kpi-pipeline-seg--venta"
              style={{ width: `${Math.max(pctPorVender, animalesPorVender > 0 ? 8 : 0)}%` }}
            />
          ) : null}
        </div>
      ) : null}

      {pipelineAnimales > 0 ? (
        <p className="home-exec-kpi-footnote">
          Ventas: {formatEnteroSafe(animalesPorVender)} por vender +{" "}
          {formatEnteroSafe(animalesVendidosEjercicio)} vendidos en ej.
        </p>
      ) : null}
    </article>
  );
}
