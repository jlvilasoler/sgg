import type { Db } from "./db/pg-client.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import { RUBROS_DEFAULT } from "./types.js";

export interface Rubro {
  id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface RubroInput {
  nombre: string;
  activo?: boolean;
}

export async function initRubrosTable(db: Db): Promise<void> {
  await seedRubrosIfEmpty(db);
  await syncRubrosFromPresupuesto(db);
}

/** Asegura rubros del catálogo por grupo (Agricultura, Construcción, etc.). */
export async function ensureRubrosNombres(
  db: Db,
  nombres: readonly string[]
): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1)
     ON CONFLICT (nombre) DO NOTHING`
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
    `INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1)
     ON CONFLICT (nombre) DO NOTHING`
  );
  for (const r of rows) {
    await insert.run({ nombre: r.rubro.trim() });
  }
}

async function seedRubrosIfEmpty(db: Db): Promise<void> {
  const { n } = (await db.prepare("SELECT COUNT(*) AS n FROM RUBROS").get()) as { n: number };
  if (n > 0) return;

  await db.transaction(async (tx) => {
    const insert = await tx.prepare("INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1)");
    for (const nombre of RUBROS_DEFAULT) {
      await insert.run({ nombre });
    }
  });
}

export async function listRubros(db: Db, soloActivos = false): Promise<Rubro[]> {
  let query = "SELECT * FROM RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(query).all()) as Rubro[];
}

export async function listRubrosNombres(db: Db): Promise<string[]> {
  return (await listRubros(db, true)).map((r) => r.nombre);
}

export async function getRubroById(db: Db, id: number): Promise<Rubro | undefined> {
  return (await db.prepare("SELECT * FROM RUBROS WHERE id = ?").get(id)) as Rubro | undefined;
}

export async function getRubroByNombre(
  db: Db,
  nombre: string
): Promise<Rubro | undefined> {
  return (await db
    .prepare("SELECT * FROM RUBROS WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre.trim())) as Rubro | undefined;
}

export async function insertRubro(db: Db, data: RubroInput): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  if (await getRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un rubro con ese nombre.");
  }
  const result = await db
    .prepare("INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, @activo)")
    .run({ nombre, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export async function updateRubro(db: Db, id: number, data: RubroInput): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  const existing = await getRubroByNombre(db, nombre);
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

export async function rubroExistsActivo(db: Db, nombre: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM RUBROS WHERE LOWER(nombre) = LOWER(?) AND activo = 1")
    .get(nombre.trim());
  return !!row;
}
