import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Db } from "./db/pg-client.js";
import {
  hashSessionToken,
  isValidSessionTokenFormat,
  validatePasswordStrength,
} from "./auth-security.js";

export type Rol = "admin" | "editor" | "consulta";

export type Modulo =
  | "presupuesto"
  | "configuracion"
  | "divisas"
  | "rrhh"
  | "ventas"
  | "stock"
  | "usuarios";

export const MODULOS: Modulo[] = [
  "presupuesto",
  "configuracion",
  "divisas",
  "rrhh",
  "ventas",
  "stock",
  "usuarios",
];

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Editor",
  consulta: "Consulta",
};

export const MODULO_LABELS: Record<Modulo, string> = {
  presupuesto: "Presupuesto y gastos",
  configuracion: "Configuración",
  divisas: "Divisas",
  rrhh: "Recursos Humanos",
  ventas: "Ingresos por ventas",
  stock: "Stock ganadero",
  usuarios: "Usuarios y permisos",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: "Acceso total al sistema (no editable)",
  editor: "Acceso y edición según sectores habilitados",
  consulta: "Solo lectura en los sectores habilitados",
};

export interface ModuloAccesoConfig {
  modulo: Modulo;
  label: string;
  acceso: boolean;
}

export interface RolPermisosConfig {
  rol: Rol;
  rol_label: string;
  descripcion: string;
  puede_escribir: boolean;
  modulos: ModuloAccesoConfig[];
  editable: boolean;
}

export interface RolPermisosInput {
  puede_escribir: boolean;
  modulos: Partial<Record<Modulo, boolean>>;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  nombre: string;
  rol: Rol;
  activo: number;
  creado_en: string;
  actualizado_en: string;
  ultimo_acceso: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
}

export interface UserPublic {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  rol_label: string;
  activo: boolean;
  permisos: Modulo[];
  puede_escribir: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
}

export interface UserInput {
  email: string;
  nombre: string;
  rol: Rol;
  activo?: boolean;
  password?: string;
}

const BCRYPT_ROUNDS = 12;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;
const MAX_ACCOUNT_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

const DEFAULT_ADMIN_EMAIL = "jlvilasoler@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "Admin123";
const LEGACY_ADMIN_EMAIL = "admin@scg.local";

/** Hash fijo para igualar tiempo de respuesta cuando el email no existe. */
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "scg-timing-safe-placeholder-v1",
  BCRYPT_ROUNDS
);

const DEFAULT_ROLE_ACCESS: Record<
  Rol,
  { puede_escribir: boolean; modulos: Modulo[] }
> = {
  admin: { puede_escribir: true, modulos: [...MODULOS] },
  editor: {
    puede_escribir: true,
    modulos: MODULOS.filter((m) => m !== "usuarios"),
  },
  consulta: {
    puede_escribir: false,
    modulos: MODULOS.filter((m) => m !== "usuarios"),
  },
};

export async function roleCapabilities(
  db: Db,
  rol: Rol
): Promise<{ permisos: Modulo[]; puede_escribir: boolean }> {
  if (rol === "admin") {
    return { permisos: [...MODULOS], puede_escribir: true };
  }

  const escRow = (await db
    .prepare("SELECT puede_escribir FROM ROLE_ESCRITURA WHERE rol = ?")
    .get(rol)) as { puede_escribir: number } | undefined;

  const modRows = (await db
    .prepare(
      "SELECT modulo FROM ROLE_PERMISOS WHERE rol = ? AND acceso = 1 ORDER BY modulo"
    )
    .all(rol)) as { modulo: string }[];

  const permisos = modRows
    .map((r) => r.modulo as Modulo)
    .filter((m) => MODULOS.includes(m));

  return {
    permisos,
    puede_escribir: pgNum(escRow?.puede_escribir) === 1,
  };
}

/** @deprecated Usar roleCapabilities(db, rol) */
export function permissionsForRol(rol: Rol): Modulo[] {
  return DEFAULT_ROLE_ACCESS[rol].modulos;
}

