import type { TabId } from "../components/Header";
import type { HomeGanadoStockData, HomePorCobrarData, HomeResultadoEjercicioData } from "../hooks/useHomeDashboard";

export type HomeInsightCacheItem = {
  id: string;
  tab: TabId;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "danger" | "accent" | "ok";
  amountUsd?: number;
  ganadoStock?: HomeGanadoStockData;
  porCobrar?: HomePorCobrarData;
  resultadoEjercicio?: HomeResultadoEjercicioData;
};

const STORAGE_KEY = "scg-home-insights-cache-v15";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedPayload = {
  key: string;
  items: HomeInsightCacheItem[];
  savedAt: number;
};

const memory = new Map<string, HomeInsightCacheItem[]>();

function monthCacheKey(scope: string | number): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${scope}:${now.getFullYear()}-${month}`;
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

export function getHomeInsightsCache(scope: string | number): HomeInsightCacheItem[] {
  const key = monthCacheKey(scope);
  const fromMemory = memory.get(key);
  if (fromMemory) return fromMemory;

  const stored = readStorage();
  if (!stored || stored.key !== key) return [];
  if (Date.now() - stored.savedAt > CACHE_TTL_MS) return [];

  memory.set(key, stored.items);
  return stored.items;
}

export function setHomeInsightsCache(scope: string | number, items: HomeInsightCacheItem[]): void {
  if (items.length === 0) return;
  const key = monthCacheKey(scope);
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

export function clearHomeInsightsCache(): void {
  memory.clear();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
