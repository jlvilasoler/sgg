import type { StockEquinaDispositivo } from "../../types";

const STORAGE_KEY = "scg:stock-equina-page";

export interface StockEquinaPageCache {
  scopeKey: string;
  rows: StockEquinaDispositivo[];
  statsRows: StockEquinaDispositivo[];
  ventasClaves: string[];
  filtrosKey: string;
}

let memCache: StockEquinaPageCache | null = null;

export function stockEquinaCacheScope(user: {
  id: number;
  empresa_id: number | null;
}): string {
  return `${user.id}:${user.empresa_id ?? "na"}`;
}

export function filtrosCacheKey(filtros: {
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}): string {
  return JSON.stringify({
    busqueda: filtros.busqueda ?? "",
    fecha_desde: filtros.fecha_desde ?? "",
    fecha_hasta: filtros.fecha_hasta ?? "",
  });
}

function readSessionCache(): StockEquinaPageCache | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockEquinaPageCache;
    if (!parsed.scopeKey || !Array.isArray(parsed.statsRows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStockEquinaPageCache(scopeKey: string): StockEquinaPageCache | null {
  if (!scopeKey) return null;
  const cache = memCache ?? readSessionCache();
  if (!cache || cache.scopeKey !== scopeKey) {
    if (memCache && memCache.scopeKey !== scopeKey) memCache = null;
    return null;
  }
  memCache = cache;
  return cache;
}

export function writeStockEquinaPageCache(
  cache: Omit<StockEquinaPageCache, "scopeKey">,
  scopeKey: string
): void {
  if (!scopeKey) return;
  const full: StockEquinaPageCache = { ...cache, scopeKey };
  memCache = full;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* quota / modo privado */
  }
}

export function clearStockEquinaPageCache(): void {
  memCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo privado */
  }
}

export function rowsDesdeCache(
  cache: StockEquinaPageCache | null,
  filtrosKey: string
): StockEquinaDispositivo[] {
  if (!cache) return [];
  if (cache.filtrosKey === filtrosKey && cache.rows.length > 0) return cache.rows;
  return cache.statsRows;
}

export function ventasClavesDesdeCache(cache: StockEquinaPageCache | null): Set<string> {
  return new Set(cache?.ventasClaves ?? []);
}