/** @deprecated Usar roleCapabilities(db, rol) */
export function canWrite(rol: Rol): boolean {
  return DEFAULT_ROLE_ACCESS[rol].puede_escribir;
}

export async function toUserPublic(row: UserRow, db: Db): Promise<UserPublic> {
  const caps = await roleCapabilities(db, row.rol);
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    rol_label: ROL_LABELS[row.rol],
    activo: pgNum(row.activo) === 1,
    permisos: caps.permisos,
    puede_escribir: caps.puede_escribir,
    creado_en: pgTimestampString(row.creado_en) ?? "",
    ultimo_acceso: pgTimestampString(row.ultimo_acceso),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertPasswordPolicy(password: string): void {
  const err = validatePasswordStrength(password);
  if (err) throw new Error(err);
}

export async function recordAuthEvent(
  db: Db,
  evento: string,
  meta?: { email?: string; ip?: string; userAgent?: string; detalle?: string }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO AUTH_AUDIT_LOG (evento, email, ip, user_agent, detalle)
     VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      evento,
      meta?.email ?? null,
      meta?.ip ?? null,
      meta?.userAgent ?? null,
      meta?.detalle ?? null
    );
}

export interface AuthAuditLogRow {
  id: number;
  evento: string;
  email: string | null;
  user_nombre: string | null;
  ip: string | null;
  user_agent: string | null;
  detalle: string | null;
  creado_en: string;
}

export interface AuthAuditLogFilters {
  email?: string;
  evento?: string;
  limite?: number;
  offset?: number;
}

export async function listAuthAuditLog(
  db: Db,
  filters?: AuthAuditLogFilters
): Promise<AuthAuditLogRow[]> {
  const limite = Math.min(300, Math.max(1, filters?.limite ?? 100));
  const offset = Math.max(0, filters?.offset ?? 0);

  let sql = `SELECT a.id, a.evento, a.email, a.ip, a.user_agent, a.detalle, a.creado_en,
                    u.nombre AS user_nombre
             FROM AUTH_AUDIT_LOG a
             LEFT JOIN USERS u ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
             WHERE 1=1`;
  const params: Record<string, unknown> = { limite, offset };

  if (filters?.email?.trim()) {
    sql += ` AND LOWER(a.email) LIKE LOWER(@email)`;
    params.email = `%${filters.email.trim()}%`;
  }
  if (filters?.evento?.trim()) {
    sql += ` AND a.evento = @evento`;
    params.evento = filters.evento.trim();
  }

  sql += ` ORDER BY a.creado_en DESC, a.id DESC LIMIT @limite OFFSET @offset`;

  const rows = (await db.prepare(sql).all(params)) as AuthAuditLogRow[];
  return rows.map((r) => ({
    ...r,
    creado_en: pgTimestampString(r.creado_en) ?? "",
  }));
}

export async function initAuthTables(db: Db): Promise<void> {
  await seedRolePermissionsIfEmpty(db);
  await purgeExpiredSessions(db);
  await seedAdminIfEmpty(db);
  await migrateLegacyAdmin(db);
  // En Vercel no re-sincronizar admin en cada cold start (invalidaba sesiones).
  if (process.env.VERCEL !== "1") {
    await syncPrimaryAdminCredentials(db);
  } else if (process.env.SCG_ADMIN_SYNC_ON_START === "1") {
    await syncPrimaryAdminCredentials(db);
  }
}

async function seedRolePermissionsIfEmpty(db: Db): Promise<void> {
  const count = (await db
    .prepare("SELECT COUNT(*) AS n FROM ROLE_ESCRITURA")
    .get()) as { n: number };
  if (pgNum(count.n) > 0) return;

  const insEsc = await db.prepare(
    "INSERT INTO ROLE_ESCRITURA (rol, puede_escribir) VALUES (?, ?)"
  );
  const insMod = await db.prepare(
    "INSERT INTO ROLE_PERMISOS (rol, modulo, acceso) VALUES (?, ?, ?)"
  );

  for (const rol of ["admin", "editor", "consulta"] as Rol[]) {
    const def = DEFAULT_ROLE_ACCESS[rol];
    await insEsc.run(rol, def.puede_escribir ? 1 : 0);
    for (const modulo of MODULOS) {
      await insMod.run(rol, modulo, def.modulos.includes(modulo) ? 1 : 0);
    }
  }
}

