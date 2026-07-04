import type { AuthActividadLog, Nota } from "../types";

const NOTAS_STORAGE_KEY = "scg-home-notas-cache-v1";
const ACTIVIDAD_STORAGE_KEY = "scg-home-actividad-cache-v2";

type NotasPayload = {
  key: string;
  items: Nota[];
};

type ActividadPayload = {
  key: string;
  items: AuthActividadLog[];
};

const notasMemory = new Map<string, Nota[]>();
const actividadMemory = new Map<string, AuthActividadLog[]>();

function notasCacheKey(userId: number): string {
  return String(userId);
}

export function actividadCacheKey(
  userId: number,
  modo: string,
  cuentaId?: number | null
): string {
  return `${userId}:${modo}:${cuentaId ?? "x"}`;
}

function readNotasStorage(): NotasPayload | null {
  try {
    const raw = sessionStorage.getItem(NOTAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotasPayload;
    if (!parsed?.key || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readActividadStorage(): ActividadPayload | null {
  try {
    const raw = sessionStorage.getItem(ACTIVIDAD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActividadPayload;
    if (!parsed?.key || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getHomeNotasCache(userId: number): Nota[] {
  const key = notasCacheKey(userId);
  const fromMemory = notasMemory.get(key);
  if (fromMemory) return fromMemory;

  const stored = readNotasStorage();
  if (!stored || stored.key !== key) return [];

  notasMemory.set(key, stored.items);
  return stored.items;
}

export function setHomeNotasCache(userId: number, items: Nota[]): void {
  const key = notasCacheKey(userId);
  notasMemory.set(key, items);
  try {
    const payload: NotasPayload = { key, items };
    sessionStorage.setItem(NOTAS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / modo privado */
  }
}

export function getHomeActividadCache(
  userId: number,
  modo: string,
  cuentaId?: number | null
): AuthActividadLog[] {
  const key = actividadCacheKey(userId, modo, cuentaId);
  const fromMemory = actividadMemory.get(key);
  if (fromMemory) return fromMemory;

  const stored = readActividadStorage();
  if (!stored || stored.key !== key) return [];

  actividadMemory.set(key, stored.items);
  return stored.items;
}

export function setHomeActividadCache(
  userId: number,
  modo: string,
  cuentaId: number | null | undefined,
  items: AuthActividadLog[]
): void {
  const key = actividadCacheKey(userId, modo, cuentaId);
  actividadMemory.set(key, items);
  try {
    const payload: ActividadPayload = { key, items };
    sessionStorage.setItem(ACTIVIDAD_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / modo privado */
  }
}

export function clearHomeNotasCache(): void {
  notasMemory.clear();
  try {
    sessionStorage.removeItem(NOTAS_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function clearHomeActividadCache(): void {
  actividadMemory.clear();
  try {
    sessionStorage.removeItem(ACTIVIDAD_STORAGE_KEY);
  } catch {
    /* noop */
  }
}
