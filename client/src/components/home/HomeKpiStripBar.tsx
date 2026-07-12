import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export type HomeKpiStripTone = "up" | "down" | "neutral" | "lime" | "gold" | "ok";

export interface HomeKpiStripCell {
  id: string;
  label: string;
  value: string;
  /** Texto al costado del valor (ej. "% del stock"). */
  valueAside?: string;
  /** Porcentaje 0–100 para mini gráfico de participación. */
  sharePct?: number;
  /** Tono del gráfico de participación. */
  shareTone?: "macho" | "hembra";
  trend?: string;
  tone?: HomeKpiStripTone;
  onClick?: () => void;
  ariaLabel?: string;
}

function ShareDonut({
  pct,
  tone,
}: {
  pct: number;
  tone: "macho" | "hembra";
}) {
  const size = 36;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, pct));
  const filled = (clamped / 100) * circumference;

  return (
    <svg
      className={`home-kpi-strip-bar__share-donut home-kpi-strip-bar__share-donut--${tone}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          className="home-kpi-strip-bar__share-donut-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="home-kpi-strip-bar__share-donut-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circumference}`}
        />
      </g>
    </svg>
  );
}

function TrendIcon({ tone }: { tone: HomeKpiStripTone }) {
  if (tone === "up" || tone === "lime" || tone === "ok") {
    return (
      <span className="home-kpi-strip-bar__trend-icon home-kpi-strip-bar__trend-icon--up" aria-hidden>
        <TrendingUp size={10} strokeWidth={2.5} />
      </span>
    );
  }
  if (tone === "down") {
    return (
      <span className="home-kpi-strip-bar__trend-icon home-kpi-strip-bar__trend-icon--down" aria-hidden>
        <TrendingDown size={10} strokeWidth={2.5} />
      </span>
    );
  }
  if (tone === "gold") {
    return (
      <span className="home-kpi-strip-bar__trend-icon home-kpi-strip-bar__trend-icon--gold" aria-hidden>
        <Minus size={10} strokeWidth={2.5} />
      </span>
    );
  }
  return null;
}

function StripCell({
  cell,
  showDivider,
}: {
  cell: HomeKpiStripCell;
  showDivider: boolean;
}) {
  const tone = cell.tone ?? "neutral";
  const shareTone = cell.shareTone ?? "macho";
  const content = (
    <>
      <span className="home-kpi-strip-bar__label">{cell.label}</span>
      <div
        className={`home-kpi-strip-bar__body${cell.sharePct != null ? " home-kpi-strip-bar__body--share" : ""}`}
      >
        <div className="home-kpi-strip-bar__main">
          <span className="home-kpi-strip-bar__value-row">
            <span className="home-kpi-strip-bar__value">{cell.value}</span>
            {cell.valueAside ? (
              <span
                className={`home-kpi-strip-bar__value-aside${cell.shareTone ? ` home-kpi-strip-bar__value-aside--${cell.shareTone}` : ""}`}
              >
                {cell.valueAside}
              </span>
            ) : null}
          </span>
          {cell.trend ? (
            <span className="home-kpi-strip-bar__trend">
              <TrendIcon tone={tone} />
              <span className="home-kpi-strip-bar__trend-text">{cell.trend}</span>
            </span>
          ) : null}
          {cell.sharePct != null ? (
            <span className="home-kpi-strip-bar__share-meter" aria-hidden>
              <span
                className={`home-kpi-strip-bar__share-meter-fill home-kpi-strip-bar__share-meter-fill--${shareTone}`}
                style={{ width: `${cell.sharePct}%` }}
              />
            </span>
          ) : null}
        </div>
        {cell.sharePct != null ? (
          <ShareDonut pct={cell.sharePct} tone={shareTone} />
        ) : null}
      </div>
    </>
  );

  return (
    <div className="home-kpi-strip-bar__cell-wrap">
      {showDivider ? <span className="home-kpi-strip-bar__divider" aria-hidden /> : null}
      {cell.onClick ? (
        <button
          type="button"
          className={`home-kpi-strip-bar__cell home-kpi-strip-bar__cell--${tone}${cell.sharePct != null ? " home-kpi-strip-bar__cell--share" : ""}`}
          onClick={cell.onClick}
          aria-label={cell.ariaLabel ?? `${cell.label}: ${cell.value}`}
        >
          {content}
        </button>
      ) : (
        <div
          className={`home-kpi-strip-bar__cell home-kpi-strip-bar__cell--${tone}${cell.sharePct != null ? " home-kpi-strip-bar__cell--share" : ""}`}
          aria-label={cell.ariaLabel ?? `${cell.label}: ${cell.value}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

interface StripProps {
  cells: HomeKpiStripCell[];
  className?: string;
  label?: string;
  footer?: ReactNode;
}

export function HomeKpiStripBar({ cells, className = "", label, footer }: StripProps) {
  if (cells.length === 0) return null;

  return (
    <div
      className={`home-kpi-strip-bar is-count-${Math.min(cells.length, 5)}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
    >
      {cells.map((cell, index) => (
        <StripCell key={cell.id} cell={cell} showDivider={index > 0} />
      ))}
      {footer}
    </div>
  );
}

export function HomeKpiStripBarSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className={`home-kpi-strip-bar home-kpi-strip-bar--skeleton is-count-${count}`}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={`sk-${index}`} className="home-kpi-strip-bar__cell-wrap">
          {index > 0 ? <span className="home-kpi-strip-bar__divider" aria-hidden /> : null}
          <div className="home-kpi-strip-bar__cell">
            <div className="home-hub-kpi-skeleton-kicker home-kpi-strip-bar__sk-label" />
            <div className="home-hub-kpi-skeleton-value home-kpi-strip-bar__sk-value" />
            <div className="home-hub-kpi-skeleton-kicker home-kpi-strip-bar__sk-trend" />
          </div>
        </div>
      ))}
    </div>
  );
}
