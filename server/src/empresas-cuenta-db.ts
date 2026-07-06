import type { Db } from "./db/pg-client.js";
import * as colorDb from "./stock-dispositivo-color-db.js";

export interface EmpresaCuentaRow {
  id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: number;
  admin_user_id: number | null;
  creado_en: string;
  actualizado_en: string;
}

export interface EmpresaOperativaRow {
  id: number;
  cuenta_id: number;
  nombre: string;
  codigo: string;
  color: string;
  activo: number;
  creado_en: string;
  actualizado_en: string;
}

export interface EmpresaOperativa {
  id: number;
  cuenta_id: number;
  nombre: string;
  codigo: string;
  color: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface EmpresaCuentaAdmin {
  id: number;
  email: string;
  nombre: string;
  es_super_admin: boolean;
}

export interface EmpresaCuenta {
  id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
  usuarios_count: number;
  empresas_count: number;
  empresas: EmpresaOperativa[];
  admin_user_id: number | null;
  admin: EmpresaCuentaAdmin | null;
}

export interface EmpresaCuentaInput {
  nombre: string;
  codigo?: string;
  activo?: boolean;
}

export interface EmpresaOperativaInput {
  nombre: string;
  codigo?: string;
  color?: string;
  activo?: boolean;
}

export type EmpresaOperativaDetalle = {
  codigo: string;
  nombre: string;
  color: string;
};

const SEED_CUENTA_MADRE = { nombre: "VILA DIAZ", codigo: "VILADIAZ" };

const SEED_EMPRESAS_OPERATIVAS: Array<{ nombre: string; codigo: string }> = [
  { nombre: "GANADERA GUAVIYU", codigo: "GUAVIYU" },
  { nombre: "GANADERA CHIVILCOY", codigo: "CHIVILCOY" },
];

function pgNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pgTimestampString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeCodigo(codigo: string): string {
  return codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "");
}

function formatEmpresaOperativaCodigo(seq: number): string {
  return `E${Math.max(1, Math.floor(seq)).toString().padStart(5, "0")}`;
}

