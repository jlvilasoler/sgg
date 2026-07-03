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
  vencimientos_impuestos: "presupuesto",
  resumen: "presupuesto",
  configuracion: "configuracion",
  divisas: "divisas",
  precios_ganado: "precios_ganado",
  simulador_venta_ganado: "simulador_venta_ganado",
  recursos_humanos: "rrhh",
  ingresos_ventas: "ventas",
  stock_ganadero: "stock",
  stock_equino: "stock",
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
  return (
    canAccessActividadSagTotal(user) ||
    canAccessActividadCuenta(user) ||
    canAccessActividadPropia(user)
  );
}

/** Superadministrador de plataforma (SCG_ADMIN_EMAIL): actividad global de todas las cuentas. */
export function canAccessActividadSagTotal(user: AuthUser | null): boolean {
  return Boolean(user?.es_admin_plataforma);
}

/** Administrador de cuenta: actividad de su equipo (Gestores, Lectores, etc.). */
export function canAccessActividadCuenta(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin") return false;
  if (user.es_super_admin) return Boolean(user.cuenta_actividad_id);
  return user.empresa_id != null || Boolean(user.cuenta_actividad_id);
}

/** Gestor, Consulta, Lector, etc.: solo su propia actividad. */
export function canAccessActividadPropia(user: AuthUser | null): boolean {
  return Boolean(user && user.rol !== "admin");
}

export type ActividadVistaModo = "total" | "cuenta" | "propio";

/** Vista por defecto si se abre actividad fuera del hub de Usuarios. */
export function actividadModoPorDefecto(user: AuthUser | null): ActividadVistaModo {
  if (canAccessActividadCuenta(user)) return "cuenta";
  return "propio";
}

export function actividadTituloPorModo(
  user: AuthUser | null,
  modo: ActividadVistaModo
): { titulo: string; subtituloAmbito: string } {
  const cuenta =
    user?.cuenta_actividad_nombre?.trim() ||
    user?.empresa_nombre?.trim() ||
    "Cuenta";
  if (modo === "total") {
    return {
      titulo: "Registro de actividad SAG total",
      subtituloAmbito: "Todas las cuentas y usuarios de la plataforma",
    };
  }
  if (modo === "cuenta") {
    return {
      titulo: `Actividad de cuenta ${cuenta}`,
      subtituloAmbito: `Usuarios y actividad de ${cuenta}`,
    };
  }
  return {
    titulo: "Mi registro de actividad",
    subtituloAmbito: "Su historial personal en la aplicación",
  };
}

/** Admin de cuenta o super-admin en vista total/cuenta: puede filtrar por usuario. */
export function canFiltrarActividadPorUsuario(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

/** Admin de cuenta o super-admin en vista total/cuenta: ve usuarios en línea de su ámbito. */
export function canVerUsuariosOnlineActividad(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export function canAccessArquitecturaSistema(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin") return false;
  return user.es_super_admin ?? user.empresa_id == null;
}

/** Panel en Configuración: administrador de su propia cuenta (no super-admin). */
export function canAccessAdministradorCuentas(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin" || user.es_super_admin) return false;
  return user.empresa_id != null;
}

/** Alta, edición y baja de usuarios del equipo: solo el admin designado de la cuenta. */
export function canManageUsuariosCuenta(user: AuthUser | null): boolean {
  return Boolean(user?.es_admin_cuenta);
}

/** Direcciones IP en registro de actividad: solo superadministrador de plataforma. */
export function canVerIpEnActividad(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Permisos globales por rol: solo el super-administrador de plataforma (SCG_ADMIN_EMAIL). */
export function canAccessPermisosPorRol(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Control global de cuentas (animales y gastos): solo superadministrador de plataforma. */
export function canAccessControlGlobalCuentas(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Documentos Digitales (configuración): solo super-administrador de plataforma. */
export function canAccessDocumentosDigitales(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Catálogo central de productos sanitarios (Sanidad): solo superadministrador. */
export function canAccessCatalogoSanitarioProductos(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Clasificación proveedores (estado de resultados): solo super-admin, en prueba. */
export function canAccessClasificacionProveedores(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Administración de Stock Ganadero (vaciar/restaurar base): solo administradores de cuenta. */
export function canAccessStockGanaderoAdmin(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

/** Calendarios de contribución rural (Configuración SAG): solo superadministrador de plataforma. */
export function canAccessConfigVencimientosImpuestos(user: AuthUser | null): boolean {
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
  if (screen === "usuarios") return false;
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
