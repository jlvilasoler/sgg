import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAuthActividad,
  fetchEstadoResultados,
  fetchNotas,
  fetchPresupuesto,
  fetchSimulacionesVentaGanado,
  fetchStockGanaderoResumen,
  fetchVentasAgricultura,
  fetchVentasArrendamientos,
  fetchVentasGanadoCerradas,
} from "../api";
import type { AuthUser, EstadoResultadosVentasDetalle, Nota, SimuladorVentaGanadoRow } from "../types";
import type { TabId } from "../components/Header";
import {
  canAccessHomeVentasEjercicio,
  canAccessIngresosVentasModulo,
  canAccessScreen,
  canAccessSimuladorVentaGanado,
  listHomeActividadPanels,
  type HomeActividadPanelState,
} from "../utils/auth-permissions";
import { canShowHomePanel } from "../utils/home-layout-config";
import { buildVencimientosProximosHome } from "../utils/vencimientos-impuestos-alertas";
import {
  getVencimientosImpuestosCache,
  loadVencimientosImpuestosBootstrap,
} from "../utils/vencimientos-impuestos-cache";
import type { VencImpCuotaConsolidada } from "../utils/vencimientos-impuestos-total";
import {
  getRecentHomeModules,
  mergeRecentModuleLists,
  parseRecentScreensFromActividad,
} from "../utils/home-quick-modules";
import {
  getHomeInsightsCache,
  setHomeInsightsCache,
} from "../utils/home-insights-cache";
import {
  getHomeActividadCache,
  getHomeNotasCache,
  setHomeActividadCache,
  setHomeNotasCache,
} from "../utils/home-panel-cache";
import {
  HOME_NOTAS_PREVIEW_LIMIT,
  ordenarNotasDestacadas,
} from "../utils/home-notas";
import {
  ejercicioConfigFromUser,
  ejercicioVigente,
  labelEjercicio,
  anioInicioEjercicioVigente,
  type EjercicioConfig,
} from "../utils/ejercicio-contable";
import { sumTotalUsdPresupuesto } from "../utils/presupuesto-total-usd";
import {
  hintVentasEjercicio,
  mergeVentasDetalleEjercicio,
  resumenAgriculturaPorRecibir,
  resumenArrendamientosPorRecibir,
  resumenGanadoCobradoEjercicio,
  resumenGanadoPorVender,
  totalGastosEstadoResultados,
  ventasDetalleCobradasEjercicio,
} from "../utils/home-kpi-utils";
import { mergeHomeInsight, isHomeInsightsCacheComplete } from "../utils/home-kpi-normalize";

export interface HomeGanadoStockData {
  activos: number;
  lotes: number;
  machos: number;
  hembras: number;
  sinDefinir: number;
  ejercicioLabel: string;
  tieneStock: boolean;
  tieneSimulador: boolean;
  tieneVendido: boolean;
  animalesPorVender: number;
  porVenderOperaciones: number;
  animalesVendidosEjercicio: number;
  vendidoOperacionesEjercicio: number;
  /** Stock en la misma fecha del ejercicio anterior (null si no hay datos). */
  stockEjercicioAnterior: number | null;
  /** % de variación vs ejercicio anterior (null si no hay comparación). */
  crecimientoStockPct: number | null;
  tieneComparacionStock: boolean;
}

export interface HomeResultadoEjercicioData {
  ejercicioLabel: string;
  gastosMes: number;
  gastosAnio: number;
  ventasAnio: number;
}

export interface HomePorCobrarModuloData {
  pendienteUsd: number;
  cobradoEjercicioUsd: number;
  tiene: boolean;
  /** Arrendamientos: contratos pendientes. */
  contratos?: number;
  /** Ganado: operaciones pendientes. */
  operaciones?: number;
  /** Agricultura: ventas pendientes. */
  ventas?: number;
}

export interface HomePorCobrarData {
  totalUsd: number;
  ejercicioLabel: string;
  /** Muestra columna «Cobr. ej.» (ventas realizadas en el ejercicio). */
  muestraCobradoEjercicio: boolean;
  arrendamientos: HomePorCobrarModuloData;
  ganado: HomePorCobrarModuloData;
  agricultura: HomePorCobrarModuloData;
}

export interface HomeInsight {
  id: string;
  tab: TabId;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "danger" | "accent" | "ok";
  /** Valor numérico USD cuando aplica (gastos, etc.). */
  amountUsd?: number;
  /** KPI stock ganadero activo. */
  ganadoStock?: HomeGanadoStockData;
  /** KPI unificado por cobrar (arrend. + ganado + agric.). */
  porCobrar?: HomePorCobrarData;
  /** KPI P&amp;L del ejercicio (ventas, gastos, utilidad, margen). */
  resultadoEjercicio?: HomeResultadoEjercicioData;
}