function parseEmpresaOperativaCodigoSeq(codigo: string): number | null {
  const m = /^E(\d{5})$/i.exec(String(codigo ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatCuentaMadreCodigo(seq: number): string {
  return `C${Math.max(1, Math.floor(seq)).toString().padStart(5, "0")}`;
}

function parseCuentaMadreCodigoSeq(codigo: string): number | null {
  const m = /^C(\d{5})$/i.exec(String(codigo ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function maxCuentaMadreCodigoSeq(db: Db): Promise<number> {
  const rows = (await db
    .prepare("SELECT codigo FROM EMPRESAS_CUENTA")
    .all()) as { codigo: string }[];
  let max = 0;
  for (const row of rows) {
    const n = parseCuentaMadreCodigoSeq(row.codigo);
    if (n != null && n > max) max = n;
  }
  return max;
}

/** Código correlativo global C00001, C00002, … único en todas las cuentas madre. */
export async function nextCuentaMadreCodigo(db: Db): Promise<string> {
  let next = (await maxCuentaMadreCodigoSeq(db)) + 1;
  while (true) {
    const candidate = formatCuentaMadreCodigo(next);
    const dup = (await db
      .prepare("SELECT 1 AS ok FROM EMPRESAS_CUENTA WHERE codigo = ?")
      .get(candidate)) as { ok: number } | undefined;
    if (!dup) return candidate;
    next += 1;
  }
}

async function migrateCuentaMadreCodigosCorrelativos(db: Db): Promise<void> {
  const rows = (await db
    .prepare("SELECT id, codigo FROM EMPRESAS_CUENTA ORDER BY id ASC")
    .all()) as { id: number; codigo: string }[];

  let maxSeq = await maxCuentaMadreCodigoSeq(db);

  for (const row of rows) {
    if (parseCuentaMadreCodigoSeq(row.codigo) != null) continue;
    maxSeq += 1;
    const newCodigo = formatCuentaMadreCodigo(maxSeq);
    await db
      .prepare("UPDATE EMPRESAS_CUENTA SET codigo = ? WHERE id = ?")
      .run(newCodigo, row.id);
  }
}

async function maxEmpresaOperativaCodigoSeq(db: Db): Promise<number> {
  const rows = (await db
    .prepare("SELECT codigo FROM EMPRESAS_OPERATIVAS")
    .all()) as { codigo: string }[];
  let max = 0;
  for (const row of rows) {
    const n = parseEmpresaOperativaCodigoSeq(row.codigo);
    if (n != null && n > max) max = n;
  }
  return max;
}

/** Código correlativo global E00001, E00002, … único en todas las empresas operativas. */
export async function nextEmpresaOperativaCodigo(db: Db): Promise<string> {
  let next = (await maxEmpresaOperativaCodigoSeq(db)) + 1;
  while (true) {
    const candidate = formatEmpresaOperativaCodigo(next);
    const dup = (await db
      .prepare("SELECT 1 AS ok FROM EMPRESAS_OPERATIVAS WHERE codigo = ?")
      .get(candidate)) as { ok: number } | undefined;
    if (!dup) return candidate;
    next += 1;
  }
}

async function migrateEmpresaOperativaCodigosCorrelativos(db: Db): Promise<void> {
  const rows = (await db
    .prepare("SELECT id, codigo FROM EMPRESAS_OPERATIVAS ORDER BY id ASC")
    .all()) as { id: number; codigo: string }[];

  let maxSeq = await maxEmpresaOperativaCodigoSeq(db);

  for (const row of rows) {
    if (parseEmpresaOperativaCodigoSeq(row.codigo) != null) continue;
    const oldCodigo = row.codigo.trim();
    if (!oldCodigo) continue;
    maxSeq += 1;
    const newCodigo = formatEmpresaOperativaCodigo(maxSeq);
    await db
      .prepare("UPDATE EMPRESAS_OPERATIVAS SET codigo = ? WHERE id = ?")
      .run(newCodigo, row.id);
    await db
      .prepare(
        "UPDATE STOCK_GANADERO_DISPOSITIVO SET empresa = ? WHERE UPPER(TRIM(empresa)) = UPPER(TRIM(?))"
      )
      .run(newCodigo, oldCodigo);
  }

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_operativas_codigo_global ON EMPRESAS_OPERATIVAS(codigo)"
    )
    .run();
}

function formatCuentaNumero(n: number): string {
  return Math.max(1, Math.floor(n)).toString().padStart(6, "0").slice(-6);
}

function parseCuentaNumero(value: unknown): number {
  const n = Number(String(value ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function rowToPublic(
  row: EmpresaCuentaRow,
  usuarios_count = 0,
  empresas: EmpresaOperativa[] = [],
  admin: EmpresaCuentaAdmin | null = null
): EmpresaCuenta {
  const adminUserId =
    row.admin_user_id != null && Number.isFinite(Number(row.admin_user_id))
      ? Number(row.admin_user_id)
      : null;
  return {
    id: row.id,
    cuenta_numero: row.cuenta_numero || formatCuentaNumero(row.id),
    nombre: row.nombre,
    codigo: row.codigo,
    activo: pgNum(row.activo) === 1,
    creado_en: pgTimestampString(row.creado_en),
    actualizado_en: pgTimestampString(row.actualizado_en),
    usuarios_count,
    empresas_count: empresas.length,
    empresas,
    admin_user_id: adminUserId,
    admin,
  };
}

async function getCuentaAdmin(
  db: Db,
  adminUserId: number | null
): Promise<EmpresaCuentaAdmin | null> {
  if (adminUserId == null) return null;
  const row = (await db
    .prepare("SELECT id, email, nombre, rol, empresa_id FROM USERS WHERE id = ?")
    .get(adminUserId)) as
    | { id: number; email: string; nombre: string; rol: string; empresa_id: number | null }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    es_super_admin: row.rol === "admin" && row.empresa_id == null,
  };
}

function operativaToPublic(row: EmpresaOperativaRow): EmpresaOperativa {
  return {
    id: row.id,
    cuenta_id: row.cuenta_id,
    nombre: row.nombre,
    codigo: row.codigo,
    color: colorDb.normalizarColorCaravana(row.color),
    activo: pgNum(row.activo) === 1,
    creado_en: pgTimestampString(row.creado_en),
    actualizado_en: pgTimestampString(row.actualizado_en),
  };
}

function normalizarColorEmpresaOperativa(
  val: string | undefined | null,
  requerido = false
): string {
  const norm = colorDb.normalizarColorCaravana(val);
  if (!norm && requerido) {
    throw new Error("Elegí un color para la empresa.");
  }
  return norm;
}

async function assertColorEmpresaOperativaDisponible(
  db: Db,
  cuentaId: number,
  color: string,
  excludeEmpresaId?: number
): Promise<void> {
  if (!color) return;
  const dup = (await db
    .prepare(
      `SELECT nombre FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ? AND color = ? AND id != ?`
    )
    .get(cuentaId, color, excludeEmpresaId ?? 0)) as { nombre: string } | undefined;
  if (dup) {
    throw new Error(
      `El color ${colorDb.etiquetaColorCaravana(color)} ya está asignado a ${dup.nombre}. Elegí otro color.`
    );
  }
}

/** Color de empresa operativa por código E00001 (vacío si no existe o sin color). */
export async function getEmpresaOperativaColorPorCodigo(
  db: Db,
  codigo: string
): Promise<string> {
  const norm = normalizeCodigo(codigo);
  if (!norm) return "";
  const row = (await db
    .prepare(
      `SELECT color FROM EMPRESAS_OPERATIVAS WHERE UPPER(TRIM(codigo)) = ?`
    )
    .get(norm)) as { color: string } | undefined;
  return colorDb.normalizarColorCaravana(row?.color);
}

async function tableExists(db: Db, tableName: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ?`
    )
    .get(tableName.toLowerCase())) as { ok: number } | undefined;
  return Boolean(row);
}

async function migrateDropEmpresaCheckConstraints(db: Db): Promise<void> {
  const tables = ["presupuesto", "ventas_agricultura", "ventas_arrendamiento"];
  for (const table of tables) {
    const rows = (await db
      .prepare(
        `SELECT c.conname AS name
         FROM pg_constraint c
         JOIN pg_class t ON c.conrelid = t.oid
         WHERE t.relname = ? AND c.contype = 'c'
           AND pg_get_constraintdef(c.oid) ILIKE '%empresa%'`
      )
      .all(table)) as { name: string }[];

    for (const row of rows) {
      await db.prepare(`ALTER TABLE ${table} DROP CONSTRAINT "${row.name}"`).run();
      console.info(`[SGG Empresas] CHECK empresa eliminado en ${table}`);
    }
  }
}

async function getCuentaIdByNombre(
  db: Db,
  nombre: string
): Promise<number | null> {
  const row = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre.trim())) as { id: number } | undefined;
  return row ? Number(row.id) : null;
}

async function getCuentaIdByCodigo(
  db: Db,
  codigo: string
): Promise<number | null> {
  const row = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE codigo = ?")
    .get(normalizeCodigo(codigo))) as { id: number } | undefined;
  return row ? Number(row.id) : null;
}

async function ensureSeedCuentaMadre(db: Db): Promise<number> {
  const existing = await getCuentaIdByNombre(db, SEED_CUENTA_MADRE.nombre);
  if (existing) return existing;

  const result = await db
    .prepare(
      `INSERT INTO EMPRESAS_CUENTA (cuenta_numero, nombre, codigo, activo)
       VALUES (?, ?, ?, 1)`
    )
    .run(
      await nextCuentaNumero(db),
      SEED_CUENTA_MADRE.nombre,
      await nextCuentaMadreCodigo(db)
    );

  console.info("[SGG Empresas] Cuenta madre VILA DIAZ creada");
  return Number(result.lastInsertRowid);
}

async function ensureEmpresaOperativaSeed(
  db: Db,
  cuentaId: number,
  seed: { nombre: string; codigo: string }
): Promise<void> {
  const exists = (await db
    .prepare(
      "SELECT id FROM EMPRESAS_OPERATIVAS WHERE cuenta_id = ? AND LOWER(nombre) = LOWER(?)"
    )
    .get(cuentaId, seed.nombre)) as { id: number } | undefined;
  if (exists) return;

  await db
    .prepare(
      `INSERT INTO EMPRESAS_OPERATIVAS (cuenta_id, nombre, codigo, activo)
       VALUES (?, ?, ?, 1)`
    )
    .run(cuentaId, seed.nombre, await nextEmpresaOperativaCodigo(db));
}

async function migrateCuentaAdminColumn(db: Db): Promise<void> {
  const col = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'empresas_cuenta'
         AND column_name = 'admin_user_id'`
    )
    .get();
  if (!col) {
    await db
      .prepare(
        "ALTER TABLE EMPRESAS_CUENTA ADD COLUMN admin_user_id INTEGER REFERENCES USERS(id)"
      )
      .run();
    console.info("[SGG Empresas] Migración: columna empresas_cuenta.admin_user_id agregada");
  }
}

async function nextCuentaNumero(db: Db): Promise<string> {
  const rows = (await db
    .prepare("SELECT cuenta_numero FROM EMPRESAS_CUENTA WHERE cuenta_numero IS NOT NULL")
    .all()) as { cuenta_numero: string | null }[];
  const used = new Set(rows.map((r) => String(r.cuenta_numero ?? "").trim()).filter(Boolean));
  let next =
    rows.reduce((max, r) => Math.max(max, parseCuentaNumero(r.cuenta_numero)), 0) + 1;
  while (used.has(formatCuentaNumero(next))) next += 1;
  return formatCuentaNumero(next);
}

async function migrateCuentaNumeroColumn(db: Db): Promise<void> {
  const col = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'empresas_cuenta'
         AND column_name = 'cuenta_numero'`
    )
    .get();
  if (!col) {
    await db
      .prepare("ALTER TABLE EMPRESAS_CUENTA ADD COLUMN cuenta_numero TEXT")
      .run();
    console.info("[SGG Empresas] Migración: columna empresas_cuenta.cuenta_numero agregada");
  }

  const rows = (await db
    .prepare(
      `SELECT id, cuenta_numero FROM EMPRESAS_CUENTA
       ORDER BY id ASC`
    )
    .all()) as { id: number; cuenta_numero: string | null }[];
  const used = new Set(
    rows.map((r) => String(r.cuenta_numero ?? "").trim()).filter(Boolean)
  );

  for (const row of rows) {
    if (row.cuenta_numero?.trim()) continue;
    let candidate = formatCuentaNumero(Number(row.id));
    let next = Math.max(Number(row.id), 1);
    while (used.has(candidate)) {
      next += 1;
      candidate = formatCuentaNumero(next);
    }
    await db
      .prepare("UPDATE EMPRESAS_CUENTA SET cuenta_numero = ? WHERE id = ?")
      .run(candidate, row.id);
    used.add(candidate);
  }

  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_cuenta_numero ON EMPRESAS_CUENTA(cuenta_numero)"
    )
    .run();
}

function primaryAdminEmail(): string {
  return (process.env.SCG_ADMIN_EMAIL?.trim() || "jlvilasoler@gmail.com")
    .trim()
    .toLowerCase();
}

/** Superadministrador único de plataforma (SCG_ADMIN_EMAIL): actividad global, etc. */
export function isPrimaryPlatformAdmin(user: { email: string }): boolean {
  return user.email.trim().toLowerCase() === primaryAdminEmail();
}

/**
 * Asigna al administrador principal de la plataforma como administrador de la
 * cuenta madre VILA DIAZ si todavía no tiene uno. Debe ejecutarse DESPUÉS de
 * crear/seedear los usuarios (auth.initAuthTables).
 */
export async function ensureCuentaMadreAdmin(db: Db): Promise<void> {
  const cuenta = (await db
    .prepare(
      "SELECT id, admin_user_id FROM EMPRESAS_CUENTA WHERE LOWER(nombre) = LOWER(?)"
    )
    .get(SEED_CUENTA_MADRE.nombre)) as
    | { id: number; admin_user_id: number | null }
    | undefined;
  if (!cuenta || cuenta.admin_user_id != null) return;

  const admin = (await db
    .prepare("SELECT id FROM USERS WHERE LOWER(email) = LOWER(?)")
    .get(primaryAdminEmail())) as { id: number } | undefined;
  if (!admin) return;

  await db
    .prepare("UPDATE EMPRESAS_CUENTA SET admin_user_id = ? WHERE id = ?")
    .run(admin.id, cuenta.id);
  console.info("[SGG Empresas] Administrador de VILA DIAZ asignado al admin principal");
}

const BACKFILL_USUARIOS_MARKER = "vila_diaz_usuarios_backfill";

/**
 * Asigna a la cuenta madre VILA DIAZ todos los usuarios pre-existentes que
 * quedaron con empresa_id NULL (creados antes del modelo multi-empresa, por
 * ejemplo los Gestor N1/N2). Excluye al administrador principal del sistema
 * (super admin), que debe permanecer sin empresa. Se ejecuta una sola vez,
 * usando un marcador en AUTH_AUDIT_LOG para no barrer usuarios globales que se
 * creen a futuro. Debe ejecutarse DESPUÉS de auth.initAuthTables.
 */
export async function backfillCuentaMadreUsuarios(db: Db): Promise<void> {
  const yaCorrio = (await db
    .prepare("SELECT 1 FROM AUTH_AUDIT_LOG WHERE evento = ? LIMIT 1")
    .get(BACKFILL_USUARIOS_MARKER)) as { [k: string]: unknown } | undefined;
  if (yaCorrio) return;

  const cuenta = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE LOWER(nombre) = LOWER(?)")
    .get(SEED_CUENTA_MADRE.nombre)) as { id: number } | undefined;
  if (!cuenta) return;

  const res = (await db
    .prepare(
      `UPDATE USERS SET empresa_id = ?
       WHERE empresa_id IS NULL AND LOWER(email) <> LOWER(?)`
    )
    .run(cuenta.id, primaryAdminEmail())) as { changes?: number };

  await db
    .prepare(
      `INSERT INTO AUTH_AUDIT_LOG (evento, email, detalle)
       VALUES (?, ?, ?)`
    )
    .run(
      BACKFILL_USUARIOS_MARKER,
      primaryAdminEmail(),
      `usuarios reasignados a VILA DIAZ=${res?.changes ?? 0}`
    );

  console.info(
    `[SGG Empresas] Backfill: ${res?.changes ?? 0} usuario(s) asignado(s) a VILA DIAZ`
  );
}

/** Alinea empresa_id de administradores de cuenta que quedaron sin cuenta o en otra. */
export async function syncCuentaAdminsEmpresaId(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT c.id AS cuenta_id, c.admin_user_id
       FROM EMPRESAS_CUENTA c
       INNER JOIN USERS u ON u.id = c.admin_user_id
       WHERE c.admin_user_id IS NOT NULL
         AND (u.empresa_id IS NULL OR u.empresa_id <> c.id)
         AND LOWER(u.email) <> LOWER(?)`
    )
    .all(primaryAdminEmail())) as { cuenta_id: number; admin_user_id: number }[];

  for (const row of rows) {
    await db
      .prepare(
        "UPDATE USERS SET empresa_id = ?, actualizado_en = NOW() WHERE id = ?"
      )
      .run(row.cuenta_id, row.admin_user_id);
  }

  if (rows.length > 0) {
    console.info(
      `[SGG Empresas] ${rows.length} administrador(es) de cuenta con empresa_id sincronizado`
    );
  }
}

async function migrateVilaDiazStructure(db: Db): Promise<void> {
  const cuentaId = await ensureSeedCuentaMadre(db);

  for (const seed of SEED_EMPRESAS_OPERATIVAS) {
    await ensureEmpresaOperativaSeed(db, cuentaId, seed);
  }

  const legacyRows = (await db
    .prepare(
      `SELECT id FROM EMPRESAS_CUENTA
       WHERE codigo IN ('GUAVIYU', 'CHIVILCOY')`
    )
    .all()) as { id: number }[];

  for (const legacy of legacyRows) {
    await db
      .prepare("UPDATE USERS SET empresa_id = ? WHERE empresa_id = ?")
      .run(cuentaId, legacy.id);
    await db.prepare("DELETE FROM EMPRESAS_CUENTA WHERE id = ?").run(legacy.id);
  }
}

async function migrateEmpresaOperativaColorColumn(db: Db): Promise<void> {
  try {
    await db
      .prepare(
        `ALTER TABLE EMPRESAS_OPERATIVAS ADD COLUMN color TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  const cuentas = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA ORDER BY id ASC")
    .all()) as { id: number }[];

  for (const cuenta of cuentas) {
    const ops = (await db
      .prepare(
        `SELECT id, color FROM EMPRESAS_OPERATIVAS
         WHERE cuenta_id = ? ORDER BY id ASC`
      )
      .all(cuenta.id)) as { id: number; color: string }[];

    const usados = new Set(
      ops
        .map((o) => colorDb.normalizarColorCaravana(o.color))
        .filter(Boolean)
    );

    for (const op of ops) {
      if (colorDb.normalizarColorCaravana(op.color)) continue;
      const libre = colorDb.COLORES_CARAVANA.find((c) => !usados.has(c.id));
      if (!libre) continue;
      await db
        .prepare("UPDATE EMPRESAS_OPERATIVAS SET color = ? WHERE id = ?")
        .run(libre.id, op.id);
      usados.add(libre.id);

      const codigoRow = (await db
        .prepare("SELECT codigo FROM EMPRESAS_OPERATIVAS WHERE id = ?")
        .get(op.id)) as { codigo: string } | undefined;
      if (codigoRow?.codigo) {
        await db
          .prepare(
            `UPDATE STOCK_GANADERO_DISPOSITIVO
             SET color_caravana = ?
             WHERE UPPER(TRIM(empresa)) = UPPER(TRIM(?))`
          )
          .run(libre.id, codigoRow.codigo);
      }
    }
  }
}

export async function initEmpresasCuentaTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS EMPRESAS_CUENTA (
        id SERIAL PRIMARY KEY,
        cuenta_numero TEXT UNIQUE,
        nombre TEXT NOT NULL UNIQUE,
        codigo TEXT NOT NULL UNIQUE,
        activo INTEGER NOT NULL DEFAULT 1,
        creado_en TIMESTAMPTZ DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS EMPRESAS_OPERATIVAS (
        id SERIAL PRIMARY KEY,
        cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
        nombre TEXT NOT NULL,
        codigo TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        activo INTEGER NOT NULL DEFAULT 1,
        creado_en TIMESTAMPTZ DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (cuenta_id, nombre),
        UNIQUE (cuenta_id, codigo)
      )`
    )
    .run();

  await migrateCuentaNumeroColumn(db);
  await migrateCuentaAdminColumn(db);
  await migrateEmpresaOperativaColorColumn(db);
  await migrateDropEmpresaCheckConstraints(db);
  await migrateVilaDiazStructure(db);
  await migrateEmpresaOperativaCodigosCorrelativos(db);
  await migrateCuentaMadreCodigosCorrelativos(db);
}

export async function listEmpresasCuenta(db: Db): Promise<EmpresaCuenta[]> {
  if (!(await tableExists(db, "empresas_cuenta"))) return [];

  const rows = (await db
    .prepare(
      `SELECT e.*, COUNT(DISTINCT u.id) AS usuarios_count
       FROM EMPRESAS_CUENTA e
       LEFT JOIN USERS u ON (u.empresa_id = e.id OR u.id = e.admin_user_id)
       GROUP BY e.id
       ORDER BY LOWER(e.nombre) ASC`
    )
    .all()) as Array<EmpresaCuentaRow & { usuarios_count: number }>;

  const result: EmpresaCuenta[] = [];
  for (const row of rows) {
    result.push(
      rowToPublic(
        row,
        pgNum(row.usuarios_count),
        await listEmpresasOperativas(db, row.id),
        await getCuentaAdmin(db, row.admin_user_id)
      )
    );
  }
  return result;
}

export async function listEmpresasActivas(db: Db): Promise<EmpresaCuenta[]> {
  const all = await listEmpresasCuenta(db);
  return all.filter((e) => e.activo);
}

export async function getEmpresaNombresActivos(db: Db): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT op.nombre
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.activo = 1 AND c.activo = 1
       ORDER BY LOWER(op.nombre) ASC`
    )
    .all()) as { nombre: string }[];
  return rows.map((r) => r.nombre);
}

export async function getEmpresaCodigosActivos(db: Db): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT op.codigo
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.activo = 1 AND c.activo = 1
       ORDER BY op.codigo ASC`
    )
    .all()) as { codigo: string }[];
  return rows.map((r) => r.codigo);
}

export async function getEmpresaCodigosActivosPorCuenta(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT op.codigo
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.cuenta_id = ? AND op.activo = 1 AND c.activo = 1
       ORDER BY op.codigo ASC`
    )
    .all(cuentaId)) as { codigo: string }[];
  return rows.map((r) => r.codigo);
}

export async function getEmpresasOperativasDetalleActivas(
  db: Db
): Promise<EmpresaOperativaDetalle[]> {
  const rows = (await db
    .prepare(
      `SELECT op.codigo, op.nombre, op.color
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.activo = 1 AND c.activo = 1
       ORDER BY LOWER(op.nombre) ASC`
    )
    .all()) as { codigo: string; nombre: string; color: string }[];
  return rows.map((r) => ({
    codigo: r.codigo,
    nombre: r.nombre,
    color: colorDb.normalizarColorCaravana(r.color),
  }));
}

export async function getEmpresasOperativasDetallePorCuenta(
  db: Db,
  cuentaId: number
): Promise<EmpresaOperativaDetalle[]> {
  const ops = await listEmpresasOperativas(db, cuentaId);
  return ops
    .filter((o) => o.activo)
    .map((o) => ({ codigo: o.codigo, nombre: o.nombre, color: o.color }));
}

/** ID de la cuenta madre semilla (VILA DIAZ). Usado para backfill de datos legacy. */
export async function getSeedCuentaMadreId(db: Db): Promise<number | null> {
  return await getCuentaIdByNombre(db, SEED_CUENTA_MADRE.nombre);
}

/**
 * cuenta_id a usar al INSERTAR datos de un usuario: su cuenta, o VILA DIAZ como
 * fallback para el super admin sin cuenta propia.
 */
export async function cuentaIdParaInsert(
  db: Db,
  user: { id: number; es_super_admin?: boolean; empresa_id?: number | null }
): Promise<number | null> {
  const propia = await resolveCuentaMadreIdForUser(db, user);
  if (propia) return propia;
  return await getSeedCuentaMadreId(db);
}

/**
 * Migración genérica: agrega columna cuenta_id a una tabla, la rellena con
 * VILA DIAZ para filas existentes y crea el índice. Idempotente.
 */
export async function migrateAddCuentaIdColumn(
  db: Db,
  tabla: string
): Promise<void> {
  let added = false;
  try {
    await db
      .prepare(
        `ALTER TABLE ${tabla} ADD COLUMN cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id)`
      )
      .run();
    added = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }
  const seedId = await getSeedCuentaMadreId(db);
  if (seedId) {
    await db
      .prepare(`UPDATE ${tabla} SET cuenta_id = ? WHERE cuenta_id IS NULL`)
      .run(seedId);
  }
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_${tabla.toLowerCase()}_cuenta ON ${tabla}(cuenta_id)`
    )
    .run();
  if (added) {
    console.info(`[SGG Empresas] Columna cuenta_id agregada a ${tabla}`);
  }
}

