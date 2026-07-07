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

export const HOME_LAYOUT_ROLES: Rol[] = ["editor", "gestor_n2", "consulta"];

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
    hint: "Ganado, ventas simuladas e ingresos por cobrar",
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
  if (user.rol === "admin" || user.es_super_admin) return true;
  const layout = user.home_paneles;
  if (!layout) return DEFAULT_HOME_LAYOUT[panelId];
  return layout[panelId] !== false;
}

export interface HomeLayoutRoleConfig {
  rol: Rol;
  rol_label: string;
  paneles: HomeLayoutMap;
}
