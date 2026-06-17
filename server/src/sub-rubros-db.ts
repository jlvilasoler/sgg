import type { Db } from "./db/pg-client.js";
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

export async function initSubRubrosTable(db: Db): Promise<void> {
  await seedSubRubrosIfEmpty(db);
  await migrateRenombrarGrupoAlambrados(db);
  await syncSubRubrosFromPresupuesto(db);
}

/** Rubro-grupo correcto: «Alambrados» (no «Alambrados y cerramientos»). */
export async function migrateRenombrarGrupoAlambrados(db: Db): Promise<void> {
  const rows = (await db
    .prepare("SELECT id, grupo FROM SUB_RUBROS")
    .all()) as { id: number; grupo: string }[];
  const update = await db.prepare("UPDATE SUB_RUBROS SET grupo = ? WHERE id = ?");
  for (const row of rows) {
    if (esGrupoAlambradosLegacy(row.grupo)) {
      await update.run(GRUPO_ALAMBRADOS, row.id);
    }
  }
}

async function migrateUnificarGruposSubRubros(_db: Db): Promise<void> {}

/** Llamar después de initGrupoIconosTable. */
export async function migrateUnificarGruposIconos(db: Db): Promise<void> {
  const exists = await db
    .prepare(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND lower(table_name) = 'grupo_iconos' LIMIT 1`
    )
    .get();
  if (!exists) return;

  const iconRows = (await db
    .prepare("SELECT id, grupo FROM GRUPO_ICONOS")
    .all()) as { id: number; grupo: string }[];
  for (const row of iconRows) {
    if (esGrupoAlambradosLegacy(row.grupo)) {
      const dup = (await db
        .prepare(
          "SELECT id FROM GRUPO_ICONOS WHERE LOWER(grupo) = LOWER(?) AND id != ?"
        )
        .get(GRUPO_ALAMBRADOS, row.id)) as { id: number } | undefined;
      if (dup) {
        await db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
      } else {
        await db.prepare("UPDATE GRUPO_ICONOS SET grupo = ? WHERE id = ?").run(
          GRUPO_ALAMBRADOS,
          row.id
        );
      }
      continue;
    }
    const canon = normalizarTituloRubro(row.grupo);
    if (!canon || canon === row.grupo) continue;
    const dup = (await db
      .prepare("SELECT id FROM GRUPO_ICONOS WHERE LOWER(grupo) = LOWER(?) AND id != ?")
      .get(canon, row.id)) as { id: number } | undefined;
    if (dup) {
      await db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
    } else {
      await db.prepare("UPDATE GRUPO_ICONOS SET grupo = ? WHERE id = ?").run(canon, row.id);
    }
  }
}

async function migrateRacinesARaciones(_db: Db): Promise<void> {}

async function seedSubRubrosIfEmpty(db: Db): Promise<void> {
  const insert = await db.prepare(
    `INSERT INTO SUB_RUBROS (nombre, grupo, activo)
     SELECT @nombre, @grupo, 1
     WHERE NOT EXISTS (SELECT 1 FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const item of SUB_RUBROS_SEED) {
    await insert.run({ nombre: item.nombre, grupo: item.grupo });
  }
}

async function syncSubRubrosFromPresupuesto(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT DISTINCT sub_rubro FROM PRESUPUESTO
       WHERE sub_rubro IS NOT NULL AND trim(sub_rubro) != ''`
    )
    .all()) as { sub_rubro: string }[];

  const insert = await db.prepare(
    `INSERT INTO SUB_RUBROS (nombre, grupo, activo)
     SELECT @nombre, @grupo, 1
     WHERE NOT EXISTS (SELECT 1 FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre))`
  );
  for (const r of rows) {
    await insert.run({ nombre: r.sub_rubro.trim(), grupo: "Importado" });
  }
}

export async function listSubRubros(db: Db, soloActivos = false): Promise<SubRubro[]> {
  let query = "SELECT * FROM SUB_RUBROS";
  if (soloActivos) query += " WHERE activo = 1";
  query += " ORDER BY LOWER(grupo) ASC, LOWER(nombre) ASC";
  return (await db.prepare(query).all()) as SubRubro[];
}

export async function listSubRubrosNombres(db: Db): Promise<string[]> {
  return (await listSubRubros(db, true)).map((r) => r.nombre);
}

export async function listSubRubrosGrupos(db: Db): Promise<string[]> {
  const fromDb = (await db
    .prepare(`SELECT DISTINCT grupo FROM SUB_RUBROS ORDER BY LOWER(grupo) ASC`)
    .all()) as { grupo: string }[];
  const set = new Set<string>([...GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export async function getSubRubroById(db: Db, id: number): Promise<SubRubro | undefined> {
  return (await db.prepare("SELECT * FROM SUB_RUBROS WHERE id = ?").get(id)) as
    | SubRubro
    | undefined;
}

export async function getSubRubroByNombre(
  db: Db,
  nombre: string
): Promise<SubRubro | undefined> {
  return (await db
    .prepare("SELECT * FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(?)")
    .get(nombre.trim())) as SubRubro | undefined;
}

export async function insertSubRubro(db: Db, data: SubRubroInput): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (await getSubRubroByNombre(db, nombre)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = await db
    .prepare(
      "INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, @activo)"
    )
    .run({ nombre, grupo, activo: data.activo === false ? 0 : 1 });
  return Number(result.lastInsertRowid);
}

export async function updateSubRubro(
  db: Db,
  id: number,
  data: SubRubroInput
): Promise<boolean> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = await getSubRubroByNombre(db, nombre);
  if (existing && existing.id !== id) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  return (
    await db
      .prepare(
        "UPDATE SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id"
      )
      .run({
        id,
        nombre,
        grupo,
        activo: data.activo === false ? 0 : 1,
      })
  ).changes > 0;
}

export type DeleteGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

/** Renombra el rubro (grupo) y propaga el cambio a gastos y catálogo RUBROS. */
export async function renameSubRubroGrupo(
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
    .prepare(`SELECT grupo FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(@nuevo) LIMIT 1`)
    .get({ nuevo })) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !== 0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  const { n: cantSubs } = (await db
    .prepare("SELECT COUNT(*) AS n FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(@anterior)")
    .get({ anterior })) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  const rubroOrigen = await getRubroByNombre(db, anterior);
  const rubroDestino = await getRubroByNombre(db, nuevo);
  if (rubroDestino && (!rubroOrigen || rubroDestino.id !== rubroOrigen.id)) {
    throw new Error("Ya existe otro rubro en el catálogo con ese nombre.");
  }

  return db.transaction(async (tx) => {
    const upd = await tx
      .prepare(
        `UPDATE SUB_RUBROS SET grupo = @nuevo
         WHERE LOWER(grupo) = LOWER(@anterior)`
      )
      .run({ anterior, nuevo });

    await tx.prepare(
      `UPDATE PRESUPUESTO SET rubro = @nuevo
       WHERE LOWER(rubro) = LOWER(@anterior)`
    ).run({ anterior, nuevo });

    if (rubroOrigen) {
      await updateRubro(db, rubroOrigen.id, {
        nombre: nuevo,
        activo: rubroOrigen.activo !== 0,
      });
    } else if (!rubroDestino) {
      try {
        await insertRubro(db, { nombre: nuevo, activo: true });
      } catch (e) {
        if (!(await getRubroByNombre(db, nuevo))) throw e;
      }
    }

    return upd.changes;
  });
}

export async function deleteSubRubrosByGrupo(
  db: Db,
  grupo: string
): Promise<DeleteGrupoResult> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  const rows = (await db
    .prepare("SELECT id, nombre FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(?)")
    .all(g)) as { id: number; nombre: string }[];
  const blocked: DeleteGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (await deleteSubRubro(db, row.id)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export async function deleteSubRubro(db: Db, id: number): Promise<boolean> {
  const row = await getSubRubroById(db, id);
  if (!row) return false;
  const used = (await db
    .prepare("SELECT COUNT(*) AS n FROM PRESUPUESTO WHERE LOWER(sub_rubro) = LOWER(?)")
    .get(row.nombre)) as { n: number };
  if (used.n > 0) {
    throw new Error(
      `No se puede eliminar: hay ${used.n} gasto(s) con este sub-rubro. Desactivalo en su lugar.`
    );
  }
  await db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(id);
  return (await db.prepare("DELETE FROM SUB_RUBROS WHERE id = ?").run(id)).changes > 0;
}

export async function subRubroExistsActivo(db: Db, nombre: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(?) AND activo = 1")
    .get(nombre.trim());
  return !!row;
}
