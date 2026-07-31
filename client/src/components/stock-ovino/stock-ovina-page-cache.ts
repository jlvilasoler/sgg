import type { StockOvinaDispositivo } from "../../types";

const STORAGE_KEY = "scg:stock-ovina-page";

export interface StockOvinaPageCache {
  scopeKey: string;
  rows: StockOvinaDispositivo[];
  statsRows: StockOvinaDispositivo[];
  ventasClaves: string[];
  filtrosKey: string;
}

let memCache: StockOvinaPageCache | null = null;

export function stockOvinaCacheScope(user: {
  id: number;
  empresa_id: number | null;
  login_mode?: "consolidado" | "individual";
  empresa_operativa_activa_id?: number | null;
}): string {
  return `${user.id}:${user.empresa_id ?? "na"}:${user.login_mode ?? "consolidado"}:${
    user.empresa_operativa_activa_id ?? "todas"
  }`;
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

function readSessionCache(): StockOvinaPageCache | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockOvinaPageCache;
    if (!parsed.scopeKey || !Array.isArray(parsed.statsRows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readStockOvinaPageCache(scopeKey: string): StockOvinaPageCache | null {
  if (!scopeKey) return null;
  const cache = memCache ?? readSessionCache();
  if (!cache || cache.scopeKey !== scopeKey) {
    if (memCache && memCache.scopeKey !== scopeKey) memCache = null;
    return null;
  }
  memCache = cache;
  return cache;
}

export function writeStockOvinaPageCache(
  cache: Omit<StockOvinaPageCache, "scopeKey">,
  scopeKey: string
): void {
  if (!scopeKey) return;
  const full: StockOvinaPageCache = { ...cache, scopeKey };
  memCache = full;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* quota / modo privado */
  }
}

export function clearStockOvinaPageCache(): void {
  memCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo privado */
  }
}

export function rowsDesdeCache(
  cache: StockOvinaPageCache | null,
  filtrosKey: string
): StockOvinaDispositivo[] {
  if (!cache) return [];
  if (cache.filtrosKey === filtrosKey && cache.rows.length > 0) return cache.rows;
  return cache.statsRows;
}

export function ventasClavesDesdeCache(cache: StockOvinaPageCache | null): Set<string> {
  return new Set(cache?.ventasClaves ?? []);
}
