import type { Db } from "./db/pg-client.js";
import {
  getSeedCuentaMadreId,
  listEmpresasCuenta,
  migrateAddCuentaIdColumn,
} from "./empresas-cuenta-db.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  VENTA_GRUPOS_SUB_RUBRO,
  VENTA_SUB_RUBROS_SEED,
} from "./venta-sub-rubros-data.js";

export interface VentaSubRubro {
  id: number;
  cuenta_id?: number | null;
  nombre: string;
  grupo: string;
  activo: number;
  creado_en?: string;
}

export interface VentaSubRubroInput {
  nombre: string;
  grupo: string;
  activo?: boolean;
}

export type DeleteVentaGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null
): string {
  if (cuentaId != null) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  }
  return query;
}

async function migrateVentaSubRubroUniquePorCuenta(db: Db): Promise<void> {
  for (const stmt of [
    "DROP INDEX IF EXISTS idx_venta_sub_rubros_nombre",
    "ALTER TABLE VENTA_SUB_RUBROS DROP CONSTRAINT IF EXISTS venta_sub_rubros_nombre_key",
  ]) {
    try {
      await db.prepare(stmt).run();
    } catch {
      /* ignore */
    }
  }
  try {
    await db
      .prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_sub_rubros_cuenta_nombre ON VENTA_SUB_RUBROS(cuenta_id, LOWER(nombre))"
      )
      .run();
  } catch {
    /* ignore */
  }
}

async function seedVentaSubRubrosForCuenta(db: Db, cuentaId: number): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo, cuenta_id)
     SELECT @nombre, @grupo, 1, @cuenta_id
     WHERE NOT EXISTS (
       SELECT 1 FROM VENTA_SUB_RUBROS
       WHERE LOWER(nombre) = LOWER(@nombre) AND cuenta_id = @cuenta_id
     )`
  );
  for (const item of VENTA_SUB_RUBROS_SEED) {
    await insert.run({ nombre: item.nombre, grupo: item.grupo, cuenta_id: cuentaId });
  }
}

export async function ensureVentaSubRubrosForCuenta(
  db: Db,
  cuentaId: number
): Promise<void> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS n FROM VENTA_SUB_RUBROS WHERE cuenta_id = ?")
    .get(cuentaId)) as { n: number };
  if (row.n > 0) return;
  await seedVentaSubRubrosForCuenta(db, cuentaId);
}

async function seedVentaSubRubrosAllCuentas(db: Db): Promise<void> {
  const cuentas = await listEmpresasCuenta(db);
  for (const cuenta of cuentas) {
    await ensureVentaSubRubrosForCuenta(db, cuenta.id);
  }
}

async function seedVentaSubRubrosIfEmpty(db: Db): Promise<void> {
  const seedId = await getSeedCuentaMadreId(db);
  if (!seedId) return;
  await ensureVentaSubRubrosForCuenta(db, seedId);
}

export async function initVentaSubRubrosTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "VENTA_SUB_RUBROS");
  await migrateVentaSubRubroUniquePorCuenta(db);
  await seedVentaSubRubrosIfEmpty(db);
  await seedVentaSubRubrosAllCuentas(db);
}

export async function listVentaSubRubros(
  db: Db,
  soloActivos = false,
  cuentaId?: number | null
): Promise<VentaSubRubro[]> {
  if (cuentaId != null) await ensureVentaSubRubrosForCuenta(db, cuentaId);
  let query = "SELECT * FROM VENTA_SUB_RUBROS WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  if (soloActivos) query += " AND activo = 1";
  query += " ORDER BY LOWER(grupo) ASC, LOWER(nombre) ASC";
  return (await db.prepare(query).all(params)) as VentaSubRubro[];
}

export async function listVentaSubRubrosGrupos(
  db: Db,
  cuentaId?: number | null
): Promise<string[]> {
  if (cuentaId != null) await ensureVentaSubRubrosForCuenta(db, cuentaId);
  let query = "SELECT DISTINCT grupo FROM VENTA_SUB_RUBROS WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  const fromDb = (await db.prepare(query).all(params)) as { grupo: string }[];
  const set = new Set<string>([...VENTA_GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export async function getVentaSubRubroById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<VentaSubRubro | undefined> {
  let query = "SELECT * FROM VENTA_SUB_RUBROS WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as VentaSubRubro | undefined;
}

export async function getVentaSubRubroByNombre(
  db: Db,
  nombre: string,
  cuentaId?: number | null
): Promise<VentaSubRubro | undefined> {
  let query = "SELECT * FROM VENTA_SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre)";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as VentaSubRubro | undefined;
}

export async function filterVentaSubRubroIdsInCuenta(
  db: Db,
  ids: number[],
  cuentaId?: number | null
): Promise<number[]> {
  if (!ids.length) return [];
  if (cuentaId == null) return ids;
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT id FROM VENTA_SUB_RUBROS WHERE id IN (${placeholders}) AND cuenta_id = ?`
    )
    .all(...ids, cuentaId)) as { id: number }[];
  return rows.map((r) => r.id);
}

