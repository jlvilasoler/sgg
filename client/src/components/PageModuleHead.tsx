import type { ReactNode } from "react";
import type { TabId } from "./Header";
import { hubCardStyle } from "./HubMenuCard";
import { HUB_ICON_THEMES, HubMenuIcon, type HubIconId } from "./icons/HubMenuIcons";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";

export type PageIconRef =
  | { source: "app"; id: TabId }
  | { source: "hub"; id: HubIconId };

function themeFor(icon: PageIconRef) {
  return icon.source === "app" ? MENU_APP_THEMES[icon.id] : HUB_ICON_THEMES[icon.id];
}

export function PageModuleIcon({
  icon,
  className = "",
}: {
  icon: PageIconRef;
  className?: string;
}) {
  return (
    <span
      className={`page-module-head-icon app-card-icon ${className}`.trim()}
      style={hubCardStyle(themeFor(icon))}
      aria-hidden
    >
      <span className="app-card-icon-shine" aria-hidden />
      {icon.source === "app" ? (
        <MenuAppIcon id={icon.id} className="menu-app-icon-svg" />
      ) : (
        <HubMenuIcon id={icon.id} className="menu-app-icon-svg" />
      )}
    </span>
  );
}

interface HeadRowProps {
  icon: PageIconRef;
  title: ReactNode;
  subtitle?: ReactNode;
  kicker?: ReactNode;
  titleClassName?: string;
  subClassName?: string;
  className?: string;
  textClassName?: string;
}

export function PageModuleHeadRow({
  icon,
  title,
  subtitle,
  kicker,
  titleClassName = "",
  subClassName = "muted",
  className = "",
  textClassName = "page-module-head-text",
}: HeadRowProps) {
  const titleCls = titleClassName.trim() || undefined;

  return (
    <div className={`page-module-head-row ${className}`.trim()}>
      <PageModuleIcon icon={icon} />
      <div className={textClassName}>
        {kicker ? <span className="responsable-module-kicker">{kicker}</span> : null}
        <h2 className={titleCls}>{title}</h2>
        {subtitle != null && subtitle !== "" ? <p className={subClassName}>{subtitle}</p> : null}
      </div>
    </div>
  );
}
