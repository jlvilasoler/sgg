import type Database from "better-sqlite3";
import { normalizarTituloRubro } from "./text-normalize.js";

export interface SubRubroItem {
  id: number;
  sub_rubro_id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface SubRubroItemInput {
  nombre: string;
  activo?: boolean;
}

export function initSubRubroItemsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SUB_RUBRO_ITEMS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_rubro_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (sub_rubro_id) REFERENCES SUB_RUBROS(id) ON DELETE CASCADE,
      UNIQUE (sub_rubro_id, nombre COLLATE NOCASE)
    );
    CREATE INDEX IF NOT EXISTS idx_sub_rubro_items_sub ON SUB_RUBRO_ITEMS(sub_rubro_id);
  `);
}

export function listItemsBySubRubroId(
  db: Database.Database,
  subRubroId: number,
  soloActivos = false
): SubRubroItem[] {
  let q = "SELECT * FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ?";
  if (soloActivos) q += " AND activo = 1";
  q += " ORDER BY nombre COLLATE NOCASE ASC";
  return db.prepare(q).all(subRubroId) as SubRubroItem[];
}

export function listItemsBySubRubroNombre(
  db: Database.Database,
  subRubroNombre: string,
  soloActivos = true
): SubRubroItem[] {
  const row = db
    .prepare("SELECT id FROM SUB_RUBROS WHERE nombre = ? COLLATE NOCASE")
    .get(subRubroNombre.trim()) as { id: number } | undefined;
  if (!row) return [];
  return listItemsBySubRubroId(db, row.id, soloActivos);
}

export function listItemsGroupedBySubRubroIds(
  db: Database.Database,
  ids: number[]
): Record<number, SubRubroItem[]> {
  const out: Record<number, SubRubroItem[]> = {};
  if (!ids.length) return out;
  for (const id of ids) out[id] = [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id IN (${placeholders})
       ORDER BY sub_rubro_id, nombre COLLATE NOCASE ASC`
    )
    .all(...ids) as SubRubroItem[];
  for (const r of rows) {
    out[r.sub_rubro_id].push(r);
  }
  return out;
}

export function countItemsBySubRubroIds(
  db: Database.Database,
  ids: number[]
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT sub_rubro_id, COUNT(*) AS n FROM SUB_RUBRO_ITEMS
       WHERE sub_rubro_id IN (${placeholders}) GROUP BY sub_rubro_id`
    )
    .all(...ids) as { sub_rubro_id: number; n: number }[];
  for (const id of ids) out[id] = 0;
  for (const r of rows) out[r.sub_rubro_id] = r.n;
  return out;
}

export function getItemById(
  db: Database.Database,
  id: number
): SubRubroItem | undefined {
  return db.prepare("SELECT * FROM SUB_RUBRO_ITEMS WHERE id = ?").get(id) as
    | SubRubroItem
    | undefined;
}

export function insertItem(
  db: Database.Database,
  subRubroId: number,
  data: SubRubroItemInput
): number {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const dup = db
    .prepare(
      "SELECT id FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND nombre = ? COLLATE NOCASE"
    )
    .get(subRubroId, nombre);
  if (dup) throw new Error("Ya existe un ítem con ese nombre en este sub-rubro.");
  const r = db
    .prepare(
      "INSERT INTO SUB_RUBRO_ITEMS (sub_rubro_id, nombre, activo) VALUES (?, ?, ?)"
    )
    .run(subRubroId, nombre, data.activo === false ? 0 : 1);
  return Number(r.lastInsertRowid);
}

export function updateItem(
  db: Database.Database,
  id: number,
  data: SubRubroItemInput
): boolean {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const row = getItemById(db, id);
  if (!row) return false;
  const dup = db
    .prepare(
      `SELECT id FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND nombre = ? COLLATE NOCASE AND id != ?`
    )
    .get(row.sub_rubro_id, nombre, id);
  if (dup) throw new Error("Ya existe otro ítem con ese nombre en este sub-rubro.");
  return (
    db.prepare(
      "UPDATE SUB_RUBRO_ITEMS SET nombre = @nombre, activo = @activo WHERE id = @id"
    ).run({
      id,
      nombre,
      activo: data.activo === false ? 0 : 1,
    }).changes > 0
  );
}

export function deleteItem(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM SUB_RUBRO_ITEMS WHERE id = ?").run(id).changes > 0;
}
