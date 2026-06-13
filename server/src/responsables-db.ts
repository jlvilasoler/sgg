import type Database from "better-sqlite3";
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

export function initResponsablesTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS RESPONSABLES (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_responsables_activo ON RESPONSABLES(activo);
  `);
  seedResponsablesIfEmpty(db);
  syncResponsablesFromPresupuesto(db);
}

export function syncResponsablesFromPresupuesto(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(PRESUPUESTO)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "responsable_gasto")) return;

  const rows = db
    .prepare(
      `SELECT DISTINCT responsable_gasto FROM PRESUPUESTO
       WHERE responsable_gasto IS NOT NULL AND trim(responsable_gasto) != ''`
    )
    .all() as { responsable_gasto: string }[];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1)"
  );
  for (const r of rows) {
    insert.run({ nombre: r.responsable_gasto.trim() });
  }
}

function seedResponsablesIfEmpty(db: Database.Database): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM RESPONSABLES").get() as {
    n: number;
  };
  if (n > 0) return;

  const insert = db.prepare(
    "INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1)"
  );
  const tx = db.transaction((nombres: readonly string[]) => {
    for (const nombre of nombres) {
      insert.run({ nombre });
    }
  });
  tx(RESPONSABLES_DEFAULT);
}

export function listResponsables(
  db: Database.Database,
  soloActivos = false
): Responsable[] {
  let query = "SELECT * FROM RESPONSABLES";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY nombre COLLATE NOCASE ASC";
  return db.prepare(query).all() as Responsable[];
}

export function listResponsablesNombres(db: Database.Database): string[] {
  return listResponsables(db, true).map((r) => r.nombre);
}

export function getResponsableById(
  db: Database.Database,
  id: number
): Responsable | undefined {
  return db.prepare("SELECT * FROM RESPONSABLES WHERE id = ?").get(id) as
    | Responsable
    | undefined;
}

export function getResponsableByNombre(
  db: Database.Database,
  nombre: string
): Responsable | undefined {
  return db
    .prepare("SELECT * FROM RESPONSABLES WHERE nombre = ? COLLATE NOCASE")
    .get(nombre.trim()) as Responsable | undefined;
}

export function insertResponsable(
  db: Database.Database,
  data: ResponsableInput
): number {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  if (getResponsableByNombre(db, nombre)) {
    throw new Error("Ya existe un responsable con ese nombre.");
  }
  const result = db
    .prepare("INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, @activo)")
    .run({ nombre, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export function updateResponsable(
  db: Database.Database,
  id: number,
  data: ResponsableInput
): boolean {
  const nombre = data.nombre.trim();
  if (!nombre) throw new Error("El nombre del responsable es obligatorio.");
  const existing = getResponsableByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro responsable con ese nombre.");
  }
  return (
    db
      .prepare(
        "UPDATE RESPONSABLES SET nombre = @nombre, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        activo: data.activo === false ? 0 : 1,
      }).changes > 0
  );
}

export function deleteResponsable(db: Database.Database, id: number): boolean {
  const responsable = getResponsableById(db, id);
  if (!responsable) return false;
  const cols = db.prepare("PRAGMA table_info(PRESUPUESTO)").all() as { name: string }[];
  if (cols.some((c) => c.name === "responsable_gasto")) {
    const used = db
      .prepare(
        "SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE responsable_gasto = ? COLLATE NOCASE"
      )
      .get(responsable.nombre) as { n: number };
    if (used.n > 0) {
      throw new Error(
        `No se puede eliminar: hay ${used.n} gasto(s) con este responsable. Desactivalo en su lugar.`
      );
    }
  }
  return db.prepare("DELETE FROM RESPONSABLES WHERE id = ?").run(id).changes > 0;
}

export function responsableExistsActivo(
  db: Database.Database,
  nombre: string
): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM RESPONSABLES WHERE nombre = ? COLLATE NOCASE AND activo = 1"
    )
    .get(nombre.trim());
  return !!row;
}
