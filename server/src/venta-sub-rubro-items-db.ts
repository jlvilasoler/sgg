import type { Db } from "./db/pg-client.js";
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

export async function initVentaSubRubroItemsTable(_db: Db): Promise<void> {}

export async function listVentaItemsBySubRubroId(
  db: Db,
  subRubroId: number,
  soloActivos = false
): Promise<VentaSubRubroItem[]> {
  let q = "SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id = ?";
  if (soloActivos) q += " AND activo = 1";
  q += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(q).all(subRubroId)) as VentaSubRubroItem[];
}

export async function listVentaItemsBySubRubroNombre(
  db: Db,
  subRubroNombre: string,
  soloActivos = true
): Promise<VentaSubRubroItem[]> {
  const row = (await db
    .prepare("SELECT id FROM VENTA_SUB_RUBROS WHERE LOWER(nombre) = LOWER(?)")
    .get(subRubroNombre.trim())) as { id: number } | undefined;
  if (!row) return [];
  return listVentaItemsBySubRubroId(db, row.id, soloActivos);
}

export async function listVentaItemsGroupedBySubRubroIds(
  db: Db,
  ids: number[]
): Promise<Record<number, VentaSubRubroItem[]>> {
  const out: Record<number, VentaSubRubroItem[]> = {};
  if (!ids.length) return out;
  for (const id of ids) out[id] = [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id IN (${placeholders})
       ORDER BY sub_rubro_id, LOWER(nombre) ASC`
    )
    .all(...ids)) as VentaSubRubroItem[];
  for (const r of rows) {
    out[r.sub_rubro_id].push(r);
  }
  return out;
}

export async function countVentaItemsBySubRubroIds(
  db: Db,
  ids: number[]
): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  if (!ids.length) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT sub_rubro_id, COUNT(*) AS n FROM VENTA_SUB_RUBRO_ITEMS
       WHERE sub_rubro_id IN (${placeholders}) GROUP BY sub_rubro_id`
    )
    .all(...ids)) as { sub_rubro_id: number; n: number }[];
  for (const id of ids) out[id] = 0;
  for (const r of rows) out[r.sub_rubro_id] = r.n;
  return out;
}

export async function getVentaItemById(
  db: Db,
  id: number
): Promise<VentaSubRubroItem | undefined> {
  return (await db.prepare("SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE id = ?").get(id)) as
    | VentaSubRubroItem
    | undefined;
}

export async function insertVentaItem(
  db: Db,
  subRubroId: number,
  data: VentaSubRubroItemInput
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const result = await db
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

export async function updateVentaItem(
  db: Db,
  id: number,
  data: VentaSubRubroItemInput
): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  return (
    await db
      .prepare(
        "UPDATE VENTA_SUB_RUBRO_ITEMS SET nombre = @nombre, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export async function deleteVentaItem(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM VENTA_SUB_RUBRO_ITEMS WHERE id = ?").run(id)).changes > 0;
}
