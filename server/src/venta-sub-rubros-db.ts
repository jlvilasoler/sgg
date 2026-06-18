import type { Db } from "./db/pg-client.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  VENTA_GRUPOS_SUB_RUBRO,
  VENTA_SUB_RUBROS_SEED,
} from "./venta-sub-rubros-data.js";

export interface VentaSubRubro {
  id: number;
  nombre: string;
  grupo: string;
  activo: number;
  creado_en?: string;
}

export interface VentaSubRubroInput {
  nombre: string;
  grupo: string;
  activo?: boolean;
}

export type DeleteVentaGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

export async function initVentaSubRubrosTable(db: Db): Promise<void> {
  await seedVentaSubRubrosIfEmpty(db);
}

async function seedVentaSubRubrosIfEmpty(db: Db): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo)
     SELECT @nombre, @grupo, 1
     WHERE NOT EXISTS (SELECT 1 FROM VENTA_SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const item of VENTA_SUB_RUBROS_SEED) {
    await insert.run({ nombre: item.nombre, grupo: item.grupo });
  }
}

export async function listVentaSubRubros(
  db: Db,
  soloActivos = false
): Promise<VentaSubRubro[]> {
  let query = "SELECT * FROM VENTA_SUB_RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY LOWER(grupo) ASC, LOWER(nombre) ASC";
  return (await db.prepare(query).all()) as VentaSubRubro[];
}

export async function listVentaSubRubrosGrupos(db: Db): Promise<string[]> {
  const fromDb = (await db
    .prepare(`SELECT DISTINCT grupo FROM VENTA_SUB_RUBROS`)
    .all()) as { grupo: string }[];
  const set = new Set<string>([...VENTA_GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export async function getVentaSubRubroById(
  db: Db,
  id: number
): Promise<VentaSubRubro | undefined> {
  return (await db
    .prepare("SELECT * FROM VENTA_SUB_RUBROS WHERE id = ?")
    .get(id)) as VentaSubRubro | undefined;
}

export async function getVentaSubRubroByNombre(
  db: Db,
  nombre: string
): Promise<VentaSubRubro | undefined> {
  return (await db
    .prepare("SELECT * FROM VENTA_SUB_RUBROS WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre.trim())) as VentaSubRubro | undefined;
}

export async function insertVentaSubRubro(
  db: Db,
  data: VentaSubRubroInput
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (await getVentaSubRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = await db
    .prepare(
      "INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, @activo)"
    )
    .run({ nombre, grupo, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export async function updateVentaSubRubro(
  db: Db,
  id: number,
  data: VentaSubRubroInput
): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = await getVentaSubRubroByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  return (
    await db
      .prepare(
        "UPDATE VENTA_SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        grupo,
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export async function renameVentaSubRubroGrupo(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string
): Promise<number> {
  const anterior = normalizarTituloRubro(grupoAnterior);
  const nuevo = normalizarTituloRubro(grupoNuevo);
  if (!anterior) throw new Error("El rubro actual no es válido.");
  if (!nuevo) throw new Error("El nuevo nombre del rubro es obligatorio.");
  if (anterior.localeCompare(nuevo, "es", { sensitivity: "accent" }) === 0) {
    return 0;
  }

  const conflictoGrupo = (await db
    .prepare(`SELECT grupo FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(@nuevo) LIMIT 1`)
    .get({ nuevo })) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !== 0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  const { n: cantSubs } = (await db
    .prepare("SELECT COUNT(*) AS n FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(@anterior)")
    .get({ anterior })) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  return (
    await db
      .prepare(
        `UPDATE VENTA_SUB_RUBROS SET grupo = @nuevo
       WHERE LOWER(grupo) = LOWER(@anterior)`
      )
      .run({ anterior, nuevo })
  ).changes;
}

export async function deleteVentaSubRubrosByGrupo(
  db: Db,
  grupo: string
): Promise<DeleteVentaGrupoResult> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  const rows = (await db
    .prepare("SELECT id, nombre FROM VENTA_SUB_RUBROS WHERE LOWER(grupo) = LOWER(?)")
    .all(g)) as { id: number; nombre: string }[];
  const blocked: DeleteVentaGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (await deleteVentaSubRubro(db, row.id)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export async function deleteVentaSubRubro(db: Db, id: number): Promise<boolean> {
  const row = await getVentaSubRubroById(db, id);
  if (!row) return false;

  const colRow = await db
    .prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'ingresos_ventas' AND column_name = 'sub_rubro' LIMIT 1`
    )
    .get();
  if (colRow) {
    const used = (await db
      .prepare(
        "SELECT COUNT(*) AS n FROM INGRESOS_VENTAS WHERE LOWER(sub_rubro) = LOWER(?)"
      )
      .get(row.nombre)) as { n: number };
    if (used.n > 0) {
      throw new Error(
        `No se puede eliminar: hay ${used.n} ingreso(s) con este sub-rubro. Desactivalo en su lugar.`
      );
    }
  }

  return (await db.prepare("DELETE FROM VENTA_SUB_RUBROS WHERE id = ?").run(id)).changes > 0;
}
