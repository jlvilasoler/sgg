import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAuthActividad,
  fetchNotas,
  fetchResumen,
  fetchSimulacionesVentaGanado,
  fetchStockGanaderoResumen,
  fetchVentasAgricultura,
  fetchVentasArrendamientos,
} from "../api";
import type { AuthActividadLog, AuthUser, Nota } from "../types";
import type { TabId } from "../components/Header";
import {
  canAccessIngresosVentasModulo,
  canAccessScreen,
  canAccessSimuladorVentaGanado,
  listHomeActividadPanels,
  type HomeActividadPanelState,
} from "../utils/auth-permissions";
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
import { ejercicioVigente } from "../utils/ejercicio-contable";

export interface HomeInsight {
  id: string;
  tab: TabId;
  label: string;
  value: string;
  hint: string;
  tone: "default" | "danger" | "accent" | "ok";
}

const FETCH_TIMEOUT_MS = 18_000;
const INSIGHTS_TIMEOUT_MS = 30_000;
const PANEL_TIMEOUT_MS = 10_000;
const HOME_NOTAS_PREVIEW_LIMIT = 8;
const HOME_ACTIVIDAD_PREVIEW_LIMIT = 7;

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

/** Ejercicio contable vigente (1/7–30/6), acumulado hasta fin del mes calendario actual. */
function ejercicioActualRango(): { desde: string; hasta: string; ejercicioLabel: string } {
  const ej = ejercicioVigente();
  const { hasta: mesHasta } = mesActualRango();
  const hasta = mesHasta <= ej.hasta ? mesHasta : ej.hasta;
  return { desde: ej.desde, hasta, ejercicioLabel: ej.label };
}

function totalGastosUsdResumen(resumen: {
  por_empresa?: { total_saldo_usd: number }[];
  por_rubro?: { total_saldo_usd: number }[];
}): number {
  const porEmpresa = resumen.por_empresa ?? [];
  const porRubro = resumen.por_rubro ?? [];
  if (porEmpresa.length > 0) {
    return porEmpresa.reduce((s, e) => s + (Number(e.total_saldo_usd) || 0), 0);
  }
  return porRubro.reduce((s, r) => s + (Number(r.total_saldo_usd) || 0), 0);
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
  "stock-ganado-activo",
  "ganado-por-vender",
  "arrendamientos-por-recibir",
  "agricultura-por-recibir",
  "gastos-mes",
  "gastos-anio",
] as const;

export function buildExpectedHomeInsights(user: AuthUser): HomeInsight[] {
  const items: HomeInsight[] = [];

  if (canAccessScreen(user, "registro") || canAccessScreen(user, "listado")) {
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
      hint: "Jul–Jun · UYU y BRL en USD",
      tone: "default",
    });
  }

  if (canAccessScreen(user, "stock_ganadero")) {
    items.push({
      id: "stock-ganado-activo",
      tab: "stock_ganadero",
      label: "Ganado activo",
      value: formatEntero(0),
      hint: "Dispositivos activos en stock",
      tone: "ok",
    });
  }

  if (canAccessSimuladorVentaGanado(user)) {
    items.push({
      id: "ganado-por-vender",
      tab: "simulador_venta_ganado",
      label: "Ganado por vender",
      value: formatEntero(0),
      hint: "Sin operaciones pendientes",
      tone: "accent",
    });
  }

  if (canAccessIngresosVentasModulo(user)) {
    items.push({
      id: "arrendamientos-por-recibir",
      tab: "ingresos_ventas",
      label: "Arrendamientos",
      value: formatUsd(0),
      hint: "Sin cobros pendientes",
      tone: "ok",
    });
    items.push({
      id: "agricultura-por-recibir",
      tab: "ingresos_ventas",
      label: "Agricultura",
      value: formatUsd(0),
      hint: "Sin ventas pendientes",
      tone: "ok",
    });
  }

  return ordenarInsightsHome(items);
}

