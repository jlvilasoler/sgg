import type { ReactNode } from "react";

export function SgMiniBars({ highlight = "last" }: { highlight?: "last" | "mid" }) {
  const bars = [38, 52, 44, 68, 48, 72, 58, 86];
  return (
    <div className="sg-hub-mini-bars" aria-hidden>
      {bars.map((h, i) => {
        const active =
          highlight === "last"
            ? i === bars.length - 1
            : i === Math.floor(bars.length / 2);
        return (
          <span
            key={i}
            className={`sg-hub-mini-bar${active ? " sg-hub-mini-bar--active" : ""}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

export function SgHubKpi({
  kicker,
  value,
  hint,
  trend,
  variant = "light",
  bars,
}: {
  kicker: string;
  value: string | number;
  hint: string;
  trend?: string;
  variant?: "dark" | "light";
  bars?: ReactNode;
}) {
  return (
    <article className={`sg-hub-kpi sg-hub-kpi--${variant}`}>
      <div className="sg-hub-kpi-top">
        <div>
          <p className="sg-hub-kpi-kicker">{kicker}</p>
          <p className="sg-hub-kpi-value">{value}</p>
          {trend ? <p className="sg-hub-kpi-trend">{trend}</p> : null}
        </div>
        {bars}
      </div>
      <p className="sg-hub-kpi-hint">{hint}</p>
    </article>
  );
}
