import type { Db } from "./db/pg-client.js";
import {
  appendGastosRubrosReadWhere,
  migrateAddCuentaIdColumnSagCatalog,
  migrateGastosRubrosUniqueIndexes,
  type GastosRubrosReadScope,
} from "./gastos-rubros-scope.js";
import {
  getRubroByNombre,
  insertRubro,
  rubroExistsActivo,
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
  cuenta_id?: number | null;
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
  await migrateAddCuentaIdColumnSagCatalog(db, "SUB_RUBROS");
  await migrateGastosRubrosUniqueIndexes(db);
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

export async function listSubRubros(
  db: Db,
  soloActivos = false,
  readScope?: GastosRubrosReadScope
): Promise<SubRubro[]> {
  let query = "SELECT * FROM SUB_RUBROS WHERE 1=1";
  const params: Record<string, string | number> = {};
  if (soloActivos) query += " AND activo = 1";
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
  }
  query += " ORDER BY LOWER(grupo) ASC, LOWER(nombre) ASC";
  return (await db.prepare(query).all(params)) as SubRubro[];
}

export async function listSubRubrosNombres(
  db: Db,
  readScope?: GastosRubrosReadScope
): Promise<string[]> {
  return (await listSubRubros(db, true, readScope)).map((r) => r.nombre);
}

export async function listSubRubrosGrupos(
  db: Db,
  readScope?: GastosRubrosReadScope
): Promise<string[]> {
  let query = "SELECT DISTINCT grupo FROM SUB_RUBROS WHERE 1=1";
  const params: Record<string, string | number> = {};
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
  }
  const fromDb = (await db.prepare(query).all(params)) as { grupo: string }[];
  const set = new Set<string>([...GRUPOS_SUB_RUBRO, ...fromDb.map((r) => r.grupo)]);
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

function grupoClaveOrden(grupo: string): string {
  if (esGrupoAlambradosLegacy(grupo)) return GRUPO_ALAMBRADOS.toLocaleLowerCase("es-UY");
  return grupo.trim().toLocaleLowerCase("es-UY");
}

function grupoTituloCanon(grupo: string): string {
  if (esGrupoAlambradosLegacy(grupo)) return GRUPO_ALAMBRADOS;
  return normalizarTituloRubro(grupo);
}

function esSubRubroActivo(activo: unknown): boolean {
  return activo === 1 || activo === true;
}

/** Grupos (rubros) y sub-rubros activos tal como en Configuración → Rubros. */
export async function getCatalogoGruposParaGastos(
  db: Db,
  readScope?: GastosRubrosReadScope
): Promise<{
  rubros: string[];
  sub_rubros_por_rubro: Record<string, string[]>;
}> {
  const all = await listSubRubros(db, false, readScope);
  if (all.length === 0) {
    return { rubros: [], sub_rubros_por_rubro: {} };
  }

  const buckets = new Map<string, { titulo: string; subs: string[] }>();
  for (const row of all) {
    const clave = grupoClaveOrden(row.grupo);
    const titulo = grupoTituloCanon(row.grupo);
    let bucket = buckets.get(clave);
    if (!bucket) {
      bucket = { titulo, subs: [] };
      buckets.set(clave, bucket);
    }
    if (!esSubRubroActivo(row.activo)) continue;
    if (
      !bucket.subs.some(
        (s) => s.localeCompare(row.nombre, "es", { sensitivity: "accent" }) === 0
      )
    ) {
      bucket.subs.push(row.nombre);
    }
  }

  let rubros = [...buckets.values()]
    .filter((b) => b.subs.length > 0)
    .map((b) => b.titulo)
    .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));

  // Si ningún sub-rubro está activo, mostrar igual los grupos del catálogo (como en Rubros).
  if (rubros.length === 0) {
    rubros = [...buckets.values()]
      .map((b) => b.titulo)
      .sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));
  }

  const sub_rubros_por_rubro: Record<string, string[]> = {};
  for (const b of buckets.values()) {
    sub_rubros_por_rubro[b.titulo] = b.subs.sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "accent" })
    );
  }

  return { rubros, sub_rubros_por_rubro };
}

/** Rubro válido al cargar gasto: grupo del catálogo o rubro contable legacy activo. */
export async function rubroGastoValido(
  db: Db,
  nombre: string,
  readScope?: GastosRubrosReadScope
): Promise<boolean> {
  const n = nombre.trim();
  if (!n) return false;
  const { rubros } = await getCatalogoGruposParaGastos(db, readScope);
  if (rubros.some((r) => r.localeCompare(n, "es", { sensitivity: "accent" }) === 0)) {
    return true;
  }
  return rubroExistsActivo(db, n, readScope?.cuentaId ?? null);
}

