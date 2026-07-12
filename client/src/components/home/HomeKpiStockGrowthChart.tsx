export interface HomeKpiStockGrowth {
  pct: number | null;
  anterior: number | null;
  actual: number;
  disponible: boolean;
}

export function HomeKpiStockGrowthChart({ growth }: { growth: HomeKpiStockGrowth }) {
  const hasData = growth.disponible && growth.pct != null && growth.anterior != null;
  const max = hasData ? Math.max(growth.anterior!, growth.actual, 1) : 1;
  const prevH = hasData ? Math.max(14, (growth.anterior! / max) * 100) : 30;
  const nowH = hasData ? Math.max(14, (growth.actual / max) * 100) : 30;
  const up = hasData && growth.pct! > 0;
  const down = hasData && growth.pct! < 0;
  const pctLabel = hasData ? `${growth.pct! > 0 ? "+" : ""}${growth.pct}%` : "—";

  return (
    <div
      className={`home-kpi-stock-growth${hasData ? "" : " is-empty"}`}
      aria-hidden={!hasData}
      title={
        hasData
          ? `Stock actual ${growth.actual} vs ${growth.anterior} en el mismo periodo del ejercicio anterior (${pctLabel})`
          : "Variación vs ejercicio anterior: sin datos históricos aún"
      }
    >
      <div className="home-kpi-stock-growth__bars">
        <span
          className="home-kpi-stock-growth__bar home-kpi-stock-growth__bar--prev"
          style={{ height: `${prevH}%` }}
        />
        <span
          className="home-kpi-stock-growth__bar home-kpi-stock-growth__bar--now"
          style={{ height: `${nowH}%` }}
        />
      </div>
      <span
        className={`home-kpi-stock-growth__pct${
          up ? " home-kpi-stock-growth__pct--up" : down ? " home-kpi-stock-growth__pct--down" : ""
        }`}
      >
        {pctLabel}
      </span>
      <span className="home-kpi-stock-growth__caption">vs ej. ant.</span>
    </div>
  );
}
