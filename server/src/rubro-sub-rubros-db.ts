import type { Db } from "./db/pg-client.js";
import * as rub from "./rubros-db.js";
import * as sub from "./sub-rubros-db.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  GRUPO_ALAMBRADOS,
  GRUPO_A_RUBRO_DEFAULT,
  lookupGrupoARubroDefault,
  RUBRO_GRUPOS_ADICIONALES,
  RUBROS_POR_GRUPO,
  SUB_RUBROS_SEED,
} from "./sub-rubros-data.js";

const OTROS_GASTOS = "Otros gastos de funcionamiento";
const MIN_RELATED_LEN = 6;

function normalizeNombreKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Mismo rubro/grupo o variantes habituales (mayúsculas, «Construcciones y Reformas» ↔ «Construcción»). */
export function nombresRelacionados(a: string, b: string): boolean {
  const aa = a.trim();
  const bb = b.trim();
  if (!aa || !bb) return false;
  if (aa.localeCompare(bb, "es", { sensitivity: "accent" }) === 0) return true;

  const na = normalizeNombreKey(aa);
  const nb = normalizeNombreKey(bb);
  if (na === nb) return true;

  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length < MIN_RELATED_LEN) return false;
  if (long.startsWith(short)) return true;

  const stem = short.slice(0, Math.min(short.length, 12));
  if (stem.length >= MIN_RELATED_LEN && long.includes(stem)) return true;

  return false;
}

function sameNombre(a: string, b: string): boolean {
  return a.localeCompare(b, "es", { sensitivity: "accent" }) === 0;
}

async function listDistinctGrupos(db: Db): Promise<string[]> {
  return (
    (await db
      .prepare("SELECT DISTINCT grupo FROM SUB_RUBROS ORDER BY LOWER(grupo)")
      .all()) as { grupo: string }[]
  ).map((r) => r.grupo);
}

function gruposExplicitosParaRubro(rubroNombre: string): string[] {
  const out: string[] = [];
  for (const [rubro, grupos] of Object.entries(RUBRO_GRUPOS_ADICIONALES)) {
    if (sameNombre(rubro, rubroNombre)) {
      out.push(...grupos);
    }
  }
  for (const [rubro, grupos] of Object.entries(RUBRO_GRUPOS_ADICIONALES)) {
    for (const g of grupos) {
      if (sameNombre(g, rubroNombre)) out.push(rubro);
    }
  }
  return out;
}

/** Grupos de sub-rubro que pertenecen a un rubro contable (mapeo, BD y alias). */
async function gruposAsociadosAlRubro(db: Db, rubroNombre: string): Promise<string[]> {
  const set = new Set<string>();
  const r = rubroNombre.trim();
  if (!r) return [];

  set.add(r);
  for (const g of gruposExplicitosParaRubro(r)) {
    set.add(g);
  }

  for (const [grupo, rubro] of Object.entries(GRUPO_A_RUBRO_DEFAULT)) {
    if (sameNombre(rubro, r) || sameNombre(grupo, r)) {
      set.add(grupo);
    }
  }

  for (const grupo of await listDistinctGrupos(db)) {
    if (sameNombre(grupo, r) || nombresRelacionados(grupo, r)) {
      set.add(grupo);
    }
    const mapped = lookupGrupoARubroDefault(grupo);
    if (mapped && (sameNombre(mapped, r) || nombresRelacionados(mapped, r))) {
      set.add(grupo);
    }
  }

  return [...set];
}

/** Rubros contables que deben compartir los sub-rubros de un grupo. */
async function rubrosRelacionadosAlGrupo(db: Db, grupo: string): Promise<string[]> {
  const g = grupo.trim();
  if (!g) return [];

  const set = new Set<string>();
  const mapped = lookupGrupoARubroDefault(g);
  if (mapped) set.add(mapped);

  const direct = await rub.getRubroByNombre(db, g);
  if (direct) set.add(direct.nombre);

  for (const extra of gruposExplicitosParaRubro(g)) {
    const row = await rub.getRubroByNombre(db, extra);
    if (row) set.add(row.nombre);
    else set.add(extra);
  }

  for (const row of await rub.listRubros(db, false)) {
    if (sameNombre(row.nombre, g) || nombresRelacionados(row.nombre, g)) {
      set.add(row.nombre);
    }
    if (mapped && (sameNombre(row.nombre, mapped) || nombresRelacionados(row.nombre, mapped))) {
      set.add(row.nombre);
    }
  }

  return [...set];
}

async function migrateAlambradosRubroContable(_db: Db): Promise<void> {}

async function migrateRetireRubroConstruccion(_db: Db): Promise<void> {}

export async function initRubroSubRubrosTable(db: Db): Promise<void> {
  await rub.ensureRubrosNombres(db, [...RUBROS_POR_GRUPO, "Dividendos"]);
  await seedRubroSubRubrosIfEmpty(db);
  await migrateVinculosFueraDeOtros(db);
  await resyncAllVinculosPorGrupo(db);
}

