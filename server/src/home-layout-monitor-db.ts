import * as auth from "./auth-db.js";
import type { Db } from "./db/pg-client.js";
import * as homeLayoutDb from "./home-layout-db.js";
import type { HomeLayoutMap, HomePanelId } from "./home-layout-db.js";

const PANEL_META: { id: HomePanelId; label: string; zone: "top" | "main" | "side" }[] = [
  { id: "kpis_operativos", label: "KPIs operativos", zone: "top" },
  { id: "kpis_gastos", label: "KPIs de gastos", zone: "top" },
  { id: "pizarron", label: "Pizarrón de notas", zone: "main" },
  { id: "auto_pendientes", label: "Pagos pendientes", zone: "main" },
  { id: "actividad", label: "Últimos guardados", zone: "main" },
  { id: "mapa_campo", label: "Mapa de potreros", zone: "side" },
  { id: "vencimientos", label: "Próximos vencimientos", zone: "side" },
  { id: "stock_potrero", label: "Animales por potrero", zone: "side" },
  { id: "modulos_rapidos", label: "Módulos rápidos", zone: "side" },
];

export interface HomeLayoutMonitorUsuarioResumen {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  rol_label: string;
  activo: boolean;
  es_admin_cuenta: boolean;
  es_super_admin: boolean;
  cuenta_id: number | null;
  cuenta_nombre: string | null;
  cuenta_codigo: string | null;
  paneles_visibles: number;
  paneles_total: number;
  tiene_personalizacion: boolean;
  ultimo_acceso: string | null;
}

export interface HomeLayoutMonitorPanelDetalle {
  id: HomePanelId;
  label: string;
  zone: "top" | "main" | "side";
  visible_efectivo: boolean;
  visible_rol: boolean;
  visible_usuario: boolean | null;
  personalizado: boolean;
  fuente: "rol" | "usuario" | "bloqueado_rol";
}

export interface HomeLayoutMonitorUsuarioDetalle extends HomeLayoutMonitorUsuarioResumen {
  ceiling: HomeLayoutMap;
  overrides: HomeLayoutMap;
  efectivo: HomeLayoutMap;
  orden: HomePanelId[];
  orden_rol: HomePanelId[];
  orden_personalizado: boolean;
  paneles: HomeLayoutMonitorPanelDetalle[];
}

export interface HomeLayoutMonitorSnapshot {
  generado_en: string;
  usuarios: HomeLayoutMonitorUsuarioResumen[];
  totales: {
    usuarios: number;
    usuarios_activos: number;
    con_personalizacion: number;
  };
}

async function userHasHomeLayoutRows(db: Db, userId: number): Promise<boolean> {
  const row = (await db
    .prepare("SELECT COUNT(*)::int AS n FROM USER_HOME_LAYOUT WHERE user_id = ?")
    .get(userId)) as { n: number };
  return Number(row.n) > 0;
}

function ordersDiffer(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return true;
  return a.some((id, index) => id !== b[index]);
}

function buildPanelDetalle(
  ceiling: HomeLayoutMap,
  overrides: HomeLayoutMap,
  efectivo: HomeLayoutMap,
  rawOverrides: Partial<HomeLayoutMap>,
): HomeLayoutMonitorPanelDetalle[] {
  return PANEL_META.map((meta) => {
    const visibleRol = ceiling[meta.id];
    const hasUserOverride = typeof rawOverrides[meta.id] === "boolean";
    const visibleUsuario = hasUserOverride ? rawOverrides[meta.id]! : null;
    const visibleEfectivo = efectivo[meta.id];
    const personalizado = hasUserOverride && visibleUsuario !== visibleRol;

    let fuente: HomeLayoutMonitorPanelDetalle["fuente"] = "rol";
    if (!visibleRol) fuente = "bloqueado_rol";
    else if (personalizado) fuente = "usuario";

    return {
      id: meta.id,
      label: meta.label,
      zone: meta.zone,
      visible_efectivo: visibleEfectivo,
      visible_rol: visibleRol,
      visible_usuario: visibleUsuario,
      personalizado,
      fuente,
    };
  });
}

async function buildUsuarioResumen(
  db: Db,
  user: auth.UserPublic,
): Promise<HomeLayoutMonitorUsuarioResumen> {
  const efectivo = await homeLayoutDb.getEffectiveHomeLayoutForUser(db, user.id, user.rol);
  const visible = homeLayoutDb.HOME_PANEL_IDS.filter((id) => efectivo[id]).length;
  const hasRows = await userHasHomeLayoutRows(db, user.id);
  const ordenUsuario = await homeLayoutDb.getUserHomeLayoutOrder(db, user.id, user.rol);
  const ordenRol = await homeLayoutDb.getHomeLayoutOrderForRole(db, user.rol);
  const tienePersonalizacion = hasRows || ordersDiffer(ordenUsuario, ordenRol);

  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    rol_label: user.rol_label,
    activo: user.activo,
    es_admin_cuenta: user.es_admin_cuenta,
    es_super_admin: user.es_super_admin,
    cuenta_id: user.empresa_id,
    cuenta_nombre: user.empresa_nombre,
    cuenta_codigo: user.empresa_codigo,
    paneles_visibles: visible,
    paneles_total: homeLayoutDb.HOME_PANEL_IDS.length,
    tiene_personalizacion: tienePersonalizacion,
    ultimo_acceso: user.ultimo_acceso,
  };
}

export async function getHomeLayoutMonitorSnapshot(db: Db): Promise<HomeLayoutMonitorSnapshot> {
  const users = await auth.listUsers(db);
  const resumenes: HomeLayoutMonitorUsuarioResumen[] = [];
  for (const user of users) {
    resumenes.push(await buildUsuarioResumen(db, user));
  }

  return {
    generado_en: new Date().toISOString(),
    usuarios: resumenes,
    totales: {
      usuarios: resumenes.length,
      usuarios_activos: resumenes.filter((u) => u.activo).length,
      con_personalizacion: resumenes.filter((u) => u.tiene_personalizacion).length,
    },
  };
}

export async function getHomeLayoutMonitorUsuario(
  db: Db,
  userId: number,
): Promise<HomeLayoutMonitorUsuarioDetalle | null> {
  const user = await auth.getUserById(db, userId);
  if (!user) return null;

  const config = await homeLayoutDb.getUserHomeLayoutConfig(db, user.id, user.rol);
  const rawOverrides = await homeLayoutDb.getUserHomeLayoutOverrides(db, user.id);
  const efectivo = await homeLayoutDb.getEffectiveHomeLayoutForUser(db, user.id, user.rol);
  const ordenRol = await homeLayoutDb.getHomeLayoutOrderForRole(db, user.rol);
  const hasRows = await userHasHomeLayoutRows(db, user.id);
  const resumen = await buildUsuarioResumen(db, user);

  return {
    ...resumen,
    ceiling: config.ceiling,
    overrides: config.overrides,
    efectivo,
    orden: config.orden,
    orden_rol: ordenRol,
    orden_personalizado: hasRows && ordersDiffer(config.orden, ordenRol),
    paneles: buildPanelDetalle(config.ceiling, config.overrides, efectivo, rawOverrides),
  };
}
