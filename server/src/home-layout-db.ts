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
  "modulos_rapidos",
] as const;

export type HomePanelId = (typeof HOME_PANEL_IDS)[number];
export type HomeLayoutMap = Record<HomePanelId, boolean>;

export const HOME_LAYOUT_ROLES: Rol[] = ["editor", "gestor_n2", "consulta"];

const DEFAULT_HOME_LAYOUT: HomeLayoutMap = {
  kpis_operativos: true,
  kpis_gastos: true,
  pizarron: true,
  auto_pendientes: true,
  actividad: true,
  mapa_campo: true,
  vencimientos: true,
  stock_potrero: true,
  modulos_rapidos: true,
};

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
        rol TEXT NOT NULL CHECK (rol IN ('editor', 'gestor_n2', 'consulta')),
        panel_id TEXT NOT NULL,
        visible INTEGER NOT NULL DEFAULT 1,
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
        actualizado_en TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, panel_id)
      )`,
    )
    .run();

  await seedHomeLayoutIfEmpty(db);
}

async function seedHomeLayoutIfEmpty(db: Db): Promise<void> {
  const count = (await db
    .prepare("SELECT COUNT(*)::int AS n FROM ROLE_HOME_LAYOUT")
    .get()) as { n: number };
  if (pgNum(count.n) > 0) return;

  const ins = await db.prepare(
    "INSERT INTO ROLE_HOME_LAYOUT (rol, panel_id, visible) VALUES (?, ?, ?)",
  );
  for (const rol of HOME_LAYOUT_ROLES) {
    for (const panelId of HOME_PANEL_IDS) {
      await ins.run(rol, panelId, DEFAULT_HOME_LAYOUT[panelId] ? 1 : 0);
    }
  }
}

export async function getHomeLayoutForRole(db: Db, rol: Rol): Promise<HomeLayoutMap> {
  if (rol === "admin") return { ...DEFAULT_HOME_LAYOUT };

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
  return {
    rol,
    rol_label: ROL_LABELS_DETALLE[rol],
    ceiling,
    overrides,
  };
}

export async function updateUserHomeLayout(
  db: Db,
  userId: number,
  rol: Rol,
  paneles: Partial<Record<string, boolean>>,
): Promise<UserHomeLayoutConfig> {
  const ceiling = await getHomeLayoutForRole(db, rol);
  const normalized = normalizeHomeLayoutMap(paneles);

  const upsert = await db.prepare(
    `INSERT INTO USER_HOME_LAYOUT (user_id, panel_id, visible, actualizado_en)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT (user_id, panel_id) DO UPDATE SET
       visible = EXCLUDED.visible,
       actualizado_en = NOW()`,
  );

  for (const panelId of HOME_PANEL_IDS) {
    // Nunca guardamos "visible" en un bloque que el rol tiene deshabilitado.
    const visible = ceiling[panelId] ? normalized[panelId] : false;
    await upsert.run(userId, panelId, visible ? 1 : 0);
  }

  return getUserHomeLayoutConfig(db, userId, rol);
}

export interface HomeLayoutRoleConfig {
  rol: Rol;
  rol_label: string;
  paneles: HomeLayoutMap;
}

export async function listHomeLayoutConfig(db: Db): Promise<HomeLayoutRoleConfig[]> {
  const result: HomeLayoutRoleConfig[] = [];
  for (const rol of HOME_LAYOUT_ROLES) {
    result.push({
      rol,
      rol_label: ROL_LABELS_DETALLE[rol],
      paneles: await getHomeLayoutForRole(db, rol),
    });
  }
  return result;
}

export async function updateHomeLayoutForRole(
  db: Db,
  rol: Rol,
  paneles: Partial<Record<string, boolean>>,
): Promise<HomeLayoutRoleConfig> {
  if (!HOME_LAYOUT_ROLES.includes(rol)) {
    throw new Error("Solo se puede configurar el inicio de Gestor N1, Gestor N2 y Consulta.");
  }

  const normalized = normalizeHomeLayoutMap(paneles);
  const upsert = await db.prepare(
    `INSERT INTO ROLE_HOME_LAYOUT (rol, panel_id, visible, actualizado_en)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT (rol, panel_id) DO UPDATE SET
       visible = EXCLUDED.visible,
       actualizado_en = NOW()`,
  );

  for (const panelId of HOME_PANEL_IDS) {
    await upsert.run(rol, panelId, normalized[panelId] ? 1 : 0);
  }

  return {
    rol,
    rol_label: ROL_LABELS_DETALLE[rol],
    paneles: normalized,
  };
}
