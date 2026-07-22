import type { Db } from "./db/pg-client.js";
import type { Rol } from "./auth-db.js";

export const HOME_PANEL_IDS = [
  "kpis_operativos",
  "kpis_gastos",
  "pizarron",
  "auto_pendientes",
  "actividad",
  "mapa_campo",
  "vencimientos",
  "stock_potrero",
  "stock_equino_potrero",
  "modulos_rapidos",
] as const;

export type HomePanelId = (typeof HOME_PANEL_IDS)[number];
export type HomeLayoutMap = Record<HomePanelId, boolean>;

export const HOME_LAYOUT_ROLES: Rol[] = ["admin", "editor", "gestor_n2", "consulta"];

const DEFAULT_HOME_LAYOUT: HomeLayoutMap = {
  kpis_operativos: true,
  kpis_gastos: true,
  pizarron: true,
  auto_pendientes: true,
  actividad: true,
  mapa_campo: true,
  vencimientos: true,
  stock_potrero: true,
  stock_equino_potrero: true,
  modulos_rapidos: true,
};

const DEFAULT_HOME_PANEL_ORDER: HomePanelId[] = [...HOME_PANEL_IDS];

function homePanelZone(id: HomePanelId): "top" | "main" | "side" {
  if (id === "kpis_operativos" || id === "kpis_gastos") return "top";
  if (id === "pizarron" || id === "auto_pendientes" || id === "actividad") return "main";
  return "side";
}

