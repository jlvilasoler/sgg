import type { CSSProperties } from "react";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import type { SgHubItem } from "./SgHubTypes";

interface Props {
  items: SgHubItem[];
  onSelect: (id: string) => void;
  title?: string;
  kicker?: string;
  featuredOnly?: boolean;
  className?: string;
}

export default function SgHubModuleGrid({
  items,
  onSelect,
  title = "Módulos principales",
  kicker = "Accesos rápidos",
  featuredOnly = false,
  className = "",
}: Props) {
  const visible = featuredOnly ? items.filter((i) => i.featured !== false) : items;
  if (!visible.length) return null;

  return (
    <section
      className={`sg-hub-panel sg-hub-panel--modules${className ? ` ${className}` : ""}`}
      aria-labelledby="sg-hub-mod-grid-title"
    >
      <div className="sg-hub-panel-head">
        <div>
          <p className="sg-hub-panel-kicker">{kicker}</p>
          <h2 id="sg-hub-mod-grid-title" className="sg-hub-panel-title">
            {title}
          </h2>
        </div>
      </div>
      <div className="sg-hub-module-grid sg-hub-module-grid--primary">
        {visible.map((item) => {
          const theme = HUB_ICON_THEMES[item.icon];
          return (
            <button
              key={item.id}
              type="button"
              className={`sg-hub-module-card${item.featured !== false ? " sg-hub-module-card--featured" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span
                className="sg-hub-module-icon"
                style={
                  {
                    "--sg-hub-icon-bg": theme?.accentSoft,
                    "--sg-hub-icon-fg": theme?.accent,
                  } as CSSProperties
                }
              >
                <HubMenuIcon id={item.icon} />
              </span>
              <span className="sg-hub-module-copy">
                <strong>{item.label}</strong>
                <small>{item.subtitle}</small>
              </span>
              <span className="sg-hub-module-arrow" aria-hidden>
                →
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