export async function listRolePermissions(db: Db): Promise<RolPermisosConfig[]> {
  const roles: Rol[] = ["admin", "editor", "consulta"];
  const result: RolPermisosConfig[] = [];

  for (const rol of roles) {
    const caps = await roleCapabilities(db, rol);
    const modRows = (await db
      .prepare("SELECT modulo, acceso FROM ROLE_PERMISOS WHERE rol = ?")
      .all(rol)) as { modulo: string; acceso: number }[];
    const accesoMap = new Map(
      modRows.map((r) => [r.modulo as Modulo, r.acceso === 1])
    );

    result.push({
      rol,
      rol_label: ROL_LABELS[rol],
      descripcion: ROL_DESCRIPCION[rol],
      puede_escribir: caps.puede_escribir,
      modulos: MODULOS.map((modulo) => ({
        modulo,
        label: MODULO_LABELS[modulo],
        acceso: rol === "admin" ? true : (accesoMap.get(modulo) ?? false),
      })),
      editable: rol !== "admin",
    });
  }

  return result;
}

export async function updateRolePermissions(
  db: Db,
  rol: Rol,
  input: RolPermisosInput
): Promise<RolPermisosConfig> {
  if (rol === "admin") {
    throw new Error("Los permisos del administrador no se pueden modificar");
  }

  const modulosInput = input.modulos ?? {};
  let enabledCount = 0;

  const upsert = await db.prepare(
    `INSERT INTO ROLE_PERMISOS (rol, modulo, acceso)
     VALUES (?, ?, ?)
     ON CONFLICT (rol, modulo) DO UPDATE SET acceso = excluded.acceso`
  );

  for (const modulo of MODULOS) {
    if (modulo === "usuarios") {
      await upsert.run(rol, modulo, 0);
      continue;
    }
    const acceso = Boolean(modulosInput[modulo]);
    if (acceso) enabledCount += 1;
    await upsert.run(rol, modulo, acceso ? 1 : 0);
  }

  if (enabledCount === 0) {
    throw new Error("Debe habilitarse al menos un sector para el rol");
  }

  const puedeEscribir = rol === "consulta" ? false : Boolean(input.puede_escribir);
  await db
    .prepare(
      `INSERT INTO ROLE_ESCRITURA (rol, puede_escribir, actualizado_en)
     VALUES (?, ?, NOW())
     ON CONFLICT (rol) DO UPDATE SET
       puede_escribir = excluded.puede_escribir,
       actualizado_en = excluded.actualizado_en`
    )
    .run(rol, puedeEscribir ? 1 : 0);

  return (await listRolePermissions(db)).find((r) => r.rol === rol)!;
}

function primaryAdminCredentials(): { email: string; password: string } {
  return {
    email: (process.env.SCG_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).trim(),
    password: (process.env.SCG_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD).trim(),
  };
}

async function seedAdminIfEmpty(db: Db): Promise<void> {
  const count = (await db.prepare("SELECT COUNT(*) AS n FROM USERS").get()) as {
    n: number;
  };
  if (pgNum(count.n) > 0) return;

  const { email, password } = primaryAdminCredentials();
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  await db
    .prepare(
      `INSERT INTO USERS (email, password_hash, nombre, rol, activo)
     VALUES (?, ?, ?, 'admin', 1)`
    )
    .run(normalizeEmail(email), hash, "Administrador SGG");

  console.info(`[SGG Auth] Usuario administrador creado: ${email}`);
}

