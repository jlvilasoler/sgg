import type { TabId } from "../components/Header";
import type { AuthUser, Modulo } from "../types";
import { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION } from "../types";

export { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION };

export const MODULO_LABELS: Record<Modulo, string> = {
  presupuesto: "Presupuesto y gastos",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador venta ganado",
  chat: "Chat interno",
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
  precios_ganado: "precios_ganado",
  simulador_venta_ganado: "simulador_venta_ganado",
  recursos_humanos: "rrhh",
  ingresos_ventas: "ventas",
  stock_ganadero: "stock",
  stock_movimientos: "usuarios",
  registro_actividad: "usuarios",
  usuarios: "usuarios",
  chat: "chat",
};

export function canAccessStockMovimientos(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function canAccessUsuarioActividad(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

/** Módulos visibles para cualquier usuario autenticado. */
const MODULOS_ACCESO_TODOS: Modulo[] = [
  "chat",
  "precios_ganado",
  "simulador_venta_ganado",
];

export function canAccessChat(user: AuthUser | null): boolean {
  return Boolean(user);
}

export function canAccessPreciosGanado(user: AuthUser | null): boolean {
  return Boolean(user);
}

export function canAccessSimuladorVentaGanado(user: AuthUser | null): boolean {
  return Boolean(user);
}

/** Simulador venta: todos los usuarios autenticados pueden crear y editar. */
export function canWriteSimuladorVentaGanado(user: AuthUser | null): boolean {
  return Boolean(user);
}

export function moduloForScreen(screen: TabId): Modulo {
  return SCREEN_MODULO[screen];
}

export function canAccessScreen(user: AuthUser | null, screen: TabId): boolean {
  if (!user) return false;
  const mod = moduloForScreen(screen);
  if (MODULOS_ACCESO_TODOS.includes(mod)) return true;
  return user.permisos.includes(mod);
}

export function canWrite(user: AuthUser | null): boolean {
  return Boolean(user?.puede_escribir);
}
