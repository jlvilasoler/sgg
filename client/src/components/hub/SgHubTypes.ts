import type { HubIconId } from "../icons/HubMenuIcons";

export interface SgHubItem {
  id: string;
  label: string;
  subtitle: string;
  icon: HubIconId;
  featured?: boolean;
}

export function findSgHubItem(items: SgHubItem[], id: string): SgHubItem | undefined {
  return items.find((item) => item.id === id);
}
