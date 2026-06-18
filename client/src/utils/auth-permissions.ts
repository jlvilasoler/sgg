import type { TabId } from "../components/Header";
import type { AuthUser, Modulo, Rol } from "../types";

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Editor",
  consulta: "Consulta",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: "Acceso total al sistema (no editable)",
  editor: "Acceso y edición según sectores habilitados",
  consulta: "Solo lectura en los sectores habilitados",
};

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
  recursos_humanos: "rrhh",
  ingresos_ventas: "ventas",
  stock_ganadero: "stock",
  stock_movimientos: "usuarios",
  usuarios: "usuarios",
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

export function canAccessScreen(user: AuthUser | null, screen: TabId): boolean {
  if (!user) return false;
  return user.permisos.includes(moduloForScreen(screen));
}

export function canWrite(user: AuthUser | null): boolean {
  return Boolean(user?.puede_escribir);
}