/** Migra el admin por defecto anterior al correo principal configurado. */
async function migrateLegacyAdmin(db: Db): Promise<void> {
  const { email, password } = primaryAdminCredentials();
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const normalizedEmail = normalizeEmail(email);

  const legacy = (await db
    .prepare("SELECT id FROM USERS WHERE LOWER(email) = LOWER(?)")
    .get(LEGACY_ADMIN_EMAIL)) as { id: number } | undefined;

  if (!legacy) return;

  const existingPrimary = (await db
    .prepare("SELECT id FROM USERS WHERE LOWER(email) = LOWER(?) AND id != ?")
    .get(normalizedEmail, legacy.id)) as { id: number } | undefined;

  if (existingPrimary) {
    await db.prepare("UPDATE USERS SET activo = 0 WHERE id = ?").run(legacy.id);
    await db
      .prepare(
        `UPDATE USERS SET password_hash = ?, rol = 'admin', activo = 1,
        actualizado_en = NOW() WHERE id = ?`
      )
      .run(hash, existingPrimary.id);
    await deleteAllUserSessions(db, legacy.id);
    await deleteAllUserSessions(db, existingPrimary.id);
  } else {
    await db
      .prepare(
        `UPDATE USERS SET email = ?, password_hash = ?, nombre = 'Administrador SGG',
        rol = 'admin', activo = 1, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(normalizedEmail, hash, legacy.id);
    await deleteAllUserSessions(db, legacy.id);
  }

  console.info(`[SGG Auth] Administrador principal configurado: ${email}`);
}

/** Alinea email/contraseña del admin principal con SCG_ADMIN_* (o valores por defecto). */
async function syncPrimaryAdminCredentials(db: Db): Promise<void> {
  const { email, password } = primaryAdminCredentials();
  const normalizedEmail = normalizeEmail(email);
  const row = (await db
    .prepare(
      "SELECT id, rol, password_hash FROM USERS WHERE LOWER(email) = LOWER(?)"
    )
    .get(normalizedEmail)) as
    | { id: number; rol: Rol; password_hash: string }
    | undefined;

  if (!row) return;

  let passwordMatches = false;
  try {
    passwordMatches = bcrypt.compareSync(password, row.password_hash);
  } catch {
    passwordMatches = false;
  }

  if (!passwordMatches) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    await db
      .prepare(
        `UPDATE USERS SET password_hash = ?, rol = 'admin', activo = 1, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(hash, row.id);
    await deleteAllUserSessions(db, row.id);
    console.info(`[SGG Auth] Contraseña del administrador sincronizada: ${email}`);
    return;
  }

  if (row.rol !== "admin") {
    await db
      .prepare(
        `UPDATE USERS SET rol = 'admin', activo = 1, actualizado_en = NOW() WHERE id = ?`
      )
      .run(row.id);
  }
}

export async function purgeExpiredSessions(db: Db): Promise<void> {
  await db
    .prepare(`DELETE FROM USER_SESSIONS WHERE expira_en <= NOW()`)
    .run();
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function pgNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pgTimestampMs(value: unknown): number {
  if (value == null) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    const t = new Date(normalized).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

function pgTimestampString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_MS).toISOString();
}

function lockoutExpiryIso(): string {
  return new Date(Date.now() + ACCOUNT_LOCKOUT_MS).toISOString();
}

function isAccountLocked(row: UserRow): boolean {
  if (!row.locked_until) return false;
  return pgTimestampMs(row.locked_until) > Date.now();
}

async function trimUserSessions(db: Db, userId: number): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT id FROM USER_SESSIONS WHERE user_id = ?
       ORDER BY creado_en DESC`
    )
    .all(userId)) as { id: string }[];

  if (rows.length <= MAX_SESSIONS_PER_USER) return;

  const toDelete = rows.slice(MAX_SESSIONS_PER_USER);
  const del = await db.prepare("DELETE FROM USER_SESSIONS WHERE id = ?");
  for (const row of toDelete) await del.run(row.id);
}

async function registerFailedLogin(
  db: Db,
  row: UserRow | undefined,
  email: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  if (!row) {
    await recordAuthEvent(db, "login_fail_unknown", {
      email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return;
  }

  const attempts = pgNum(row.failed_login_attempts) + 1;
  if (attempts >= MAX_ACCOUNT_LOGIN_ATTEMPTS) {
    await db
      .prepare(
        `UPDATE USERS SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`
      )
      .run(attempts, lockoutExpiryIso(), row.id);
    await recordAuthEvent(db, "account_locked", {
      email: row.email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      detalle: `${attempts} intentos fallidos`,
    });
    return;
  }

  await db
    .prepare(`UPDATE USERS SET failed_login_attempts = ? WHERE id = ?`)
    .run(attempts, row.id);
  await recordAuthEvent(db, "login_fail", {
    email: row.email,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

async function clearLoginFailures(db: Db, userId: number): Promise<void> {
  await db
    .prepare(
      `UPDATE USERS SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`
    )
    .run(userId);
}

export async function createSession(
  db: Db,
  userId: number,
  meta?: { ip?: string; userAgent?: string }
): Promise<string> {
  await purgeExpiredSessions(db);
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  await db
    .prepare(
      `INSERT INTO USER_SESSIONS (id, user_id, expira_en, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`
    )
    .run(tokenHash, Number(userId), sessionExpiryIso(), meta?.ip ?? null, meta?.userAgent ?? null);

  await trimUserSessions(db, userId);

  await db
    .prepare(`UPDATE USERS SET ultimo_acceso = NOW() WHERE id = ?`)
    .run(userId);

  return token;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  if (!isValidSessionTokenFormat(token)) return;
  await db
    .prepare("DELETE FROM USER_SESSIONS WHERE id = ?")
    .run(hashSessionToken(token));
}

export async function deleteAllUserSessions(db: Db, userId: number): Promise<void> {
  await db.prepare("DELETE FROM USER_SESSIONS WHERE user_id = ?").run(userId);
}

export async function getUserBySessionToken(
  db: Db,
  token: string | undefined
): Promise<UserPublic | null> {
  if (!isValidSessionTokenFormat(token)) return null;
  await purgeExpiredSessions(db);

  const tokenHash = hashSessionToken(token!);
  const row = (await db
    .prepare(
      `SELECT u.* FROM USERS u
       INNER JOIN USER_SESSIONS s ON s.user_id = u.id
       WHERE s.id = ? AND u.activo = 1
         AND s.expira_en > NOW()`
    )
    .get(tokenHash)) as UserRow | undefined;

  if (!row) return null;

  await db
    .prepare(`UPDATE USER_SESSIONS SET expira_en = ? WHERE id = ?`)
    .run(sessionExpiryIso(), tokenHash);

  return await toUserPublic(row, db);
}

export type LoginResult =
  | { ok: true; user: UserPublic }
  | { ok: false; reason: "invalid" | "locked" };

export async function verifyLogin(
  db: Db,
  email: string,
  password: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<LoginResult> {
  const normalized = normalizeEmail(email);
  const row = (await db
    .prepare(`SELECT * FROM USERS WHERE LOWER(email) = LOWER(?) AND activo = 1`)
    .get(normalized)) as UserRow | undefined;

  if (row && isAccountLocked(row)) {
    await recordAuthEvent(db, "login_blocked_locked", {
      email: row.email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { ok: false, reason: "locked" };
  }

  const hashToCompare = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  let valid = false;
  try {
    valid = bcrypt.compareSync(password, hashToCompare);
  } catch {
    valid = false;
  }

  if (!row || !valid) {
    await registerFailedLogin(db, row, normalized, meta);
    return { ok: false, reason: "invalid" };
  }

  await clearLoginFailures(db, row.id);
  await recordAuthEvent(db, "login_ok", {
    email: row.email,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { ok: true, user: await toUserPublic(row, db) };
}

export async function listUsers(db: Db): Promise<UserPublic[]> {
  const rows = (await db
    .prepare("SELECT * FROM USERS ORDER BY LOWER(nombre) ASC")
    .all()) as UserRow[];
  const result: UserPublic[] = [];
  for (const row of rows) {
    result.push(await toUserPublic(row, db));
  }
  return result;
}

export async function getUserById(db: Db, id: number): Promise<UserPublic | null> {
  const row = (await db.prepare("SELECT * FROM USERS WHERE id = ?").get(id)) as
    | UserRow
    | undefined;
  return row ? await toUserPublic(row, db) : null;
}

export async function insertUser(db: Db, data: UserInput): Promise<UserPublic> {
  const email = normalizeEmail(data.email);
  if (!email.includes("@")) throw new Error("Email inválido");
  if (!data.password) throw new Error("La contraseña es obligatoria");
  assertPasswordPolicy(data.password);
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

  const exists = (await db
    .prepare("SELECT id FROM USERS WHERE LOWER(email) = LOWER(?)")
    .get(email)) as { id: number } | undefined;
  if (exists) throw new Error("Ya existe un usuario con ese email");

  const hash = bcrypt.hashSync(data.password, BCRYPT_ROUNDS);
  const result = await db
    .prepare(
      `INSERT INTO USERS (email, password_hash, nombre, rol, activo)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(email, hash, data.nombre.trim(), data.rol, data.activo === false ? 0 : 1);

  return (await getUserById(db, Number(result.lastInsertRowid)))!;
}

export async function updateUser(
  db: Db,
  id: number,
  data: Partial<UserInput>
): Promise<UserPublic> {
  const current = (await db.prepare("SELECT * FROM USERS WHERE id = ?").get(id)) as
    | UserRow
    | undefined;
  if (!current) throw new Error("Usuario no encontrado");

  const email = data.email !== undefined ? normalizeEmail(data.email) : current.email;
  const nombre = data.nombre !== undefined ? data.nombre.trim() : current.nombre;
  const rol = data.rol ?? current.rol;
  const activo = data.activo !== undefined ? (data.activo ? 1 : 0) : current.activo;

  if (!email.includes("@")) throw new Error("Email inválido");
  if (!nombre) throw new Error("El nombre es obligatorio");

  const dup = (await db
    .prepare("SELECT id FROM USERS WHERE LOWER(email) = LOWER(?) AND id != ?")
    .get(email, id)) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe otro usuario con ese email");

  if (data.password) {
    assertPasswordPolicy(data.password);
    const hash = bcrypt.hashSync(data.password, BCRYPT_ROUNDS);
    await db
      .prepare(
        `UPDATE USERS SET email = ?, nombre = ?, rol = ?, activo = ?,
        password_hash = ?, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(email, nombre, rol, activo, hash, id);
    await deleteAllUserSessions(db, id);
  } else {
    await db
      .prepare(
        `UPDATE USERS SET email = ?, nombre = ?, rol = ?, activo = ?,
        actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(email, nombre, rol, activo, id);
    if (activo === 0) await deleteAllUserSessions(db, id);
  }

  return (await getUserById(db, id))!;
}

export async function changeOwnPassword(
  db: Db,
  userId: number,
  actual: string,
  nueva: string
): Promise<void> {
  assertPasswordPolicy(nueva);

  const row = (await db.prepare("SELECT * FROM USERS WHERE id = ?").get(userId)) as
    | UserRow
    | undefined;
  if (!row) throw new Error("Usuario no encontrado");
  if (!bcrypt.compareSync(actual, row.password_hash)) {
    throw new Error("Contraseña actual incorrecta");
  }

  const hash = bcrypt.hashSync(nueva, BCRYPT_ROUNDS);
  await db
    .prepare(
      `UPDATE USERS SET password_hash = ?, actualizado_en = NOW() WHERE id = ?`
    )
    .run(hash, userId);
  await deleteAllUserSessions(db, userId);
}

export async function countActiveAdmins(
  db: Db,
  excludeId?: number
): Promise<number> {
  const row = excludeId
    ? ((await db
        .prepare(
          `SELECT COUNT(*) AS n FROM USERS WHERE rol = 'admin' AND activo = 1 AND id != ?`
        )
        .get(excludeId)) as { n: number })
    : ((await db
        .prepare(`SELECT COUNT(*) AS n FROM USERS WHERE rol = 'admin' AND activo = 1`)
        .get()) as { n: number });
  return row.n;
}