/** Asigna cuenta_id según el nombre de empresa operativa (columna empresa). */
export async function backfillCuentaIdPorEmpresa(
  db: Db,
  tabla: string,
  empresaColumn = "empresa"
): Promise<void> {
  try {
    const result = await db
      .prepare(
        `UPDATE ${tabla} AS t
         SET cuenta_id = op.cuenta_id
         FROM EMPRESAS_OPERATIVAS op
         WHERE LOWER(TRIM(op.nombre)) = LOWER(TRIM(t.${empresaColumn}))
           AND (t.cuenta_id IS NULL OR t.cuenta_id IS DISTINCT FROM op.cuenta_id)`
      )
      .run();
    if (result.changes > 0) {
      console.info(
        `[SGG Empresas] backfill cuenta_id en ${tabla}: ${result.changes} fila(s)`
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist|no such column|duplicate column/i.test(msg)) return;
    throw err;
  }
}

export async function getEmpresaNombresActivosPorCuenta(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT op.nombre
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.cuenta_id = ? AND op.activo = 1 AND c.activo = 1
       ORDER BY LOWER(op.nombre) ASC`
    )
    .all(cuentaId)) as { nombre: string }[];
  return rows.map((r) => r.nombre);
}

export async function listEmpresasOperativas(
  db: Db,
  cuentaId: number
): Promise<EmpresaOperativa[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ?
       ORDER BY LOWER(nombre) ASC`
    )
    .all(cuentaId)) as EmpresaOperativaRow[];
  return rows.map(operativaToPublic);
}

