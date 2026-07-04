import { LayoutGrid } from "lucide-react";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import type { StockGanaderoHubItem } from "./StockGanaderoHub";

interface Props {
  items: StockGanaderoHubItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  showDashboard?: boolean;
  navLabel?: string;
  showSubtitles?: boolean;
}

export default function StockGanaderoHubNav({
  items,
  activeId,
  onNavigate,
  onVolverDashboard,
  showDashboard = true,
  navLabel = "Principal",
  showSubtitles = false,
}: Props) {
  return (
    <nav className="sg-hub-aside-nav" aria-label="Módulos Stock Ganadero">
      <p className="sg-hub-aside-nav-label">{navLabel}</p>
      {showDashboard && (
        <button
          type="button"
          className={`sg-hub-nav-item${activeId === "menu" ? " is-active" : ""}`}
          onClick={onVolverDashboard}
        >
          <LayoutGrid size={18} aria-hidden />
          Dashboard
        </button>
      )}
      {items.map((item) => (
        <button
          key={item.id}
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
      ))}
    </nav>
  );
}
