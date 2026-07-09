import { LayoutGrid } from "lucide-react";
import { Fragment } from "react";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import type { SgHubItem, SgHubNavSection } from "./SgHubTypes";

interface Props {
  items: SgHubItem[];
  sections?: SgHubNavSection[];
  activeId: string;
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  showDashboard?: boolean;
  navLabel?: string;
  showSubtitles?: boolean;
  ariaLabel?: string;
}

function NavItemButton({
  item,
  activeId,
  onNavigate,
  showSubtitles,
}: {
  item: SgHubItem;
  activeId: string;
  onNavigate: (id: string) => void;
  showSubtitles: boolean;
}) {
  return (
    <button
      type="button"
      className={`sg-hub-nav-item${activeId === item.id ? " is-active" : ""}`}
      onClick={() => onNavigate(item.id)}
    >
      <span className="sg-hub-nav-icon" aria-hidden>
        <HubMenuIcon id={item.icon as HubIconId} />
      </span>
      <span className="sg-hub-nav-copy">
        <span>{item.label}</span>
        {showSubtitles && item.subtitle ? (
          <small className="sg-hub-nav-sub">{item.subtitle}</small>
        ) : null}
      </span>
    </button>
  );
}

export default function SgHubNav({
  items,
  sections = [],
  activeId,
  onNavigate,
  onVolverDashboard,
  showDashboard = true,
  navLabel = "Principal",
  showSubtitles = false,
  ariaLabel = "Módulos",
}: Props) {
  return (
    <nav className="sg-hub-aside-nav" aria-label={ariaLabel}>
      <p className="sg-hub-aside-nav-label">{navLabel}</p>
      {showDashboard ? (
        <button
          type="button"
          className={`sg-hub-nav-item${
            activeId === "menu" || activeId === "cuenta_hub" || activeId === "sag_hub"
              ? " is-active"
              : ""
          }`}
          onClick={onVolverDashboard}
        >
          <LayoutGrid size={18} aria-hidden />
          Dashboard
        </button>
      ) : null}
      {sections.map((section) =>
        section.items.length > 0 ? (
          <Fragment key={section.id}>
            <p className="sg-hub-aside-nav-label sg-hub-aside-nav-label--section">
              {section.label}
            </p>
            {section.items.map((item) => (
              <NavItemButton
                key={item.id}
                item={item}
                activeId={activeId}
                onNavigate={onNavigate}
                showSubtitles={showSubtitles}
              />
            ))}
          </Fragment>
        ) : null
      )}
      {items.map((item) => (
        <NavItemButton
          key={item.id}
          item={item}
          activeId={activeId}
          onNavigate={onNavigate}
          showSubtitles={showSubtitles}
        />
      ))}
    </nav>
  );
}