export async function getEmpresaCuentaById(
  db: Db,
  id: number
): Promise<EmpresaCuenta | null> {
  const row = (await db
    .prepare("SELECT * FROM EMPRESAS_CUENTA WHERE id = ?")
    .get(id)) as EmpresaCuentaRow | undefined;
  if (!row) return null;

  const countRow = (await db
    .prepare(
      "SELECT COUNT(DISTINCT id) AS n FROM USERS WHERE empresa_id = ? OR id = ?"
    )
    .get(id, row.admin_user_id)) as { n: number };

  return rowToPublic(
    row,
    pgNum(countRow.n),
    await listEmpresasOperativas(db, id),
    await getCuentaAdmin(db, row.admin_user_id)
  );
}

export async function getEmpresaCuentaByAdminUserId(
  db: Db,
  userId: number
): Promise<EmpresaCuenta | null> {
  const row = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE admin_user_id = ? LIMIT 1")
    .get(userId)) as { id: number } | undefined;
  if (!row) return null;
  return getEmpresaCuentaById(db, row.id);
}

export async function getEmpresaCuentaByNombre(
  db: Db,
  nombre: string
): Promise<EmpresaCuenta | null> {
  const row = (await db
    .prepare("SELECT * FROM EMPRESAS_CUENTA WHERE nombre = ?")
    .get(nombre.trim())) as EmpresaCuentaRow | undefined;
  return row
    ? rowToPublic(
        row,
        0,
        await listEmpresasOperativas(db, row.id),
        await getCuentaAdmin(db, row.admin_user_id)
      )
    : null;
}

