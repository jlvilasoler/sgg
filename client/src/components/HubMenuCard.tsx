import type { CSSProperties, ReactNode } from "react";
import type { MenuAppTheme } from "./icons/MenuAppIcons";

export interface HubMenuCardProps {
  label: string;
  subtitle: string;
  icon: ReactNode;
  theme: MenuAppTheme;
  onClick: () => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
  className?: string;
  badgeCount?: number;
}

export function hubCardStyle(theme: MenuAppTheme): CSSProperties {
  return {
    "--app-icon-accent": theme.accent,
    "--app-icon-bg": theme.accentSoft,
    "--app-icon-glow": theme.accentGlow,
  } as CSSProperties;
}

export function HubMenuCard({
  label,
  subtitle,
  icon,
  theme,
  onClick,
  onMouseEnter,
  onFocus,
  className,
  badgeCount = 0,
}: HubMenuCardProps) {
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? "99+" : String(badgeCount);

  return (
    <button
      type="button"
      className={className ? `app-card-btn ${className}` : "app-card-btn"}
      style={hubCardStyle(theme)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      aria-label={
        showBadge ? `${label}, ${badgeCount} vencimientos próximos` : undefined
      }
    >
      <span className="app-card-icon">
        <span className="app-card-icon-shine" aria-hidden />
        {icon}
        {showBadge && (
          <span className="app-card-badge app-card-badge--alert" aria-hidden>
            {badgeLabel}
          </span>
        )}
      </span>
      <span className="app-card-text">
        <span className="app-card-label" title={label}>
          {label}
        </span>
        <span className="app-card-sub" title={subtitle}>
          {subtitle}
        </span>
      </span>
      <span className="app-card-chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}
