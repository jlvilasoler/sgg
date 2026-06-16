import type { Db } from "./db/pg-client.js";
import { RESPONSABLES_DEFAULT } from "./types.js";

export interface Responsable {
  id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface ResponsableInput {
  nombre: string;
  activo?: boolean;
}

export async function initResponsablesTable(db: Db): Promise<void> {
  await seedResponsablesIfEmpty(db);
  await syncResponsablesFromPresupuesto(db);
}

export async function syncResponsablesFromPresupuesto(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT responsable_gasto FROM PRESUPUESTO
       WHERE responsable_gasto IS NOT NULL AND trim(responsable_gasto) != ''`
    )
    .all()) as { responsable_gasto: string }[];
  const insert = await db.prepare(
    `INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1)
     ON CONFLICT (nombre) DO NOTHING`
  );
  for (const r of rows) {
    await insert.run({ nombre: r.responsable_gasto.trim() });
  }
}

async function seedResponsablesIfEmpty(db: Db): Promise<void> {
  const { n } = (await db.prepare("SELECT COUNT(*) AS n FROM RESPONSABLES").get()) as {
    n: number;
  };
  if (n > 0) return;

  await db.transaction(async (tx) => {
    const insert = await tx.prepare(
      "INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1)"
    );
    for (const nombre of RESPONSABLES_DEFAULT) {
      await insert.run({ nombre });
    }
  });
}

export async function listResponsables(
  db: Db,
  soloActivos = false
): Promise<Responsable[]> {
  let query = "SELECT * FROM RESPONSABLES";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(query).all()) as Responsable[];
}

export async function listResponsablesNombres(db: Db): Promise<string[]> {
  return (await listResponsables(db, true)).map((r) => r.nombre);
}

export async function getResponsableById(
  db: Db,
  id: number
): Promise<Responsable | undefined> {
  return (await db.prepare("SELECT * FROM RESPONSABLES WHERE id = ?").get(id)) as
    | Responsable
    | undefined;
}

export async function getResponsableByNombre(
  db: Db,
  nombre: string
): Promise<Responsable | undefined> {
  return (await db
    .prepare("SELECT * FROM RESPONSABLES WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre.trim())) as Responsable | undefined;
}

export async function insertResponsable(db: Db, data: ResponsableInput): Promise<number> {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  if (await getResponsableByNombre(db, nombre)) {
    throw new Error("Ya existe un responsable con ese nombre.");
  }
  const result = await db
    .prepare("INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, @activo)")
    .run({ nombre, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export async function updateResponsable(
  db: Db,
  id: number,
  data: ResponsableInput
): Promise<boolean> {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  const existing = await getResponsableByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro responsable con ese nombre.");
  }
  return (
    await db
      .prepare(
        "UPDATE RESPONSABLES SET nombre = @nombre, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export async function deleteResponsable(db: Db, id: number): Promise<boolean> {
  const responsable = await getResponsableById(db, id);
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

export async function responsableExistsActivo(db: Db, nombre: string): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 FROM RESPONSABLES WHERE LOWER(nombre) = LOWER(?) AND activo = 1"
    )
    .get(nombre.trim());
  return !!row;
}
