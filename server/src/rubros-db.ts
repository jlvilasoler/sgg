import type Database from "better-sqlite3";
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

export function initRubrosTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS RUBROS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_rubros_activo ON RUBROS(activo);
  `);
  seedRubrosIfEmpty(db);
  syncRubrosFromPresupuesto(db);
}

/** Asegura rubros del catálogo por grupo (Agricultura, Construcción, etc.). */
export function ensureRubrosNombres(
  db: Database.Database,
  nombres: readonly string[]
): void {
  const insert = db.prepare(
    "INSERT OR IGNORE INTO RUBROS (nombre, activo) VALUES (@nombre, 1)"
  );
  for (const nombre of nombres) {
    insert.run({ nombre });
  }
}

function syncRubrosFromPresupuesto(db: Database.Database): void {
  const rows = db
    .prepare(
      `SELECT DISTINCT rubro FROM PRESUPUESTO
       WHERE rubro IS NOT NULL AND trim(rubro) != ''`
    )
    .all() as { rubro: string }[];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO RUBROS (nombre, activo) VALUES (@nombre, 1)"
  );
  for (const r of rows) {
    insert.run({ nombre: r.rubro.trim() });
  }
}

function seedRubrosIfEmpty(db: Database.Database): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM RUBROS").get() as { n: number };
  if (n > 0) return;

  const insert = db.prepare("INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1)");
  const tx = db.transaction((nombres: readonly string[]) => {
    for (const nombre of nombres) {
      insert.run({ nombre });
    }
  });
  tx(RUBROS_DEFAULT);
}

export function listRubros(db: Database.Database, soloActivos = false): Rubro[] {
  let query = "SELECT * FROM RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY nombre COLLATE NOCASE ASC";
  return db.prepare(query).all() as Rubro[];
}

export function listRubrosNombres(db: Database.Database): string[] {
  return listRubros(db, true).map((r) => r.nombre);
}

export function getRubroById(db: Database.Database, id: number): Rubro | undefined {
  return db.prepare("SELECT * FROM RUBROS WHERE id = ?").get(id) as Rubro | undefined;
}

export function getRubroByNombre(
  db: Database.Database,
  nombre: string
): Rubro | undefined {
  return db
    .prepare("SELECT * FROM RUBROS WHERE nombre = ? COLLATE NOCASE")
    .get(nombre.trim()) as Rubro | undefined;
}

export function insertRubro(db: Database.Database, data: RubroInput): number {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  if (getRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un rubro con ese nombre.");
  }
  const result = db
    .prepare("INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, @activo)")
    .run({ nombre, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export function updateRubro(db: Database.Database, id: number, data: RubroInput): boolean {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del rubro es obligatorio.");
  const existing = getRubroByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro rubro con ese nombre.");
  }
  return (
    db.prepare("UPDATE RUBROS SET nombre = @nombre, activo = @activo WHERE id = @id").run({
      id,
      nombre,
      activo: data.activo === false ? 0 : 1,
    }).changes > 0
  );
}

export function deleteRubro(db: Database.Database, id: number): boolean {
  const rubro = getRubroById(db, id);
  if (!rubro) return false;
  const used = db
    .prepare("SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE rubro = ? COLLATE NOCASE")
    .get(rubro.nombre) as { n: number };
  if (used.n > 0) {
    throw new Error(
      `No se puede eliminar: hay ${used.n} gasto(s) con este rubro. Desactivalo en su lugar.`
    );
  }
  return db.prepare("DELETE FROM RUBROS WHERE id = ?").run(id).changes > 0;
}

export function rubroExistsActivo(db: Database.Database, nombre: string): boolean {
  const row = db
    .prepare("SELECT 1 FROM RUBROS WHERE nombre = ? COLLATE NOCASE AND activo = 1")
    .get(nombre.trim());
  return !!row;
}
