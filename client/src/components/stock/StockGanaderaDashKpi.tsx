import StockDashSexoBreakdown from "./StockDashSexoBreakdown";
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
  sexoStats: SexoDispositivoCounts;
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
  loading = false,
  active = false,
  disabled = false,
  onClick,
}: Props) {
  const className = [
    "sg-kpi-card",
    `sg-kpi-card--${variant}`,
    active ? "is-active" : "",
    onClick ? "sg-kpi-card--clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="sg-kpi-card-accent" aria-hidden />
      <div className="sg-kpi-card-body">
        <div className="sg-kpi-card-main">
          <header className="sg-kpi-card-head">
            <span className="sg-kpi-card-icon">
              <KpiIcon variant={variant} />
            </span>
            <span className="sg-kpi-card-label">{label}</span>
            {onClick ? (
              <span className="sg-kpi-card-action" aria-hidden>
                {active ? "Filtrando" : "Filtrar"}
              </span>
            ) : (
              <span className="sg-kpi-card-action sg-kpi-card-action--placeholder" aria-hidden />
            )}
          </header>
          <div className="sg-kpi-card-value">{loading ? "—" : value}</div>
          <p className="sg-kpi-card-hint" title={hint || undefined}>
            {hint || "\u00a0"}
          </p>
        </div>
        <StockDashSexoBreakdown stats={sexoStats} loading={loading} variant="compact" />
      </div>
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

  return <div className={className}>{content}</div>;
}
