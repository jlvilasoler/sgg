import { ChevronDown, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import {
  collectExpandedGroupIds,
  isDescendantActive,
  ventasHubItemHasChildren,
  type VentasHubItem,
} from "./VentasHubTypes";

interface Props {
  items: VentasHubItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  showDashboard?: boolean;
  navLabel?: string;
  showSubtitles?: boolean;
  ariaLabel?: string;
}

function NavTreeItem({
  item,
  depth,
  activeId,
  onNavigate,
  showSubtitles,
  expandedIds,
  onToggleExpand,
}: {
  item: VentasHubItem;
  depth: number;
  activeId: string;
  onNavigate: (id: string) => void;
  showSubtitles: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const hasChildren = ventasHubItemHasChildren(item);
  const isActive = activeId === item.id;
  const isGroupActive = hasChildren && isDescendantActive(item, activeId);
  const isExpanded = hasChildren && (expandedIds.has(item.id) || isGroupActive);

  const handleClick = () => {
    if (hasChildren) {
      onToggleExpand(item.id);
      return;
    }
    onNavigate(item.id);
  };

  return (
    <>
      <button
        type="button"
        className={`sg-hub-nav-item${depth > 0 ? " sg-hub-nav-item--nested" : ""}${
          isActive ? " is-active" : ""
        }${isGroupActive && !isActive ? " is-active-group" : ""}`}
        style={{ paddingLeft: `${0.65 + depth * 0.75}rem` }}
        onClick={handleClick}
        aria-expanded={hasChildren ? isExpanded : undefined}
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
        {hasChildren ? (
          <ChevronDown
            size={15}
            className={`sg-hub-nav-chevron${isExpanded ? " is-open" : ""}`}
            aria-hidden
          />
        ) : null}
      </button>
      {hasChildren && isExpanded ? (
        <div className="sg-hub-nav-children" role="group" aria-label={item.label}>
          {item.children!.map((child) => (
            <NavTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              activeId={activeId}
              onNavigate={onNavigate}
              showSubtitles={showSubtitles}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export default function VentasHubNav({
  items,
  activeId,
  onNavigate,
  onVolverDashboard,
  showDashboard = true,
  navLabel = "Principal",
  showSubtitles = false,
  ariaLabel = "Módulos de ventas",
}: Props) {
  const autoExpanded = useMemo(
    () => collectExpandedGroupIds(items, activeId),
    [items, activeId]
  );
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(() => new Set());

  const expandedIds = useMemo(() => {
    const merged = new Set(manualExpanded);
    autoExpanded.forEach((id) => merged.add(id));
    return merged;
  }, [manualExpanded, autoExpanded]);

  const onToggleExpand = (id: string) => {
    setManualExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <nav className="sg-hub-aside-nav" aria-label={ariaLabel}>
      <p className="sg-hub-aside-nav-label">{navLabel}</p>
      {showDashboard ? (
        <button
          type="button"
          className={`sg-hub-nav-item${activeId === "menu" ? " is-active" : ""}`}
          onClick={onVolverDashboard}
        >
          <LayoutGrid size={18} aria-hidden />
          Dashboard
        </button>
      ) : null}
      {items.map((item) => (
        <NavTreeItem
          key={item.id}
          item={item}
          depth={0}
          activeId={activeId}
          onNavigate={onNavigate}
          showSubtitles={showSubtitles}
          expandedIds={expandedIds}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </nav>
  );
}
