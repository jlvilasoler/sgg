import type { Db } from "./db/pg-client.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  filterVentaSubRubroIdsInCuenta,
  getVentaSubRubroById,
  getVentaSubRubroByNombre,
} from "./venta-sub-rubros-db.js";

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
  soloActivos = false,
  cuentaId?: number | null
): Promise<VentaSubRubroItem[]> {
  const sub = await getVentaSubRubroById(db, subRubroId, cuentaId);
  if (!sub) return [];
  let q = "SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id = ?";
  if (soloActivos) q += " AND activo = 1";
  q += " ORDER BY LOWER(nombre) ASC";
  return (await db.prepare(q).all(subRubroId)) as VentaSubRubroItem[];
}

export async function listVentaItemsBySubRubroNombre(
  db: Db,
  subRubroNombre: string,
  soloActivos = true,
  cuentaId?: number | null
): Promise<VentaSubRubroItem[]> {
  const row = await getVentaSubRubroByNombre(db, subRubroNombre, cuentaId);
  if (!row) return [];
  return listVentaItemsBySubRubroId(db, row.id, soloActivos, cuentaId);
}

export async function listVentaItemsGroupedBySubRubroIds(
  db: Db,
  ids: number[],
  cuentaId?: number | null
): Promise<Record<number, VentaSubRubroItem[]>> {
  const out: Record<number, VentaSubRubroItem[]> = {};
  const scopedIds = await filterVentaSubRubroIdsInCuenta(db, ids, cuentaId);
  if (!scopedIds.length) return out;
  for (const id of scopedIds) out[id] = [];
  const placeholders = scopedIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT * FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id IN (${placeholders})
       ORDER BY sub_rubro_id, LOWER(nombre) ASC`
    )
    .all(...scopedIds)) as VentaSubRubroItem[];
  for (const r of rows) {
    out[r.sub_rubro_id].push(r);
  }
  return out;
}

export async function countVentaItemsBySubRubroIds(
  db: Db,
  ids: number[],
  cuentaId?: number | null
): Promise<Record<number, number>> {
  const out: Record<number, number> = {};
  const scopedIds = await filterVentaSubRubroIdsInCuenta(db, ids, cuentaId);
  if (!scopedIds.length) return out;
  const placeholders = scopedIds.map(() => "?").join(",");
  const rows = (await db
    .prepare(
      `SELECT sub_rubro_id, COUNT(*) AS n FROM VENTA_SUB_RUBRO_ITEMS
       WHERE sub_rubro_id IN (${placeholders}) GROUP BY sub_rubro_id`
    )
    .all(...scopedIds)) as { sub_rubro_id: number; n: number }[];
  for (const id of scopedIds) out[id] = 0;
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

export async function getVentaItemByIdInCuenta(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<VentaSubRubroItem | undefined> {
  const item = await getVentaItemById(db, id);
  if (!item) return undefined;
  const sub = await getVentaSubRubroById(db, item.sub_rubro_id, cuentaId);
  if (!sub) return undefined;
  return item;
}

export async function insertVentaItem(
  db: Db,
  subRubroId: number,
  data: VentaSubRubroItemInput,
  cuentaId?: number | null
): Promise<number> {
  const sub = await getVentaSubRubroById(db, subRubroId, cuentaId);
  if (!sub) throw new Error("Sub-rubro no encontrado.");
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const dup = (await db
    .prepare(
      "SELECT id FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND LOWER(nombre) = LOWER(?)"
    )
    .get(subRubroId, nombre)) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe un ítem con ese nombre en este sub-rubro.");
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
  data: VentaSubRubroItemInput,
  cuentaId?: number | null
): Promise<boolean> {
  const row = await getVentaItemByIdInCuenta(db, id, cuentaId);
  if (!row) return false;
  const nombre = normalizarTituloRubro(data.nombre);
  if (!nombre) throw new Error("El nombre del ítem es obligatorio.");
  const dup = (await db
    .prepare(
      `SELECT id FROM VENTA_SUB_RUBRO_ITEMS WHERE sub_rubro_id = ? AND LOWER(nombre) = LOWER(?) AND id != ?`
    )
    .get(row.sub_rubro_id, nombre, id)) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe otro ítem con ese nombre en este sub-rubro.");
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

export async function deleteVentaItem(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  const row = await getVentaItemByIdInCuenta(db, id, cuentaId);
  if (!row) return false;
  return (await db.prepare("DELETE FROM VENTA_SUB_RUBRO_ITEMS WHERE id = ?").run(id)).changes > 0;
}