export async function isValidEmpresaNombre(
  db: Db,
  nombre: string
): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.nombre = ? AND op.activo = 1 AND c.activo = 1`
    )
    .get(nombre.trim())) as { ok: number } | undefined;
  return Boolean(row);
}

export async function isValidEmpresaCodigo(
  db: Db,
  codigo: string
): Promise<boolean> {
  const normalized = normalizeCodigo(codigo);
  if (!normalized) return false;
  const row = (await db
    .prepare(
      `SELECT 1 AS ok
       FROM EMPRESAS_OPERATIVAS op
       INNER JOIN EMPRESAS_CUENTA c ON c.id = op.cuenta_id
       WHERE op.codigo = ? AND op.activo = 1 AND c.activo = 1`
    )
    .get(normalized)) as { ok: number } | undefined;
  return Boolean(row);
}

export async function insertEmpresaCuenta(
  db: Db,
  input: EmpresaCuentaInput
): Promise<EmpresaCuenta> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la empresa es obligatorio");

  const codigo = await nextCuentaMadreCodigo(db);

  const dupNombre = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre)) as { id: number } | undefined;
  if (dupNombre) throw new Error("Ya existe una cuenta con ese nombre");

  const dupCodigo = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE codigo = ?")
    .get(codigo)) as { id: number } | undefined;
  if (dupCodigo) throw new Error("Ya existe una cuenta con ese código");

  const result = await db
    .prepare(
      `INSERT INTO EMPRESAS_CUENTA (cuenta_numero, nombre, codigo, activo)
       VALUES (?, ?, ?, ?)`
    )
    .run(await nextCuentaNumero(db), nombre, codigo, input.activo === false ? 0 : 1);

  return (await getEmpresaCuentaById(db, Number(result.lastInsertRowid)))!;
}

export async function updateEmpresaCuenta(
  db: Db,
  id: number,
  input: Partial<EmpresaCuentaInput>
): Promise<EmpresaCuenta> {
  const current = (await db
    .prepare("SELECT * FROM EMPRESAS_CUENTA WHERE id = ?")
    .get(id)) as EmpresaCuentaRow | undefined;
  if (!current) throw new Error("Cuenta de empresa no encontrada");

  const nombre =
    input.nombre !== undefined ? input.nombre.trim() : current.nombre;
  const codigo = current.codigo;
  const activo =
    input.activo !== undefined ? (input.activo ? 1 : 0) : current.activo;

  if (!nombre) throw new Error("El nombre de la empresa es obligatorio");
  if (!codigo) throw new Error("El código de la empresa es obligatorio");

  const dupNombre = (await db
    .prepare(
      "SELECT id FROM EMPRESAS_CUENTA WHERE LOWER(nombre) = LOWER(?) AND id != ?"
    )
    .get(nombre, id)) as { id: number } | undefined;
  if (dupNombre) throw new Error("Ya existe otra cuenta con ese nombre");

  const dupCodigo = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE codigo = ? AND id != ?")
    .get(codigo, id)) as { id: number } | undefined;
  if (dupCodigo) throw new Error("Ya existe otra cuenta con ese código");

  await db
    .prepare(
      `UPDATE EMPRESAS_CUENTA
       SET nombre = ?, codigo = ?, activo = ?, actualizado_en = NOW()
       WHERE id = ?`
    )
    .run(nombre, codigo, activo, id);

  return (await getEmpresaCuentaById(db, id))!;
}

export async function insertEmpresaOperativa(
  db: Db,
  cuentaId: number,
  input: EmpresaOperativaInput
): Promise<EmpresaOperativa> {
  const cuenta = await getEmpresaCuentaById(db, cuentaId);
  if (!cuenta) throw new Error("Cuenta madre no encontrada");

  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre de la empresa es obligatorio");

  const codigo = await nextEmpresaOperativaCodigo(db);

  const dupNombre = (await db
    .prepare(
      `SELECT id FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ? AND LOWER(nombre) = LOWER(?)`
    )
    .get(cuentaId, nombre)) as { id: number } | undefined;
  if (dupNombre) throw new Error("Ya existe una empresa con ese nombre en la cuenta");

  const dupCodigo = (await db
    .prepare("SELECT id FROM EMPRESAS_OPERATIVAS WHERE codigo = ?")
    .get(codigo)) as { id: number } | undefined;
  if (dupCodigo) throw new Error("Ya existe una empresa con ese código");

  const color = normalizarColorEmpresaOperativa(input.color, true);
  await assertColorEmpresaOperativaDisponible(db, cuentaId, color);

  const result = await db
    .prepare(
      `INSERT INTO EMPRESAS_OPERATIVAS (cuenta_id, nombre, codigo, color, activo)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(cuentaId, nombre, codigo, color, input.activo === false ? 0 : 1);

  const row = (await db
    .prepare("SELECT * FROM EMPRESAS_OPERATIVAS WHERE id = ?")
    .get(Number(result.lastInsertRowid))) as EmpresaOperativaRow;
  return operativaToPublic(row);
}