export function normalizeHomePanelOrder(
  input: readonly string[] | null | undefined,
): HomePanelId[] {
  const seen = new Set<HomePanelId>();
  const order: HomePanelId[] = [];
  for (const raw of input ?? []) {
    if (!isHomePanelId(raw)) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    order.push(raw);
  }
  for (const id of HOME_PANEL_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

function orderPanelsInZone(
  order: readonly HomePanelId[],
  zone: "top" | "main" | "side",
): HomePanelId[] {
  return order.filter((id) => homePanelZone(id) === zone);
}

async function migrateHomeLayoutSortOrderColumn(db: Db, table: string): Promise<void> {
  try {
    await db.prepare(`ALTER TABLE ${table} ADD COLUMN sort_order INTEGER`).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }
}

async function backfillHomeLayoutSortOrder(db: Db, table: string): Promise<void> {
  const defaultIndex = new Map(HOME_PANEL_IDS.map((id, index) => [id, index]));
  const rows = (await db
    .prepare(`SELECT panel_id, sort_order FROM ${table}`)
    .all()) as { panel_id: string; sort_order: number | null }[];

  const upd = await db.prepare(
    `UPDATE ${table} SET sort_order = ? WHERE panel_id = ? AND sort_order IS NULL`,
  );
  for (const row of rows) {
    if (!isHomePanelId(row.panel_id)) continue;
    if (row.sort_order != null) continue;
    await upd.run(defaultIndex.get(row.panel_id) ?? 0, row.panel_id);
  }
}

const ROL_LABELS_DETALLE: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Gestor N1",
  gestor_n2: "Gestor N2",
  consulta: "Consulta (Lector)",
};

function pgNum(v: unknown): number {
  return Number(v) || 0;
}

function isHomePanelId(value: string): value is HomePanelId {
  return (HOME_PANEL_IDS as readonly string[]).includes(value);
}

export function normalizeHomeLayoutMap(
  input: Partial<Record<string, boolean>> | null | undefined,
): HomeLayoutMap {
  const base: HomeLayoutMap = { ...DEFAULT_HOME_LAYOUT };
  if (!input) return base;
  for (const id of HOME_PANEL_IDS) {
    if (typeof input[id] === "boolean") base[id] = input[id]!;
  }
  return base;
}

export async function initHomeLayoutTable(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ROLE_HOME_LAYOUT (
        rol TEXT NOT NULL CHECK (rol IN ('admin', 'editor', 'gestor_n2', 'consulta')),
        panel_id TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER,
        actualizado_en TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (rol, panel_id)
      )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS USER_HOME_LAYOUT (
        user_id INTEGER NOT NULL,
        panel_id TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER,
        actualizado_en TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, panel_id)
      )`,
    )
    .run();

  await migrateHomeLayoutSortOrderColumn(db, "ROLE_HOME_LAYOUT");
  await migrateHomeLayoutSortOrderColumn(db, "USER_HOME_LAYOUT");
  await migrateRoleHomeLayoutAllowAdmin(db);

  await seedHomeLayoutIfEmpty(db);
  await ensureHomeLayoutRolesSeeded(db);
  await backfillHomeLayoutSortOrder(db, "ROLE_HOME_LAYOUT");
  await backfillHomeLayoutSortOrder(db, "USER_HOME_LAYOUT");
}

/** Amplía el CHECK de roles para incluir Administrador en bases ya creadas. */
async function migrateRoleHomeLayoutAllowAdmin(db: Db): Promise<void> {
  try {
    const constraints = (await db
      .prepare(
        `SELECT c.conname AS name
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         WHERE t.relname = 'role_home_layout' AND c.contype = 'c'`,
      )
      .all()) as { name: string }[];
    for (const row of constraints) {
      if (!row?.name) continue;
      try {
        await db.prepare(`ALTER TABLE ROLE_HOME_LAYOUT DROP CONSTRAINT IF EXISTS ${row.name}`).run();
      } catch {
        /* ignore */
      }
    }
  } catch {
    for (const name of ["role_home_layout_rol_check", "ROLE_HOME_LAYOUT_rol_check"]) {
      try {
        await db.prepare(`ALTER TABLE ROLE_HOME_LAYOUT DROP CONSTRAINT IF EXISTS ${name}`).run();
      } catch {
        /* ignore */
      }
    }
  }
  try {
    await db
      .prepare(
        `ALTER TABLE ROLE_HOME_LAYOUT
         ADD CONSTRAINT role_home_layout_rol_check
         CHECK (rol IN ('admin', 'editor', 'gestor_n2', 'consulta'))`,
      )
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate/i.test(msg)) {
      console.warn("[SGG] migrateRoleHomeLayoutAllowAdmin:", msg);
    }
  }
}

async function seedHomeLayoutIfEmpty(db: Db): Promise<void> {
  const count = (await db
    .prepare("SELECT COUNT(*)::int AS n FROM ROLE_HOME_LAYOUT")
    .get()) as { n: number };
  if (pgNum(count.n) > 0) return;

  const ins = await db.prepare(
    "INSERT INTO ROLE_HOME_LAYOUT (rol, panel_id, visible, sort_order) VALUES (?, ?, ?, ?)",
  );
  for (const rol of HOME_LAYOUT_ROLES) {
    for (let i = 0; i < HOME_PANEL_IDS.length; i++) {
      const panelId = HOME_PANEL_IDS[i]!;
      await ins.run(rol, panelId, DEFAULT_HOME_LAYOUT[panelId] ? 1 : 0, i);
    }
  }
}

/** Asegura filas de layout para roles nuevos (p. ej. admin) en DBs ya sembradas. */
async function ensureHomeLayoutRolesSeeded(db: Db): Promise<void> {
  const ins = await db.prepare(
    `INSERT INTO ROLE_HOME_LAYOUT (rol, panel_id, visible, sort_order)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (rol, panel_id) DO NOTHING`,
  );
  for (const rol of HOME_LAYOUT_ROLES) {
    for (let i = 0; i < HOME_PANEL_IDS.length; i++) {
      const panelId = HOME_PANEL_IDS[i]!;
      await ins.run(rol, panelId, DEFAULT_HOME_LAYOUT[panelId] ? 1 : 0, i);
    }
  }
}

export async function getHomeLayoutOrderForRole(db: Db, rol: Rol): Promise<HomePanelId[]> {
  const rows = (await db
    .prepare(
      "SELECT panel_id, sort_order FROM ROLE_HOME_LAYOUT WHERE rol = ? ORDER BY sort_order ASC NULLS LAST, panel_id ASC",
    )
    .all(rol)) as { panel_id: string; sort_order: number | null }[];

  if (rows.length === 0) return [...DEFAULT_HOME_PANEL_ORDER];

  const ordered = rows
    .filter((row) => isHomePanelId(row.panel_id))
    .sort((a, b) => {
      const ao = a.sort_order ?? DEFAULT_HOME_PANEL_ORDER.indexOf(a.panel_id as HomePanelId);
      const bo = b.sort_order ?? DEFAULT_HOME_PANEL_ORDER.indexOf(b.panel_id as HomePanelId);
      return ao - bo;
    })
    .map((row) => row.panel_id as HomePanelId);

  return normalizeHomePanelOrder(ordered);
}

/** Orden personal del usuario; si no hay filas guardadas, hereda el del rol. */
export async function getUserHomeLayoutOrder(
  db: Db,
  userId: number,
  rol: Rol,
): Promise<HomePanelId[]> {
  const rows = (await db
    .prepare(
      "SELECT panel_id, sort_order FROM USER_HOME_LAYOUT WHERE user_id = ? ORDER BY sort_order ASC NULLS LAST, panel_id ASC",
    )
    .all(userId)) as { panel_id: string; sort_order: number | null }[];

  if (rows.length === 0) return getHomeLayoutOrderForRole(db, rol);

  const ordered = rows
    .filter((row) => isHomePanelId(row.panel_id))
    .sort((a, b) => {
      const ao = a.sort_order ?? DEFAULT_HOME_PANEL_ORDER.indexOf(a.panel_id as HomePanelId);
      const bo = b.sort_order ?? DEFAULT_HOME_PANEL_ORDER.indexOf(b.panel_id as HomePanelId);
      return ao - bo;
    })
    .map((row) => row.panel_id as HomePanelId);

  return normalizeHomePanelOrder(ordered);
}

export async function getEffectiveHomeLayoutOrderForUser(
  db: Db,
  userId: number,
  rol: Rol,
): Promise<HomePanelId[]> {
  return getUserHomeLayoutOrder(db, userId, rol);
}

export async function getHomeLayoutForRole(db: Db, rol: Rol): Promise<HomeLayoutMap> {
  const rows = (await db
    .prepare(
      "SELECT panel_id, visible FROM ROLE_HOME_LAYOUT WHERE rol = ?",
    )
    .all(rol)) as { panel_id: string; visible: number }[];

  if (rows.length === 0) return { ...DEFAULT_HOME_LAYOUT };

  const map = { ...DEFAULT_HOME_LAYOUT };
  for (const row of rows) {
    if (isHomePanelId(row.panel_id)) {
      map[row.panel_id] = pgNum(row.visible) === 1;
    }
  }
  return map;
}

/** Preferencias personales del usuario (solo pueden ocultar bloques permitidos por su rol). */
export async function getUserHomeLayoutOverrides(
  db: Db,
  userId: number,
): Promise<Partial<HomeLayoutMap>> {
  const rows = (await db
    .prepare("SELECT panel_id, visible FROM USER_HOME_LAYOUT WHERE user_id = ?")
    .all(userId)) as { panel_id: string; visible: number }[];

  const overrides: Partial<HomeLayoutMap> = {};
  for (const row of rows) {
    if (isHomePanelId(row.panel_id)) {
      overrides[row.panel_id] = pgNum(row.visible) === 1;
    }
  }
  return overrides;
}

/**
 * Layout efectivo de un usuario: intersección del techo del rol (Configuración SAG)
 * con las preferencias personales. El usuario solo puede ocultar, nunca revelar
 * un bloque deshabilitado por el superadministrador.
 */
export async function getEffectiveHomeLayoutForUser(
  db: Db,
  userId: number,
  rol: Rol,
): Promise<HomeLayoutMap> {
  const ceiling = await getHomeLayoutForRole(db, rol);
  const overrides = await getUserHomeLayoutOverrides(db, userId);
  const effective = { ...ceiling };
  for (const id of HOME_PANEL_IDS) {
    if (!ceiling[id]) {
      effective[id] = false;
      continue;
    }
    if (typeof overrides[id] === "boolean") {
      effective[id] = overrides[id]!;
    }
  }
  return effective;
}

export interface UserHomeLayoutConfig {
  rol: Rol;
  rol_label: string;
  /** Techo permitido por el rol (Configuración SAG). */
  ceiling: HomeLayoutMap;
  /** Preferencia personal por bloque (solo aplica donde ceiling es true). */
  overrides: HomeLayoutMap;
  orden: HomePanelId[];
}

export async function getUserHomeLayoutConfig(
  db: Db,
  userId: number,
  rol: Rol,
): Promise<UserHomeLayoutConfig> {
  const ceiling = await getHomeLayoutForRole(db, rol);
  const rawOverrides = await getUserHomeLayoutOverrides(db, userId);
  const overrides = { ...ceiling };
  for (const id of HOME_PANEL_IDS) {
    if (typeof rawOverrides[id] === "boolean") overrides[id] = rawOverrides[id]!;
  }
  const orden = await getUserHomeLayoutOrder(db, userId, rol);
  return {
    rol,
    rol_label: ROL_LABELS_DETALLE[rol],
    ceiling,
    overrides,
    orden,
  };
}

export async function updateUserHomeLayout(
  db: Db,
  userId: number,
  rol: Rol,
  paneles: Partial<Record<string, boolean>>,
  orden?: readonly string[] | null,
): Promise<UserHomeLayoutConfig> {
  const ceiling = await getHomeLayoutForRole(db, rol);
  const normalized = normalizeHomeLayoutMap(paneles);
  const order = normalizeHomePanelOrder(orden ?? (await getUserHomeLayoutOrder(db, userId, rol)));

  const upsert = await db.prepare(
    `INSERT INTO USER_HOME_LAYOUT (user_id, panel_id, visible, sort_order, actualizado_en)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (user_id, panel_id) DO UPDATE SET
       visible = EXCLUDED.visible,
       sort_order = EXCLUDED.sort_order,
       actualizado_en = NOW()`,
  );

  for (const panelId of HOME_PANEL_IDS) {
    const visible = ceiling[panelId] ? normalized[panelId] : false;
    const sortOrder = order.indexOf(panelId);
    await upsert.run(userId, panelId, visible ? 1 : 0, sortOrder >= 0 ? sortOrder : 0);
  }

  return getUserHomeLayoutConfig(db, userId, rol);
}

export interface HomeLayoutRoleConfig {
  rol: Rol;
  rol_label: string;
  paneles: HomeLayoutMap;
  orden: HomePanelId[];
}

export async function listHomeLayoutConfig(db: Db): Promise<HomeLayoutRoleConfig[]> {
  const result: HomeLayoutRoleConfig[] = [];
  for (const rol of HOME_LAYOUT_ROLES) {
    result.push({
      rol,
      rol_label: ROL_LABELS_DETALLE[rol],
      paneles: await getHomeLayoutForRole(db, rol),
      orden: await getHomeLayoutOrderForRole(db, rol),
    });
  }
  return result;
}

export async function updateHomeLayoutForRole(
  db: Db,
  rol: Rol,
  paneles: Partial<Record<string, boolean>>,
  orden?: readonly string[] | null,
): Promise<HomeLayoutRoleConfig> {
  if (!HOME_LAYOUT_ROLES.includes(rol)) {
    throw new Error(
      "Solo se puede configurar el inicio de Administrador, Gestor N1, Gestor N2 y Consulta.",
    );
  }

  const normalized = normalizeHomeLayoutMap(paneles);
  const order = normalizeHomePanelOrder(orden ?? (await getHomeLayoutOrderForRole(db, rol)));
  const upsert = await db.prepare(
    `INSERT INTO ROLE_HOME_LAYOUT (rol, panel_id, visible, sort_order, actualizado_en)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (rol, panel_id) DO UPDATE SET
       visible = EXCLUDED.visible,
       sort_order = EXCLUDED.sort_order,
       actualizado_en = NOW()`,
  );

  for (const panelId of HOME_PANEL_IDS) {
    const sortOrder = order.indexOf(panelId);
    await upsert.run(rol, panelId, normalized[panelId] ? 1 : 0, sortOrder >= 0 ? sortOrder : 0);
  }

  return {
    rol,
    rol_label: ROL_LABELS_DETALLE[rol],
    paneles: normalized,
    orden: order,
  };
}
