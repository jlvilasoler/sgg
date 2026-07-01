import type { StockGanaderaDispositivo } from "../../types";

const STORAGE_KEY = "scg:stock-ganadera-page";

export interface StockGanaderaPageCache {
  scopeKey: string;
  rows: StockGanaderaDispositivo[];
  statsRows: StockGanaderaDispositivo[];
  ventasClaves: string[];
  filtrosKey: string;
}

let memCache: StockGanaderaPageCache | null = null;

export function stockGanaderaCacheScope(user: {
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

function readSessionCache(): StockGanaderaPageCache | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockGanaderaPageCache;
    if (!parsed.scopeKey || !Array.isArray(parsed.statsRows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStockGanaderaPageCache(scopeKey: string): StockGanaderaPageCache | null {
  if (!scopeKey) return null;
  const cache = memCache ?? readSessionCache();
  if (!cache || cache.scopeKey !== scopeKey) {
    if (memCache && memCache.scopeKey !== scopeKey) memCache = null;
    return null;
  }
  memCache = cache;
  return cache;
}

export function writeStockGanaderaPageCache(
  cache: Omit<StockGanaderaPageCache, "scopeKey">,
  scopeKey: string
): void {
  if (!scopeKey) return;
  const full: StockGanaderaPageCache = { ...cache, scopeKey };
  memCache = full;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* quota / modo privado */
  }
}

export function clearStockGanaderaPageCache(): void {
  memCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo privado */
  }
}

export function rowsDesdeCache(
  cache: StockGanaderaPageCache | null,
  filtrosKey: string
): StockGanaderaDispositivo[] {
  if (!cache) return [];
  if (cache.filtrosKey === filtrosKey) return cache.rows;
  return [];
}

export function ventasClavesDesdeCache(cache: StockGanaderaPageCache | null): Set<string> {
  return new Set(cache?.ventasClaves ?? []);
}
