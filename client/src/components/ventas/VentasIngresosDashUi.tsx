import type { ReactNode } from "react";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

export function VentasIngresosDashPanel({
  title = "Resumen",
  kicker = "Indicadores",
  children,
}: {
  title?: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="sg-hub-panel sg-devices-dashboard ventas-ingresos-dashboard"
      aria-label={title}
    >
      <div className="sg-hub-panel-head">
        <div>
          <p className="sg-hub-panel-kicker">{kicker}</p>
          <h2 className="sg-hub-panel-title">{title}</h2>
        </div>
      </div>
      <div className="sg-hub-kpi-strip sg-devices-kpi-summary ventas-ingresos-kpi-summary">
        {children}
      </div>
    </section>
  );
}

export function VentasIngresosListPanel({ children }: { children: ReactNode }) {
  return (
    <section className="sg-hub-panel sg-hub-panel--devices-table ventas-ingresos-list-panel">
      {children}
    </section>
  );
}

export function VentasDashKpi({
  kicker,
  value,
  hint,
  trend,
  variant = "dark",
  highlight = "last",
}: {
  kicker: string;
  value: string | number;
  hint: string;
  trend?: string;
  variant?: "dark" | "light";
  highlight?: "last" | "mid";
}) {
  return (
    <SgHubKpi
      variant={variant}
      kicker={kicker}
      value={value}
      hint={hint}
      trend={trend}
      bars={<SgMiniBars highlight={highlight} />}
    />
  );
}
