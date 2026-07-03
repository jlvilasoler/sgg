import { fetchVencimientosImpuestosBootstrap } from "../api";
import type {
  ContribucionRuralCalendariosStore,
  UserVencimientosImpuestosPrefs,
} from "../types/contribucion-rural";
import type { PatenteSuciveCalendariosStore } from "../types/patente-sucive";
import type { BpsCajaRuralCalendariosStore } from "../types/bps-caja-rural";
import type { PrimariaRuralCalendariosStore } from "../types/primaria-rural";

export interface VencimientosImpuestosBootstrap {
  rural: ContribucionRuralCalendariosStore;
  patente: PatenteSuciveCalendariosStore;
  bps: BpsCajaRuralCalendariosStore;
  primaria: PrimariaRuralCalendariosStore;
  preferencias: UserVencimientosImpuestosPrefs | null;
}

const STORAGE_KEY = "scg:venc-imp-bootstrap-v3";

let memoryCache: VencimientosImpuestosBootstrap | null = null;
let inflight: Promise<VencimientosImpuestosBootstrap> | null = null;

function cacheVersion(data: VencimientosImpuestosBootstrap): string {
  return `${data.rural.updatedAt}|${data.patente.updatedAt}|${data.bps.updatedAt}|${data.primaria.updatedAt}|${data.preferencias?.actualizado_en ?? ""}`;
}

function readStorage(): VencimientosImpuestosBootstrap | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VencimientosImpuestosBootstrap;
    if (
      !parsed?.rural?.jurisdicciones ||
      !parsed?.patente?.calendario ||
      !parsed?.bps?.calendario ||
      !parsed?.primaria?.calendario
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getVencimientosImpuestosCache(): VencimientosImpuestosBootstrap | null {
  if (memoryCache) return memoryCache;
  const stored = readStorage();
  if (stored) memoryCache = stored;
  return stored;
}

export function setVencimientosImpuestosCache(data: VencimientosImpuestosBootstrap): void {
  memoryCache = data;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / modo privado */
  }
}

export function invalidateVencimientosImpuestosCache(): void {
  memoryCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("scg:venc-imp-bootstrap-v2");
    sessionStorage.removeItem("scg:venc-imp-bootstrap-v1");
  } catch {
    /* noop */
  }
}

export async function loadVencimientosImpuestosBootstrap(
  options: { force?: boolean } = {},
): Promise<VencimientosImpuestosBootstrap> {
  const cached = options.force ? null : getVencimientosImpuestosCache();
  if (cached && !options.force) {
    void refreshVencimientosImpuestosBootstrap(cached);
    return cached;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const data = await fetchVencimientosImpuestosBootstrap();
    setVencimientosImpuestosCache(data);
    return data;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

async function refreshVencimientosImpuestosBootstrap(
  previous: VencimientosImpuestosBootstrap,
): Promise<void> {
  if (inflight) return;
  try {
    const fresh = await fetchVencimientosImpuestosBootstrap();
    if (cacheVersion(fresh) !== cacheVersion(previous)) {
      setVencimientosImpuestosCache(fresh);
    }
  } catch {
    /* silencioso en segundo plano */
  }
}

export function prefetchVencimientosImpuestos(): void {
  if (getVencimientosImpuestosCache() || inflight) return;
  void loadVencimientosImpuestosBootstrap().catch(() => {
    /* prefetch best-effort */
  });
}
