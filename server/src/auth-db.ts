import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Db } from "./db/pg-client.js";
import { DEFAULT_ADMIN_NAME } from "./brand.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import {
  hashSessionToken,
  isValidSessionTokenFormat,
  validatePasswordStrength,
} from "./auth-security.js";
import { avatarDtoFromRow, migrateUserAvatarColumns } from "./user-avatar-db.js";
import type { UserAvatarDto } from "./user-avatar-db.js";

export type Rol = "admin" | "editor" | "gestor_n2" | "consulta";

export const ALL_ROLES: Rol[] = ["admin", "editor", "gestor_n2", "consulta"];

export function isValidRol(value: string): value is Rol {
  return ALL_ROLES.includes(value as Rol);
}

export type Modulo =
  | "presupuesto"
  | "configuracion"
  | "divisas"
  | "precios_ganado"
  | "simulador_venta_ganado"
  | "chat"
  | "rrhh"
  | "ventas"
  | "stock"
  | "usuarios"
  | "documentos_digitales";

export const MODULOS: Modulo[] = [
  "presupuesto",
  "configuracion",
  "divisas",
  "precios_ganado",
  "simulador_venta_ganado",
  "chat",
  "rrhh",
  "ventas",
  "stock",
  "usuarios",
  "documentos_digitales",
];

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Gestor",
  gestor_n2: "Gestor",
  consulta: "Consulta",
};

export const MODULO_LABELS: Record<Modulo, string> = {
  presupuesto: "Presupuesto y gastos",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador venta ganado",
  chat: "Chat interno",
  rrhh: "Recursos Humanos",
  ventas: "Ingresos por ventas",
  stock: "Stock ganadero",
  usuarios: "Administración de Usuarios",
  documentos_digitales: "Documentos Digitales",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: "Acceso total al sistema (no editable)",
  editor: "Gestión operativa según las secciones habilitadas.",
  gestor_n2: "Acceso según las secciones que defina el administrador.",
  consulta: "Solo lectura en los sectores habilitados",
};

/** Módulos que solo el administrador puede usar (no configurables por rol). */
export const MODULOS_SOLO_ADMIN: Modulo[] = ["usuarios", "documentos_digitales"];

export interface ModuloAccesoConfig {
  modulo: Modulo;
  label: string;
  acceso: boolean;
  solo_lectura: boolean;
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
  modulos_solo_lectura?: Partial<Record<Modulo, boolean>>;
}

export interface UserRow {
  id: number;
  usuario_numero: string | null;
  email: string;
  password_hash: string;
  nombre: string;
  rol: Rol;
  activo: number;
  empresa_id: number | null;
  creado_en: string;
  actualizado_en: string;
  ultimo_acceso: string | null;
  failed_login_attempts?: number;
  locked_until?: string | null;
  avatar_tipo?: string;
  avatar_archivo?: string;
}

export interface UserPublic {
  id: number;
  usuario_numero: string;
  email: string;
  nombre: string;
  rol: Rol;
  rol_label: string;
  activo: boolean;
  empresa_id: number | null;
  empresa_nombre: string | null;
  empresa_codigo: string | null;
  empresa_cuenta_numero: string | null;
  /** Cuenta madre para actividad/chat (p. ej. VILA DIAZ para super-admin principal). */
  cuenta_actividad_id: number | null;
  cuenta_actividad_nombre: string | null;
  es_super_admin: boolean;
  /** Usuario designado como administrador de su cuenta (EMPRESAS_CUENTA.admin_user_id). */
  es_admin_cuenta: boolean;
  permisos: Modulo[];
  puede_escribir: boolean;
  modulos_solo_lectura: Modulo[];
  creado_en: string;
  ultimo_acceso: string | null;
  avatar: UserAvatarDto;
}

