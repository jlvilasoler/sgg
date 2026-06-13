import bcrypt from "bcryptjs";
import crypto from "crypto";
import type Database from "better-sqlite3";
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

export function roleCapabilities(
  db: Database.Database,
  rol: Rol
): { permisos: Modulo[]; puede_escribir: boolean } {
  if (rol === "admin") {
    return { permisos: [...MODULOS], puede_escribir: true };
  }

  const escRow = db
    .prepare("SELECT puede_escribir FROM ROLE_ESCRITURA WHERE rol = ?")
    .get(rol) as { puede_escribir: number } | undefined;

  const modRows = db
    .prepare(
      "SELECT modulo FROM ROLE_PERMISOS WHERE rol = ? AND acceso = 1 ORDER BY modulo"
    )
    .all(rol) as { modulo: string }[];

  const permisos = modRows
    .map((r) => r.modulo as Modulo)
    .filter((m) => MODULOS.includes(m));

  return {
    permisos,
    puede_escribir: escRow?.puede_escribir === 1,
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

export function toUserPublic(row: UserRow, db: Database.Database): UserPublic {
  const caps = roleCapabilities(db, row.rol);
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    rol_label: ROL_LABELS[row.rol],
    activo: row.activo === 1,
    permisos: caps.permisos,
    puede_escribir: caps.puede_escribir,
    creado_en: row.creado_en,
    ultimo_acceso: row.ultimo_acceso,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ensureUserColumn(
  db: Database.Database,
  column: string,
  definition: string
): void {
  const cols = db.prepare("PRAGMA table_info(USERS)").all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE USERS ADD COLUMN ${column} ${definition}`);
  }
}

function assertPasswordPolicy(password: string): void {
  const err = validatePasswordStrength(password);
  if (err) throw new Error(err);
}

export function recordAuthEvent(
  db: Database.Database,
  evento: string,
  meta?: { email?: string; ip?: string; userAgent?: string; detalle?: string }
): void {
  db.prepare(
    `INSERT INTO AUTH_AUDIT_LOG (evento, email, ip, user_agent, detalle)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    evento,
    meta?.email ?? null,
    meta?.ip ?? null,
    meta?.userAgent ?? null,
    meta?.detalle ?? null
  );
}

export function initAuthTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS USERS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'consulta')),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime')),
      actualizado_en TEXT DEFAULT (datetime('now', 'localtime')),
      ultimo_acceso TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON USERS(email);

    CREATE TABLE IF NOT EXISTS USER_SESSIONS (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      creado_en TEXT DEFAULT (datetime('now', 'localtime')),
      expira_en TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES USERS(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON USER_SESSIONS(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expira ON USER_SESSIONS(expira_en);

    CREATE TABLE IF NOT EXISTS AUTH_AUDIT_LOG (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evento TEXT NOT NULL,
      email TEXT,
      ip TEXT,
      user_agent TEXT,
      detalle TEXT,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_audit_creado ON AUTH_AUDIT_LOG(creado_en);
  `);

  ensureUserColumn(db, "failed_login_attempts", "INTEGER NOT NULL DEFAULT 0");
  ensureUserColumn(db, "locked_until", "TEXT");

  initRolePermissionsTables(db);
  purgeExpiredSessions(db);
  seedAdminIfEmpty(db);
  migrateLegacyAdmin(db);
}

function initRolePermissionsTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ROLE_ESCRITURA (
      rol TEXT PRIMARY KEY CHECK (rol IN ('admin', 'editor', 'consulta')),
      puede_escribir INTEGER NOT NULL DEFAULT 0,
      actualizado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS ROLE_PERMISOS (
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'consulta')),
      modulo TEXT NOT NULL,
      acceso INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (rol, modulo)
    );
  `);
  seedRolePermissionsIfEmpty(db);
}

function seedRolePermissionsIfEmpty(db: Database.Database): void {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM ROLE_ESCRITURA")
    .get() as { n: number };
  if (count.n > 0) return;

  const insEsc = db.prepare(
    "INSERT INTO ROLE_ESCRITURA (rol, puede_escribir) VALUES (?, ?)"
  );
  const insMod = db.prepare(
    "INSERT INTO ROLE_PERMISOS (rol, modulo, acceso) VALUES (?, ?, ?)"
  );

  for (const rol of ["admin", "editor", "consulta"] as Rol[]) {
    const def = DEFAULT_ROLE_ACCESS[rol];
    insEsc.run(rol, def.puede_escribir ? 1 : 0);
    for (const modulo of MODULOS) {
      insMod.run(rol, modulo, def.modulos.includes(modulo) ? 1 : 0);
    }
  }
}

export function listRolePermissions(db: Database.Database): RolPermisosConfig[] {
  const roles: Rol[] = ["admin", "editor", "consulta"];
  return roles.map((rol) => {
    const caps = roleCapabilities(db, rol);
    const modRows = db
      .prepare("SELECT modulo, acceso FROM ROLE_PERMISOS WHERE rol = ?")
      .all(rol) as { modulo: string; acceso: number }[];
    const accesoMap = new Map(
      modRows.map((r) => [r.modulo as Modulo, r.acceso === 1])
    );

    return {
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
    };
  });
}

export function updateRolePermissions(
  db: Database.Database,
  rol: Rol,
  input: RolPermisosInput
): RolPermisosConfig {
  if (rol === "admin") {
    throw new Error("Los permisos del administrador no se pueden modificar");
  }

  const modulosInput = input.modulos ?? {};
  let enabledCount = 0;

  const upsert = db.prepare(
    `INSERT INTO ROLE_PERMISOS (rol, modulo, acceso)
     VALUES (?, ?, ?)
     ON CONFLICT(rol, modulo) DO UPDATE SET acceso = excluded.acceso`
  );

  for (const modulo of MODULOS) {
    if (modulo === "usuarios") {
      upsert.run(rol, modulo, 0);
      continue;
    }
    const acceso = Boolean(modulosInput[modulo]);
    if (acceso) enabledCount += 1;
    upsert.run(rol, modulo, acceso ? 1 : 0);
  }

  if (enabledCount === 0) {
    throw new Error("Debe habilitarse al menos un sector para el rol");
  }

  const puedeEscribir = rol === "consulta" ? false : Boolean(input.puede_escribir);
  db.prepare(
    `INSERT INTO ROLE_ESCRITURA (rol, puede_escribir, actualizado_en)
     VALUES (?, ?, datetime('now', 'localtime'))
     ON CONFLICT(rol) DO UPDATE SET
       puede_escribir = excluded.puede_escribir,
       actualizado_en = excluded.actualizado_en`
  ).run(rol, puedeEscribir ? 1 : 0);

  return listRolePermissions(db).find((r) => r.rol === rol)!;
}

function primaryAdminCredentials(): { email: string; password: string } {
  return {
    email: process.env.SCG_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL,
    password: process.env.SCG_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
  };
}

function seedAdminIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM USERS").get() as { n: number };
  if (count.n > 0) return;

  const { email, password } = primaryAdminCredentials();
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  db.prepare(
    `INSERT INTO USERS (email, password_hash, nombre, rol, activo)
     VALUES (?, ?, ?, 'admin', 1)`
  ).run(email, hash, "Administrador SCG");

  console.info(`[SCG Auth] Usuario administrador creado: ${email}`);
}

/** Migra el admin por defecto anterior al correo principal configurado. */
function migrateLegacyAdmin(db: Database.Database): void {
  const { email, password } = primaryAdminCredentials();
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);

  const legacy = db
    .prepare("SELECT id FROM USERS WHERE email = ? COLLATE NOCASE")
    .get(LEGACY_ADMIN_EMAIL) as { id: number } | undefined;

  if (!legacy) return;

  const existingPrimary = db
    .prepare("SELECT id FROM USERS WHERE email = ? COLLATE NOCASE AND id != ?")
    .get(email, legacy.id) as { id: number } | undefined;

  if (existingPrimary) {
    db.prepare("UPDATE USERS SET activo = 0 WHERE id = ?").run(legacy.id);
    db.prepare(
      `UPDATE USERS SET password_hash = ?, rol = 'admin', activo = 1,
        actualizado_en = datetime('now', 'localtime') WHERE id = ?`
    ).run(hash, existingPrimary.id);
    deleteAllUserSessions(db, legacy.id);
    deleteAllUserSessions(db, existingPrimary.id);
  } else {
    db.prepare(
      `UPDATE USERS SET email = ?, password_hash = ?, nombre = 'Administrador SCG',
        rol = 'admin', activo = 1, actualizado_en = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(email, hash, legacy.id);
    deleteAllUserSessions(db, legacy.id);
  }

  console.info(`[SCG Auth] Administrador principal configurado: ${email}`);
}

export function purgeExpiredSessions(db: Database.Database): void {
  db.prepare(
    `DELETE FROM USER_SESSIONS WHERE datetime(expira_en) <= datetime('now', 'localtime')`
  ).run();
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_MS).toISOString().slice(0, 19).replace("T", " ");
}

function lockoutExpiryIso(): string {
  return new Date(Date.now() + ACCOUNT_LOCKOUT_MS)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function isAccountLocked(row: UserRow): boolean {
  if (!row.locked_until) return false;
  const locked = dbLockedUntilMs(row.locked_until);
  return locked > Date.now();
}

function dbLockedUntilMs(iso: string): number {
  return new Date(iso.replace(" ", "T")).getTime();
}

function trimUserSessions(db: Database.Database, userId: number): void {
  const rows = db
    .prepare(
      `SELECT id FROM USER_SESSIONS WHERE user_id = ?
       ORDER BY datetime(creado_en) DESC`
    )
    .all(userId) as { id: string }[];

  if (rows.length <= MAX_SESSIONS_PER_USER) return;

  const toDelete = rows.slice(MAX_SESSIONS_PER_USER);
  const del = db.prepare("DELETE FROM USER_SESSIONS WHERE id = ?");
  for (const row of toDelete) del.run(row.id);
}

function registerFailedLogin(
  db: Database.Database,
  row: UserRow | undefined,
  email: string,
  meta?: { ip?: string; userAgent?: string }
): void {
  if (!row) {
    recordAuthEvent(db, "login_fail_unknown", {
      email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return;
  }

  const attempts = (row.failed_login_attempts ?? 0) + 1;
  if (attempts >= MAX_ACCOUNT_LOGIN_ATTEMPTS) {
    db.prepare(
      `UPDATE USERS SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`
    ).run(attempts, lockoutExpiryIso(), row.id);
    recordAuthEvent(db, "account_locked", {
      email: row.email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      detalle: `${attempts} intentos fallidos`,
    });
    return;
  }

  db.prepare(`UPDATE USERS SET failed_login_attempts = ? WHERE id = ?`).run(
    attempts,
    row.id
  );
  recordAuthEvent(db, "login_fail", {
    email: row.email,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}

function clearLoginFailures(db: Database.Database, userId: number): void {
  db.prepare(
    `UPDATE USERS SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?`
  ).run(userId);
}

export function createSession(
  db: Database.Database,
  userId: number,
  meta?: { ip?: string; userAgent?: string }
): string {
  purgeExpiredSessions(db);
  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  db.prepare(
    `INSERT INTO USER_SESSIONS (id, user_id, expira_en, ip, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tokenHash, userId, sessionExpiryIso(), meta?.ip ?? null, meta?.userAgent ?? null);

  trimUserSessions(db, userId);

  db.prepare(
    `UPDATE USERS SET ultimo_acceso = datetime('now', 'localtime') WHERE id = ?`
  ).run(userId);

  return token;
}

export function deleteSession(db: Database.Database, token: string): void {
  if (!isValidSessionTokenFormat(token)) return;
  db.prepare("DELETE FROM USER_SESSIONS WHERE id = ?").run(hashSessionToken(token));
}

export function deleteAllUserSessions(db: Database.Database, userId: number): void {
  db.prepare("DELETE FROM USER_SESSIONS WHERE user_id = ?").run(userId);
}

export function getUserBySessionToken(
  db: Database.Database,
  token: string | undefined
): UserPublic | null {
  if (!isValidSessionTokenFormat(token)) return null;
  purgeExpiredSessions(db);

  const tokenHash = hashSessionToken(token!);
  const row = db
    .prepare(
      `SELECT u.* FROM USERS u
       INNER JOIN USER_SESSIONS s ON s.user_id = u.id
       WHERE s.id = ? AND u.activo = 1
         AND datetime(s.expira_en) > datetime('now', 'localtime')`
    )
    .get(tokenHash) as UserRow | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE USER_SESSIONS SET expira_en = ? WHERE id = ?`
  ).run(sessionExpiryIso(), tokenHash);

  return toUserPublic(row, db);
}

export type LoginResult =
  | { ok: true; user: UserPublic }
  | { ok: false; reason: "invalid" | "locked" };

export function verifyLogin(
  db: Database.Database,
  email: string,
  password: string,
  meta?: { ip?: string; userAgent?: string }
): LoginResult {
  const normalized = normalizeEmail(email);
  const row = db
    .prepare(`SELECT * FROM USERS WHERE email = ? COLLATE NOCASE AND activo = 1`)
    .get(normalized) as UserRow | undefined;

  if (row && isAccountLocked(row)) {
    recordAuthEvent(db, "login_blocked_locked", {
      email: row.email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return { ok: false, reason: "locked" };
  }

  const hashToCompare = row?.password_hash ?? DUMMY_PASSWORD_HASH;
  const valid = bcrypt.compareSync(password, hashToCompare);

  if (!row || !valid) {
    registerFailedLogin(db, row, normalized, meta);
    return { ok: false, reason: "invalid" };
  }

  clearLoginFailures(db, row.id);
  recordAuthEvent(db, "login_ok", {
    email: row.email,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { ok: true, user: toUserPublic(row, db) };
}

export function listUsers(db: Database.Database): UserPublic[] {
  const rows = db
    .prepare("SELECT * FROM USERS ORDER BY nombre COLLATE NOCASE ASC")
    .all() as UserRow[];
  return rows.map((row) => toUserPublic(row, db));
}

export function getUserById(db: Database.Database, id: number): UserPublic | null {
  const row = db.prepare("SELECT * FROM USERS WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toUserPublic(row, db) : null;
}

export function insertUser(db: Database.Database, data: UserInput): UserPublic {
  const email = normalizeEmail(data.email);
  if (!email.includes("@")) throw new Error("Email inválido");
  if (!data.password) throw new Error("La contraseña es obligatoria");
  assertPasswordPolicy(data.password);
  if (!data.nombre.trim()) throw new Error("El nombre es obligatorio");

  const exists = db
    .prepare("SELECT id FROM USERS WHERE email = ? COLLATE NOCASE")
    .get(email) as { id: number } | undefined;
  if (exists) throw new Error("Ya existe un usuario con ese email");

  const hash = bcrypt.hashSync(data.password, BCRYPT_ROUNDS);
  const result = db
    .prepare(
      `INSERT INTO USERS (email, password_hash, nombre, rol, activo)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(email, hash, data.nombre.trim(), data.rol, data.activo === false ? 0 : 1);

  return getUserById(db, Number(result.lastInsertRowid))!;
}

export function updateUser(
  db: Database.Database,
  id: number,
  data: Partial<UserInput>
): UserPublic {
  const current = db.prepare("SELECT * FROM USERS WHERE id = ?").get(id) as UserRow | undefined;
  if (!current) throw new Error("Usuario no encontrado");

  const email = data.email !== undefined ? normalizeEmail(data.email) : current.email;
  const nombre = data.nombre !== undefined ? data.nombre.trim() : current.nombre;
  const rol = data.rol ?? current.rol;
  const activo = data.activo !== undefined ? (data.activo ? 1 : 0) : current.activo;

  if (!email.includes("@")) throw new Error("Email inválido");
  if (!nombre) throw new Error("El nombre es obligatorio");

  const dup = db
    .prepare("SELECT id FROM USERS WHERE email = ? COLLATE NOCASE AND id != ?")
    .get(email, id) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe otro usuario con ese email");

  if (data.password) {
    assertPasswordPolicy(data.password);
    const hash = bcrypt.hashSync(data.password, BCRYPT_ROUNDS);
    db.prepare(
      `UPDATE USERS SET email = ?, nombre = ?, rol = ?, activo = ?,
        password_hash = ?, actualizado_en = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(email, nombre, rol, activo, hash, id);
    deleteAllUserSessions(db, id);
  } else {
    db.prepare(
      `UPDATE USERS SET email = ?, nombre = ?, rol = ?, activo = ?,
        actualizado_en = datetime('now', 'localtime')
       WHERE id = ?`
    ).run(email, nombre, rol, activo, id);
    if (activo === 0) deleteAllUserSessions(db, id);
  }

  return getUserById(db, id)!;
}

export function changeOwnPassword(
  db: Database.Database,
  userId: number,
  actual: string,
  nueva: string
): void {
  assertPasswordPolicy(nueva);

  const row = db.prepare("SELECT * FROM USERS WHERE id = ?").get(userId) as UserRow | undefined;
  if (!row) throw new Error("Usuario no encontrado");
  if (!bcrypt.compareSync(actual, row.password_hash)) {
    throw new Error("Contraseña actual incorrecta");
  }

  const hash = bcrypt.hashSync(nueva, BCRYPT_ROUNDS);
  db.prepare(
    `UPDATE USERS SET password_hash = ?, actualizado_en = datetime('now', 'localtime') WHERE id = ?`
  ).run(hash, userId);
  deleteAllUserSessions(db, userId);
}

export function countActiveAdmins(db: Database.Database, excludeId?: number): number {
  const row = excludeId
    ? (db
        .prepare(
          `SELECT COUNT(*) AS n FROM USERS WHERE rol = 'admin' AND activo = 1 AND id != ?`
        )
        .get(excludeId) as { n: number })
    : (db
        .prepare(`SELECT COUNT(*) AS n FROM USERS WHERE rol = 'admin' AND activo = 1`)
        .get() as { n: number });
  return row.n;
}
