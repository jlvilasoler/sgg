import type { StockGanaderaDispositivo } from "../../types";

const STORAGE_KEY = "scg:stock-ganadera-page";

export interface StockGanaderaPageCache {
  rows: StockGanaderaDispositivo[];
  statsRows: StockGanaderaDispositivo[];
  ventasClaves: string[];
  filtrosKey: string;
}

let memCache: StockGanaderaPageCache | null = null;

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
    if (!Array.isArray(parsed.statsRows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStockGanaderaPageCache(): StockGanaderaPageCache | null {
  if (memCache) return memCache;
  memCache = readSessionCache();
  return memCache;
}

export function writeStockGanaderaPageCache(cache: StockGanaderaPageCache): void {
  memCache = cache;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
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
  if (cache.filtrosKey === filtrosKey && cache.rows.length > 0) return cache.rows;
  return cache.statsRows;
}

export function ventasClavesDesdeCache(cache: StockGanaderaPageCache | null): Set<string> {
  return new Set(cache?.ventasClaves ?? []);
}