export interface UserInput {
  email: string;
  nombre: string;
  rol: Rol;
  activo?: boolean;
  password?: string;
  empresa_id?: number | null;
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

const GESTOR_N2_MODULOS: Modulo[] = [
  "presupuesto",
  "configuracion",
  "divisas",
  "precios_ganado",
  "simulador_venta_ganado",
  "chat",
  "rrhh",
  "stock",
];

const DEFAULT_ROLE_ACCESS: Record<
  Rol,
  { puede_escribir: boolean; modulos: Modulo[] }
> = {
  admin: { puede_escribir: true, modulos: [...MODULOS] },
  editor: {
    puede_escribir: true,
    modulos: MODULOS.filter((m) => !MODULOS_SOLO_ADMIN.includes(m)),
  },
  gestor_n2: {
    puede_escribir: true,
    modulos: GESTOR_N2_MODULOS,
  },
  consulta: {
    puede_escribir: false,
    modulos: MODULOS.filter((m) => !MODULOS_SOLO_ADMIN.includes(m)),
  },
};

export async function roleCapabilities(
  db: Db,
  rol: Rol
): Promise<{ permisos: Modulo[]; puede_escribir: boolean; modulos_solo_lectura: Modulo[] }> {
  if (rol === "admin") {
    return { permisos: [...MODULOS], puede_escribir: true, modulos_solo_lectura: [] };
  }

  const escRow = (await db
    .prepare("SELECT puede_escribir FROM ROLE_ESCRITURA WHERE rol = ?")
    .get(rol)) as { puede_escribir: number } | undefined;

  const modRows = (await db
    .prepare(
      "SELECT modulo, solo_lectura FROM ROLE_PERMISOS WHERE rol = ? AND acceso = 1 ORDER BY modulo"
    )
    .all(rol)) as { modulo: string; solo_lectura: number }[];

  const permisos = [
    ...new Set([
      ...modRows
        .map((r) => r.modulo as Modulo)
        .filter((m) => MODULOS.includes(m))
        .filter((m) => !MODULOS_SOLO_ADMIN.includes(m)),
      ...MODULOS_TODOS_LOS_USUARIOS,
    ]),
  ].sort();

  const puedeEscribir = pgNum(escRow?.puede_escribir) === 1;
  const modulos_solo_lectura = puedeEscribir
    ? modRows
        .filter((r) => pgNum(r.solo_lectura) === 1)
        .map((r) => r.modulo as Modulo)
        .filter((m) => MODULOS.includes(m))
    : [...permisos];

  return {
    permisos,
    puede_escribir: puedeEscribir,
    modulos_solo_lectura,
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
  const empresaId =
    row.empresa_id != null && Number.isFinite(Number(row.empresa_id))
      ? Number(row.empresa_id)
      : null;

  let empresa_nombre: string | null = null;
  let empresa_codigo: string | null = null;
  let empresa_cuenta_numero: string | null = null;
  if (empresaId) {
    const empresaRow = (await db
      .prepare("SELECT nombre, codigo, cuenta_numero FROM EMPRESAS_CUENTA WHERE id = ?")
      .get(empresaId)) as
      | { nombre: string; codigo: string; cuenta_numero: string | null }
      | undefined;
    if (empresaRow) {
      empresa_nombre = empresaRow.nombre;
      empresa_codigo = empresaRow.codigo;
      empresa_cuenta_numero = empresaRow.cuenta_numero;
    }
  }

  const esSuperAdmin = await empresasCuenta.isPlatformSuperAdmin(db, {
    id: row.id,
    rol: row.rol,
    empresa_id: empresaId,
    email: row.email,
  });
  const cuentaActividadId = await empresasCuenta.resolveCuentaMadreIdForUser(db, {
    id: row.id,
    email: row.email,
    es_super_admin: esSuperAdmin,
    empresa_id: empresaId,
  });
  let cuentaActividadNombre: string | null = null;
  if (cuentaActividadId != null) {
    const cuentaRow = await empresasCuenta.getEmpresaCuentaById(db, cuentaActividadId);
    cuentaActividadNombre = cuentaRow?.nombre ?? null;
  }

  const cuentaAdmin = await empresasCuenta.getEmpresaCuentaByAdminUserId(db, row.id);

  return {
    id: row.id,
    usuario_numero: formatUsuarioNumero(row.usuario_numero ?? row.id),
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    rol_label: ROL_LABELS[row.rol],
    activo: pgNum(row.activo) === 1,
    empresa_id: empresaId,
    empresa_nombre,
    empresa_codigo,
    empresa_cuenta_numero,
    cuenta_actividad_id: cuentaActividadId,
    cuenta_actividad_nombre: cuentaActividadNombre,
    es_super_admin: esSuperAdmin,
    es_admin_cuenta: cuentaAdmin != null,
    permisos: caps.permisos,
    puede_escribir: caps.puede_escribir,
    modulos_solo_lectura: caps.modulos_solo_lectura,
    creado_en: pgTimestampString(row.creado_en) ?? "",
    ultimo_acceso: pgTimestampString(row.ultimo_acceso),
    avatar: avatarDtoFromRow(row.id, row),
  };
}

function formatUsuarioNumero(value: unknown): string {
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/\D/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 9999) {
    throw new Error("No se pudo generar ID_USUARIO válido");
  }
  return String(Math.floor(n)).padStart(4, "0");
}

async function nextUsuarioNumero(db: Db): Promise<string> {
  const rows = (await db
    .prepare("SELECT usuario_numero FROM USERS WHERE usuario_numero IS NOT NULL")
    .all()) as { usuario_numero: string | null }[];
  const used = new Set<number>();
  for (const row of rows) {
    const n = Number(String(row.usuario_numero ?? "").replace(/\D/g, ""));
    if (Number.isFinite(n) && n > 0) used.add(Math.floor(n));
  }
  for (let n = 1; n <= 9999; n += 1) {
    if (!used.has(n)) return formatUsuarioNumero(n);
  }
  throw new Error("No hay ID_USUARIO disponibles");
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
  scope?: AuthAuditLogScope;
}

/** Alcance de lectura: super admin sin scope; admin de cuenta por emails; usuario por email propio. */
export interface AuthAuditLogScope {
  emails_in?: string[];
  email_exacto?: string;
}

export interface AuthAuditLogResumen {
  total: number;
  logins: number;
  navegacion: number;
  acciones: number;
}

export interface AuthAuditLogPage {
  rows: AuthAuditLogRow[];
  total: number;
  resumen: AuthAuditLogResumen;
}

function authAuditLogWhere(filters?: AuthAuditLogFilters): {
  sql: string;
  params: Record<string, unknown>;
} {
  let sql = ` FROM AUTH_AUDIT_LOG a
             LEFT JOIN USERS u ON LOWER(TRIM(u.email)) = LOWER(TRIM(a.email))
             WHERE 1=1`;
  const params: Record<string, unknown> = {};

  const scope = filters?.scope;
  if (scope?.email_exacto) {
    sql += ` AND LOWER(TRIM(a.email)) = LOWER(@scope_email_exacto)`;
    params.scope_email_exacto = scope.email_exacto.trim();
  } else if (scope?.emails_in) {
    if (scope.emails_in.length === 0) {
      sql += ` AND 1=0`;
    } else {
      const placeholders = scope.emails_in
        .map((_, i) => `@scope_email_in_${i}`)
        .join(", ");
      sql += ` AND LOWER(TRIM(a.email)) IN (${placeholders})`;
      scope.emails_in.forEach((email, i) => {
        params[`scope_email_in_${i}`] = email.toLowerCase();
      });
    }
  }

  if (filters?.email?.trim()) {
    sql += ` AND LOWER(a.email) LIKE LOWER(@email)`;
    params.email = `%${filters.email.trim()}%`;
  }
  if (filters?.evento?.trim()) {
    sql += ` AND a.evento = @evento`;
    params.evento = filters.evento.trim();
  }

  return { sql, params };
}

export async function listUserEmailsForCuentaMadre(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
  const users = await listUsers(db, {
    empresa_id: cuentaId,
    incluir_admin_id: cuenta?.admin_user_id ?? null,
  });
  return users.map((u) => normalizeEmail(u.email));
}

export type ActividadAmbito = "total" | "cuenta";

export async function resolveAuthAuditLogScope(
  db: Db,
  actor: UserPublic,
  requestedEmail?: string,
  ambito?: ActividadAmbito
): Promise<
  | { ok: true; filters: Pick<AuthAuditLogFilters, "email" | "scope"> }
  | { ok: false; error: string }
> {
  const emailQuery = requestedEmail?.trim() || undefined;

  if (actor.rol !== "admin") {
    if (emailQuery && normalizeEmail(emailQuery) !== normalizeEmail(actor.email)) {
      return { ok: false, error: "Solo puede ver su propia actividad" };
    }
    return {
      ok: true,
      filters: { scope: { email_exacto: normalizeEmail(actor.email) } },
    };
  }

  if (actor.es_super_admin && ambito === "total") {
    return { ok: true, filters: { email: emailQuery, scope: undefined } };
  }

  if (actor.es_super_admin && ambito !== "cuenta") {
    return {
      ok: false,
      error: "Indique el ámbito de actividad (total o cuenta)",
    };
  }

  const cuentaId =
    actor.cuenta_actividad_id ??
    (await empresasCuenta.resolveCuentaMadreIdForUser(db, actor));
  if (!cuentaId) {
    return {
      ok: true,
      filters: { scope: { email_exacto: normalizeEmail(actor.email) } },
    };
  }
  const emailsIn = await listUserEmailsForCuentaMadre(db, cuentaId);
  if (emailQuery) {
    const normalized = normalizeEmail(emailQuery);
    if (!emailsIn.includes(normalized)) {
      return { ok: false, error: "Usuario fuera de su cuenta" };
    }
    return {
      ok: true,
      filters: { email: emailQuery, scope: { emails_in: emailsIn } },
    };
  }
  return { ok: true, filters: { scope: { emails_in: emailsIn } } };
}

export async function listUserIdsForCuentaMadre(
  db: Db,
  cuentaId: number
): Promise<number[]> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
  const users = await listUsers(db, {
    empresa_id: cuentaId,
    incluir_admin_id: cuenta?.admin_user_id ?? null,
  });
  return users.map((u) => u.id);
}