export async function updateEmpresaOperativa(
  db: Db,
  cuentaId: number,
  empresaId: number,
  input: Partial<EmpresaOperativaInput>
): Promise<EmpresaOperativa> {
  const current = (await db
    .prepare("SELECT * FROM EMPRESAS_OPERATIVAS WHERE id = ? AND cuenta_id = ?")
    .get(empresaId, cuentaId)) as EmpresaOperativaRow | undefined;
  if (!current) throw new Error("Empresa operativa no encontrada");

  const nombre =
    input.nombre !== undefined ? input.nombre.trim() : current.nombre;
  const activo =
    input.activo !== undefined ? (input.activo ? 1 : 0) : current.activo;
  const color =
    input.color !== undefined
      ? normalizarColorEmpresaOperativa(input.color, true)
      : colorDb.normalizarColorCaravana(current.color);

  if (!nombre) throw new Error("El nombre de la empresa es obligatorio");
  if (!color) throw new Error("Elegí un color para la empresa.");

  const dupNombre = (await db
    .prepare(
      `SELECT id FROM EMPRESAS_OPERATIVAS
       WHERE cuenta_id = ? AND LOWER(nombre) = LOWER(?) AND id != ?`
    )
    .get(cuentaId, nombre, empresaId)) as { id: number } | undefined;
  if (dupNombre) throw new Error("Ya existe una empresa con ese nombre en la cuenta");

  await assertColorEmpresaOperativaDisponible(db, cuentaId, color, empresaId);

  await db
    .prepare(
      `UPDATE EMPRESAS_OPERATIVAS
       SET nombre = ?, color = ?, activo = ?, actualizado_en = NOW()
       WHERE id = ? AND cuenta_id = ?`
    )
    .run(nombre, color, activo, empresaId, cuentaId);

  const prevColor = colorDb.normalizarColorCaravana(current.color);
  if (color && color !== prevColor) {
    await db
      .prepare(
        `UPDATE STOCK_GANADERO_DISPOSITIVO
         SET color_caravana = ?
         WHERE UPPER(TRIM(empresa)) = UPPER(TRIM(?))`
      )
      .run(color, current.codigo);
  }

  const row = (await db
    .prepare("SELECT * FROM EMPRESAS_OPERATIVAS WHERE id = ?")
    .get(empresaId)) as EmpresaOperativaRow;
  return operativaToPublic(row);
}

