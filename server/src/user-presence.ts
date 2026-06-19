import type { UserPublic } from "./auth-db.js";
import type { Db } from "./db/pg-client.js";
import { avatarDtoFromRow } from "./user-avatar-db.js";
import type { UserAvatarDto } from "./user-avatar-db.js";

/** Usuario con actividad reciente en la app (ms). */
export const ONLINE_TIMEOUT_MS = 3 * 60 * 1000;
const TOUCH_THROTTLE_MS = 20 * 1000;

export interface UsuarioOnline {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  avatar: UserAvatarDto;
  ip: string | null;
  pantalla: string | null;
  ultimo_visto: string;
  hace_segundos: number;
}

export interface UserPresenceStatus {
  id: number;
  online: boolean;
  ultimo_visto: string | null;
  hace_segundos: number | null;
  online_desde_segundos: number | null;
}

type PresenceEntry = {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  ip: string | null;
  pantalla: string | null;
  lastSeen: number;
  onlineSince: number;
};

const presence = new Map<string, PresenceEntry>();

function purgeStale(now = Date.now()): void {
  for (const [key, entry] of presence) {
    if (now - entry.lastSeen > ONLINE_TIMEOUT_MS) presence.delete(key);
  }
}

export function touchUserPresence(
  user: Pick<UserPublic, "id" | "email" | "nombre" | "rol">,
  meta?: { ip?: string; pantalla?: string }
): void {
  const key = user.email.toLowerCase();
  const now = Date.now();
  const existing = presence.get(key);
  const pantalla = meta?.pantalla?.trim() || existing?.pantalla || null;
  const wasOffline =
    !existing || now - existing.lastSeen > ONLINE_TIMEOUT_MS;

  if (
    existing &&
    !wasOffline &&
    now - existing.lastSeen < TOUCH_THROTTLE_MS &&
    !meta?.pantalla &&
    pantalla === existing.pantalla
  ) {
    return;
  }

  presence.set(key, {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    ip: meta?.ip ?? existing?.ip ?? null,
    pantalla,
    lastSeen: now,
    onlineSince: wasOffline ? now : (existing?.onlineSince ?? now),
  });
}

export function removeUserPresence(email: string): void {
  presence.delete(email.toLowerCase());
}

export function listOnlineUsers(): Omit<UsuarioOnline, "avatar">[] {
  const now = Date.now();
  purgeStale(now);
  const result: Omit<UsuarioOnline, "avatar">[] = [];
  for (const entry of presence.values()) {
    if (now - entry.lastSeen > ONLINE_TIMEOUT_MS) continue;
    result.push({
      id: entry.id,
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

function presenceEntryByUserId(now = Date.now()): Map<number, PresenceEntry> {
  const map = new Map<number, PresenceEntry>();
  for (const entry of presence.values()) {
    if (now - entry.lastSeen <= ONLINE_TIMEOUT_MS) {
      map.set(entry.id, entry);
    }
  }
  return map;
}

export async function getUsersPresenceStatus(
  db: Db,
  userIds: number[]
): Promise<Record<number, UserPresenceStatus>> {
  const now = Date.now();
  purgeStale(now);
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  const onlineMap = presenceEntryByUserId(now);
  const result: Record<number, UserPresenceStatus> = {};

  const offlineIds: number[] = [];
  for (const id of unique) {
    const entry = onlineMap.get(id);
    if (entry) {
      result[id] = {
        id,
        online: true,
        ultimo_visto: new Date(entry.lastSeen).toISOString(),
        hace_segundos: Math.max(0, Math.floor((now - entry.lastSeen) / 1000)),
        online_desde_segundos: Math.max(
          0,
          Math.floor((now - entry.onlineSince) / 1000)
        ),
      };
      continue;
    }
    offlineIds.push(id);
  }

  if (offlineIds.length > 0) {
    const placeholders = offlineIds.map(() => "?").join(", ");
    const rows = (await db
      .prepare(`SELECT id, ultimo_acceso FROM USERS WHERE id IN (${placeholders})`)
      .all(...offlineIds)) as Array<{ id: number; ultimo_acceso: string | null }>;

    for (const row of rows) {
      const ultimoRaw = row.ultimo_acceso ?? null;
      const ultimoMs = ultimoRaw ? new Date(ultimoRaw).getTime() : NaN;
      const hace =
        Number.isFinite(ultimoMs) && ultimoMs > 0
          ? Math.max(0, Math.floor((now - ultimoMs) / 1000))
          : null;

      result[row.id] = {
        id: row.id,
        online: false,
        ultimo_visto: ultimoRaw,
        hace_segundos: hace,
        online_desde_segundos: null,
      };
    }

    for (const id of offlineIds) {
      if (result[id]) continue;
      result[id] = {
        id,
        online: false,
        ultimo_visto: null,
        hace_segundos: null,
        online_desde_segundos: null,
      };
    }
  }

  return result;
}
