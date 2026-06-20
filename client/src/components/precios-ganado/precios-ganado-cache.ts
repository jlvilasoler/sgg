import type { SemanaPreciosGanado } from "../../types";

export type PreciosGanadoSegmentoCache = {
  semanas: SemanaPreciosGanado[];
  ultima: SemanaPreciosGanado | null;
};

const STORAGE_KEY = "scg-precios-ganado-cache-v1";

let memoryCache: Record<string, PreciosGanadoSegmentoCache> = {};

function readStorage(): Record<string, PreciosGanadoSegmentoCache> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PreciosGanadoSegmentoCache>;
  } catch {
    return {};
  }
}

function ensureMemoryHydrated(): void {
  if (Object.keys(memoryCache).length > 0) return;
  memoryCache = readStorage();
}

export function getPreciosGanadoSegmentoCache(
  segmento: string
): PreciosGanadoSegmentoCache | undefined {
  ensureMemoryHydrated();
  return memoryCache[segmento];
}

export function setPreciosGanadoSegmentoCache(
  segmento: string,
  data: PreciosGanadoSegmentoCache
): void {
  ensureMemoryHydrated();
  memoryCache[segmento] = data;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
  } catch {
    /* quota / private mode */
  }
}