export async function getSubRubroById(db: Db, id: number): Promise<SubRubro | undefined> {
  return (await db.prepare("SELECT * FROM SUB_RUBROS WHERE id = ?").get(id)) as
    | SubRubro
    | undefined;
}

export async function getSubRubroByNombre(
  db: Db,
  nombre: string,
  readScope?: GastosRubrosReadScope
): Promise<SubRubro | undefined> {
  let query = "SELECT * FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre)";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
    query += " ORDER BY cuenta_id DESC NULLS LAST LIMIT 1";
    return (await db.prepare(query).get(params)) as SubRubro | undefined;
  }
  return (await db.prepare(query).get(params)) as SubRubro | undefined;
}

async function subRubroNombreEnConflicto(
  db: Db,
  nombre: string,
  cuentaId: number | null,
  excludeId?: number
): Promise<SubRubro | undefined> {
  let query =
    "SELECT * FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre)";
  const params: Record<string, string | number> = { nombre };
  if (cuentaId == null) {
    query += " AND cuenta_id IS NULL";
  } else {
    query += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    params.cuentaId = cuentaId;
  }
  const rows = (await db.prepare(query).all(params)) as SubRubro[];
  return rows.find((r) => r.id !== excludeId);
}

export async function insertSubRubro(
  db: Db,
  data: SubRubroInput,
  cuentaId: number | null = null
): Promise<number> {
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  if (await subRubroNombreEnConflicto(db, nombre, cuentaId)) {
    throw new Error("Ya existe un sub-rubro con ese nombre.");
  }
  const result = await db
    .prepare(
      `INSERT INTO SUB_RUBROS (nombre, grupo, activo, cuenta_id)
       VALUES (@nombre, @grupo, @activo, @cuenta_id)`
    )
    .run({
      nombre,
      grupo,
      activo: data.activo === false ? 0 : 1,
      cuenta_id: cuentaId,
    });
  return Number(result.lastInsertRowid);
}

export async function updateSubRubro(
  db: Db,
  id: number,
  data: SubRubroInput,
  cuentaId: number | null = null
): Promise<boolean> {
  const prev = await getSubRubroById(db, id);
  if (!prev) return false;
  const nombre = normalizarTituloRubro(data.nombre);
  const grupo = normalizarTituloRubro(data.grupo);
  if (!nombre) throw new Error("El nombre del sub-rubro es obligatorio.");
  if (!grupo) throw new Error("El grupo del sub-rubro es obligatorio.");
  const existing = await subRubroNombreEnConflicto(db, nombre, prev.cuenta_id ?? cuentaId, id);
  if (existing) {
    throw new Error("Ya existe otro sub-rubro con ese nombre.");
  }
  let query =
    "UPDATE SUB_RUBROS SET nombre = @nombre, grupo = @grupo, activo = @activo WHERE id = @id";
  const params: Record<string, string | number> = {
    id,
    nombre,
    grupo,
    activo: data.activo === false ? 0 : 1,
  };
  if (cuentaId != null) {
    query += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    params.cuentaId = cuentaId;
  } else if (prev.cuenta_id == null) {
    query += " AND cuenta_id IS NULL";
  }
  return (await db.prepare(query).run(params)).changes > 0;
}

export type DeleteGrupoResult = {
  deleted: number;
  blocked: Array<{ nombre: string; razon: string }>;
};