/** Mueve sub-rubros que estaban mal colgados de «Otros gastos» a su rubro propio. */
export async function migrateVinculosFueraDeOtros(db: Db): Promise<void> {
  const otros = await rub.getRubroByNombre(db, OTROS_GASTOS);
  if (!otros) return;

  const rows = (await db
    .prepare(
      `SELECT s.id AS sub_id, s.grupo
       FROM SUB_RUBROS s
       INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id AND rsr.rubro_id = ?`
    )
    .all(otros.id)) as { sub_id: number; grupo: string }[];

  const delLink = await db.prepare(
    "DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ? AND sub_rubro_id = ?"
  );
  const insLink = await db.prepare(
    `INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)
     ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING`
  );

  for (const row of rows) {
    const destinos = (await rubrosRelacionadosAlGrupo(db, row.grupo)).filter(
      (n) => !sameNombre(n, OTROS_GASTOS)
    );
    if (destinos.length === 0) continue;

    await rub.ensureRubrosNombres(db, destinos);
    await delLink.run(otros.id, row.sub_id);
    for (const rubroNombre of destinos) {
      const rubroRow = await rub.getRubroByNombre(db, rubroNombre);
      if (rubroRow) await insLink.run(rubroRow.id, row.sub_id);
    }
  }
}

async function seedRubroSubRubrosIfEmpty(db: Db): Promise<void> {
  const { n } = (await db
    .prepare("SELECT COUNT(*) AS n FROM RUBRO_SUB_RUBROS")
    .get()) as { n: number };
  if (n > 0) return;

  const insert = await db.prepare(
    `INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)
     ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING`
  );

  for (const item of SUB_RUBROS_SEED) {
    const destinos = await rubrosRelacionadosAlGrupo(db, item.grupo);
    const subRow = await sub.getSubRubroByNombre(db, item.nombre);
    if (!subRow) continue;
    for (const rubroNombre of destinos) {
      const rubroRow = await rub.getRubroByNombre(db, rubroNombre);
      if (rubroRow) await insert.run(rubroRow.id, subRow.id);
    }
  }
}

export async function getSubRubroIdsForRubro(db: Db, rubroId: number): Promise<number[]> {
  const rows = (await db
    .prepare(
      `SELECT sub_rubro_id FROM RUBRO_SUB_RUBROS WHERE rubro_id = ? ORDER BY sub_rubro_id`
    )
    .all(rubroId)) as { sub_rubro_id: number }[];
  return rows.map((r) => r.sub_rubro_id);
}

export async function getSubRubroNombresForRubro(
  db: Db,
  rubroNombre: string,
  soloActivos = true
): Promise<string[]> {
  const r = rubroNombre.trim();
  if (!r) return [];

  const grupos = await gruposAsociadosAlRubro(db, r);
  const rubroRow = await rub.getRubroByNombre(db, r);

  const rows = (await db
    .prepare(
      soloActivos
        ? "SELECT nombre, grupo FROM SUB_RUBROS WHERE activo = 1"
        : "SELECT nombre, grupo FROM SUB_RUBROS"
    )
    .all()) as { nombre: string; grupo: string }[];

  const names = new Set<string>();
  for (const row of rows) {
    if (grupos.some((g) => sameNombre(g, row.grupo))) {
      names.add(row.nombre);
    }
  }

  if (rubroRow) {
    let linkQuery = `
      SELECT DISTINCT s.nombre FROM SUB_RUBROS s
      INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id
      WHERE rsr.rubro_id = ?
    `;
    if (soloActivos) linkQuery += " AND s.activo = 1";
    const linked = (await db.prepare(linkQuery).all(rubroRow.id)) as { nombre: string }[];
    for (const l of linked) names.add(l.nombre);
  }

  return [...names].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));
}

export async function rubroHasVinculos(db: Db, rubroNombre: string): Promise<boolean> {
  return (await getSubRubroNombresForRubro(db, rubroNombre, true)).length > 0;
}

export async function isSubRubroValidForRubro(
  db: Db,
  rubroNombre: string,
  subRubroNombre: string
): Promise<boolean> {
  if (!subRubroNombre.trim()) return true;
  const allowed = await getSubRubroNombresForRubro(db, rubroNombre, true);
  if (allowed.length === 0) return true;
  return allowed.some(
    (n) => n.localeCompare(subRubroNombre.trim(), "es", { sensitivity: "accent" }) === 0
  );
}

export interface RubroVinculoMapaItem {
  rubro_id: number;
  rubro: string;
  rubro_activo: number;
  sub_rubros: Array<{ nombre: string; grupo: string; activo: number }>;
}