export async function resolveActividadOnlineUserIds(
  db: Db,
  actor: UserPublic,
  ambito?: ActividadAmbito
): Promise<number[] | null> {
  if (actor.es_super_admin && ambito === "total") return null;
  if (actor.rol === "admin") {
    const cuentaId =
      actor.cuenta_actividad_id ??
      (await empresasCuenta.resolveCuentaMadreIdForUser(db, actor));
    if (cuentaId) return await listUserIdsForCuentaMadre(db, cuentaId);
    return [actor.id];
  }
  return [actor.id];
}

export async function listAuthAuditLog(
  db: Db,
  filters?: AuthAuditLogFilters
): Promise<AuthAuditLogPage> {
  const limite = Math.min(100, Math.max(1, filters?.limite ?? 20));
  const offset = Math.max(0, filters?.offset ?? 0);
  const { sql: whereSql, params: whereParams } = authAuditLogWhere(filters);

  const countRow = (await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN a.evento = 'login_ok' THEN 1 ELSE 0 END) AS logins,
              SUM(CASE WHEN a.evento = 'navegacion' THEN 1 ELSE 0 END) AS navegacion,
              SUM(CASE WHEN a.evento = 'accion' THEN 1 ELSE 0 END) AS acciones
       ${whereSql}`
    )
    .get(whereParams)) as {
    total: number;
    logins: number;
    navegacion: number;
    acciones: number;
  };

  const params = { ...whereParams, limite, offset };
  const sql = `SELECT a.id, a.evento, a.email, a.ip, a.user_agent, a.detalle, a.creado_en,
                      u.nombre AS user_nombre
               ${whereSql}
               ORDER BY a.creado_en DESC, a.id DESC
               LIMIT @limite OFFSET @offset`;

  const rows = (await db.prepare(sql).all(params)) as AuthAuditLogRow[];
  const total = pgNum(countRow?.total);

  return {
    rows: rows.map((r) => ({
      ...r,
      creado_en: pgTimestampString(r.creado_en) ?? "",
    })),
    total,
    resumen: {
      total,
      logins: pgNum(countRow?.logins),
      navegacion: pgNum(countRow?.navegacion),
      acciones: pgNum(countRow?.acciones),
    },
  };
}

async function migrateUserEmpresaId(db: Db): Promise<void> {
  const col = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'empresa_id'`
    )
    .get();
  if (!col) {
    await db
      .prepare("ALTER TABLE USERS ADD COLUMN empresa_id INTEGER REFERENCES EMPRESAS_CUENTA(id)")
      .run();
    console.info("[SGG Auth] Migración: columna users.empresa_id agregada");
  }
}

