import type { HubIconId } from "../icons/HubMenuIcons";

export interface VentasHubItem {
  id: string;
  label: string;
  subtitle: string;
  icon: HubIconId;
  children?: VentasHubItem[];
}

export function ventasHubItemHasChildren(item: VentasHubItem): boolean {
  return Boolean(item.children?.length);
}

export function isDescendantActive(item: VentasHubItem, activeId: string): boolean {
  if (item.id === activeId) return true;
  return item.children?.some((child) => isDescendantActive(child, activeId)) ?? false;
}

export function collectExpandedGroupIds(items: VentasHubItem[], activeId: string): Set<string> {
  const expanded = new Set<string>();
  const walk = (list: VentasHubItem[]) => {
    for (const item of list) {
      if (item.children?.length && isDescendantActive(item, activeId)) {
        expanded.add(item.id);
        walk(item.children);
      }
    }
  };
  walk(items);
  return expanded;
}

export function flattenVentasHubLeaves(items: VentasHubItem[]): VentasHubItem[] {
  const out: VentasHubItem[] = [];
  const walk = (list: VentasHubItem[]) => {
    for (const item of list) {
      if (item.children?.length) walk(item.children);
      else out.push(item);
    }
  };
  walk(items);
  return out;
}

export function findVentasHubItem(items: VentasHubItem[], id: string): VentasHubItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findVentasHubItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}
