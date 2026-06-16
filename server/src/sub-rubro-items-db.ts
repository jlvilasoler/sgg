import type { Db } from "./db/pg-client.js";
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

export async function initSubRubroItemsTable(_db: Db): Promise<void> {}

export async function listItemsBySubRubroId(
  db: Db,
  subRubroId: number,
  soloActivos = false
): Promise<SubRubroItem[]> {
  let q = "SELECT * FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ?";
  if (soloActivos) q += " AND activo = 1";
  q += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(q).all(subRubroId)) as SubRubroItem[];
}

export async function listItemsBySubRubroNombre(
  db: Db,
  subRubroNombre: string,
  soloActivos = true
): Promise<SubRubroItem[]> {
  const row = (await db
    .prepare("SELECT id FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(?)")
    .get(subRubroNombre.trim())) as { id: number } | undefined;
  if (!row) return [];
  return listItemsBySubRubroId(db, row.id, soloActivos);
}

export async function listItemsGroupedBySubRubroIds(
  db: Db,
  ids: number[]
): Promise<Record<number, SubRubroItem[]>> {
  const out: Record<number, SubRubroItem[]> = {};
  if (!ids.length) return out;
  for (const id of ids) out[id] = [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT * FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id IN (${placeholders})
       ORDER BY sub_rubro_id, LOWER(nombre) ASC`
    )
    .all(...ids)) as SubRubroItem[];
  for (const r of rows) {
    out[r.sub_rubro_id].push(r);
  }
  return out;
}

export async function countItemsBySubRubroIds(
  db: Db,
  ids: number[]
): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT sub_rubro_id, COUNT(*) AS n FROM SUB_RUBRO_ITEMS
       WHERE sub_rubro_id IN (${placeholders}) GROUP BY sub_rubro_id`
    )
    .all(...ids)) as { sub_rubro_id: number; n: number }[];
  for (const id of ids) out[id] = 0;
  for (const r of rows) out[r.sub_rubro_id] = r.n;
  return out;
}

export async function getItemById(
  db: Db,
  id: number
): Promise<SubRubroItem | undefined> {
  return (await db.prepare("SELECT * FROM SUB_RUBRO_ITEMS WHERE id = ?").get(id)) as
    | SubRubroItem
    | undefined;
}

export async function insertItem(
  db: Db,
  subRubroId: number,
  data: SubRubroItemInput
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const dup = await db
    .prepare(
      "SELECT id FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND LOWER(nombre) = LOWER(?)"
    )
    .get(subRubroId, nombre);
  if (dup) throw new Error("Ya existe un ítem con ese nombre en este sub-rubro.");
  const r = await db
    .prepare(
      "INSERT INTO SUB_RUBRO_ITEMS (sub_rubro_id, nombre, activo) VALUES (?, ?, ?)"
    )
    .run(subRubroId, nombre, data.activo === false ? 0 : 1);
  return Number(r.lastInsertRowid);
}

export async function updateItem(
  db: Db,
  id: number,
  data: SubRubroItemInput
): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const row = await getItemById(db, id);
  if (!row) return false;
  const dup = await db
    .prepare(
      `SELECT id FROM SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND LOWER(nombre) = LOWER(?) AND id != ?`
    )
    .get(row.sub_rubro_id, nombre, id);
  if (dup) throw new Error("Ya existe otro ítem con ese nombre en este sub-rubro.");
  return (
    await db.prepare(
      "UPDATE SUB_RUBRO_ITEMS SET nombre = @nombre, activo = @activo WHERE id = @id"
    ).run({
      id,
      nombre,
      activo: data.activo === false ? 0 : 1,
    })
  ).changes > 0;
}

export async function deleteItem(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM SUB_RUBRO_ITEMS WHERE id = ?").run(id)).changes > 0;
}