/** Renombra el rubro (grupo) y propaga el cambio a gastos y catálogo RUBROS. */
export async function renameSubRubroGrupo(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string,
  cuentaId: number | null = null,
  sagMode = false
): Promise<number> {
  const anterior = normalizarTituloRubro(grupoAnterior);
  const nuevo = normalizarTituloRubro(grupoNuevo);
  if (!anterior) throw new Error("El rubro actual no es válido.");
  if (!nuevo) throw new Error("El nuevo nombre del rubro es obligatorio.");
  if (anterior.localeCompare(nuevo, "es", { sensitivity: "accent" }) === 0) {
    return 0;
  }

  let conflictoQuery =
    "SELECT grupo FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(@nuevo)";
  const conflictoParams: Record<string, string | number> = { nuevo };
  if (!sagMode && cuentaId != null) {
    conflictoQuery += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    conflictoParams.cuentaId = cuentaId;
  } else if (!sagMode && cuentaId == null) {
    conflictoQuery += " AND cuenta_id IS NULL";
  }
  conflictoQuery += " LIMIT 1";
  const conflictoGrupo = (await db
    .prepare(conflictoQuery)
    .get(conflictoParams)) as { grupo: string } | undefined;
  if (
    conflictoGrupo &&
    conflictoGrupo.grupo.localeCompare(anterior, "es", { sensitivity: "accent" }) !== 0
  ) {
    throw new Error(`Ya existe el rubro «${conflictoGrupo.grupo}».`);
  }

  let countQuery =
    "SELECT COUNT(*) AS n FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(@anterior)";
  const countParams: Record<string, string | number> = { anterior };
  if (!sagMode && cuentaId != null) {
    countQuery += " AND cuenta_id = @cuentaId";
    countParams.cuentaId = cuentaId;
  } else if (!sagMode && cuentaId == null) {
    countQuery += " AND cuenta_id IS NULL";
  }
  const { n: cantSubs } = (await db.prepare(countQuery).get(countParams)) as { n: number };
  if (cantSubs === 0) {
    throw new Error(`No hay sub-rubros bajo «${anterior}».`);
  }

  const rubroOrigen = await getRubroByNombre(db, anterior, cuentaId);
  const rubroDestino = await getRubroByNombre(db, nuevo, cuentaId);
  if (rubroDestino && (!rubroOrigen || rubroDestino.id !== rubroOrigen.id)) {
    throw new Error("Ya existe otro rubro en el catálogo con ese nombre.");
  }

  return db.transaction(async (tx) => {
    let updQuery = `UPDATE SUB_RUBROS SET grupo = @nuevo
         WHERE LOWER(grupo) = LOWER(@anterior)`;
    const updParams: Record<string, string | number> = { anterior, nuevo };
    if (!sagMode && cuentaId != null) {
      updQuery += " AND cuenta_id = @cuentaId";
      updParams.cuentaId = cuentaId;
    } else if (!sagMode && cuentaId == null) {
      updQuery += " AND cuenta_id IS NULL";
    }
    const upd = await tx.prepare(updQuery).run(updParams);

    await tx.prepare(
      `UPDATE PRESUPUESTO SET rubro = @nuevo
       WHERE LOWER(rubro) = LOWER(@anterior)`
    ).run({ anterior, nuevo });

    if (rubroOrigen) {
      await updateRubro(tx, rubroOrigen.id, {
        nombre: nuevo,
        activo: rubroOrigen.activo !== 0,
      }, cuentaId);
    } else if (!rubroDestino) {
      try {
        await insertRubro(tx, { nombre: nuevo, activo: true }, cuentaId);
      } catch (e) {
        if (!(await getRubroByNombre(tx, nuevo, cuentaId))) throw e;
      }
    }

    return upd.changes;
  });
}

export async function deleteSubRubrosByGrupo(
  db: Db,
  grupo: string,
  cuentaId: number | null = null,
  sagMode = false
): Promise<DeleteGrupoResult> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  let query = "SELECT id, nombre FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(@grupo)";
  const params: Record<string, string | number> = { grupo: g };
  if (!sagMode && cuentaId != null) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  } else if (!sagMode && cuentaId == null) {
    query += " AND cuenta_id IS NULL";
  }
  const rows = (await db.prepare(query).all(params)) as { id: number; nombre: string }[];
  const blocked: DeleteGrupoResult["blocked"] = [];
  let deleted = 0;
  for (const row of rows) {
    try {
      if (await deleteSubRubro(db, row.id, cuentaId, sagMode)) deleted++;
    } catch (e) {
      blocked.push({ nombre: row.nombre, razon: (e as Error).message });
    }
  }
  return { deleted, blocked };
}

export async function deleteSubRubro(
  db: Db,
  id: number,
  cuentaId: number | null = null,
  sagMode = false
): Promise<boolean> {
  const row = await getSubRubroById(db, id);
  if (!row) return false;
  if (!sagMode && row.cuenta_id == null) {
    throw new Error("Solo el superadministrador puede eliminar rubros del catálogo base SAG");
  }
  if (!sagMode && cuentaId != null && row.cuenta_id != null && row.cuenta_id !== cuentaId) {
    throw new Error("No tenés permiso para eliminar rubros de otra cuenta");
  }
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

export async function subRubroExistsActivo(
  db: Db,
  nombre: string,
  readScope?: GastosRubrosReadScope
): Promise<boolean> {
  let query =
    "SELECT 1 FROM SUB_RUBROS WHERE LOWER(nombre) = LOWER(@nombre) AND activo = 1";
  const params: Record<string, string | number> = { nombre: nombre.trim() };
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
  }
  const row = await db.prepare(query).get(params);
  return !!row;
}
