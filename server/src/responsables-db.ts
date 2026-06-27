import type { Db } from "./db/pg-client.js";
import { RESPONSABLES_DEFAULT } from "./types.js";
import {
  getSeedCuentaMadreId,
  migrateAddCuentaIdColumn,
} from "./empresas-cuenta-db.js";

export interface Responsable {
  id: number;
  cuenta_id?: number | null;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface ResponsableInput {
  nombre: string;
  activo?: boolean;
}

export async function initResponsablesTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "RESPONSABLES");
  await migrateResponsableUniquePorCuenta(db);
  await seedResponsablesIfEmpty(db);
  await syncResponsablesFromPresupuesto(db);
}

/** El nombre deja de ser único global para serlo por cuenta. */
async function migrateResponsableUniquePorCuenta(db: Db): Promise<void> {
  for (const stmt of [
    "DROP INDEX IF EXISTS idx_responsables_nombre",
    "ALTER TABLE RESPONSABLES DROP CONSTRAINT IF EXISTS responsables_nombre_key",
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
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_responsables_cuenta_nombre ON RESPONSABLES(cuenta_id, LOWER(nombre))"
      )
      .run();
  } catch {
    /* ignore */
  }
}

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

export async function syncResponsablesFromPresupuesto(db: Db): Promise<void> {
  // Deriva responsables por cuenta a partir del gasto, mapeando empresa→cuenta.
  const rows = (await db
    .prepare(
      `SELECT DISTINCT p.responsable_gasto AS nombre, op.cuenta_id AS cuenta_id
       FROM PRESUPUESTO p
       INNER JOIN EMPRESAS_OPERATIVAS op ON op.nombre = p.empresa
       WHERE p.responsable_gasto IS NOT NULL AND trim(p.responsable_gasto) != ''`
    )
    .all()) as { nombre: string; cuenta_id: number | null }[];
  const insert = await db.prepare(
    `INSERT INTO RESPONSABLES (nombre, activo, cuenta_id)
     SELECT @nombre, 1, @cuenta_id
     WHERE NOT EXISTS (
       SELECT 1 FROM RESPONSABLES
       WHERE LOWER(nombre) = LOWER(@nombre) AND cuenta_id IS NOT DISTINCT FROM @cuenta_id
     )`
  );
  for (const r of rows) {
    if (r.cuenta_id == null) continue;
    await insert.run({ nombre: r.nombre.trim(), cuenta_id: r.cuenta_id });
  }
}

async function seedResponsablesIfEmpty(db: Db): Promise<void> {
  const seedId = await getSeedCuentaMadreId(db);
  if (!seedId) return;
  const insert = await db.prepare(
    `INSERT INTO RESPONSABLES (nombre, activo, cuenta_id)
     SELECT @nombre, 1, @cuenta_id
     WHERE NOT EXISTS (
       SELECT 1 FROM RESPONSABLES
       WHERE LOWER(nombre) = LOWER(@nombre) AND cuenta_id = @cuenta_id
     )`
  );
  for (const nombre of RESPONSABLES_DEFAULT) {
    await insert.run({ nombre, cuenta_id: seedId });
  }
}

export async function listResponsables(
  db: Db,
  soloActivos = false,
  cuentaId?: number | null
): Promise<Responsable[]> {
  let query = "SELECT * FROM RESPONSABLES WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  if (soloActivos) query += " AND activo = 1";
  query += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(query).all(params)) as Responsable[];
}

export async function listResponsablesNombres(
  db: Db,
  cuentaId?: number | null
): Promise<string[]> {
  return (await listResponsables(db, true, cuentaId)).map((r) => r.nombre);
}

export async function getResponsableById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<Responsable | undefined> {
  let query = "SELECT * FROM RESPONSABLES WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Responsable | undefined;
}

export async function getResponsableByNombre(
  db: Db,
  nombre: string,
  cuentaId?: number | null
): Promise<Responsable | undefined> {
  let query = "SELECT * FROM RESPONSABLES WHERE LOWER(nombre) = LOWER(@nombre)";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Responsable | undefined;
}

export async function insertResponsable(
  db: Db,
  data: ResponsableInput,
  cuentaId?: number | null
): Promise<number> {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  if (await getResponsableByNombre(db, nombre, cuentaId)) {
    throw new Error("Ya existe un responsable con ese nombre.");
  }
  const result = await db
    .prepare(
      "INSERT INTO RESPONSABLES (nombre, activo, cuenta_id) VALUES (@nombre, @activo, @cuenta_id)"
    )
    .run({ nombre, activo: data.activo === false ? 0 : 1, cuenta_id: cuentaId ?? null });
  return Number(result.lastInsertRowid);
}

export async function updateResponsable(
  db: Db,
  id: number,
  data: ResponsableInput,
  cuentaId?: number | null
): Promise<boolean> {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  const existing = await getResponsableByNombre(db, nombre, cuentaId);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro responsable con ese nombre.");
  }
  let query =
    "UPDATE RESPONSABLES SET nombre = @nombre, activo = @activo WHERE id = @id";
  const params: Record<string, string | number> = {
    id,
    nombre,
    activo: data.activo === false ? 0 : 1,
  };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).run(params)).changes > 0;
}

export async function deleteResponsable(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  const responsable = await getResponsableById(db, id, cuentaId);
  if (!responsable) return false;
  const used = (await db
    .prepare(
      "SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE LOWER(responsable_gasto) = LOWER(?)"
    )
    .get(responsable.nombre)) as { n: number };
  if (used.n > 0) {
    throw new Error(
      `No se puede eliminar: hay ${used.n} gasto(s) con este responsable. Desactivalo en su lugar.`
    );
  }
  return (await db.prepare("DELETE FROM RESPONSABLES WHERE id = ?").run(id)).changes > 0;
}

export async function responsableExistsActivo(
  db: Db,
  nombre: string,
  cuentaId?: number | null
): Promise<boolean> {
  let query =
    "SELECT 1 FROM RESPONSABLES WHERE LOWER(nombre) = LOWER(@nombre) AND activo = 1";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  query = scopeCuenta(query, params, cuentaId);
  const row = await db.prepare(query).get(params);
  return !!row;
}