function mergeInsightsWithExpected(user: AuthUser, loaded: HomeInsight[]): HomeInsight[] {
  const byId = new Map(buildExpectedHomeInsights(user).map((item) => [item.id, { ...item }]));
  for (const item of loaded) {
    if (byId.has(item.id)) byId.set(item.id, item);
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

function ordenarNotasDestacadas(notas: Nota[]): Nota[] {
  return [...notas].sort((a, b) => {
    if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
    const aTs = a.actualizado_en ?? "";
    const bTs = b.actualizado_en ?? "";
    return bTs.localeCompare(aTs);
  });
}

function proximosDesdeCache(): VencImpCuotaConsolidada[] {
  const cached = getVencimientosImpuestosCache();
  if (!cached) return [];
  return buildVencimientosProximosHome(cached, 4);
}

export function useHomeDashboard(user: AuthUser, apiOnline: boolean) {
  const userId = user.id;
  const puedeNotas = canAccessScreen(user, "notas");
  const puedeVencimientos = canAccessScreen(user, "vencimientos_impuestos");
  const actividadPanelConfigs = useMemo(() => listHomeActividadPanels(user), [
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

  const [extraInsights, setExtraInsights] = useState<HomeInsight[]>(() =>
    getHomeInsightsCache(userId)
  );
  const [loadingInsights, setLoadingInsights] = useState(
    () => apiOnline && getHomeInsightsCache(userId).length === 0
  );
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

    void withTimeout(fetchNotas({ limit: HOME_NOTAS_PREVIEW_LIMIT }), PANEL_TIMEOUT_MS)
      .then((data) => {
        if (cancelled) return;
        const sorted = ordenarNotasDestacadas(data);
        setNotas(sorted);
        setHomeNotasCache(userId, sorted);
      })
      .catch(() => {
        if (!cancelled && cached.length === 0) setNotas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingNotas(false);
      });

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

    void withTimeout(loadVencimientosImpuestosBootstrap())
      .then((bootstrap) => {
        if (!cancelled) {
          setProximosVenc(buildVencimientosProximosHome(bootstrap, 4));
        }
      })
      .catch(() => {
        if (!cancelled && cached.length === 0) setProximosVenc([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVenc(false);
      });

    return () => {
      cancelled = true;
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

    return () => {
      cancelled = true;
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
    const cached = getHomeInsightsCache(userId);
    if (cached.length > 0) {
      setExtraInsights(cached);
    }

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

    if (canAccessScreen(user, "registro") || canAccessScreen(user, "listado")) {
      const { desde, hasta } = mesActualRango();
      const { desde: desdeEjercicio, hasta: hastaEjercicio, ejercicioLabel } =
        ejercicioActualRango();
      jobs.push(
        runJobs(
          "gastos",
          Promise.all([
            fetchResumen({ fecha_desde: desde, fecha_hasta: hasta }),
            fetchResumen({ fecha_desde: desdeEjercicio, fecha_hasta: hastaEjercicio }),
          ]).then(([resumenMes, resumenAnio]) => {
            const totalMes = totalGastosUsdResumen(resumenMes);
            const totalAnio = totalGastosUsdResumen(resumenAnio);
            return [
              {
                id: "gastos-mes",
                tab: "listado" as TabId,
                label: "Gastos del mes",
                value: formatUsd(totalMes),
                hint: "Monto incluye UYU y BRL",
                tone: "default" as const,
              },
              {
                id: "gastos-anio",
                tab: "listado" as TabId,
                label: "Gastos del año",
                value: formatUsd(totalAnio),
                hint: `${ejercicioLabel} · UYU y BRL en USD`,
                tone: "default" as const,
              },
            ];
          })
        )
      );
    }

    if (canAccessScreen(user, "stock_ganadero")) {
      jobs.push(
        runJob(
          "stock-ganado-activo",
          fetchStockGanaderoResumen().then((resumen) => ({
            id: "stock-ganado-activo",
            tab: "stock_ganadero",
            label: "Ganado activo",
            value: formatEntero(resumen.dispositivos),
            hint:
              resumen.lotes > 0
                ? `${formatEntero(resumen.lotes)} lote(s) · dispositivos vivos`
                : "Dispositivos activos en stock",
            tone: "ok" as const,
          }))
        )
      );
    }

    if (canAccessSimuladorVentaGanado(user)) {
      jobs.push(
        runJob(
          "ganado-por-vender",
          fetchSimulacionesVentaGanado({ limit: 120 }).then((rows) => {
            const pendientes = rows.filter((r) => !r.venta_realizada);
            const animales = pendientes.reduce(
              (s, r) => s + (r.dispositivos_count || r.cantidad_animales || 0),
              0
            );
            const usd = pendientes.reduce((s, r) => s + (r.total_usd || 0), 0);
            return {
              id: "ganado-por-vender",
              tab: "simulador_venta_ganado",
              label: "Ganado por vender",
              value: formatEntero(animales),
              hint:
                pendientes.length > 0
                  ? `${pendientes.length} operación(es) · ${formatUsd(usd)} estimado`
                  : "Sin operaciones pendientes",
              tone: "accent" as const,
            };
          })
        )
      );
    }

    if (canAccessIngresosVentasModulo(user)) {
      jobs.push(
        runJob(
          "arrendamientos-por-recibir",
          fetchVentasArrendamientos().then((rows) => {
            const pendientes = rows.filter((r) => !r.venta_realizada);
            const usd = pendientes.reduce((s, r) => s + (r.total_usd || 0), 0);
            return {
              id: "arrendamientos-por-recibir",
              tab: "ingresos_ventas",
              label: "Arrendamientos",
              value: formatUsd(usd),
              hint:
                pendientes.length > 0
                  ? `${pendientes.length} contrato(s) por recibir`
                  : "Sin cobros pendientes",
              tone: "ok" as const,
            };
          })
        ),
        runJob(
          "agricultura-por-recibir",
          fetchVentasAgricultura().then((rows) => {
            const pendientes = rows.filter((r) => !r.venta_realizada);
            const usd = pendientes.reduce((s, r) => s + (r.importe_usd || 0), 0);
            return {
              id: "agricultura-por-recibir",
              tab: "ingresos_ventas",
              label: "Agricultura",
              value: formatUsd(usd),
              hint:
                pendientes.length > 0
                  ? `${pendientes.length} venta(s) por recibir`
                  : "Sin ventas pendientes",
              tone: "ok" as const,
            };
          })
        )
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
          const next = ordenarInsightsHome([...byId.values()]);
          setHomeInsightsCache(userId, next);
          return next;
        });
      }
      setLoadingInsights(false);
      setInsightsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, userId, permissionsKey]);

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