/**
 * Asigna un usuario como administrador de la cuenta madre.
 * El usuario debe ser el administrador de la plataforma (super admin, sin cuenta)
 * o pertenecer a esta misma cuenta. Si pertenece a la cuenta, se promueve a rol admin.
 */
export async function setEmpresaCuentaAdmin(
  db: Db,
  cuentaId: number,
  userId: number | null
): Promise<EmpresaCuenta> {
  const cuenta = (await db
    .prepare("SELECT id FROM EMPRESAS_CUENTA WHERE id = ?")
    .get(cuentaId)) as { id: number } | undefined;
  if (!cuenta) throw new Error("Cuenta madre no encontrada");

  if (userId == null) {
    await db
      .prepare(
        "UPDATE EMPRESAS_CUENTA SET admin_user_id = NULL, actualizado_en = NOW() WHERE id = ?"
      )
      .run(cuentaId);
    return (await getEmpresaCuentaById(db, cuentaId))!;
  }

  const user = (await db
    .prepare("SELECT id, rol, empresa_id FROM USERS WHERE id = ?")
    .get(userId)) as
    | { id: number; rol: string; empresa_id: number | null }
    | undefined;
  if (!user) throw new Error("Usuario no encontrado");

  const esSuperAdmin = user.rol === "admin" && user.empresa_id == null;
  const perteneceCuenta =
    user.empresa_id != null && Number(user.empresa_id) === cuentaId;

  if (!esSuperAdmin && !perteneceCuenta) {
    throw new Error(
      "El administrador debe pertenecer a esta cuenta o ser el administrador del sistema"
    );
  }

  if (perteneceCuenta && user.rol !== "admin") {
    await db
      .prepare("UPDATE USERS SET rol = 'admin', actualizado_en = NOW() WHERE id = ?")
      .run(userId);
  }

  await db
    .prepare(
      "UPDATE EMPRESAS_CUENTA SET admin_user_id = ?, actualizado_en = NOW() WHERE id = ?"
    )
    .run(userId, cuentaId);

  if (!esSuperAdmin) {
    await db
      .prepare(
        "UPDATE USERS SET empresa_id = ?, actualizado_en = NOW() WHERE id = ?"
      )
      .run(cuentaId, userId);
  }

  return (await getEmpresaCuentaById(db, cuentaId))!;
}

