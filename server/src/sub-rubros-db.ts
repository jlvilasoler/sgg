import type Database from "better-sqlite3";
import {
  getRubroByNombre,
  insertRubro,
  updateRubro,
} from "./rubros-db.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  esGrupoAlambradosLegacy,
  GRUPO_ALAMBRADOS,
  GRUPOS_SUB_RUBRO,
  SUB_RUBROS_SEED,
} from "./sub-rubros-data.js";

export interface SubRubro {
  id: number;
  nombre: string;
  grupo: string;
  activo: number;
  creado_en?: string;
}

export interface SubRubroInput {
  nombre: string;
  grupo: string;
  activo?: boolean;
}

export function initSubRubrosTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS SUB_RUBROS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
      grupo TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_sub_rubros_activo ON SUB_RUBROS(activo);
    CREATE INDEX IF NOT EXISTS idx_sub_rubros_grupo ON SUB_RUBROS(grupo);
  `);
  seedSubRubrosIfEmpty(db);
  migrateRacinesARaciones(db);
  migrateUnificarGruposSubRubros(db);
  migrateRenombrarGrupoAlambrados(db);
  syncSubRubrosFromPresupuesto(db);
}

/** Rubro-grupo correcto: «Alambrados» (no «Alambrados y cerramientos»). */
export function migrateRenombrarGrupoAlambrados(db: Database.Database): void {
  const rows = db
    .prepare("SELECT id, grupo FROM SUB_RUBROS")
    .all() as { id: number; grupo: string }[];
  const update = db.prepare("UPDATE SUB_RUBROS SET grupo = ? WHERE id = ?");
  for (const row of rows) {
    if (esGrupoAlambradosLegacy(row.grupo)) {
      update.run(GRUPO_ALAMBRADOS, row.id);
    }
  }
}

/**
 * Unifica variantes del mismo rubro-grupo (ej. «Alambrados y cerramientos» vs «Alambrados Y Cerramientos»)
 * tras corregir normalizarTituloRubro (la «y» ya no pasa a mayúscula al guardar).
 */
function migrateUnificarGruposSubRubros(db: Database.Database): void {
  const rows = db
    .prepare("SELECT id, grupo FROM SUB_RUBROS")
    .all() as { id: number; grupo: string }[];
  if (!rows.length) return;

  const canonPorClave = new Map<string, string>();
  for (const row of rows) {
    const clave = row.grupo.toLocaleLowerCase("es-UY");
    const canon = normalizarTituloRubro(row.grupo);
    const prev = canonPorClave.get(clave);
    if (!prev) canonPorClave.set(clave, canon);
    else if (prev !== canon) {
      const elige =
        prev.includes(" y ") || (!prev.includes(" Y ") && canon.includes(" Y "))
          ? prev
          : canon;
      canonPorClave.set(clave, elige);
    }
  }

  const update = db.prepare("UPDATE SUB_RUBROS SET grupo = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const row of rows) {
      const clave = row.grupo.toLocaleLowerCase("es-UY");
      const canon = canonPorClave.get(clave);
      if (canon && canon !== row.grupo) update.run(canon, row.id);
    }
  });
  tx();
}

/** Llamar después de initGrupoIconosTable. */
export function migrateUnificarGruposIconos(db: Database.Database): void {
  const exists = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'GRUPO_ICONOS'"
    )
    .get();
  if (!exists) return;

  const iconRows = db
    .prepare("SELECT id, grupo FROM GRUPO_ICONOS")
    .all() as { id: number; grupo: string }[];
  for (const row of iconRows) {
    if (esGrupoAlambradosLegacy(row.grupo)) {
      const dup = db
        .prepare(
          "SELECT id FROM GRUPO_ICONOS WHERE grupo = ? COLLATE NOCASE AND id != ?"
        )
        .get(GRUPO_ALAMBRADOS, row.id) as { id: number } | undefined;
      if (dup) {
        db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
      } else {
        db.prepare("UPDATE GRUPO_ICONOS SET grupo = ? WHERE id = ?").run(
          GRUPO_ALAMBRADOS,
          row.id
        );
      }
      continue;
    }
    const canon = normalizarTituloRubro(row.grupo);
    if (!canon || canon === row.grupo) continue;
    const dup = db
      .prepare("SELECT id FROM GRUPO_ICONOS WHERE grupo = ? COLLATE NOCASE AND id != ?")
      .get(canon, row.id) as { id: number } | undefined;
    if (dup) {
      db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
    } else {
      db.prepare("UPDATE GRUPO_ICONOS SET grupo = ? WHERE id = ?").run(canon, row.id);
    }
  }
}

/** Corrección de nombre en catálogo y gastos existentes. */
function migrateRacinesARaciones(db: Database.Database): void {
  const viejo = getSubRubroByNombre(db, "Racines");
  if (!viejo) return;
  const nuevo = getSubRubroByNombre(db, "Raciones");
  if (nuevo && nuevo.id !== viejo.id) return;

  db.prepare("UPDATE SUB_RUBROS SET nombre = 'Raciones' WHERE id = ?").run(viejo.id);

  const cols = db.prepare("PRAGMA table_info(PRESUPUESTO)").all() as { name: string }[];
  if (cols.some((c) => c.name === "sub_rubro")) {
    db.prepare(
      `UPDATE PRESUPUESTO SET sub_rubro = 'Raciones'
       WHERE sub_rubro = 'Racines' COLLATE NOCASE`
    ).run();
  }
}

function seedSubRubrosIfEmpty(db: Database.Database): void {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM SUB_RUBROS").get() as { n: number };
  if (n > 0) return;

  const insert = db.prepare(
    "INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1)"
  );
  const tx = db.transaction((items: typeof SUB_RUBROS_SEED) => {
    for (const item of items) {
      insert.run({ nombre: item.nombre, grupo: item.grupo });
    }
  });
  tx(SUB_RUBROS_SEED);
}

function syncSubRubrosFromPresupuesto(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(PRESUPUESTO)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "sub_rubro")) return;

  const rows = db
    .prepare(
      `SELECT DISTINCT sub_rubro FROM PRESUPUESTO
       WHERE sub_rubro IS NOT NULL AND trim(sub_rubro) != ''`
    )
    .all() as { sub_rubro: string }[];

  const insert = db.prepare(
    "INSERT OR IGNORE INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1)"
  );
  for (const r of rows) {
    insert.run({ nombre: r.sub_rubro.trim(), grupo: "Importado" });
  }
}

export function listSubRubros(db: Database.Database, soloActivos = false): SubRubro[] {
  let query = "SELECT * FROM SUB_RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY grupo COLLATE NOCASE ASC, nombre COLLATE NOCASE ASC";
  return db.prepare(query).all() as SubRubro[];
}

export function listSubRubrosNombres(db: Database.Database): string[] {
  return listSubRubros(db, true).map((r) => r.nombre);
}

export function listSubRubrosGrupos(db: Database.Database): string[] {
  const fromDb = db
    .prepare(
      `SELECT DISTINCT grupo FROM SUB_RUBROS ORDER BY grupo COLLATE NOCASE ASC`
    )
    .all() as { grupo: string }[];
  const set = new Set<string>([...GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function getSubRubroById(db: Database.Database, id: number): SubRubro | undefined {
  return db.prepare("SELECT * FROM SUB_RUBROS WHERE id = ?").get(id) as SubRubro | undefined;
}

export function getSubRubroByNombre(
  db: Database.Database,
  nombre: string
): SubRubro | undefined {
  return db
    .prepare("SELECT * FROM SUB_RUBROS WHERE nombre = ? COLLATE NOCASE")
    .get(nombre.trim()) as SubRubro | undefined;
}

export function insertSubRubro(db: Database.Database, data: SubRubroInput): number {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (getSubRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = db
    .prepare(
      "INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, @activo)"
    )
    .run({ nombre, grupo, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export function updateSubRubro(
  db: Database.Database,
  id: number,
  data: SubRubroInput
): boolean {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = getSubRubroByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  return (
    db
      .prepare(
        "UPDATE SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        grupo,
        activo: data.activo === false ? 0 : 1,
      }).changes > 0
  );
}

export type DeleteGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

/** Renombra el rubro (grupo) y propaga el cambio a gastos y catálogo RUBROS. */
export function renameSubRubroGrupo(
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
      `SELECT grupo FROM SUB_RUBROS WHERE grupo = @nuevo COLLATE NOCASE LIMIT 1`
    )
    .get({ nuevo }) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !==
      0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  const { n: cantSubs } = db
    .prepare(
      "SELECT COUNT(*) AS n FROM SUB_RUBROS WHERE grupo = @anterior COLLATE NOCASE"
    )
    .get({ anterior }) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  const rubroOrigen = getRubroByNombre(db, anterior);
  const rubroDestino = getRubroByNombre(db, nuevo);
  if (rubroDestino && (!rubroOrigen || rubroDestino.id !== rubroOrigen.id)) {
    throw new Error("Ya existe otro rubro en el catálogo con ese nombre.");
  }

  const renombrar = db.transaction(() => {
    const upd = db
      .prepare(
        `UPDATE SUB_RUBROS SET grupo = @nuevo
         WHERE grupo = @anterior COLLATE NOCASE`
      )
      .run({ anterior, nuevo });

    db.prepare(
      `UPDATE PRESUPUESTO SET rubro = @nuevo
       WHERE rubro = @anterior COLLATE NOCASE`
    ).run({ anterior, nuevo });

    if (rubroOrigen) {
      updateRubro(db, rubroOrigen.id, {
        nombre: nuevo,
        activo: rubroOrigen.activo !== 0,
      });
    } else if (!rubroDestino) {
      try {
        insertRubro(db, { nombre: nuevo, activo: true });
      } catch (e) {
        if (!getRubroByNombre(db, nuevo)) throw e;
      }
    }

    return upd.changes;
  });

  return renombrar();
}

export function deleteSubRubrosByGrupo(
  db: Database.Database,
  grupo: string
): DeleteGrupoResult {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  const rows = db
    .prepare("SELECT id, nombre FROM SUB_RUBROS WHERE grupo = ? COLLATE NOCASE")
    .all(g) as { id: number; nombre: string }[];
  const blocked: DeleteGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (deleteSubRubro(db, row.id)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export function deleteSubRubro(db: Database.Database, id: number): boolean {
  const row = getSubRubroById(db, id);
  if (!row) return false;
  const cols = db.prepare("PRAGMA table_info(PRESUPUESTO)").all() as { name: string }[];
  if (cols.some((c) => c.name === "sub_rubro")) {
    const used = db
      .prepare(
        "SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE sub_rubro = ? COLLATE NOCASE"
      )
      .get(row.nombre) as { n: number };
    if (used.n > 0) {
      throw new Error(
        `No se puede eliminar: hay ${used.n} gasto(s) con este sub-rubro. Desactivalo en su lugar.`
      );
    }
  }
  db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(id);
  return db.prepare("DELETE FROM SUB_RUBROS WHERE id = ?").run(id).changes > 0;
}

export function subRubroExistsActivo(db: Database.Database, nombre: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM SUB_RUBROS WHERE nombre = ? COLLATE NOCASE AND activo = 1"
    )
    .get(nombre.trim());
  return !!row;
}
