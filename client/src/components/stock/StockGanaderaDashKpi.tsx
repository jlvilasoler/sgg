import StockDashSexoBreakdown from "./StockDashSexoBreakdown";
import { SgMiniBars } from "./SgHubUi";
import type { SexoDispositivoCounts } from "./stock-ganadera-utils";

export type StockGanaderaDashKpiVariant =
  | "total"
  | "activos"
  | "salida"
  | "vendido"
  | "muerto"
  | "extraviado";

interface Props {
  label: string;
  value: number | string;
  hint: string;
  variant: StockGanaderaDashKpiVariant;
  sexoStats?: SexoDispositivoCounts;
  trend?: string;
  tone?: "light" | "dark";
  showSexo?: boolean;
  showBars?: boolean;
  barsHighlight?: "last" | "mid";
  loading?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function KpiIcon({ variant }: { variant: StockGanaderaDashKpiVariant }) {
  switch (variant) {
    case "total":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "activos":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6.5v7M6.5 10h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "salida":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M4 14h12M11 6l5 4-5 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vendido":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M4 6h12l-1.2 8H5.2L4 6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M8 9v4M12 9v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "muerto":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "extraviado":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 3.5 4 7v6l6 3.5 6-3.5V7L10 3.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 12.5v2.5M7.5 16h5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

export default function StockGanaderaDashKpi({
  label,
  value,
  hint,
  variant,
  sexoStats,
  trend,
  tone = "dark",
  showSexo = true,
  showBars = true,
  barsHighlight = "last",
  loading = false,
  active = false,
  disabled = false,
  onClick,
}: Props) {
  const className = [
    "sg-hub-kpi",
    "sg-hub-kpi--dash",
    tone === "dark" ? "sg-hub-kpi--dark" : "sg-hub-kpi--light",
    `sg-hub-kpi--accent-${variant}`,
    onClick ? "sg-hub-kpi--clickable" : "",
    active ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {onClick ? (
        <span className="sg-hub-kpi-filter-tag" aria-hidden>
          {active ? "Filtrando" : "Filtrar"}
        </span>
      ) : null}
      <div className="sg-hub-kpi-top">
        <div className="sg-hub-kpi-dash-main">
          <span className="sg-hub-kpi-dash-icon" aria-hidden>
            <KpiIcon variant={variant} />
          </span>
          <div className="sg-hub-kpi-dash-copy">
            <p className="sg-hub-kpi-kicker">{label}</p>
            <p className="sg-hub-kpi-value">{loading ? "—" : value}</p>
            {trend ? <p className="sg-hub-kpi-trend">{trend}</p> : null}
          </div>
        </div>
        {showBars ? <SgMiniBars highlight={barsHighlight} /> : null}
      </div>
      <p className="sg-hub-kpi-hint">{hint || "\u00a0"}</p>
      {showSexo && sexoStats ? (
        <div className="sg-hub-kpi-sexo">
          <StockDashSexoBreakdown stats={sexoStats} loading={loading} variant="compact" />
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled || loading}
        aria-pressed={active}
        title={hint}
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}
