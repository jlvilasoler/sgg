import type { Db } from "./db/pg-client.js";
import type { UserPublic } from "./auth-db.js";

/** NULL = catálogo base SAG (visible en todas las cuentas). */
export type GastosRubrosReadMode = "cuenta" | "sag";

export interface GastosRubrosReadScope {
  mode: GastosRubrosReadMode;
  /** Cuenta del usuario (lectura normal). */
  cuentaId?: number | null;
  /** Filtro opcional en panel SAG (plataforma + una cuenta). */
  filterCuentaId?: number | null;
}

export async function migrateAddCuentaIdColumnSagCatalog(
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
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_${tabla.toLowerCase()}_cuenta ON ${tabla}(cuenta_id)`
    )
    .run();
  if (added) {
    console.info(`[SGG Rubros] Columna cuenta_id (SAG) agregada a ${tabla}`);
  }
}

export async function migrateGastosRubrosUniqueIndexes(db: Db): Promise<void> {
  for (const stmt of [
    "DROP INDEX IF EXISTS idx_sub_rubros_nombre",
    "DROP INDEX IF EXISTS idx_rubros_nombre",
    "DROP INDEX IF EXISTS idx_grupo_iconos_grupo",
    "ALTER TABLE SUB_RUBROS DROP CONSTRAINT IF EXISTS sub_rubros_nombre_key",
    "ALTER TABLE RUBROS DROP CONSTRAINT IF EXISTS rubros_nombre_key",
    "ALTER TABLE GRUPO_ICONOS DROP CONSTRAINT IF EXISTS grupo_iconos_grupo_key",
  ]) {
    try {
      await db.prepare(stmt).run();
    } catch {
      /* ignore */
    }
  }
  for (const stmt of [
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_rubros_sag_nombre
       ON SUB_RUBROS (LOWER(nombre)) WHERE cuenta_id IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_rubros_cuenta_nombre
       ON SUB_RUBROS (cuenta_id, LOWER(nombre)) WHERE cuenta_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_rubros_sag_nombre
       ON RUBROS (LOWER(nombre)) WHERE cuenta_id IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_rubros_cuenta_nombre
       ON RUBROS (cuenta_id, LOWER(nombre)) WHERE cuenta_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_iconos_sag_grupo
       ON GRUPO_ICONOS (LOWER(grupo)) WHERE cuenta_id IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_grupo_iconos_cuenta_grupo
       ON GRUPO_ICONOS (cuenta_id, LOWER(grupo)) WHERE cuenta_id IS NOT NULL`,
  ]) {
    try {
      await db.prepare(stmt).run();
    } catch {
      /* ignore */
    }
  }
}

export function gastosRubrosReadScopeFromRequest(
  user: UserPublic,
  query: Record<string, unknown>
): GastosRubrosReadScope {
  const ambito = String(query.ambito ?? "").trim().toLowerCase();
  const filterRaw = query.cuenta_id ?? query.filter_cuenta_id;
  const filterCuentaId =
    filterRaw != null && String(filterRaw).trim() !== ""
      ? Number(filterRaw)
      : undefined;

  if (user.es_super_admin && ambito === "sag") {
    return {
      mode: "sag",
      filterCuentaId:
        filterCuentaId != null && Number.isFinite(filterCuentaId) && filterCuentaId > 0
          ? filterCuentaId
          : null,
    };
  }

  const cuentaId =
    user.cuenta_actividad_id ?? user.empresa_id ?? null;
  return {
    mode: "cuenta",
    cuentaId: cuentaId != null && cuentaId > 0 ? cuentaId : null,
  };
}

export function appendGastosRubrosReadWhere(
  query: string,
  params: Record<string, string | number>,
  scope: GastosRubrosReadScope,
  alias = ""
): string {
  const col = alias ? `${alias}.cuenta_id` : "cuenta_id";
  if (scope.mode === "sag") {
    if (scope.filterCuentaId != null) {
      query += ` AND (${col} IS NULL OR ${col} = @filterCuentaId)`;
      params.filterCuentaId = scope.filterCuentaId;
    }
    return query;
  }
  if (scope.cuentaId == null) {
    query += ` AND ${col} IS NULL`;
    return query;
  }
  query += ` AND (${col} IS NULL OR ${col} = @cuentaId)`;
  params.cuentaId = scope.cuentaId;
  return query;
}

/** Cuenta efectiva para altas desde una cuenta o desde gastos. */
export function gastosRubrosWriteCuentaId(
  user: UserPublic,
  body?: Record<string, unknown>
): number | null {
  const ambito = String(body?.ambito ?? "").trim().toLowerCase();
  if (user.es_super_admin && ambito === "sag") {
    const raw = body?.cuenta_id;
    if (raw === null || raw === "null" || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const cuentaId = user.cuenta_actividad_id ?? user.empresa_id ?? null;
  return cuentaId != null && cuentaId > 0 ? cuentaId : null;
}

export function assertGastosRubroRowWritable(
  row: { cuenta_id?: number | null },
  user: UserPublic,
  writeCuentaId: number | null,
  sagMode: boolean
): void {
  if (row.cuenta_id == null) {
    if (!user.es_super_admin) {
      throw new Error(
        "Solo el superadministrador puede modificar el catálogo base SAG"
      );
    }
    return;
  }
  if (sagMode && user.es_super_admin) return;
  if (writeCuentaId == null || row.cuenta_id !== writeCuentaId) {
    throw new Error("No tenés permiso para modificar rubros de otra cuenta");
  }
}
