import type { AuthUser, Rol } from "../types";
import { ROL_LABELS_DETALLE } from "../types";

/** Bloques configurables del dashboard Inicio. */
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

export const HOME_LAYOUT_ROLES = ["admin", "editor", "gestor_n2", "consulta"] as const;

export type HomeLayoutConfigurableRol = (typeof HOME_LAYOUT_ROLES)[number];

export function isHomeLayoutConfigurableRol(rol: Rol): rol is HomeLayoutConfigurableRol {
  return (HOME_LAYOUT_ROLES as readonly Rol[]).includes(rol);
}

export interface HomePanelMeta {
  id: HomePanelId;
  label: string;
  kicker: string;
  hint: string;
  zone: "top" | "main" | "side";
}

export const HOME_PANEL_META: HomePanelMeta[] = [
  {
    id: "kpis_operativos",
    kicker: "Indicadores",
    label: "KPIs operativos",
    hint: "Ganado, ventas del ejercicio e ingresos por cobrar",
    zone: "top",
  },
  {
    id: "kpis_gastos",
    kicker: "Presupuesto",
    label: "KPIs de gastos",
    hint: "Gastos del mes y del ejercicio",
    zone: "top",
  },
  {
    id: "pizarron",
    kicker: "Recordatorios",
    label: "Pizarrón de notas",
    hint: "Notas fijadas y recientes",
    zone: "main",
  },
  {
    id: "auto_pendientes",
    kicker: "Automatización",
    label: "Pagos pendientes",
    hint: "Aprobación de gastos automáticos",
    zone: "main",
  },
  {
    id: "actividad",
    kicker: "Actividad",
    label: "Últimos guardados",
    hint: "Movimientos recientes del equipo o propios",
    zone: "main",
  },
  {
    id: "mapa_campo",
    kicker: "Campo",
    label: "Mapa de potreros",
    hint: "Vista previa del mapa ganadero",
    zone: "side",
  },
  {
    id: "vencimientos",
    kicker: "Tributario",
    label: "Próximos vencimientos",
    hint: "Calendario de impuestos",
    zone: "side",
  },
  {
    id: "stock_potrero",
    kicker: "Stock",
    label: "Animales por potrero",
    hint: "Resumen ganadero y dotación",
    zone: "side",
  },
  {
    id: "modulos_rapidos",
    kicker: "Accesos",
    label: "Módulos rápidos",
    hint: "Atajos según perfil y uso reciente",
    zone: "side",
  },
];

export const DEFAULT_HOME_LAYOUT: HomeLayoutMap = {
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

export const DEFAULT_HOME_PANEL_ORDER: HomePanelId[] = [...HOME_PANEL_IDS];

export function homePanelZone(id: HomePanelId): HomePanelMeta["zone"] {
  return HOME_PANEL_META.find((p) => p.id === id)?.zone ?? "main";
}

export function normalizeHomePanelOrder(
  input: readonly string[] | null | undefined,
): HomePanelId[] {
  const seen = new Set<HomePanelId>();
  const order: HomePanelId[] = [];
  for (const raw of input ?? []) {
    if (!(HOME_PANEL_IDS as readonly string[]).includes(raw)) continue;
    const id = raw as HomePanelId;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const id of HOME_PANEL_IDS) {
    if (!seen.has(id)) order.push(id);
  }
  return order;
}

export function orderPanelsInZone(
  order: readonly HomePanelId[],
  zone: HomePanelMeta["zone"],
): HomePanelId[] {
  return order.filter((id) => homePanelZone(id) === zone);
}

export function moveHomePanelInOrder(
  order: readonly HomePanelId[],
  draggedId: HomePanelId,
  targetId: HomePanelId,
): HomePanelId[] {
  if (draggedId === targetId) return [...order];
  const zone = homePanelZone(draggedId);
  if (homePanelZone(targetId) !== zone) return [...order];

  const zoneIds = orderPanelsInZone(order, zone);
  const from = zoneIds.indexOf(draggedId);
  const to = zoneIds.indexOf(targetId);
  if (from < 0 || to < 0) return [...order];

  const nextZone = [...zoneIds];
  nextZone.splice(from, 1);
  nextZone.splice(to, 0, draggedId);

  const zoneSet = new Set(zoneIds);
  const next: HomePanelId[] = [];
  let zoneIdx = 0;
  for (const id of order) {
    if (zoneSet.has(id)) {
      next.push(nextZone[zoneIdx]!);
      zoneIdx += 1;
    } else {
      next.push(id);
    }
  }
  return next;
}

export function homeLayoutAllVisible(): HomeLayoutMap {
  return { ...DEFAULT_HOME_LAYOUT };
}

export function normalizeHomeLayoutMap(
  input: Partial<Record<string, boolean>> | null | undefined,
): HomeLayoutMap {
  const base = { ...DEFAULT_HOME_LAYOUT };
  if (!input) return base;
  for (const id of HOME_PANEL_IDS) {
    if (typeof input[id] === "boolean") base[id] = input[id]!;
  }
  return base;
}

export function rolHomeLayoutLabel(rol: Rol): string {
  return ROL_LABELS_DETALLE[rol] ?? rol;
}

export function canShowHomePanel(
  user: AuthUser | null | undefined,
  panelId: HomePanelId,
): boolean {
  if (!user) return false;
  const layout = user.home_paneles;
  if (!layout) {
    // Fallback solo cuando el servidor no envió el layout efectivo.
    if (user.rol === "admin" || user.es_super_admin) return true;
    return DEFAULT_HOME_LAYOUT[panelId];
  }
  return layout[panelId] !== false;
}

export interface HomeLayoutRoleConfig {
  rol: HomeLayoutConfigurableRol;
  rol_label: string;
  paneles: HomeLayoutMap;
  orden: HomePanelId[];
}

/** Configuración personal del inicio para el usuario logueado. */
export interface MyHomeLayoutConfig {
  rol: Rol;
  rol_label: string;
  /** Techo permitido por el rol (definido por el superadministrador). */
  ceiling: HomeLayoutMap;
  /** Preferencia personal por bloque (solo aplica donde el techo lo permite). */
  overrides: HomeLayoutMap;
  /** Orden de bloques en el dashboard (por zona: KPIs, columna principal, lateral). */
  orden: HomePanelId[];
}