const FETCH_TIMEOUT_MS = 18_000;
const INSIGHTS_TIMEOUT_MS = 30_000;
const PANEL_TIMEOUT_MS = 30_000;
/** El pizarrón y paneles livianos arrancan primero; KPIs pesados después. */
const HOME_STAGGER_VENC_MS = 350;
const HOME_STAGGER_ACTIVIDAD_MS = 500;
const HOME_STAGGER_KPIS_MS = 900;
const HOME_ACTIVIDAD_PREVIEW_LIMIT = 7;

function fetchSafe<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch(() => null);
}

function withTimeout<T>(promise: Promise<T>, ms = FETCH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function mesActualRango(): { desde: string; hasta: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const desde = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const ultimo = new Date(y, m + 1, 0);
  const hasta = `${y}-${String(m + 1).padStart(2, "0")}-${String(ultimo.getDate()).padStart(2, "0")}`;
  return { desde, hasta };
}

/** Ejercicio contable vigente (según cuenta), acumulado hasta fin del mes calendario actual. */
function ejercicioActualRango(
  cfg?: EjercicioConfig,
): { desde: string; hasta: string; ejercicioLabel: string } {
  const ej = ejercicioVigente(new Date(), cfg);
  const { hasta: mesHasta } = mesActualRango();
  const hasta = mesHasta <= ej.hasta ? mesHasta : ej.hasta;
  return { desde: ej.desde, hasta, ejercicioLabel: ej.label };
}

function totalGastosUsdRows(rows: Parameters<typeof sumTotalUsdPresupuesto>[0]): number {
  return sumTotalUsdPresupuesto(rows);
}

/** Gastos de toda la cuenta en KPIs del inicio (no solo los propios). */
function presupuestoFiltroCuentaHome(user: AuthUser): { ver_todos?: boolean } {
  if (user.rol === "admin") return {};
  if (user.rol === "editor" || user.rol === "gestor_n2" || user.rol === "consulta") {
    return { ver_todos: true };
  }
  return {};
}

function formatEntero(n: number): string {
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(n);
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const HOME_INSIGHT_ORDER = [
  "ganado-stock",
  "por-cobrar",
  "ventas-ejercicio",
  "gastos-mes",
  "gastos-anio",
] as const;

function puedeHomeGanadoStock(user: AuthUser): boolean {
  if (!canShowHomePanel(user, "kpis_operativos")) return false;
  return canAccessScreen(user, "stock_ganadero") || canAccessSimuladorVentaGanado(user);
}

function puedeHomePorCobrar(user: AuthUser): boolean {
  if (!canShowHomePanel(user, "kpis_operativos")) return false;
  return canAccessIngresosVentasModulo(user) || canAccessSimuladorVentaGanado(user);
}

function buildGanadoStockInsight(
  resumen: {
    dispositivos: number;
    lotes: number;
    machos?: number;
    hembras?: number;
    sin_definir?: number;
    comparacion_ejercicio_anterior?: {
      disponible?: boolean;
      stock_anterior?: number | null;
      crecimiento_pct?: number | null;
    };
  } | null,
  simRowsAbiertas: SimuladorVentaGanadoRow[] | null,
  simRowsCerradas: SimuladorVentaGanadoRow[] | null,
  flags: {
    tieneStock: boolean;
    tieneSimulador: boolean;
    tieneVendido: boolean;
  },
  ejercicio: { desde: string; hasta: string; ejercicioLabel: string },
): HomeInsight {
  const activos = resumen?.dispositivos ?? 0;
  const lotes = resumen?.lotes ?? 0;
  const porVender = simRowsAbiertas
    ? resumenGanadoPorVender(simRowsAbiertas)
    : { operaciones: 0, animales: 0, usd: 0 };
  const vendido = simRowsCerradas
    ? resumenGanadoCobradoEjercicio(simRowsCerradas, ejercicio.desde, ejercicio.hasta)
    : { operaciones: 0, animales: 0, usd: 0 };

  const comparacion = resumen?.comparacion_ejercicio_anterior;

  const ganadoStock: HomeGanadoStockData = {
    activos,
    lotes,
    machos: resumen?.machos ?? 0,
    hembras: resumen?.hembras ?? 0,
    sinDefinir: resumen?.sin_definir ?? 0,
    ejercicioLabel: ejercicio.ejercicioLabel,
    tieneStock: flags.tieneStock,
    tieneSimulador: flags.tieneSimulador,
    tieneVendido: flags.tieneVendido,
    animalesPorVender: porVender.animales,
    porVenderOperaciones: porVender.operaciones,
    animalesVendidosEjercicio: vendido.animales,
    vendidoOperacionesEjercicio: vendido.operaciones,
    stockEjercicioAnterior: comparacion?.stock_anterior ?? null,
    crecimientoStockPct: comparacion?.crecimiento_pct ?? null,
    tieneComparacionStock: comparacion?.disponible === true,
  };

  const hintPartes: string[] = [];
  if (flags.tieneStock && activos > 0) hintPartes.push(`${formatEntero(activos)} en stock`);
  if (flags.tieneVendido && vendido.animales > 0) {
    hintPartes.push(`${formatEntero(vendido.animales)} vendidos`);
  }
  if (flags.tieneSimulador && porVender.animales > 0) {
    hintPartes.push(`${formatEntero(porVender.animales)} por vender`);
  }

  return {
    id: "ganado-stock",
    tab: "stock_ganadero",
    label: "Ganado",
    value: formatEntero(activos),
    hint:
      hintPartes.length > 0
        ? `${ejercicio.ejercicioLabel} · ${hintPartes.join(" · ")}`
        : `${ejercicio.ejercicioLabel} · stock y ventas`,
    tone: "ok",
    ganadoStock,
  };
}

function hintPorCobrar(data: HomePorCobrarData): string {
  const partes: string[] = [];
  if (data.arrendamientos.tiene && data.arrendamientos.pendienteUsd > 0.5) {
    partes.push(`Arrend. ${formatUsd(data.arrendamientos.pendienteUsd)}`);
  }
  if (data.ganado.tiene && data.ganado.pendienteUsd > 0.5) {
    partes.push(`Ganado ${formatUsd(data.ganado.pendienteUsd)}`);
  }
  if (data.agricultura.tiene && data.agricultura.pendienteUsd > 0.5) {
    partes.push(`Agric. ${formatUsd(data.agricultura.pendienteUsd)}`);
  }
  if (partes.length === 0) {
    return `${data.ejercicioLabel} · sin cobros pendientes`;
  }
  return `${data.ejercicioLabel} · ${partes.join(" + ")}`;
}

function buildPorCobrarInsight(
  arrendRows: Awaited<ReturnType<typeof fetchVentasArrendamientos>> | null,
  agricRows: Awaited<ReturnType<typeof fetchVentasAgricultura>> | null,
  simRowsAbiertas: SimuladorVentaGanadoRow[] | null,
  simRowsCerradas: SimuladorVentaGanadoRow[] | null,
  er: Awaited<ReturnType<typeof fetchEstadoResultados>> | null,
  flags: {
    tieneArrendamientos: boolean;
    tieneAgricultura: boolean;
    tieneGanado: boolean;
    tieneCobrado: boolean;
  },
  ejercicio: { desde: string; hasta: string; ejercicioLabel: string },
): HomeInsight {
  const { ejercicioLabel, desde, hasta } = ejercicio;
  const arrend = arrendRows
    ? resumenArrendamientosPorRecibir(arrendRows)
    : { contratos: 0, usd: 0 };
  const agric = agricRows
    ? resumenAgriculturaPorRecibir(agricRows)
    : { ventas: 0, usd: 0 };
  const ganado = simRowsAbiertas
    ? resumenGanadoPorVender(simRowsAbiertas)
    : { operaciones: 0, animales: 0, usd: 0 };
  const detalleFilas =
    flags.tieneCobrado && (arrendRows || agricRows || simRowsCerradas)
      ? ventasDetalleCobradasEjercicio(arrendRows, agricRows, simRowsCerradas, desde, hasta)
      : null;
  const detalle = mergeVentasDetalleEjercicio(er?.ventas_detalle, detalleFilas);

  const porCobrar: HomePorCobrarData = {
    totalUsd: arrend.usd + agric.usd + ganado.usd,
    ejercicioLabel,
    muestraCobradoEjercicio: flags.tieneCobrado,
    arrendamientos: {
      contratos: arrend.contratos,
      pendienteUsd: arrend.usd,
      cobradoEjercicioUsd: flags.tieneCobrado ? detalle.arrendamientos : 0,
      tiene: flags.tieneArrendamientos,
    },
    ganado: {
      operaciones: ganado.operaciones,
      pendienteUsd: ganado.usd,
      cobradoEjercicioUsd: flags.tieneCobrado ? detalle.ganado : 0,
      tiene: flags.tieneGanado,
    },
    agricultura: {
      ventas: agric.ventas,
      pendienteUsd: agric.usd,
      cobradoEjercicioUsd: flags.tieneCobrado ? detalle.agricultura : 0,
      tiene: flags.tieneAgricultura,
    },
  };

  return {
    id: "por-cobrar",
    tab: "ingresos_ventas",
    label: "Por cobrar",
    value: formatUsd(porCobrar.totalUsd),
    hint: hintPorCobrar(porCobrar),
    tone: "ok",
    porCobrar,
  };
}

function buildResultadoEjercicioInsight(
  er: Awaited<ReturnType<typeof fetchEstadoResultados>>,
  ejercicioLabel: string,
  gastosMes: number,
  detalleOverride?: EstadoResultadosVentasDetalle,
): HomeInsight {
  const detalle = detalleOverride ?? er.ventas_detalle;
  const ventas =
    Math.round((detalle.ganado + detalle.agricultura + detalle.arrendamientos) * 100) / 100;
  const gastos = totalGastosEstadoResultados(er);
  const resultadoEjercicio: HomeResultadoEjercicioData = {
    ejercicioLabel,
    gastosMes,
    gastosAnio: gastos,
    ventasAnio: ventas,
  };

  return {
    id: "ventas-ejercicio",
    tab: "resumen",
    label: "Resumen financiero",
    value: formatUsd(ventas),
    hint: `${ejercicioLabel} · ${hintVentasEjercicio(detalle, ejercicioLabel)}`,
    tone: "ok",
    resultadoEjercicio,
  };
}

function buildResultadoEjercicioFallback(
  gastosUsd: number,
  ejercicioLabel: string,
  gastosMes: number,
): HomeInsight {
  const resultadoEjercicio: HomeResultadoEjercicioData = {
    ejercicioLabel,
    gastosMes,
    gastosAnio: gastosUsd,
    ventasAnio: 0,
  };
  return {
    id: "ventas-ejercicio",
    tab: "resumen",
    label: "Resumen financiero",
    value: formatUsd(0),
    hint:
      gastosUsd > 0.5
        ? `${ejercicioLabel} · gastos ${formatUsd(gastosUsd)} · sin ventas registradas`
        : `${ejercicioLabel} · sin movimientos`,
    tone: "ok",
    resultadoEjercicio,
  };
}

export function buildExpectedHomeInsights(user: AuthUser): HomeInsight[] {
  const items: HomeInsight[] = [];

  if (
    canShowHomePanel(user, "kpis_gastos") &&
    (canAccessScreen(user, "registro") || canAccessScreen(user, "listado"))
  ) {
    items.push({
      id: "gastos-mes",
      tab: "listado",
      label: "Gastos del mes",
      value: formatUsd(0),
      hint: "Monto incluye UYU y BRL",
      tone: "default",
    });
    items.push({
      id: "gastos-anio",
      tab: "listado",
      label: "Gastos del año",
      value: formatUsd(0),
      hint: `${labelEjercicio(anioInicioEjercicioVigente(new Date(), ejercicioConfigFromUser(user)), ejercicioConfigFromUser(user))} · UYU y BRL en USD`,
      tone: "default",
    });
  }

  if (puedeHomeGanadoStock(user)) {
    const ejCfg = ejercicioConfigFromUser(user);
    const { ejercicioLabel } = ejercicioActualRango(ejCfg);
    const tieneStock = canAccessScreen(user, "stock_ganadero");
    const tieneSimulador = canAccessSimuladorVentaGanado(user);
    const tieneVendido = canAccessHomeVentasEjercicio(user);
    items.push({
      id: "ganado-stock",
      tab: "stock_ganadero",
      label: "Ganado",
      value: formatEntero(0),
      hint: `${ejercicioLabel} · stock y ventas`,
      tone: "ok",
      ganadoStock: {
        activos: 0,
        lotes: 0,
        machos: 0,
        hembras: 0,
        sinDefinir: 0,
        ejercicioLabel,
        tieneStock,
        tieneSimulador,
        tieneVendido,
        animalesPorVender: 0,
        porVenderOperaciones: 0,
        animalesVendidosEjercicio: 0,
        vendidoOperacionesEjercicio: 0,
        stockEjercicioAnterior: null,
        crecimientoStockPct: null,
        tieneComparacionStock: false,
      },
    });
  }

  if (puedeHomePorCobrar(user)) {
    const ejCfg = ejercicioConfigFromUser(user);
    const { ejercicioLabel } = ejercicioActualRango(ejCfg);
    const tieneIngresos = canAccessIngresosVentasModulo(user);
    const tieneGanado = canAccessSimuladorVentaGanado(user);
    items.push({
      id: "por-cobrar",
      tab: "ingresos_ventas",
      label: "Por cobrar",
      value: formatUsd(0),
      hint: `${ejercicioLabel} · sin cobros pendientes`,
      tone: "ok",
      porCobrar: {
        totalUsd: 0,
        ejercicioLabel,
        muestraCobradoEjercicio: canAccessHomeVentasEjercicio(user),
        arrendamientos: {
          contratos: 0,
          pendienteUsd: 0,
          cobradoEjercicioUsd: 0,
          tiene: tieneIngresos,
        },
        ganado: {
          operaciones: 0,
          pendienteUsd: 0,
          cobradoEjercicioUsd: 0,
          tiene: tieneGanado,
        },
        agricultura: {
          ventas: 0,
          pendienteUsd: 0,
          cobradoEjercicioUsd: 0,
          tiene: tieneIngresos,
        },
      },
    });
  }

  if (canShowHomePanel(user, "kpis_operativos") && canAccessHomeVentasEjercicio(user)) {
    const ejCfg = ejercicioConfigFromUser(user);
    const { ejercicioLabel } = ejercicioActualRango(ejCfg);
    items.push({
      id: "ventas-ejercicio",
      tab: "resumen",
      label: "Resumen financiero",
      value: formatUsd(0),
      hint: `${ejercicioLabel} · gastos y ventas`,
      tone: "ok",
      resultadoEjercicio: {
        ejercicioLabel,
        gastosMes: 0,
        gastosAnio: 0,
        ventasAnio: 0,
      },
    });
  }

  return ordenarInsightsHome(items);
}

function mergeInsightsWithExpected(user: AuthUser, loaded: HomeInsight[]): HomeInsight[] {
  const byId = new Map(buildExpectedHomeInsights(user).map((item) => [item.id, { ...item }]));
  for (const item of loaded) {
    const expected = byId.get(item.id);
    if (expected) byId.set(item.id, mergeHomeInsight(expected, item));
  }
  return ordenarInsightsHome([...byId.values()]).slice(0, HOME_INSIGHT_ORDER.length);
}

function ordenarInsightsHome(items: HomeInsight[]): HomeInsight[] {
  const rank = (id: string) => {
    const idx = HOME_INSIGHT_ORDER.indexOf(id as (typeof HOME_INSIGHT_ORDER)[number]);
    return idx === -1 ? HOME_INSIGHT_ORDER.length : idx;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id));
}

function proximosDesdeCache(): VencImpCuotaConsolidada[] {
  const cached = getVencimientosImpuestosCache();
  if (!cached) return [];
  return buildVencimientosProximosHome(cached, 4);
}

export function useHomeDashboard(user: AuthUser, apiOnline: boolean) {
  const userId = user.id;
  const insightsCacheScope = `${userId}:${user.login_mode ?? "consolidado"}:${
    user.empresa_operativa_activa_id ?? "todas"
  }`;
  const puedeNotas = canAccessScreen(user, "notas") && canShowHomePanel(user, "pizarron");
  const puedeVencimientos =
    canAccessScreen(user, "vencimientos_impuestos") && canShowHomePanel(user, "vencimientos");
  const actividadPanelConfigs = useMemo(() => {
    if (!canShowHomePanel(user, "actividad")) return [];
    return listHomeActividadPanels(user);
  }, [
    user.id,
    user.rol,
    user.email,
    user.es_super_admin,
    user.es_admin_plataforma,
    user.cuenta_actividad_id,
    user.empresa_id,
    user.cuenta_actividad_nombre,
    user.empresa_nombre,
  ]);
  const puedeActividad = actividadPanelConfigs.length > 0;

  const [actividadPanels, setActividadPanels] = useState<HomeActividadPanelState[]>(() =>
    actividadPanelConfigs.map((panel) => {
      const cached = getHomeActividadCache(userId, panel.cacheKey, panel.fetchParams.cuentaId);
      return { ...panel, items: cached, loading: cached.length === 0 };
    })
  );

  const [notas, setNotas] = useState<Nota[]>(() => getHomeNotasCache(userId));
  const [loadingNotas, setLoadingNotas] = useState(
    () => puedeNotas && getHomeNotasCache(userId).length === 0
  );

  const [proximosVenc, setProximosVenc] = useState<VencImpCuotaConsolidada[]>(proximosDesdeCache);
  const [loadingVenc, setLoadingVenc] = useState(
    () => puedeVencimientos && proximosDesdeCache().length === 0
  );

  const [recentScreens, setRecentScreens] = useState<TabId[]>(() => getRecentHomeModules(userId));

  const [extraInsights, setExtraInsights] = useState<HomeInsight[]>(() => {
    const cached = getHomeInsightsCache(insightsCacheScope);
    const expected = buildExpectedHomeInsights(user);
    if (!isHomeInsightsCacheComplete(expected, cached)) return expected;
    return mergeInsightsWithExpected(user, cached);
  });
  const [loadingInsights, setLoadingInsights] = useState(() => {
    if (!apiOnline) return false;
    const cached = getHomeInsightsCache(insightsCacheScope);
    const expected = buildExpectedHomeInsights(user);
    return cached.length === 0 || !isHomeInsightsCacheComplete(expected, cached);
  });
  const [insightsReady, setInsightsReady] = useState(false);

  const permissionsKey = useMemo(
    () =>
      [
        user.rol,
        [...(user.permisos ?? [])].sort().join(","),
        user.es_super_admin ? "1" : "0",
      ].join("|"),
    [user.rol, user.permisos, user.es_super_admin]
  );

  useEffect(() => {
    if (!apiOnline || !puedeNotas) {
      setNotas([]);
      setLoadingNotas(false);
      return;
    }

    let cancelled = false;
    const cached = getHomeNotasCache(userId);
    if (cached.length > 0) {
      setNotas(cached);
      setLoadingNotas(false);
    } else {
      setLoadingNotas(true);
    }

    const load = async (attempt = 0): Promise<void> => {
      try {
        // Sin timeout artificial: misma llamada que la pantalla Notas (que sí carga).
        const data = await fetchNotas({ limit: HOME_NOTAS_PREVIEW_LIMIT });
        if (cancelled) return;
        const sorted = ordenarNotasDestacadas(data);
        setNotas(sorted);
        setHomeNotasCache(userId, sorted);
      } catch (err) {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn("[home-notas] falló carga:", err);
        }
        if (attempt < 1) {
          await new Promise((r) => window.setTimeout(r, 1200));
          if (!cancelled) return load(attempt + 1);
        }
        // No vaciar el pizarrón: conservar caché o estado previo.
      } finally {
        if (!cancelled) setLoadingNotas(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [apiOnline, puedeNotas, userId]);

  useEffect(() => {
    if (!apiOnline || !puedeVencimientos) {
      setProximosVenc([]);
      setLoadingVenc(false);
      return;
    }

    let cancelled = false;
    const cached = proximosDesdeCache();
    if (cached.length > 0) {
      setProximosVenc(cached);
      setLoadingVenc(false);
    } else {
      setLoadingVenc(true);
    }

    const timer = window.setTimeout(() => {
      void withTimeout(loadVencimientosImpuestosBootstrap(), PANEL_TIMEOUT_MS)
        .then((bootstrap) => {
          if (!cancelled) {
            setProximosVenc(buildVencimientosProximosHome(bootstrap, 4));
          }
        })
        .catch(() => {
          /* conservar caché previo */
        })
        .finally(() => {
          if (!cancelled) setLoadingVenc(false);
        });
    }, HOME_STAGGER_VENC_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, puedeVencimientos, userId]);

  useEffect(() => {
    if (!apiOnline || actividadPanelConfigs.length === 0) {
      setActividadPanels([]);
      return;
    }

    let cancelled = false;

    setActividadPanels((prev) =>
      actividadPanelConfigs.map((panel) => {
        const cached = getHomeActividadCache(userId, panel.cacheKey, panel.fetchParams.cuentaId);
        const prevPanel = prev.find((p) => p.id === panel.id);
        return {
          ...panel,
          items: cached.length > 0 ? cached : (prevPanel?.items ?? []),
          loading: cached.length === 0,
        };
      })
    );

    const timer = window.setTimeout(() => {
      void Promise.all(
        actividadPanelConfigs.map(async (panel) => {
          const cached = getHomeActividadCache(userId, panel.cacheKey, panel.fetchParams.cuentaId);
          try {
            const result = await withTimeout(
              fetchAuthActividad({
                limite: HOME_ACTIVIDAD_PREVIEW_LIMIT,
                ...panel.fetchParams,
              }),
              PANEL_TIMEOUT_MS
            );
            if (cancelled) return;
            setHomeActividadCache(userId, panel.cacheKey, panel.fetchParams.cuentaId, result.items);
            setActividadPanels((prev) =>
              prev.map((p) =>
                p.id === panel.id ? { ...p, items: result.items, loading: false } : p
              )
            );
          } catch {
            if (cancelled) return;
            setActividadPanels((prev) =>
              prev.map((p) =>
                p.id === panel.id
                  ? { ...p, items: cached.length > 0 ? cached : p.items, loading: false }
                  : p
              )
            );
          }
        })
      );
    }, HOME_STAGGER_ACTIVIDAD_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, userId, actividadPanelConfigs]);

  useEffect(() => {
    const local = getRecentHomeModules(userId);
    setRecentScreens(local);

    if (!apiOnline) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void withTimeout(
        fetchAuthActividad({
          evento: "navegacion",
          limite: 20,
          email: user.email,
        }),
        PANEL_TIMEOUT_MS
      )
        .then((result) => {
          if (cancelled) return;
          const fromApi = parseRecentScreensFromActividad(result.items);
          setRecentScreens(mergeRecentModuleLists(local, fromApi));
        })
        .catch(() => {
          if (!cancelled) setRecentScreens(local);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, userId, user.email]);

  useEffect(() => {
    if (!apiOnline) {
      setLoadingInsights(false);
      return;
    }

    let cancelled = false;
    const cached = getHomeInsightsCache(insightsCacheScope);
    const expected = buildExpectedHomeInsights(user);
    if (cached.length > 0 && isHomeInsightsCacheComplete(expected, cached)) {
      setExtraInsights(mergeInsightsWithExpected(user, cached));
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const jobs: Promise<HomeInsight | HomeInsight[] | null>[] = [];

      const runJob = (
        id: string,
        promise: Promise<HomeInsight>
      ): Promise<HomeInsight | null> =>
        withTimeout(promise, INSIGHTS_TIMEOUT_MS)
          .then((insight) => insight)
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn(`[home-insights] ${id}:`, err);
            }
            return null;
          });

      const runJobs = (
        id: string,
        promise: Promise<HomeInsight[]>
      ): Promise<HomeInsight[] | null> =>
        withTimeout(promise, INSIGHTS_TIMEOUT_MS)
          .then((insights) => insights)
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn(`[home-insights] ${id}:`, err);
            }
            return null;
          });

      if (
        canShowHomePanel(user, "kpis_gastos") &&
        (canAccessScreen(user, "registro") || canAccessScreen(user, "listado"))
      ) {
        const { desde, hasta } = mesActualRango();
        const { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel } =
          ejercicioActualRango(ejercicioConfigFromUser(user));
        jobs.push(
          runJobs(
            "gastos",
            Promise.all([
              fetchPresupuesto({
                fecha_desde: desde,
                fecha_hasta: hasta,
                ...presupuestoFiltroCuentaHome(user),
              }),
              fetchPresupuesto({
                fecha_desde: desdeEjercicio,
                fecha_hasta: hastaEjercicio,
                ...presupuestoFiltroCuentaHome(user),
              }),
            ]).then(([rowsMes, rowsAnio]) => {
              const totalMes = totalGastosUsdRows(rowsMes);
              const totalAnio = totalGastosUsdRows(rowsAnio);
              return [
                {
                  id: "gastos-mes",
                  tab: "listado" as TabId,
                  label: "Gastos del mes",
                  value: formatUsd(totalMes),
                  amountUsd: totalMes,
                  hint: "Monto incluye UYU y BRL",
                  tone: "default" as const,
                },
                {
                  id: "gastos-anio",
                  tab: "listado" as TabId,
                  label: "Gastos del año",
                  value: formatUsd(totalAnio),
                  amountUsd: totalAnio,
                  hint: `${ejercicioLabel} · UYU y BRL en USD`,
                  tone: "default" as const,
                },
              ];
            })
          )
        );
      }

      if (puedeHomeGanadoStock(user)) {
        const tieneStock = canAccessScreen(user, "stock_ganadero");
        const tieneSimulador = canAccessSimuladorVentaGanado(user);
        const tieneVendido = canAccessHomeVentasEjercicio(user);
        const ejCfg = ejercicioConfigFromUser(user);
        const { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel } =
          ejercicioActualRango(ejCfg);
        jobs.push(
          runJob(
            "ganado-stock",
            Promise.all([
              tieneStock ? fetchSafe(fetchStockGanaderoResumen()) : Promise.resolve(null),
              tieneSimulador
                ? fetchSafe(fetchSimulacionesVentaGanado({ limit: 500 }))
                : Promise.resolve(null),
              tieneVendido
                ? fetchSafe(
                    fetchVentasGanadoCerradas({
                      fecha_desde: desdeEjercicio,
                      fecha_hasta: hastaEjercicio,
                    }),
                  )
                : Promise.resolve(null),
            ]).then(([resumen, simAbiertas, simCerradas]) =>
              buildGanadoStockInsight(resumen, simAbiertas, simCerradas, {
                tieneStock,
                tieneSimulador,
                tieneVendido,
              }, { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel })
            )
          )
        );
      }

      if (puedeHomePorCobrar(user)) {
        const tieneIngresos = canAccessIngresosVentasModulo(user);
        const tieneGanado = canAccessSimuladorVentaGanado(user);
        const tieneCobrado = canAccessHomeVentasEjercicio(user);
        const ejCfg = ejercicioConfigFromUser(user);
        const { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel } =
          ejercicioActualRango(ejCfg);
        jobs.push(
          runJob(
            "por-cobrar",
            Promise.all([
              tieneIngresos ? fetchSafe(fetchVentasArrendamientos()) : Promise.resolve(null),
              tieneIngresos ? fetchSafe(fetchVentasAgricultura()) : Promise.resolve(null),
              tieneGanado
                ? fetchSafe(fetchSimulacionesVentaGanado({ limit: 500 }))
                : Promise.resolve(null),
              tieneCobrado && tieneGanado
                ? fetchSafe(
                    fetchVentasGanadoCerradas({
                      fecha_desde: desdeEjercicio,
                      fecha_hasta: hastaEjercicio,
                    }),
                  )
                : Promise.resolve(null),
              tieneCobrado
                ? fetchSafe(
                    fetchEstadoResultados({
                      fecha_desde: desdeEjercicio,
                      fecha_hasta: hastaEjercicio,
                    })
                  )
                : Promise.resolve(null),
            ]).then(([arrendRows, agricRows, simAbiertas, simCerradas, er]) =>
              buildPorCobrarInsight(arrendRows, agricRows, simAbiertas, simCerradas, er, {
                tieneArrendamientos: tieneIngresos,
                tieneAgricultura: tieneIngresos,
                tieneGanado,
                tieneCobrado,
              }, {
                desde: desdeEjercicio,
                hasta: hastaEjercicio,
                ejercicioLabel,
              })
            )
          )
        );
      }

      if (canShowHomePanel(user, "kpis_operativos") && canAccessHomeVentasEjercicio(user)) {
        const tieneIngresos = canAccessIngresosVentasModulo(user);
        const tieneGanado = canAccessSimuladorVentaGanado(user);
        const { desde: desdeMes, hasta: hastaMes } = mesActualRango();
        const { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel } =
          ejercicioActualRango(ejercicioConfigFromUser(user));
        jobs.push(
          runJob(
            "ventas-ejercicio",
            Promise.all([
              fetchSafe(
                fetchEstadoResultados({
                  fecha_desde: desdeEjercicio,
                  fecha_hasta: hastaEjercicio,
                }),
              ),
              tieneIngresos ? fetchSafe(fetchVentasArrendamientos()) : Promise.resolve(null),
              tieneIngresos ? fetchSafe(fetchVentasAgricultura()) : Promise.resolve(null),
              tieneGanado
                ? fetchSafe(
                    fetchVentasGanadoCerradas({
                      fecha_desde: desdeEjercicio,
                      fecha_hasta: hastaEjercicio,
                    }),
                  )
                : Promise.resolve(null),
              fetchSafe(
                fetchPresupuesto({
                  fecha_desde: desdeMes,
                  fecha_hasta: hastaMes,
                  ...presupuestoFiltroCuentaHome(user),
                }),
              ),
            ]).then(async ([er, arrendRows, agricRows, simCerradas, gastosMesRows]) => {
              const gastosMes = gastosMesRows ? sumTotalUsdPresupuesto(gastosMesRows) : 0;
              const detalleFilas = ventasDetalleCobradasEjercicio(
                arrendRows,
                agricRows,
                simCerradas,
                desdeEjercicio,
                hastaEjercicio,
              );
              if (er) {
                const detalle = mergeVentasDetalleEjercicio(er.ventas_detalle, detalleFilas);
                return buildResultadoEjercicioInsight(er, ejercicioLabel, gastosMes, detalle);
              }
              const ventasTotal =
                detalleFilas.ganado + detalleFilas.agricultura + detalleFilas.arrendamientos;
              if (ventasTotal > 0.5) {
                const gastosRows = await fetchSafe(
                  fetchPresupuesto({
                    fecha_desde: desdeEjercicio,
                    fecha_hasta: hastaEjercicio,
                    ...presupuestoFiltroCuentaHome(user),
                  }),
                );
                const gastosUsd = gastosRows ? sumTotalUsdPresupuesto(gastosRows) : 0;
                return {
                  id: "ventas-ejercicio",
                  tab: "resumen" as TabId,
                  label: "Resumen financiero",
                  value: formatUsd(ventasTotal),
                  hint: `${ejercicioLabel} · ${hintVentasEjercicio(detalleFilas, ejercicioLabel)}`,
                  tone: "ok" as const,
                  resultadoEjercicio: {
                    ejercicioLabel,
                    gastosMes,
                    gastosAnio: gastosUsd,
                    ventasAnio: ventasTotal,
                  },
                };
              }
              const rows = await fetchSafe(
                fetchPresupuesto({
                  fecha_desde: desdeEjercicio,
                  fecha_hasta: hastaEjercicio,
                  ...presupuestoFiltroCuentaHome(user),
                }),
              );
              const gastosUsd = rows ? sumTotalUsdPresupuesto(rows) : 0;
              if (gastosUsd <= 0.5) throw new Error("estado-resultados no disponible");
              return buildResultadoEjercicioFallback(gastosUsd, ejercicioLabel, gastosMes);
            }),
          ),
        );
      }

      if (jobs.length === 0) {
        setLoadingInsights(false);
        setInsightsReady(true);
        return;
      }

      setLoadingInsights(true);
      setInsightsReady(false);

      void Promise.all(jobs).then((results) => {
        if (cancelled) return;
        const loaded = results.flatMap((item) => {
          if (item == null) return [];
          return Array.isArray(item) ? item : [item];
        });
        if (loaded.length > 0) {
          setExtraInsights((prev) => {
            const byId = new Map(prev.map((item) => [item.id, item]));
            for (const item of loaded) byId.set(item.id, item);
            const next = mergeInsightsWithExpected(user, [...byId.values()]);
            const expected = buildExpectedHomeInsights(user);
            if (isHomeInsightsCacheComplete(expected, next)) {
              setHomeInsightsCache(insightsCacheScope, next);
            }
            return next;
          });
        }
        setLoadingInsights(false);
        setInsightsReady(true);
      });
    }, HOME_STAGGER_KPIS_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, userId, permissionsKey, user]);

  const insights = useMemo(
    () => mergeInsightsWithExpected(user, extraInsights),
    [user, extraInsights]
  );

  const notasDestacadas = useMemo(() => notas.slice(0, HOME_NOTAS_PREVIEW_LIMIT), [notas]);

  const syncNotas = useCallback(
    (updater: (prev: Nota[]) => Nota[]) => {
      setNotas((prev) => {
        const next = ordenarNotasDestacadas(updater(prev)).slice(0, HOME_NOTAS_PREVIEW_LIMIT);
        setHomeNotasCache(userId, next);
        return next;
      });
    },
    [userId]
  );

  const applyNotaHome = useCallback(
    (nota: Nota) => {
      syncNotas((prev) => {
        const exists = prev.some((n) => n.id === nota.id);
        return exists ? prev.map((n) => (n.id === nota.id ? nota : n)) : [nota, ...prev];
      });
    },
    [syncNotas]
  );

  const removeNotaHome = useCallback(
    (id: number) => {
      syncNotas((prev) => prev.filter((n) => n.id !== id));
    },
    [syncNotas]
  );

  return {
    loadingInsights,
    insightsReady,
    loadingNotas,
    loadingVenc,
    notasDestacadas,
    applyNotaHome,
    removeNotaHome,
    proximosVenc,
    actividadPanels,
    insights,
    recentScreens,
    puedeNotas,
    puedeVencimientos,
    puedeActividad,
  };
}
