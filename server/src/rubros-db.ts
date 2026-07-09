import type { Db } from "./db/pg-client.js";
import {
  appendGastosRubrosReadWhere,
  migrateAddCuentaIdColumnSagCatalog,
  type GastosRubrosReadScope,
} from "./gastos-rubros-scope.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import { RUBROS_DEFAULT } from "./types.js";

export interface Rubro {
  id: number;
  cuenta_id?: number | null;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface RubroInput {
  nombre: string;
  activo?: boolean;
}

export async function initRubrosTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumnSagCatalog(db, "RUBROS");
  await seedRubrosIfEmpty(db);
  await syncRubrosFromPresupuesto(db);
}

/** Asegura rubros del catálogo por grupo (Agricultura, Construcción, etc.). */
export async function ensureRubrosNombres(
  db: Db,
  nombres: readonly string[]
): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO RUBROS (nombre, activo)
     SELECT @nombre, 1
     WHERE NOT EXISTS (SELECT 1 FROM RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const nombre of nombres) {
    await insert.run({ nombre });
  }
}

async function syncRubrosFromPresupuesto(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT rubro FROM PRESUPUESTO
       WHERE rubro IS NOT NULL AND trim(rubro) != ''`
    )
    .all()) as { rubro: string }[];
  const insert = await db.prepare(
    `INSERT INTO RUBROS (nombre, activo)
     SELECT @nombre, 1
     WHERE NOT EXISTS (SELECT 1 FROM RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const r of rows) {
    await insert.run({ nombre: r.rubro.trim() });
  }
}

async function seedRubrosIfEmpty(db: Db): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO RUBROS (nombre, activo)
     SELECT @nombre, 1
     WHERE NOT EXISTS (SELECT 1 FROM RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const nombre of RUBROS_DEFAULT) {
    await insert.run({ nombre });
  }
}

export async function listRubros(
  db: Db,
  soloActivos = false,
  readScope?: GastosRubrosReadScope
): Promise<Rubro[]> {
  let query = "SELECT * FROM RUBROS WHERE 1=1";
  const params: Record<string, string | number> = {};
  if (soloActivos) query += " AND activo = 1";
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
  }
  query += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(query).all(params)) as Rubro[];
}

export async function listRubrosNombres(
  db: Db,
  readScope?: GastosRubrosReadScope
): Promise<string[]> {
  return (await listRubros(db, true, readScope)).map((r) => r.nombre);
}

export async function getRubroById(db: Db, id: number): Promise<Rubro | undefined> {
  return (await db.prepare("SELECT * FROM RUBROS WHERE id = ?").get(id)) as Rubro | undefined;
}

export async function getRubroByNombre(
  db: Db,
  nombre: string,
  cuentaId: number | null = null
): Promise<Rubro | undefined> {
  let query = "SELECT * FROM RUBROS WHERE LOWER(nombre) = LOWER(@nombre)";
  const params: Record<string, string | number | null> = { nombre: nombre.trim() };
  if (cuentaId != null) {
    query += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    params.cuentaId = cuentaId;
    query += " ORDER BY cuenta_id DESC NULLS LAST LIMIT 1";
    return (await db.prepare(query).get(params)) as Rubro | undefined;
  }
  query += " AND cuenta_id IS NULL LIMIT 1";
  return (await db.prepare(query).get(params)) as Rubro | undefined;
}

export async function insertRubro(
  db: Db,
  data: RubroInput,
  cuentaId: number | null = null
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  if (await getRubroByNombre(db, nombre, cuentaId)) {
    throw new Error("Ya existe un rubro con ese nombre.");
  }
  const result = await db
    .prepare(
      "INSERT INTO RUBROS (nombre, activo, cuenta_id) VALUES (@nombre, @activo, @cuenta_id)"
    )
    .run({
      nombre,
      activo: data.activo === false ? 0 : 1,
      cuenta_id: cuentaId,
    });
  return Number(result.lastInsertRowid);
}

export async function updateRubro(
  db: Db,
  id: number,
  data: RubroInput,
  cuentaId: number | null = null
): Promise<boolean> {
  const prev = await getRubroById(db, id);
  if (!prev) return false;
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  const existing = await getRubroByNombre(db, nombre, prev.cuenta_id ?? cuentaId);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro rubro con ese nombre.");
  }
  return (
    await db.prepare("UPDATE RUBROS SET nombre = @nombre, activo = @activo WHERE id = @id").run({
      id,
      nombre,
      activo: data.activo === false ? 0 : 1,
    })
  ).changes > 0;
}

export async function deleteRubro(db: Db, id: number): Promise<boolean> {
  const rubro = await getRubroById(db, id);
  if (!rubro) return false;
  const used = (await db
    .prepare("SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE LOWER(rubro) = LOWER(?)")
    .get(rubro.nombre)) as { n: number };
  if (used.n > 0) {
    throw new Error(
      `No se puede eliminar: hay ${used.n} gasto(s) con este rubro. Desactivalo en su lugar.`
    );
  }
  return (await db.prepare("DELETE FROM RUBROS WHERE id = ?").run(id)).changes > 0;
}

export async function rubroExistsActivo(
  db: Db,
  nombre: string,
  cuentaId: number | null = null
): Promise<boolean> {
  let query =
    "SELECT 1 FROM RUBROS WHERE LOWER(nombre) = LOWER(@nombre) AND activo = 1";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  if (cuentaId != null) {
    query += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    params.cuentaId = cuentaId;
  } else {
    query += " AND cuenta_id IS NULL";
  }
  const row = await db.prepare(query).get(params);
  return !!row;
}
