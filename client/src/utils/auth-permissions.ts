import type { TabId } from "../components/Header";
import type { AuthUser, Modulo } from "../types";
import { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION } from "../types";

export { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION };

export const MODULO_LABELS: Record<Modulo, string> = {
  presupuesto: "Presupuesto y gastos",
  configuracion: "Configuración",
  divisas: "Divisas",
  rrhh: "Recursos Humanos",
  ventas: "Ingresos por ventas",
  stock: "Stock ganadero",
  usuarios: "Usuarios y permisos",
};

const SCREEN_MODULO: Record<TabId, Modulo> = {
  registro: "presupuesto",
  listado: "presupuesto",
  resumen: "presupuesto",
  configuracion: "configuracion",
  divisas: "divisas",
  precios_ganado: "divisas",
  recursos_humanos: "rrhh",
  ingresos_ventas: "ventas",
  stock_ganadero: "stock",
  stock_movimientos: "usuarios",
  registro_actividad: "usuarios",
  usuarios: "usuarios",
  chat: "presupuesto",
};

export function canAccessStockMovimientos(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function canAccessUsuarioActividad(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function moduloForScreen(screen: TabId): Modulo {
  return SCREEN_MODULO[screen];
}

export function canAccessChat(user: AuthUser | null): boolean {
  return Boolean(user);
}

export function canAccessScreen(user: AuthUser | null, screen: TabId): boolean {
  if (!user) return false;
  if (screen === "chat") return canAccessChat(user);
  return user.permisos.includes(moduloForScreen(screen));
}

export function canWrite(user: AuthUser | null): boolean {
  return Boolean(user?.puede_escribir);
}