async function migrateUserNumero(db: Db): Promise<void> {
  const col = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'usuario_numero'`
    )
    .get();
  if (!col) {
    await db.prepare("ALTER TABLE USERS ADD COLUMN usuario_numero TEXT").run();
    console.info("[SGG Auth] Migración: columna users.usuario_numero agregada");
  }

  const rows = (await db
    .prepare("SELECT id, usuario_numero FROM USERS ORDER BY id ASC")
    .all()) as { id: number; usuario_numero: string | null }[];
  const used = new Set<number>();
  for (const row of rows) {
    const n = Number(String(row.usuario_numero ?? "").replace(/\D/g, ""));
    if (Number.isFinite(n) && n > 0 && n <= 9999) used.add(Math.floor(n));
  }

  let next = 1;
  for (const row of rows) {
    if (row.usuario_numero) continue;
    while (used.has(next) && next <= 9999) next += 1;
    if (next > 9999) throw new Error("No hay ID_USUARIO disponibles");
    const numero = formatUsuarioNumero(next);
    await db
      .prepare("UPDATE USERS SET usuario_numero = ? WHERE id = ?")
      .run(numero, row.id);
    used.add(next);
  }

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_usuario_numero ON USERS(usuario_numero)"
    )
    .run();
}

export async function initAuthTables(db: Db): Promise<void> {
  await migrateUserAvatarColumns(db);
  await migrateGestorN2Role(db);
  await migrateRolePermisosSoloLectura(db);
  await seedRolePermissionsIfEmpty(db);
  await ensureGestorN2RolePermissions(db);
  await migrateModulosPreciosGanadoYChat(db);
  await migrateModuloDocumentosDigitales(db);
  await migrateUserEmpresaId(db);
  await migrateUserNumero(db);
  await migratePasswordResetTokens(db);
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

async function migrateGestorN2Role(db: Db): Promise<void> {
  const tables = ["users", "role_escritura", "role_permisos"] as const;
  for (const table of tables) {
    const rows = (await db
      .prepare(
        `SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS def
         FROM pg_constraint c
         JOIN pg_class t ON c.conrelid = t.oid
         WHERE t.relname = ? AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) ILIKE '%rol%'`
      )
      .all(table)) as { name: string; def: string }[];

    const current = rows[0];
    if (current?.def?.includes("gestor_n2")) continue;

    for (const row of rows) {
      await db.prepare(`ALTER TABLE ${table} DROP CONSTRAINT "${row.name}"`).run();
    }
    await db
      .prepare(
        `ALTER TABLE ${table}
         ADD CONSTRAINT ${table}_rol_check
         CHECK (rol IN ('admin', 'editor', 'gestor_n2', 'consulta'))`
      )
      .run();
    console.info(`[SGG Auth] Rol gestor_n2 habilitado en tabla ${table}`);
  }
}

async function ensureGestorN2RolePermissions(db: Db): Promise<void> {
  const exists = (await db
    .prepare("SELECT 1 AS ok FROM ROLE_ESCRITURA WHERE rol = 'gestor_n2'")
    .get()) as { ok: number } | undefined;
  if (exists) return;

  const def = DEFAULT_ROLE_ACCESS.gestor_n2;
  await db
    .prepare("INSERT INTO ROLE_ESCRITURA (rol, puede_escribir) VALUES ('gestor_n2', ?)")
    .run(def.puede_escribir ? 1 : 0);

  const insMod = await db.prepare(
    "INSERT INTO ROLE_PERMISOS (rol, modulo, acceso, solo_lectura) VALUES ('gestor_n2', ?, ?, ?)"
  );
  for (const modulo of MODULOS) {
    const acceso = def.modulos.includes(modulo) ? 1 : 0;
    const soloLectura = modulo === "divisas" ? 1 : 0;
    await insMod.run(modulo, acceso, soloLectura);
  }
  console.info("[SGG Auth] Permisos por defecto creados para Gestor N2");
}

/** Módulos con acceso obligatorio para todos los roles (no deshabilitables). */
export const MODULOS_TODOS_LOS_USUARIOS: Modulo[] = ["chat"];

/** Escritura sin restricción de rol global (p. ej. chat para consulta). */
export const MODULOS_ESCRITURA_TODOS_LOS_USUARIOS: Modulo[] = ["chat"];

async function migrateRolePermisosSoloLectura(db: Db): Promise<void> {
  const col = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_permisos' AND column_name = 'solo_lectura'`
    )
    .get();
  if (!col) {
    await db
      .prepare(
        "ALTER TABLE ROLE_PERMISOS ADD COLUMN solo_lectura INTEGER NOT NULL DEFAULT 0"
      )
      .run();
    console.info("[SGG Auth] Migración: columna role_permisos.solo_lectura agregada");
  }

  await db
    .prepare(
      "UPDATE ROLE_PERMISOS SET solo_lectura = 1 WHERE rol = 'gestor_n2' AND modulo = 'divisas'"
    )
    .run();

  for (const modulo of MODULOS_SOLO_ADMIN) {
    await db
      .prepare(
        "UPDATE ROLE_PERMISOS SET acceso = 0, solo_lectura = 0 WHERE modulo = ? AND rol != 'admin'"
      )
      .run(modulo);
  }

  await db
    .prepare("UPDATE ROLE_PERMISOS SET acceso = 1, solo_lectura = 0 WHERE modulo = 'chat'")
    .run();
}