/** Marcador para consultas que no deben devolver filas (cuenta sin empresas operativas). */
export const SIN_EMPRESAS_SCOPE = "__sin_empresas__";

export async function isCuentaAdminUser(db: Db, userId: number): Promise<boolean> {
  const row = (await db
    .prepare("SELECT 1 AS ok FROM EMPRESAS_CUENTA WHERE admin_user_id = ? LIMIT 1")
    .get(userId)) as { ok: number } | undefined;
  return Boolean(row);
}

/**
 * Super admin de plataforma: admin sin cuenta asignada y no es solo admin de una cuenta madre.
 * El email principal (SCG_ADMIN_EMAIL) siempre es super admin aunque administre VILA DIAZ.
 */
export async function isPlatformSuperAdmin(
  db: Db,
  user: { id: number; rol: string; empresa_id: number | null; email: string }
): Promise<boolean> {
  if (user.rol !== "admin" || user.empresa_id != null) return false;
  return user.email.trim().toLowerCase() === primaryAdminEmail();
}

export function isSuperAdminUser(user: {
  rol: string;
  empresa_id: number | null;
}): boolean {
  return user.rol === "admin" && user.empresa_id == null;
}

/** ID de cuenta madre que delimita los datos del usuario; null = sin límite (super admin puro). */
export async function resolveCuentaMadreIdForUser(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<number | null> {
  const cuentaAdmin = await getEmpresaCuentaByAdminUserId(db, user.id);
  if (cuentaAdmin) return cuentaAdmin.id;
  if (user.es_super_admin) {
    const email = user.email?.trim().toLowerCase() ?? "";
    if (email === primaryAdminEmail()) {
      const seedId = await getSeedCuentaMadreId(db);
      if (seedId) return seedId;
    }
    return null;
  }
  if (user.empresa_id != null && Number.isFinite(Number(user.empresa_id))) {
    return Number(user.empresa_id);
  }
  return null;
}

/**
 * Nombres de empresas operativas visibles para el usuario en pantallas operativas.
 * null = sin filtro (solo super admin puro sin cuenta); [] = ninguna.
 */
export async function getEmpresasOperativasPermitidas(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<string[] | null> {
  const cuentaId = await resolveCuentaMadreIdForUser(db, user);
  if (cuentaId) return await getEmpresaNombresActivosPorCuenta(db, cuentaId);
  if (user.es_super_admin) return null;
  return [];
}

export async function getEmpresasCodigosOperativasPermitidas(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<string[] | null> {
  const cuentaId = await resolveCuentaMadreIdForUser(db, user);
  if (cuentaId) return await getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  if (user.es_super_admin) return null;
  return [];
}

export async function getEmpresasOperativasDetallePermitidas(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<Array<{ codigo: string; nombre: string }>> {
  const cuentaId = await resolveCuentaMadreIdForUser(db, user);
  if (cuentaId) return await getEmpresasOperativasDetallePorCuenta(db, cuentaId);
  if (user.es_super_admin) return await getEmpresasOperativasDetalleActivas(db);
  return [];
}

/** Lista para filtros SQL/API; usa marcador si la cuenta no tiene operativas. */
export async function getEmpresasScopeFilter(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<string[] | undefined> {
  const permitidas = await getEmpresasOperativasPermitidas(db, user);
  if (permitidas === null) return undefined;
  if (permitidas.length === 0) return [SIN_EMPRESAS_SCOPE];
  return permitidas;
}

/** Igual que getEmpresasScopeFilter pero con códigos (stock RFID guarda codigo, no nombre). */
export async function getEmpresasCodigosScopeFilter(
  db: Db,
  user: {
    id: number;
    email?: string;
    es_super_admin?: boolean;
    empresa_id?: number | null;
  }
): Promise<string[] | undefined> {
  const permitidas = await getEmpresasCodigosOperativasPermitidas(db, user);
  if (permitidas === null) return undefined;
  if (permitidas.length === 0) return [SIN_EMPRESAS_SCOPE];
  return permitidas;
}
