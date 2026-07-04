import type { TabId } from "../components/Header";

export type HomeInsightCacheItem = {
  id: string;
  tab: TabId;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "danger" | "accent" | "ok";
};

const STORAGE_KEY = "scg-home-insights-cache-v2";

type CachedPayload = {
  key: string;
  items: HomeInsightCacheItem[];
  savedAt: number;
};

const memory = new Map<string, HomeInsightCacheItem[]>();

function monthCacheKey(userId: number): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${userId}:${now.getFullYear()}-${month}`;
}

function readStorage(): CachedPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (!parsed?.key || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getHomeInsightsCache(userId: number): HomeInsightCacheItem[] {
  const key = monthCacheKey(userId);
  const fromMemory = memory.get(key);
  if (fromMemory) return fromMemory;

  const stored = readStorage();
  if (!stored || stored.key !== key) return [];

  memory.set(key, stored.items);
  return stored.items;
}

export function setHomeInsightsCache(userId: number, items: HomeInsightCacheItem[]): void {
  if (items.length === 0) return;
  const key = monthCacheKey(userId);
  memory.set(key, items);
  try {
    const payload: CachedPayload = {
      key,
      items,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / modo privado */
  }
}
