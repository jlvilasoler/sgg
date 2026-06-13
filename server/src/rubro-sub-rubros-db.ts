import type Database from "better-sqlite3";
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

function listDistinctGrupos(db: Database.Database): string[] {
  return (
    db
      .prepare("SELECT DISTINCT grupo FROM SUB_RUBROS ORDER BY grupo COLLATE NOCASE")
      .all() as { grupo: string }[]
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
function gruposAsociadosAlRubro(db: Database.Database, rubroNombre: string): string[] {
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

  for (const grupo of listDistinctGrupos(db)) {
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
function rubrosRelacionadosAlGrupo(db: Database.Database, grupo: string): string[] {
  const g = grupo.trim();
  if (!g) return [];

  const set = new Set<string>();
  const mapped = lookupGrupoARubroDefault(g);
  if (mapped) set.add(mapped);

  const direct = rub.getRubroByNombre(db, g);
  if (direct) set.add(direct.nombre);

  for (const extra of gruposExplicitosParaRubro(g)) {
    const row = rub.getRubroByNombre(db, extra);
    if (row) set.add(row.nombre);
    else set.add(extra);
  }

  for (const row of rub.listRubros(db, false)) {
    if (sameNombre(row.nombre, g) || nombresRelacionados(row.nombre, g)) {
      set.add(row.nombre);
    }
    if (mapped && (sameNombre(row.nombre, mapped) || nombresRelacionados(row.nombre, mapped))) {
      set.add(row.nombre);
    }
  }

  return [...set];
}

function ensureRubrosFromSubRubroGrupos(db: Database.Database): void {
  const nombres = new Set<string>();
  for (const grupo of listDistinctGrupos(db)) {
    const mapped = lookupGrupoARubroDefault(grupo);
    nombres.add(mapped ?? grupo);
    for (const r of rubrosRelacionadosAlGrupo(db, grupo)) {
      if (!sameNombre(r, "Construcción")) nombres.add(r);
    }
  }
  rub.ensureRubrosNombres(db, [...nombres]);
}

/** Unifica rubro contable y gastos: solo «Alambrados» en el selector. */
function migrateAlambradosRubroContable(db: Database.Database): void {
  const viejoNombre = "Alambrados y cerramientos";
  db.prepare(
    `UPDATE PRESUPUESTO SET rubro = @canon
     WHERE rubro = @viejo COLLATE NOCASE
        OR lower(trim(rubro)) LIKE 'alambrados y cerr%'`
  ).run({ canon: GRUPO_ALAMBRADOS, viejo: viejoNombre });

  rub.ensureRubrosNombres(db, [GRUPO_ALAMBRADOS]);
  const viejo = rub.getRubroByNombre(db, viejoNombre);
  const canon = rub.getRubroByNombre(db, GRUPO_ALAMBRADOS);
  if (!viejo) return;

  if (canon && canon.id !== viejo.id) {
    const links = db
      .prepare("SELECT sub_rubro_id FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?")
      .all(viejo.id) as { sub_rubro_id: number }[];
    const ins = db.prepare(
      "INSERT OR IGNORE INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
    );
    for (const { sub_rubro_id } of links) {
      ins.run(canon.id, sub_rubro_id);
    }
    db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?").run(viejo.id);
    db.prepare("UPDATE RUBROS SET activo = 0 WHERE id = ?").run(viejo.id);
  } else {
    db.prepare("UPDATE RUBROS SET nombre = ? WHERE id = ?").run(GRUPO_ALAMBRADOS, viejo.id);
  }
}

/** «Construcción» duplicaba «Construcciones y Reformas» en el selector de rubros. */
function migrateRetireRubroConstruccion(db: Database.Database): void {
  const viejo = rub.getRubroByNombre(db, "Construcción");
  if (!viejo) return;

  rub.ensureRubrosNombres(db, ["Construcciones y Reformas"]);
  const nuevo = rub.getRubroByNombre(db, "Construcciones y Reformas");
  if (nuevo) {
    const links = db
      .prepare("SELECT sub_rubro_id FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?")
      .all(viejo.id) as { sub_rubro_id: number }[];
    const ins = db.prepare(
      "INSERT OR IGNORE INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
    );
    for (const { sub_rubro_id } of links) {
      ins.run(nuevo.id, sub_rubro_id);
    }
    db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?").run(viejo.id);
  }

  db.prepare(
    `UPDATE PRESUPUESTO SET rubro = 'Construcciones y Reformas'
     WHERE rubro = 'Construcción' COLLATE NOCASE`
  ).run();
  db.prepare("UPDATE RUBROS SET activo = 0 WHERE id = ?").run(viejo.id);
}

export function initRubroSubRubrosTable(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS RUBRO_SUB_RUBROS (
      rubro_id INTEGER NOT NULL,
      sub_rubro_id INTEGER NOT NULL,
      PRIMARY KEY (rubro_id, sub_rubro_id),
      FOREIGN KEY (rubro_id) REFERENCES RUBROS(id) ON DELETE CASCADE,
      FOREIGN KEY (sub_rubro_id) REFERENCES SUB_RUBROS(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_rsr_rubro ON RUBRO_SUB_RUBROS(rubro_id);
    CREATE INDEX IF NOT EXISTS idx_rsr_sub ON RUBRO_SUB_RUBROS(sub_rubro_id);
  `);
  rub.ensureRubrosNombres(db, [...RUBROS_POR_GRUPO, "Dividendos"]);
  migrateAlambradosRubroContable(db);
  migrateRetireRubroConstruccion(db);
  ensureRubrosFromSubRubroGrupos(db);
  seedRubroSubRubrosIfEmpty(db);
  migrateVinculosFueraDeOtros(db);
  resyncAllVinculosPorGrupo(db);
}

/** Mueve sub-rubros que estaban mal colgados de «Otros gastos» a su rubro propio. */
export function migrateVinculosFueraDeOtros(db: Database.Database): void {
  const otros = rub.getRubroByNombre(db, OTROS_GASTOS);
  if (!otros) return;

  const rows = db
    .prepare(
      `SELECT s.id AS sub_id, s.grupo
       FROM SUB_RUBROS s
       INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id AND rsr.rubro_id = ?`
    )
    .all(otros.id) as { sub_id: number; grupo: string }[];

  const delLink = db.prepare(
    "DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ? AND sub_rubro_id = ?"
  );
  const insLink = db.prepare(
    "INSERT OR IGNORE INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
  );

  for (const row of rows) {
    const destinos = rubrosRelacionadosAlGrupo(db, row.grupo).filter(
      (n) => !sameNombre(n, OTROS_GASTOS)
    );
    if (destinos.length === 0) continue;

    rub.ensureRubrosNombres(db, destinos);
    delLink.run(otros.id, row.sub_id);
    for (const rubroNombre of destinos) {
      const rubroRow = rub.getRubroByNombre(db, rubroNombre);
      if (rubroRow) insLink.run(rubroRow.id, row.sub_id);
    }
  }
}

function seedRubroSubRubrosIfEmpty(db: Database.Database): void {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM RUBRO_SUB_RUBROS")
    .get() as { n: number };
  if (n > 0) return;

  const insert = db.prepare(
    "INSERT OR IGNORE INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
  );

  for (const item of SUB_RUBROS_SEED) {
    const destinos = rubrosRelacionadosAlGrupo(db, item.grupo);
    const subRow = sub.getSubRubroByNombre(db, item.nombre);
    if (!subRow) continue;
    for (const rubroNombre of destinos) {
      const rubroRow = rub.getRubroByNombre(db, rubroNombre);
      if (rubroRow) insert.run(rubroRow.id, subRow.id);
    }
  }
}

export function getSubRubroIdsForRubro(
  db: Database.Database,
  rubroId: number
): number[] {
  const rows = db
    .prepare(
      `SELECT sub_rubro_id FROM RUBRO_SUB_RUBROS WHERE rubro_id = ? ORDER BY sub_rubro_id`
    )
    .all(rubroId) as { sub_rubro_id: number }[];
  return rows.map((r) => r.sub_rubro_id);
}

export function getSubRubroNombresForRubro(
  db: Database.Database,
  rubroNombre: string,
  soloActivos = true
): string[] {
  const r = rubroNombre.trim();
  if (!r) return [];

  const grupos = gruposAsociadosAlRubro(db, r);
  const rubroRow = rub.getRubroByNombre(db, r);

  const rows = db
    .prepare(
      soloActivos
        ? "SELECT nombre, grupo FROM SUB_RUBROS WHERE activo = 1"
        : "SELECT nombre, grupo FROM SUB_RUBROS"
    )
    .all() as { nombre: string; grupo: string }[];

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
    const linked = db.prepare(linkQuery).all(rubroRow.id) as { nombre: string }[];
    for (const l of linked) names.add(l.nombre);
  }

  return [...names].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "accent" }));
}

export function rubroHasVinculos(db: Database.Database, rubroNombre: string): boolean {
  return getSubRubroNombresForRubro(db, rubroNombre, true).length > 0;
}

export function isSubRubroValidForRubro(
  db: Database.Database,
  rubroNombre: string,
  subRubroNombre: string
): boolean {
  if (!subRubroNombre.trim()) return true;
  const allowed = getSubRubroNombresForRubro(db, rubroNombre, true);
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

export function getMapaVinculosCompleto(db: Database.Database): RubroVinculoMapaItem[] {
  const rubrosList = rub.listRubros(db, false);
  return rubrosList.map((row) => ({
    rubro_id: row.id,
    rubro: row.nombre,
    rubro_activo: row.activo,
    sub_rubros: getSubRubroNombresForRubro(db, row.nombre, false).map((nombre) => {
      const subRow = sub.getSubRubroByNombre(db, nombre);
      return {
        nombre,
        grupo: subRow?.grupo ?? "",
        activo: subRow?.activo ?? 1,
      };
    }),
  }));
}

/**
 * Grupo de sub-rubro al crear uno nuevo desde un rubro contable del formulario de gastos.
 * Prioriza el grupo de sub-rubros ya vinculados al rubro; si no hay, usa el mapeo catálogo ↔ rubro.
 */
export function resolveGrupoParaRubroContable(
  db: Database.Database,
  rubroNombre: string
): string {
  const r = rubroNombre.trim();
  if (!r) throw new Error("El rubro contable es obligatorio.");

  const rubroRow = rub.getRubroByNombre(db, r);
  if (rubroRow) {
    const vinculado = db
      .prepare(
        `SELECT s.grupo, COUNT(*) AS c FROM SUB_RUBROS s
         INNER JOIN RUBRO_SUB_RUBROS rsr ON rsr.sub_rubro_id = s.id
         WHERE rsr.rubro_id = ?
         GROUP BY s.grupo ORDER BY c DESC LIMIT 1`
      )
      .get(rubroRow.id) as { grupo: string } | undefined;
    if (vinculado?.grupo) return normalizarTituloRubro(vinculado.grupo);
  }

  const grupos = gruposAsociadosAlRubro(db, r);

  for (const g of grupos) {
    const mapped = lookupGrupoARubroDefault(g);
    if (mapped && sameNombre(mapped, r)) {
      return normalizarTituloRubro(g);
    }
  }

  for (const g of grupos) {
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM SUB_RUBROS WHERE grupo = ? COLLATE NOCASE")
      .get(g) as { n: number };
    if (n > 0) return normalizarTituloRubro(g);
  }

  for (const g of grupos) {
    if (sameNombre(g, r)) return normalizarTituloRubro(g);
  }

  return normalizarTituloRubro(r);
}

/** Rubro contable principal que corresponde al grupo del sub-rubro. */
export function resolveRubroNombreForGrupo(
  db: Database.Database,
  grupo: string
): string | null {
  const g = grupo.trim();
  if (!g) return null;
  const mapped = lookupGrupoARubroDefault(g);
  if (mapped) return mapped;
  const direct = rub.getRubroByNombre(db, g);
  if (direct) return direct.nombre;
  const relacionados = rubrosRelacionadosAlGrupo(db, g);
  return relacionados[0] ?? null;
}

/** Todos los rubros contables que deben recibir vínculo para este grupo. */
function rubrosDestinoParaGrupo(db: Database.Database, grupo: string): string[] {
  return rubrosRelacionadosAlGrupo(db, grupo);
}

/** Vincula un sub-rubro a todos los rubros contables relacionados con su grupo. */
export function syncVinculoSubRubroPorGrupo(
  db: Database.Database,
  subRubroId: number,
  grupo: string
): void {
  const destinos = rubrosDestinoParaGrupo(db, grupo);
  if (destinos.length === 0) return;

  rub.ensureRubrosNombres(db, destinos);
  db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(subRubroId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
  );
  for (const rubroNombre of destinos) {
    const rubroRow = rub.getRubroByNombre(db, rubroNombre);
    if (rubroRow) ins.run(rubroRow.id, subRubroId);
  }
}

/** Re-enlaza todos los sub-rubros según su grupo (arranque / corrección). */
export function resyncAllVinculosPorGrupo(db: Database.Database): void {
  const rows = db
    .prepare("SELECT id, grupo FROM SUB_RUBROS")
    .all() as { id: number; grupo: string }[];
  for (const row of rows) {
    syncVinculoSubRubroPorGrupo(db, row.id, row.grupo);
  }
}

export function getMapSubRubrosPorRubro(
  db: Database.Database,
  soloActivos = true
): Record<string, string[]> {
  const rubrosList = rub.listRubros(db, soloActivos);
  const map: Record<string, string[]> = {};
  for (const r of rubrosList) {
    const subs = getSubRubroNombresForRubro(db, r.nombre, soloActivos);
    if (subs.length > 0) {
      map[r.nombre] = subs;
    }
  }
  return map;
}

export function setRubroSubRubros(
  db: Database.Database,
  rubroId: number,
  subRubroIds: number[]
): void {
  const rubroRow = rub.getRubroById(db, rubroId);
  if (!rubroRow) throw new Error("Rubro no encontrado.");

  const unique = [...new Set(subRubroIds)];
  for (const sid of unique) {
    const subRow = sub.getSubRubroById(db, sid);
    if (!subRow) throw new Error(`Sub-rubro id ${sid} no encontrado.`);
  }

  const tx = db.transaction((ids: number[]) => {
    db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE rubro_id = ?").run(rubroId);
    const ins = db.prepare(
      "INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)"
    );
    for (const sid of ids) {
      ins.run(rubroId, sid);
    }
  });
  tx(unique);
}

export function clearVinculosForSubRubro(db: Database.Database, subRubroId: number): void {
  db.prepare("DELETE FROM RUBRO_SUB_RUBROS WHERE sub_rubro_id = ?").run(subRubroId);
}
