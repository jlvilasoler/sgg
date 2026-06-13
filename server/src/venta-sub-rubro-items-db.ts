import type Database from "better-sqlite3";
import { normalizarTituloRubro } from "./text-normalize.js";

export interface VentaSubRubroItem {
  id: number;
  sub_rubro_id: number;
  nombre: string;
  activo: number;
  creado_en?: string;
}

export interface VentaSubRubroItemInput {
  nombre: string;
  activo?: boolean;
}

export function initVentaSubRubroItemsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS VENTA_SUB_RUBRO_ITEMS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_rubro_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (sub_rubro_id) REFERENCES VENTA_SUB_RUBROS(id) ON DELETE CASCADE,
      UNIQUE (sub_rubro_id, nombre COLLATE NOCASE)
    );
    CREATE INDEX IF NOT EXISTS idx_venta_sub_rubro_items_sub ON VENTA_SUB_RUBRO_ITEMS(sub_rubro_id);
  `);
}

export function listVentaItemsBySubRubroId(
  db: Database.Database,
  subRubroId: number,
  soloActivos = false
): VentaSubRubroItem[] {
  let q = "SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id = ?";
  if (soloActivos) q += " AND activo = 1";
  q += " ORDER BY nombre COLLATE NOCASE ASC";
  return db.prepare(q).all(subRubroId) as VentaSubRubroItem[];
}

export function listVentaItemsBySubRubroNombre(
  db: Database.Database,
  subRubroNombre: string,
  soloActivos = true
): VentaSubRubroItem[] {
  const row = db
    .prepare("SELECT id FROM VENTA_SUB_RUBROS WHERE nombre = ? COLLATE NOCASE")
    .get(subRubroNombre.trim()) as { id: number } | undefined;
  if (!row) return [];
  return listVentaItemsBySubRubroId(db, row.id, soloActivos);
}

export function listVentaItemsGroupedBySubRubroIds(
  db: Database.Database,
  ids: number[]
): Record<number, VentaSubRubroItem[]> {
  const out: Record<number, VentaSubRubroItem[]> = {};
  if (!ids.length) return out;
  for (const id of ids) out[id] = [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id IN (${placeholders})
       ORDER BY sub_rubro_id, nombre COLLATE NOCASE ASC`
    )
    .all(...ids) as VentaSubRubroItem[];
  for (const r of rows) {
    out[r.sub_rubro_id].push(r);
  }
  return out;
}

export function countVentaItemsBySubRubroIds(
  db: Database.Database,
  ids: number[]
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT sub_rubro_id, COUNT(*) AS n FROM VENTA_SUB_RUBRO_ITEMS
       WHERE sub_rubro_id IN (${placeholders}) GROUP BY sub_rubro_id`
    )
    .all(...ids) as { sub_rubro_id: number; n: number }[];
  for (const id of ids) out[id] = 0;
  for (const r of rows) out[r.sub_rubro_id] = r.n;
  return out;
}

export function getVentaItemById(
  db: Database.Database,
  id: number
): VentaSubRubroItem | undefined {
  return db.prepare("SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE id = ?").get(id) as
    | VentaSubRubroItem
    | undefined;
}

export function insertVentaItem(
  db: Database.Database,
  subRubroId: number,
  data: VentaSubRubroItemInput
): number {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const result = db
    .prepare(
      `INSERT INTO VENTA_SUB_RUBRO_ITEMS (sub_rubro_id, nombre, activo)
       VALUES (@sub_rubro_id, @nombre, @activo)`
    )
    .run({
      sub_rubro_id: subRubroId,
      nombre,
      activo: data.activo === false ? 0 : 1,
    });
  return Number(result.lastInsertRowid);
}

export function updateVentaItem(
  db: Database.Database,
  id: number,
  data: VentaSubRubroItemInput
): boolean {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  return (
    db
      .prepare(
        "UPDATE VENTA_SUB_RUBRO_ITEMS SET nombre = @nombre, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        activo: data.activo === false ? 0 : 1,
      }).changes > 0
  );
}

export function deleteVentaItem(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM VENTA_SUB_RUBRO_ITEMS WHERE id = ?").run(id).changes > 0;
}
