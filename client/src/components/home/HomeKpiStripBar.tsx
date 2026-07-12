import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

export type HomeKpiStripTone = "up" | "down" | "neutral" | "lime" | "gold" | "ok";

export interface HomeKpiStripCell {
  id: string;
  label: string;
  value: string;
  trend?: string;
  tone?: HomeKpiStripTone;
  onClick?: () => void;
  ariaLabel?: string;
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
  const content = (
    <>
      <span className="home-kpi-strip-bar__label">{cell.label}</span>
      <span className="home-kpi-strip-bar__value">{cell.value}</span>
      {cell.trend ? (
        <span className="home-kpi-strip-bar__trend">
          <TrendIcon tone={tone} />
          <span className="home-kpi-strip-bar__trend-text">{cell.trend}</span>
        </span>
      ) : null}
    </>
  );

  return (
    <div className="home-kpi-strip-bar__cell-wrap">
      {showDivider ? <span className="home-kpi-strip-bar__divider" aria-hidden /> : null}
      {cell.onClick ? (
        <button
          type="button"
          className={`home-kpi-strip-bar__cell home-kpi-strip-bar__cell--${tone}`}
          onClick={cell.onClick}
          aria-label={cell.ariaLabel ?? `${cell.label}: ${cell.value}`}
        >
          {content}
        </button>
      ) : (
        <div
          className={`home-kpi-strip-bar__cell home-kpi-strip-bar__cell--${tone}`}
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
      className={`home-kpi-strip-bar is-count-${Math.min(cells.length, 4)}${className ? ` ${className}` : ""}`}
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