async function migrateModulosPreciosGanadoYChat(db: Db): Promise<void> {
  const ins = await db.prepare(
    `INSERT INTO ROLE_PERMISOS (rol, modulo, acceso, solo_lectura)
     VALUES (?, ?, 1, 0)
     ON CONFLICT (rol, modulo) DO NOTHING`
  );

  for (const modulo of MODULOS_TODOS_LOS_USUARIOS) {
    for (const rol of ALL_ROLES) {
      await ins.run(rol, modulo);
    }
  }
}

async function migrateModuloDocumentosDigitales(db: Db): Promise<void> {
  const ins = await db.prepare(
    `INSERT INTO ROLE_PERMISOS (rol, modulo, acceso, solo_lectura)
     VALUES (?, 'documentos_digitales', ?, 0)
     ON CONFLICT (rol, modulo) DO NOTHING`
  );

  for (const rol of ALL_ROLES) {
    const acceso = rol === "admin" ? 1 : 0;
    await ins.run(rol, acceso);
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
    "INSERT INTO ROLE_PERMISOS (rol, modulo, acceso, solo_lectura) VALUES (?, ?, ?, ?)"
  );

  for (const rol of ALL_ROLES) {
    const def = DEFAULT_ROLE_ACCESS[rol];
    await insEsc.run(rol, def.puede_escribir ? 1 : 0);
    for (const modulo of MODULOS) {
      const acceso = def.modulos.includes(modulo) ? 1 : 0;
      const soloLectura =
        !def.puede_escribir || (rol === "gestor_n2" && modulo === "divisas") ? 1 : 0;
      await insMod.run(rol, modulo, acceso, soloLectura);
    }
  }
}

