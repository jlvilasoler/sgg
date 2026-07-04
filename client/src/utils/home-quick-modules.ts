import type { TabId } from "../components/Header";
import type { MenuApp } from "../components/HomeMenu";
import type { AuthActividadLog, AuthUser, Modulo } from "../types";
import { canAccessScreen } from "./auth-permissions";

const RECENT_STORAGE_KEY = "scg:home-recent-modules";
const MAX_RECENT_STORED = 16;
export const HOME_QUICK_MODULES_MAX = 5;

const PROFILE_MODULO_ORDER: Modulo[] = [
  "presupuesto",
  "ventas",
  "stock",
  "rrhh",
  "configuracion",
  "divisas",
  "precios_ganado",
  "simulador_venta_ganado",
  "chat",
  "usuarios",
  "documentos_digitales",
];

const MODULO_MENU_SCREENS: Record<Modulo, TabId[]> = {
  presupuesto: ["registro", "vencimientos_impuestos"],
  configuracion: ["configuracion"],
  divisas: ["divisas"],
  precios_ganado: ["precios_ganado"],
  simulador_venta_ganado: ["ingresos_ventas"],
  chat: ["chat", "notas"],
  rrhh: ["recursos_humanos"],
  ventas: ["ingresos_ventas"],
  stock: ["stock_ganadero", "stock_equino"],
  usuarios: ["registro_actividad"],
  documentos_digitales: [],
};

/** Etiquetas de actividad del servidor → pantalla del menú principal. */
const NAV_LABEL_TO_SCREEN: Record<string, TabId> = {
  home: "registro",
  registro: "registro",
  listado: "registro",
  resumen: "registro",
  configuracion: "configuracion",
  divisas: "divisas",
  precios_ganado: "precios_ganado",
  simulador_venta_ganado: "ingresos_ventas",
  recursos_humanos: "recursos_humanos",
  ingresos_ventas: "ingresos_ventas",
  stock_ganadero: "stock_ganadero",
  stock_equino: "stock_equino",
  registro_actividad: "registro_actividad",
  chat: "chat",
  notas: "notas",
  vencimientos_impuestos: "vencimientos_impuestos",
  "Menú principal": "registro",
  "Ingresar gasto": "registro",
  "Presupuesto / listado de gastos": "registro",
  Resumen: "registro",
  Configuración: "configuracion",
  Divisas: "divisas",
  "Precios de Ganado": "precios_ganado",
  "Simulador venta ganado": "ingresos_ventas",
  "Recursos Humanos": "recursos_humanos",
  "Ingresos por ventas": "ingresos_ventas",
  "Stock Ganadero": "stock_ganadero",
  "Stock Equino": "stock_equino",
  "Registro de actividad": "registro_actividad",
  "Chat interno": "chat",
  Notas: "notas",
  "Vencimientos Impuestos": "vencimientos_impuestos",
};

const MENU_SCREEN_IDS = new Set<TabId>([
  "registro",
  "vencimientos_impuestos",
  "configuracion",
  "divisas",
  "precios_ganado",
  "ingresos_ventas",
  "recursos_humanos",
  "stock_ganadero",
  "stock_equino",
  "registro_actividad",
  "notas",
  "chat",
]);

function recentStorageKey(userId: number): string {
  return `${RECENT_STORAGE_KEY}:${userId}`;
}

function normalizeMenuScreen(raw: string): TabId | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "home") return null;
  if (MENU_SCREEN_IDS.has(trimmed as TabId)) return trimmed as TabId;
  return NAV_LABEL_TO_SCREEN[trimmed] ?? null;
}

export function pushRecentHomeModule(userId: number, pantalla: string): void {
  const screen = normalizeMenuScreen(pantalla);
  if (!screen || userId <= 0) return;
  try {
    const raw = localStorage.getItem(recentStorageKey(userId));
    const prev = raw ? (JSON.parse(raw) as TabId[]) : [];
    const next = [screen, ...prev.filter((id) => id !== screen)].slice(0, MAX_RECENT_STORED);
    localStorage.setItem(recentStorageKey(userId), JSON.stringify(next));
  } catch {
    /* quota / modo privado */
  }
}

export function getRecentHomeModules(userId: number): TabId[] {
  if (userId <= 0) return [];
  try {
    const raw = localStorage.getItem(recentStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TabId[];
    return parsed.filter((id) => MENU_SCREEN_IDS.has(id));
  } catch {
    return [];
  }
}

export function clearHomeRecentModulesCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${RECENT_STORAGE_KEY}:`)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* noop */
  }
}

export function screenFromActividadDetalle(detalle: string | null): TabId | null {
  if (!detalle?.trim()) return null;
  const legacy = detalle.match(/^Accedió a:\s*(.+)$/i);
  const visita = detalle.match(/^Visitó el módulo «(.+)»$/i);
  const abrio = detalle.match(/^Abrió la pantalla «(.+)»$/i);
  const label = (legacy?.[1] ?? visita?.[1] ?? abrio?.[1] ?? detalle).trim();
  return normalizeMenuScreen(label);
}

export function parseRecentScreensFromActividad(items: AuthActividadLog[]): TabId[] {
  const out: TabId[] = [];
  for (const item of items) {
    const screen = screenFromActividadDetalle(item.detalle);
    if (!screen || out.includes(screen)) continue;
    out.push(screen);
  }
  return out;
}

export function mergeRecentModuleLists(...lists: TabId[][]): TabId[] {
  const out: TabId[] = [];
  for (const list of lists) {
    for (const id of list) {
      if (!MENU_SCREEN_IDS.has(id) || out.includes(id)) continue;
      out.push(id);
    }
  }
  return out;
}

/** Pantallas representativas de los módulos habilitados en el perfil. */
export function screensDelPerfil(user: AuthUser): TabId[] {
  const ids: TabId[] = [];
  const push = (id: TabId) => {
    if (ids.includes(id)) return;
    if (!canAccessScreen(user, id)) return;
    ids.push(id);
  };

  for (const mod of PROFILE_MODULO_ORDER) {
    if (!user.permisos.includes(mod)) continue;
    for (const screen of MODULO_MENU_SCREENS[mod]) push(screen);
  }

  push("notas");
  push("registro_actividad");
  push("chat");

  return ids;
}

export function buildHomeQuickApps(
  allApps: MenuApp[],
  user: AuthUser,
  recentIds: TabId[],
  maxItems = HOME_QUICK_MODULES_MAX,
): MenuApp[] {
  const appById = new Map(allApps.map((app) => [app.id, app]));
  const ordered: TabId[] = [];

  const push = (id: TabId) => {
    if (ordered.includes(id)) return;
    if (!appById.has(id)) return;
    if (!canAccessScreen(user, id)) return;
    ordered.push(id);
  };

  for (const id of recentIds) push(id);
  for (const id of screensDelPerfil(user)) push(id);
  for (const app of allApps) push(app.id);

  return ordered.slice(0, maxItems).map((id) => appById.get(id)!);
}
