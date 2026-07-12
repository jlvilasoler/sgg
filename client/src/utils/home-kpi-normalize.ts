import type {
  HomeGanadoStockData,
  HomeInsight,
  HomePorCobrarData,
  HomePorCobrarModuloData,
  HomeResultadoEjercicioData,
} from "../hooks/useHomeDashboard";

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

/** Formato USD seguro (nunca NaN). */
export function formatUsdSafe(value: unknown): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num(value));
}

export function formatEnteroSafe(value: unknown): string {
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(num(value));
}

function normalizeModulo(
  raw: Record<string, unknown> | HomePorCobrarModuloData | undefined,
  fallback: HomePorCobrarModuloData,
): HomePorCobrarModuloData {
  const src = (raw ?? {}) as Record<string, unknown>;
  return {
    tiene: bool(src.tiene, fallback.tiene),
    pendienteUsd: num(src.pendienteUsd ?? src.usd, fallback.pendienteUsd),
    cobradoEjercicioUsd: num(src.cobradoEjercicioUsd, fallback.cobradoEjercicioUsd),
    contratos: src.contratos != null ? num(src.contratos) : fallback.contratos,
    operaciones: src.operaciones != null ? num(src.operaciones) : fallback.operaciones,
    ventas: src.ventas != null ? num(src.ventas) : fallback.ventas,
  };
}

export function normalizePorCobrarData(
  raw: Partial<HomePorCobrarData> | undefined,
  fallback: HomePorCobrarData,
): HomePorCobrarData {
  const arrend = normalizeModulo(
    raw?.arrendamientos as Record<string, unknown> | undefined,
    fallback.arrendamientos,
  );
  const ganado = normalizeModulo(
    raw?.ganado as Record<string, unknown> | undefined,
    fallback.ganado,
  );
  const agricultura = normalizeModulo(
    raw?.agricultura as Record<string, unknown> | undefined,
    fallback.agricultura,
  );
  const totalCalc = arrend.pendienteUsd + ganado.pendienteUsd + agricultura.pendienteUsd;
  return {
    ejercicioLabel: String(raw?.ejercicioLabel ?? fallback.ejercicioLabel),
    totalUsd: num(raw?.totalUsd, totalCalc),
    muestraCobradoEjercicio: bool(
      raw?.muestraCobradoEjercicio,
      fallback.muestraCobradoEjercicio,
    ),
    arrendamientos: arrend,
    ganado,
    agricultura,
  };
}

export function normalizeGanadoStockData(
  raw: Partial<HomeGanadoStockData> | undefined,
  fallback: HomeGanadoStockData,
): HomeGanadoStockData {
  const src = raw ?? {};
  return {
    activos: num(src.activos, fallback.activos),
    lotes: num(src.lotes, fallback.lotes),
    machos: num(src.machos, fallback.machos),
    hembras: num(src.hembras, fallback.hembras),
    sinDefinir: num(src.sinDefinir, fallback.sinDefinir),
    ejercicioLabel: String(src.ejercicioLabel ?? fallback.ejercicioLabel),
    tieneStock: bool(src.tieneStock, fallback.tieneStock),
    tieneSimulador: bool(src.tieneSimulador, fallback.tieneSimulador),
    tieneVendido: bool(src.tieneVendido, fallback.tieneVendido),
    animalesPorVender: num(src.animalesPorVender, fallback.animalesPorVender),
    porVenderOperaciones: num(src.porVenderOperaciones, fallback.porVenderOperaciones),
    animalesVendidosEjercicio: num(
      src.animalesVendidosEjercicio,
      fallback.animalesVendidosEjercicio,
    ),
    vendidoOperacionesEjercicio: num(
      src.vendidoOperacionesEjercicio,
      fallback.vendidoOperacionesEjercicio,
    ),
    stockEjercicioAnterior:
      src.stockEjercicioAnterior != null
        ? num(src.stockEjercicioAnterior)
        : fallback.stockEjercicioAnterior,
    crecimientoStockPct:
      src.crecimientoStockPct != null ? num(src.crecimientoStockPct) : fallback.crecimientoStockPct,
    tieneComparacionStock: bool(src.tieneComparacionStock, fallback.tieneComparacionStock),
  };
}

export function normalizeResultadoEjercicioData(
  raw: Partial<HomeResultadoEjercicioData> | undefined,
  fallback: HomeResultadoEjercicioData,
): HomeResultadoEjercicioData {
  const src = raw ?? {};
  return {
    ejercicioLabel: String(src.ejercicioLabel ?? fallback.ejercicioLabel),
    gastosMes: num(src.gastosMes, fallback.gastosMes),
    gastosAnio: num(src.gastosAnio, fallback.gastosAnio),
    ventasAnio: num(src.ventasAnio, fallback.ventasAnio),
  };
}

export function mergeHomeInsight(expected: HomeInsight, loaded: HomeInsight): HomeInsight {
  if (expected.ganadoStock && !loaded.ganadoStock) return { ...expected };
  if (expected.porCobrar && !loaded.porCobrar) return { ...expected };
  if (expected.resultadoEjercicio && !loaded.resultadoEjercicio) return { ...expected };

  const merged: HomeInsight = { ...expected, ...loaded };

  if (expected.ganadoStock) {
    merged.ganadoStock = normalizeGanadoStockData(loaded.ganadoStock, expected.ganadoStock);
  }

  if (expected.porCobrar) {
    merged.porCobrar = normalizePorCobrarData(loaded.porCobrar, expected.porCobrar);
  }

  if (expected.resultadoEjercicio) {
    merged.resultadoEjercicio = normalizeResultadoEjercicioData(
      loaded.resultadoEjercicio,
      expected.resultadoEjercicio,
    );
  }

  return merged;
}

export function pctSeguro(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((parte / total) * 100);
}

/** La caché solo es válida si incluye los bloques anidados de KPIs compuestos. */
export function isHomeInsightsCacheComplete(
  expected: HomeInsight[],
  cached: HomeInsight[],
): boolean {
  if (cached.length === 0) return false;
  for (const exp of expected) {
    const item = cached.find((c) => c.id === exp.id);
    if (!item) return false;
    if (exp.ganadoStock && !item.ganadoStock) return false;
    if (exp.porCobrar && !item.porCobrar) return false;
    if (exp.resultadoEjercicio && !item.resultadoEjercicio) return false;
  }
  return true;
}
