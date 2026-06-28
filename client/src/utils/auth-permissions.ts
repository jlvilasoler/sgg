import type { TabId } from "../components/Header";
import type { AuthUser, Modulo } from "../types";
import { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION } from "../types";

export { ROL_LABELS, ROL_LABELS_DETALLE, ROL_DESCRIPCION };

export const MODULO_LABELS: Record<Modulo, string> = {
  presupuesto: "Presupuesto y gastos",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador de Ventas",
  chat: "Chat interno",
  rrhh: "Recursos Humanos",
  ventas: "Ingresos por ventas",
  stock: "Stock ganadero",
  usuarios: "Administración de Usuarios",
  documentos_digitales: "Documentos Digitales",
};

/** Módulos reservados al administrador (no configurables por rol). */
export const MODULOS_SOLO_ADMIN: Modulo[] = ["usuarios", "documentos_digitales"];

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
  panel_admin_sitio: "usuarios",
  chat: "chat",
  documentos_digitales: "documentos_digitales",
};

export function canAccessStockMovimientos(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function canAccessUsuarioActividad(user: AuthUser | null): boolean {
  return Boolean(user);
}

/** Admin de cuenta o super-admin: puede filtrar actividad por usuario. */
export function canFiltrarActividadPorUsuario(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

/** Admin de cuenta o super-admin: ve usuarios en línea de su ámbito. */
export function canVerUsuariosOnlineActividad(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function canAccessArquitecturaSistema(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin") return false;
  return user.es_super_admin ?? user.empresa_id == null;
}

/** Permisos globales por rol: solo el super-administrador de plataforma (SCG_ADMIN_EMAIL). */
export function canAccessPermisosPorRol(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Documentos Digitales (configuración): solo super-administrador de plataforma. */
export function canAccessDocumentosDigitales(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Módulos visibles para cualquier usuario autenticado. */
const MODULOS_ACCESO_TODOS: Modulo[] = ["chat"];

export function canWriteModulo(user: AuthUser | null, modulo: Modulo): boolean {
  if (!user?.puede_escribir) return false;
  if (user.modulos_solo_lectura?.includes(modulo)) return false;
  return true;
}

export function canAccessChat(user: AuthUser | null): boolean {
  return Boolean(user);
}

export function canAccessPreciosGanado(user: AuthUser | null): boolean {
  return Boolean(user?.permisos.includes("precios_ganado"));
}

export function canAccessSimuladorVentaGanado(user: AuthUser | null): boolean {
  return Boolean(user?.permisos.includes("simulador_venta_ganado"));
}

/** Simulador venta: escritura según permisos del rol. */
export function canWriteSimuladorVentaGanado(user: AuthUser | null): boolean {
  return canWriteModulo(user, "simulador_venta_ganado");
}

/** Ingresos por ventas: escritura según permisos del rol. */
export function canWriteIngresosVentas(user: AuthUser | null): boolean {
  return canWriteModulo(user, "ventas");
}

export function moduloForScreen(screen: TabId): Modulo {
  return SCREEN_MODULO[screen];
}

export function canAccessScreen(user: AuthUser | null, screen: TabId): boolean {
  if (!user) return false;
  if (screen === "registro_actividad") return true;
  if (screen === "documentos_digitales") return canAccessDocumentosDigitales(user);
  if (screen === "panel_admin_sitio") return canAccessArquitecturaSistema(user);
  const mod = moduloForScreen(screen);
  if (MODULOS_SOLO_ADMIN.includes(mod)) return user.rol === "admin";
  if (MODULOS_ACCESO_TODOS.includes(mod)) return true;
  return user.permisos.includes(mod);
}

export function canWrite(user: AuthUser | null): boolean {
  return Boolean(user?.puede_escribir);
}
