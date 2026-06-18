import type { CSSProperties, ReactNode } from "react";
import type { MenuAppTheme } from "./icons/MenuAppIcons";

export interface HubMenuCardProps {
  label: string;
  subtitle: string;
  icon: ReactNode;
  theme: MenuAppTheme;
  onClick: () => void;
}

export function hubCardStyle(theme: MenuAppTheme): CSSProperties {
  return {
    "--app-icon-accent": theme.accent,
    "--app-icon-bg": theme.accentSoft,
    "--app-icon-glow": theme.accentGlow,
  } as CSSProperties;
}

export function HubMenuCard({ label, subtitle, icon, theme, onClick }: HubMenuCardProps) {
  return (
    <button
      type="button"
      className="app-card-btn"
      style={hubCardStyle(theme)}
      onClick={onClick}
    >
      <span className="app-card-icon">
        <span className="app-card-icon-shine" aria-hidden />
        {icon}
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