export async function insertVentaSubRubro(
  db: Db,
  data: VentaSubRubroInput,
  cuentaId?: number | null
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (cuentaId == null) throw new Error("No se pudo determinar la cuenta para este catálogo.");
  if (await getVentaSubRubroByNombre(db, nombre, cuentaId)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = await db
    .prepare(
      "INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo, cuenta_id) VALUES (@nombre, @grupo, @activo, @cuenta_id)"
    )
    .run({
      nombre,
      grupo,
      activo: data.activo === false ? 0 : 1,
      cuenta_id: cuentaId,
    });
  return Number(result.lastInsertRowid);
}

export async function updateVentaSubRubro(
  db: Db,
  id: number,
  data: VentaSubRubroInput,
  cuentaId?: number | null
): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = await getVentaSubRubroByNombre(db, nombre, cuentaId);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  let query =
    "UPDATE VENTA_SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id";
  const params: Record<string, string | number> = {
    id,
    nombre,
    grupo,
    activo: data.activo === false ? 0 : 1,
  };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).run(params)).changes > 0;
}

export async function renameVentaSubRubroGrupo(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string,
  cuentaId?: number | null
): Promise<number> {
  const anterior = normalizarTituloRubro(grupoAnterior);
  const nuevo = normalizarTituloRubro(grupoNuevo);
  if (!anterior) throw new Error("El rubro actual no es válido.");
  if (!nuevo) throw new Error("El nuevo nombre del rubro es obligatorio.");
  if (anterior.localeCompare(nuevo, "es", { sensitivity: "accent" }) === 0) {
    return 0;
  }

  let conflictoQuery =
    "SELECT grupo FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(@nuevo)";
  const conflictoParams: Record<string, string | number> = { nuevo };
  conflictoQuery = scopeCuenta(conflictoQuery, conflictoParams, cuentaId);
  conflictoQuery += " LIMIT 1";
  const conflictoGrupo = (await db
    .prepare(conflictoQuery)
    .get(conflictoParams)) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !== 0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  let countQuery =
    "SELECT COUNT(*) AS n FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(@anterior)";
  const countParams: Record<string, string | number> = { anterior };
  countQuery = scopeCuenta(countQuery, countParams, cuentaId);
  const { n: cantSubs } = (await db.prepare(countQuery).get(countParams)) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  let updateQuery = `UPDATE VENTA_SUB_RUBROS SET grupo = @nuevo
       WHERE LOWER(grupo) = LOWER(@anterior)`;
  const updateParams: Record<string, string | number> = { anterior, nuevo };
  updateQuery = scopeCuenta(updateQuery, updateParams, cuentaId);
  return (await db.prepare(updateQuery).run(updateParams)).changes;
}

export async function deleteVentaSubRubrosByGrupo(
  db: Db,
  grupo: string,
  cuentaId?: number | null
): Promise<DeleteVentaGrupoResult> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  let query = "SELECT id, nombre FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(@grupo)";
  const params: Record<string, string | number> = { grupo: g };
  query = scopeCuenta(query, params, cuentaId);
  const rows = (await db.prepare(query).all(params)) as { id: number; nombre: string }[];
  const blocked: DeleteVentaGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (await deleteVentaSubRubro(db, row.id, cuentaId)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export async function deleteVentaSubRubro(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  const row = await getVentaSubRubroById(db, id, cuentaId);
  if (!row) return false;

  const colRow = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'ingresos_ventas' AND column_name = 'sub_rubro' LIMIT 1`
    )
    .get();
  if (colRow) {
    let usedQuery =
      "SELECT COUNT(*) AS n FROM INGRESOS_VENTAS WHERE LOWER(sub_rubro) = LOWER(@nombre)";
    const usedParams: Record<string, string | number> = { nombre: row.nombre };
    if (row.cuenta_id != null) {
      usedQuery += " AND cuenta_id = @cuentaId";
      usedParams.cuentaId = row.cuenta_id;
    }
    const used = (await db.prepare(usedQuery).get(usedParams)) as { n: number };
    if (used.n > 0) {
      throw new Error(
        `No se puede eliminar: hay ${used.n} ingreso(s) con este sub-rubro. Desactivalo en su lugar.`
      );
    }
  }

  let deleteQuery = "DELETE FROM VENTA_SUB_RUBROS WHERE id = @id";
  const deleteParams: Record<string, string | number> = { id };
  deleteQuery = scopeCuenta(deleteQuery, deleteParams, cuentaId);
  return (await db.prepare(deleteQuery).run(deleteParams)).changes > 0;
}
