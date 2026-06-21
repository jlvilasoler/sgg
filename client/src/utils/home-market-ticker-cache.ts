import type { HomeTickerItem } from "./home-market-ticker-data";

const STORAGE_KEY = "scg-home-ticker-cache-v2";

let memoryItems: HomeTickerItem[] | null = null;

function readStorage(): HomeTickerItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HomeTickerItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ensureMemoryHydrated(): HomeTickerItem[] {
  if (memoryItems === null) {
    memoryItems = readStorage();
  }
  return memoryItems;
}

export function getHomeTickerCache(): HomeTickerItem[] {
  return ensureMemoryHydrated();
}

export function setHomeTickerCache(items: HomeTickerItem[]): void {
  if (items.length === 0) return;
  memoryItems = items;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota / private mode */
  }
}
