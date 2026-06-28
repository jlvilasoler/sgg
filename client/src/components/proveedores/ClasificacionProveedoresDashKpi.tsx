type Variant = "total" | "clasificados" | "pendientes" | "costos" | "admin" | "comercial";

interface Props {
  label: string;
  value: number | string;
  hint: string;
  variant: Variant;
  loading?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function KpiIcon({ variant }: { variant: Variant }) {
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
    case "clasificados":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M6 10.5 8.5 13 14 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "pendientes":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 6.5v4.25M10 13.25h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "costos":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M4 14h12M6 10h8M8 6h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "admin":
      return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden>
          <rect x="4" y="3.5" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "comercial":
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
  }
}

const VARIANT_CLASS: Record<Variant, string> = {
  total: "sg-kpi-card--total",
  clasificados: "sg-kpi-card--activos",
  pendientes: "sg-kpi-card--salida",
  costos: "sg-kpi-card--vendido",
  admin: "sg-kpi-card--muerto",
  comercial: "sg-kpi-card--extraviado",
};

export default function ClasificacionProveedoresDashKpi({
  label,
  value,
  hint,
  variant,
  loading = false,
  active = false,
  disabled = false,
  onClick,
}: Props) {
  const className = [
    "sg-kpi-card",
    VARIANT_CLASS[variant],
    active ? "is-active" : "",
    onClick ? "sg-kpi-card--clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="sg-kpi-card-accent" aria-hidden />
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
          ) : null}
        </header>
        <div className="sg-kpi-card-value">{loading ? "—" : value}</div>
        {hint ? (
          <p className="sg-kpi-card-hint" title={hint}>
            {hint}
          </p>
        ) : null}
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