export async function getMapaVinculosCompleto(db: Db): Promise<RubroVinculoMapaItem[]> {
  const rubrosList = await rub.listRubros(db, false);
  const out: RubroVinculoMapaItem[] = [];
  for (const row of rubrosList) {
    out.push({
      rubro_id: row.id,
      rubro: row.nombre,
      rubro_activo: row.activo,
      sub_rubros: (await getSubRubroNombresForRubro(db, row.nombre, false)).map((nombre) => {
        return { nombre, grupo: "", activo: 1 };
      }),
    });
    const last = out[out.length - 1];
    for (let i = 0; i < last.sub_rubros.length; i++) {
      const subRow = await sub.getSubRubroByNombre(db, last.sub_rubros[i].nombre);
      last.sub_rubros[i] = {
        nombre: last.sub_rubros[i].nombre,
        grupo: subRow?.grupo ?? "",
        activo: subRow?.activo ?? 1,
      };
    }
  }
  return out;
}

/**
 * Grupo de sub-rubro al crear uno nuevo desde un rubro contable del formulario de gastos.
 */
export async function resolveGrupoParaRubroContable(
  db: Db,
  rubroNombre: string
): Promise<string> {
  const r = rubroNombre.trim();
  if (!r) throw new Error("El rubro contable es obligatorio.");

  const rubroRow = await rub.getRubroByNombre(db, r);
  if (rubroRow) {
    const vinculado = (await db
      .prepare(
        `SELECT s.grupo, COUNT(*) AS c FROM SUB_RUBROS s
         INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id
         WHERE rsr.rubro_id = ?
         GROUP BY s.grupo ORDER BY c DESC LIMIT 1`
      )
      .get(rubroRow.id)) as { grupo: string } | undefined;
    if (vinculado?.grupo) return normalizarTituloRubro(vinculado.grupo);
  }

  const grupos = await gruposAsociadosAlRubro(db, r);

  for (const g of grupos) {
    const mapped = lookupGrupoARubroDefault(g);
    if (mapped && sameNombre(mapped, r)) {
      return normalizarTituloRubro(g);
    }
  }

  for (const g of grupos) {
    const { n } = (await db
      .prepare("SELECT COUNT(*) AS n FROM SUB_RUBROS WHERE LOWER(grupo) = LOWER(?)")
      .get(g)) as { n: number };
    if (n > 0) return normalizarTituloRubro(g);
  }

  for (const g of grupos) {
    if (sameNombre(g, r)) return normalizarTituloRubro(g);
  }

  return normalizarTituloRubro(r);
}

/** Rubro contable principal que corresponde al grupo del sub-rubro. */
export async function resolveRubroNombreForGrupo(
  db: Db,
  grupo: string
): Promise<string | null> {
  const g = grupo.trim();
  if (!g) return null;
  const mapped = lookupGrupoARubroDefault(g);
  if (mapped) return mapped;
  const direct = await rub.getRubroByNombre(db, g);
  if (direct) return direct.nombre;
  const relacionados = await rubrosRelacionadosAlGrupo(db, g);
  return relacionados[0] ?? null;
}

/** Vincula un sub-rubro a todos los rubros contables relacionados con su grupo. */
export async function syncVinculoSubRubroPorGrupo(
  db: Db,
  subRubroId: number,
  grupo: string
): Promise<void> {
  const destinos = await rubrosRelacionadosAlGrupo(db, grupo);
  if (destinos.length === 0) return;

  await rub.ensureRubrosNombres(db, destinos);
  await db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(subRubroId);
  const ins = await db.prepare(
    `INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)
     ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING`
  );
  for (const rubroNombre of destinos) {
    const rubroRow = await rub.getRubroByNombre(db, rubroNombre);
    if (rubroRow) await ins.run(rubroRow.id, subRubroId);
  }
}

/** Re-enlaza todos los sub-rubros según su grupo (arranque / corrección). */
export async function resyncAllVinculosPorGrupo(db: Db): Promise<void> {
  const rows = (await db
    .prepare("SELECT id, grupo FROM SUB_RUBROS")
    .all()) as { id: number; grupo: string }[];
  for (const row of rows) {
    await syncVinculoSubRubroPorGrupo(db, row.id, row.grupo);
  }
}

export async function getMapSubRubrosPorRubro(
  db: Db,
  soloActivos = true
): Promise<Record<string, string[]>> {
  const rubrosList = await rub.listRubros(db, soloActivos);
  const map: Record<string, string[]> = {};
  for (const r of rubrosList) {
    const subs = await getSubRubroNombresForRubro(db, r.nombre, soloActivos);
    if (subs.length > 0) {
      map[r.nombre] = subs;
    }
  }
  return map;
}

export async function setRubroSubRubros(
  db: Db,
  rubroId: number,
  subRubroIds: number[]
): Promise<void> {
  const rubroRow = await rub.getRubroById(db, rubroId);
  if (!rubroRow) throw new Error("Rubro no encontrado.");

  const unique = [...new Set(subRubroIds)];
  for (const sid of unique) {
    const subRow = await sub.getSubRubroById(db, sid);
    if (!subRow) throw new Error(`Sub-rubro id ${sid} no encontrado.`);
  }

  await db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?").run(rubroId);
    const ins = await tx.prepare(
      "INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
    );
    for (const sid of unique) {
      await ins.run(rubroId, sid);
    }
  });
}

export async function clearVinculosForSubRubro(db: Db, subRubroId: number): Promise<void> {
  await db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(subRubroId);
}
