import type Database from "better-sqlite3";
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

export function initVentaSubRubrosTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS VENTA_SUB_RUBROS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      grupo TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_venta_sub_rubros_activo ON VENTA_SUB_RUBROS(activo);
    CREATE INDEX IF NOT EXISTS idx_venta_sub_rubros_grupo ON VENTA_SUB_RUBROS(grupo);
  `);
  seedVentaSubRubrosIfEmpty(db);
}

function seedVentaSubRubrosIfEmpty(db: Database.Database): void {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM VENTA_SUB_RUBROS")
    .get() as { n: number };
  if (n > 0) return;

  const insert = db.prepare(
    "INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1)"
  );
  const tx = db.transaction((items: typeof VENTA_SUB_RUBROS_SEED) => {
    for (const item of items) {
      insert.run({ nombre: item.nombre, grupo: item.grupo });
    }
  });
  tx(VENTA_SUB_RUBROS_SEED);
}

export function listVentaSubRubros(
  db: Database.Database,
  soloActivos = false
): VentaSubRubro[] {
  let query = "SELECT * FROM VENTA_SUB_RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY grupo COLLATE NOCASE ASC, nombre COLLATE NOCASE ASC";
  return db.prepare(query).all() as VentaSubRubro[];
}

export function listVentaSubRubrosGrupos(db: Database.Database): string[] {
  const fromDb = db
    .prepare(
      `SELECT DISTINCT grupo FROM VENTA_SUB_RUBROS ORDER BY grupo COLLATE NOCASE ASC`
    )
    .all() as { grupo: string }[];
  const set = new Set<string>([...VENTA_GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function getVentaSubRubroById(
  db: Database.Database,
  id: number
): VentaSubRubro | undefined {
  return db
    .prepare("SELECT * FROM VENTA_SUB_RUBROS WHERE id = ?")
    .get(id) as VentaSubRubro | undefined;
}

export function getVentaSubRubroByNombre(
  db: Database.Database,
  nombre: string
): VentaSubRubro | undefined {
  return db
    .prepare("SELECT * FROM VENTA_SUB_RUBROS WHERE nombre = ? COLLATE NOCASE")
    .get(nombre.trim()) as VentaSubRubro | undefined;
}

export function insertVentaSubRubro(
  db: Database.Database,
  data: VentaSubRubroInput
): number {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (getVentaSubRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = db
    .prepare(
      "INSERT INTO VENTA_SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, @activo)"
    )
    .run({ nombre, grupo, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export function updateVentaSubRubro(
  db: Database.Database,
  id: number,
  data: VentaSubRubroInput
): boolean {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = getVentaSubRubroByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  return (
    db
      .prepare(
        "UPDATE VENTA_SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        grupo,
        activo: data.activo === false ? 0 : 1,
      }).changes > 0
  );
}

export function renameVentaSubRubroGrupo(
  db: Database.Database,
  grupoAnterior: string,
  grupoNuevo: string
): number {
  const anterior = normalizarTituloRubro(grupoAnterior);
  const nuevo = normalizarTituloRubro(grupoNuevo);
  if (!anterior) throw new Error("El rubro actual no es válido.");
  if (!nuevo) throw new Error("El nuevo nombre del rubro es obligatorio.");
  if (anterior.localeCompare(nuevo, "es", { sensitivity: "accent" }) === 0) {
    return 0;
  }

  const conflictoGrupo = db
    .prepare(
      `SELECT grupo FROM VENTA_SUB_RUBROS WHERE grupo = @nuevo COLLATE NOCASE LIMIT 1`
    )
    .get({ nuevo }) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !== 0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  const { n: cantSubs } = db
    .prepare(
      "SELECT COUNT(*) AS n FROM VENTA_SUB_RUBROS WHERE grupo = @anterior COLLATE NOCASE"
    )
    .get({ anterior }) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  return db
    .prepare(
      `UPDATE VENTA_SUB_RUBROS SET grupo = @nuevo
       WHERE grupo = @anterior COLLATE NOCASE`
    )
    .run({ anterior, nuevo }).changes;
}

export function deleteVentaSubRubrosByGrupo(
  db: Database.Database,
  grupo: string
): DeleteVentaGrupoResult {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  const rows = db
    .prepare("SELECT id, nombre FROM VENTA_SUB_RUBROS WHERE grupo = ? COLLATE NOCASE")
    .all(g) as { id: number; nombre: string }[];
  const blocked: DeleteVentaGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (deleteVentaSubRubro(db, row.id)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export function deleteVentaSubRubro(db: Database.Database, id: number): boolean {
  const row = getVentaSubRubroById(db, id);
  if (!row) return false;

  const cols = db
    .prepare("PRAGMA table_info(INGRESOS_VENTAS)")
    .all() as { name: string }[];
  if (cols.some((c) => c.name === "sub_rubro")) {
    const used = db
      .prepare(
        "SELECT COUNT(*) AS n FROM INGRESOS_VENTAS WHERE sub_rubro = ? COLLATE NOCASE"
      )
      .get(row.nombre) as { n: number };
    if (used.n > 0) {
      throw new Error(
        `No se puede eliminar: hay ${used.n} ingreso(s) con este sub-rubro. Desactivalo en su lugar.`
      );
    }
  }

  return db.prepare("DELETE FROM VENTA_SUB_RUBROS WHERE id = ?").run(id).changes > 0;
}
