import type { UserPublic } from "./auth-db.js";

/** Usuario con actividad reciente en la app (ms). */
export const ONLINE_TIMEOUT_MS = 3 * 60 * 1000;
const TOUCH_THROTTLE_MS = 20 * 1000;

export interface UsuarioOnline {
  email: string;
  nombre: string;
  rol: string;
  ip: string | null;
  pantalla: string | null;
  ultimo_visto: string;
  hace_segundos: number;
}

type PresenceEntry = {
  email: string;
  nombre: string;
  rol: string;
  ip: string | null;
  pantalla: string | null;
  lastSeen: number;
};

const presence = new Map<string, PresenceEntry>();

function purgeStale(now = Date.now()): void {
  for (const [key, entry] of presence) {
    if (now - entry.lastSeen > ONLINE_TIMEOUT_MS) presence.delete(key);
  }
}

export function touchUserPresence(
  user: Pick<UserPublic, "email" | "nombre" | "rol">,
  meta?: { ip?: string; pantalla?: string }
): void {
  const key = user.email.toLowerCase();
  const now = Date.now();
  const existing = presence.get(key);
  const pantalla = meta?.pantalla?.trim() || existing?.pantalla || null;

  if (
    existing &&
    now - existing.lastSeen < TOUCH_THROTTLE_MS &&
    !meta?.pantalla &&
    pantalla === existing.pantalla
  ) {
    return;
  }

  presence.set(key, {
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    ip: meta?.ip ?? existing?.ip ?? null,
    pantalla,
    lastSeen: now,
  });
}

export function removeUserPresence(email: string): void {
  presence.delete(email.toLowerCase());
}

export function listOnlineUsers(): UsuarioOnline[] {
  const now = Date.now();
  purgeStale(now);
  const result: UsuarioOnline[] = [];
  for (const entry of presence.values()) {
    if (now - entry.lastSeen > ONLINE_TIMEOUT_MS) continue;
    result.push({
      email: entry.email,
      nombre: entry.nombre,
      rol: entry.rol,
      ip: entry.ip,
      pantalla: entry.pantalla,
      ultimo_visto: new Date(entry.lastSeen).toISOString(),
      hace_segundos: Math.max(0, Math.floor((now - entry.lastSeen) / 1000)),
    });
  }
  result.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return result;
}