export async function listRolePermissions(db: Db): Promise<RolPermisosConfig[]> {
  const roles: Rol[] = ALL_ROLES;
  const result: RolPermisosConfig[] = [];

  for (const rol of roles) {
    const caps = await roleCapabilities(db, rol);
    const modRows = (await db
      .prepare("SELECT modulo, acceso, solo_lectura FROM ROLE_PERMISOS WHERE rol = ?")
      .all(rol)) as { modulo: string; acceso: number; solo_lectura: number }[];
    const accesoMap = new Map(
      modRows.map((r) => [r.modulo as Modulo, r.acceso === 1])
    );
    const soloLecturaMap = new Map(
      modRows.map((r) => [r.modulo as Modulo, r.solo_lectura === 1])
    );

    result.push({
      rol,
      rol_label: ROL_LABELS[rol],
      descripcion: ROL_DESCRIPCION[rol],
      puede_escribir: caps.puede_escribir,
      modulos: MODULOS.map((modulo) => ({
        modulo,
        label: MODULO_LABELS[modulo],
        acceso:
          rol === "admin"
            ? true
            : MODULOS_SOLO_ADMIN.includes(modulo)
              ? false
              : MODULOS_TODOS_LOS_USUARIOS.includes(modulo)
                ? true
                : (accesoMap.get(modulo) ?? false),
        solo_lectura:
          rol === "admin"
            ? false
            : (soloLecturaMap.get(modulo) ?? false) || !caps.puede_escribir,
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
  const soloInput = input.modulos_solo_lectura ?? {};
  let enabledCount = 0;

  const puedeEscribir = rol === "consulta" ? false : Boolean(input.puede_escribir);

  const upsert = await db.prepare(
    `INSERT INTO ROLE_PERMISOS (rol, modulo, acceso, solo_lectura)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (rol, modulo) DO UPDATE SET
       acceso = excluded.acceso,
       solo_lectura = excluded.solo_lectura`
  );

  for (const modulo of MODULOS) {
    if (MODULOS_SOLO_ADMIN.includes(modulo)) {
      await upsert.run(rol, modulo, 0, 0);
      continue;
    }
    if (MODULOS_TODOS_LOS_USUARIOS.includes(modulo)) {
      await upsert.run(rol, modulo, 1, 0);
      enabledCount += 1;
      continue;
    }
    const acceso = Boolean(modulosInput[modulo]);
    const soloLectura =
      acceso && (!puedeEscribir || Boolean(soloInput[modulo]));
    if (acceso) enabledCount += 1;
    await upsert.run(rol, modulo, acceso ? 1 : 0, soloLectura ? 1 : 0);
  }

  if (enabledCount === 0) {
    throw new Error("Debe habilitarse al menos un sector para el rol");
  }

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
    .run(normalizeEmail(email), hash, DEFAULT_ADMIN_NAME);

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
        `UPDATE USERS SET email = ?, password_hash = ?, nombre = ?,
        rol = 'admin', activo = 1, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(normalizedEmail, hash, DEFAULT_ADMIN_NAME, legacy.id);
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

export async function listUsers(
  db: Db,
  opts?: { empresa_id?: number | null; incluir_admin_id?: number | null }
): Promise<UserPublic[]> {
  let sql = "SELECT * FROM USERS";
  const params: unknown[] = [];

  if (opts?.empresa_id !== undefined && opts.empresa_id !== null) {
    if (
      opts.incluir_admin_id !== undefined &&
      opts.incluir_admin_id !== null
    ) {
      sql += " WHERE (empresa_id = ? OR id = ?)";
      params.push(opts.empresa_id, opts.incluir_admin_id);
    } else {
      sql += " WHERE empresa_id = ?";
      params.push(opts.empresa_id);
    }
  }

  sql += " ORDER BY LOWER(nombre) ASC";

  const rows = (await db.prepare(sql).all(...params)) as UserRow[];
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
  const empresaId =
    data.empresa_id !== undefined && data.empresa_id !== null
      ? Number(data.empresa_id)
      : null;

  if (empresaId != null) {
    const empresa = (await db
      .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE id = ? AND activo = 1")
      .get(empresaId)) as { id: number } | undefined;
    if (!empresa) throw new Error("La cuenta de empresa no existe o está inactiva");
  }

  const usuarioNumero = await nextUsuarioNumero(db);
  const result = await db
    .prepare(
      `INSERT INTO USERS (usuario_numero, email, password_hash, nombre, rol, activo, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      usuarioNumero,
      email,
      hash,
      data.nombre.trim(),
      data.rol,
      data.activo === false ? 0 : 1,
      empresaId
    );

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
  const empresaId =
    data.empresa_id !== undefined
      ? data.empresa_id === null
        ? null
        : Number(data.empresa_id)
      : current.empresa_id ?? null;

  if (!email.includes("@")) throw new Error("Email inválido");
  if (!nombre) throw new Error("El nombre es obligatorio");

  if (empresaId != null) {
    const empresa = (await db
      .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE id = ? AND activo = 1")
      .get(empresaId)) as { id: number } | undefined;
    if (!empresa) throw new Error("La cuenta de empresa no existe o está inactiva");
  }

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
        empresa_id = ?, password_hash = ?, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(email, nombre, rol, activo, empresaId, hash, id);
    await deleteAllUserSessions(db, id);
  } else {
    await db
      .prepare(
        `UPDATE USERS SET email = ?, nombre = ?, rol = ?, activo = ?,
        empresa_id = ?, actualizado_en = NOW()
       WHERE id = ?`
      )
      .run(email, nombre, rol, activo, empresaId, id);
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

const RESET_TOKEN_MS = 60 * 60 * 1000;

async function migratePasswordResetTokens(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS PASSWORD_RESET_TOKENS (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
        expira_en TIMESTAMPTZ NOT NULL,
        usado_en TIMESTAMPTZ,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip TEXT
      )`
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
       ON PASSWORD_RESET_TOKENS(user_id)`
    )
    .run();
}

async function purgeExpiredResetTokens(db: Db): Promise<void> {
  await db
    .prepare(
      `DELETE FROM PASSWORD_RESET_TOKENS
       WHERE expira_en <= NOW()
          OR usado_en IS NOT NULL`
    )
    .run();
}

export async function findActiveUserByEmail(
  db: Db,
  email: string
): Promise<UserRow | undefined> {
  return (await db
    .prepare(`SELECT * FROM USERS WHERE LOWER(email) = LOWER(?) AND activo = 1`)
    .get(normalizeEmail(email))) as UserRow | undefined;
}

export async function createPasswordResetToken(
  db: Db,
  userId: number,
  meta?: { ip?: string }
): Promise<string> {
  await purgeExpiredResetTokens(db);
  await db
    .prepare(`DELETE FROM PASSWORD_RESET_TOKENS WHERE user_id = ?`)
    .run(userId);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expira = new Date(Date.now() + RESET_TOKEN_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO PASSWORD_RESET_TOKENS (id, user_id, expira_en, ip)
       VALUES (?, ?, ?, ?)`
    )
    .run(tokenHash, userId, expira, meta?.ip ?? null);

  return rawToken;
}

export type ResetTokenStatus = "valid" | "invalid" | "expired" | "used";

export async function peekPasswordResetToken(
  db: Db,
  rawToken: string
): Promise<ResetTokenStatus> {
  if (!isValidSessionTokenFormat(rawToken)) return "invalid";
  await purgeExpiredResetTokens(db);

  const tokenHash = hashSessionToken(rawToken);
  const row = (await db
    .prepare(
      `SELECT expira_en, usado_en FROM PASSWORD_RESET_TOKENS WHERE id = ?`
    )
    .get(tokenHash)) as { expira_en: string; usado_en: string | null } | undefined;

  if (!row) return "invalid";
  if (row.usado_en) return "used";
  if (new Date(row.expira_en) <= new Date()) return "expired";
  return "valid";
}

export async function resetPasswordWithToken(
  db: Db,
  rawToken: string,
  newPassword: string
): Promise<
  { ok: true; email: string } | { ok: false; reason: ResetTokenStatus }
> {
  const status = await peekPasswordResetToken(db, rawToken);
  if (status !== "valid") return { ok: false, reason: status };

  assertPasswordPolicy(newPassword);

  const tokenHash = hashSessionToken(rawToken);
  const row = (await db
    .prepare(
      `SELECT t.user_id, u.email
       FROM PASSWORD_RESET_TOKENS t
       INNER JOIN USERS u ON u.id = t.user_id
       WHERE t.id = ? AND t.usado_en IS NULL AND t.expira_en > NOW()`
    )
    .get(tokenHash)) as { user_id: number; email: string } | undefined;

  if (!row) return { ok: false, reason: "invalid" };

  const hash = bcrypt.hashSync(newPassword, BCRYPT_ROUNDS);
  await db
    .prepare(
      `UPDATE USERS SET password_hash = ?, actualizado_en = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = ?`
    )
    .run(hash, row.user_id);
  await db
    .prepare(`UPDATE PASSWORD_RESET_TOKENS SET usado_en = NOW() WHERE id = ?`)
    .run(tokenHash);
  await db
    .prepare(`DELETE FROM PASSWORD_RESET_TOKENS WHERE user_id = ? AND id != ?`)
    .run(row.user_id, tokenHash);
  await deleteAllUserSessions(db, row.user_id);

  return { ok: true, email: row.email };
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
