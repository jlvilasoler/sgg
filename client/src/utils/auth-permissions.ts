import type { TabId } from "../components/Header";
import type { ActividadAmbito } from "../api";
import type { AuthActividadLog, AuthUser, Modulo } from "../types";
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
  campo_mapa: "stock",
  tareas_operativas: "stock",
  ayuda: "chat",
  stock_movimientos: "usuarios",
  registro_actividad: "usuarios",
  notas: "chat",
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

/** Cuenta madre del usuario (actividad compartida entre integrantes del equipo). */
export function resolveCuentaActividadId(user: AuthUser | null): number | undefined {
  if (!user) return undefined;
  const id = user.cuenta_actividad_id ?? user.empresa_id;
  return id != null && id > 0 ? id : undefined;
}

/** Panel «Últimos guardados» en Inicio: cualquier integrante de una cuenta. */
export function canAccessHomeActividadCuenta(user: AuthUser | null): boolean {
  return resolveCuentaActividadId(user) != null;
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
  if (!user) return "propio";
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
      titulo: "Registro de actividad SAG",
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

/** Ingresos automáticos mensuales: solo el administrador de la cuenta puede aprobar u omitir. */
export function canAprobarGastosAutomatizacion(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

/** Admin de cuenta o super-admin en vista total/cuenta: ve usuarios en línea de su ámbito. */
export function canVerUsuariosOnlineActividad(user: AuthUser | null): boolean {
  return user?.rol === "admin";
}

export type HomeActividadPanelConfig = {
  id: "cuenta" | "propio" | "total";
  cacheKey: string;
  fetchParams: {
    ambito?: ActividadAmbito;
    cuentaId?: number;
    email?: string;
    feed: "home";
  };
  kicker: string;
  title: string;
  emptyText: string;
  verTodoModo: ActividadVistaModo;
  variant: "default" | "global";
};

export type HomeActividadPanelState = HomeActividadPanelConfig & {
  items: AuthActividadLog[];
  loading: boolean;
};

/** Paneles de «Últimos guardados» en Inicio según rol. */
export function listHomeActividadPanels(user: AuthUser | null): HomeActividadPanelConfig[] {
  if (!user) return [];

  const panels: HomeActividadPanelConfig[] = [];
  const cuentaId = resolveCuentaActividadId(user);
  const cuentaNombre =
    user.cuenta_actividad_nombre?.trim() || user.empresa_nombre?.trim() || "tu cuenta";

  if (user.rol === "admin" && (cuentaId != null || user.es_super_admin)) {
    if (cuentaId != null || !user.es_super_admin) {
      panels.push({
        id: "cuenta",
        cacheKey: `cuenta:${cuentaId ?? "x"}`,
        fetchParams: {
          ambito: "cuenta",
          ...(cuentaId != null ? { cuentaId } : {}),
          feed: "home",
        },
        kicker: "Actividad de cuenta",
        title: "Últimos guardados",
        emptyText: `Todavía no hay cargas recientes del equipo en ${cuentaNombre} (gastos, stock, RRHH, ventas o notas compartidas).`,
        verTodoModo: "cuenta",
        variant: "default",
      });
    }
  } else if (resolveCuentaActividadId(user) != null || user.rol !== "admin") {
    panels.push({
      id: "propio",
      cacheKey: "propio",
      fetchParams: { email: user.email, feed: "home" },
      kicker: "Mi actividad",
      title: "Últimos guardados",
      emptyText:
        "Todavía no hay cargas recientes tuyas (gastos, stock, RRHH, ventas o notas compartidas).",
      verTodoModo: "propio",
      variant: "default",
    });
  }

  if (canAccessActividadSagTotal(user)) {
    panels.push({
      id: "total",
      cacheKey: "total",
      fetchParams: { ambito: "total", feed: "home" },
      kicker: "Plataforma SAG",
      title: "Actividad en todas las cuentas",
      emptyText:
        "Todavía no hay cargas recientes en ninguna cuenta de la plataforma (gastos, stock, RRHH, ventas o notas).",
      verTodoModo: "total",
      variant: "global",
    });
  }

  return panels;
}

export function canAccessArquitecturaSistema(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin") return false;
  return user.es_super_admin ?? user.empresa_id == null;
}

/** Arquitectura de su propia cuenta en Configuración (admin de cuenta, no superadmin). */
export function canAccessArquitecturaCuenta(user: AuthUser | null): boolean {
  if (!user || user.rol !== "admin" || user.es_super_admin) return false;
  const cuentaId = user.cuenta_actividad_id ?? user.empresa_id;
  return cuentaId != null && cuentaId > 0;
}

/** Panel en Configuración: administrador de su propia cuenta (no super-admin). */
export function canAccessAdministradorCuentas(user: AuthUser | null): boolean {
  return canAccessArquitecturaCuenta(user);
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

/** Tema y checkout Mercado Pago (Configuración SAG): solo superadministrador. */
export function canAccessBillingMercadoPagoSettings(user: AuthUser | null): boolean {
  return Boolean(user?.es_super_admin);
}

/** Panel de suscripciones de plataforma: solo superadministrador. */
export function canAccessBillingAdminSuscripciones(user: AuthUser | null): boolean {
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

/** Ingresos por ventas: lectura/consulta del módulo ventas. */
export function canAccessIngresosVentasModulo(user: AuthUser | null): boolean {
  return Boolean(user?.permisos.includes("ventas"));
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

/** Catálogo de rubros de ingresos por ventas: solo administrador y gestor nivel 1. */
export function canManageVentaRubros(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.rol !== "admin" && user.rol !== "editor") return false;
  return canWriteModulo(user, "ventas");
}

export function moduloForScreen(screen: TabId): Modulo {
  return SCREEN_MODULO[screen];
}

export function canAccessScreen(user: AuthUser | null, screen: TabId): boolean {
  if (!user) return false;
  if (screen === "registro_actividad") return true;
  if (screen === "notas") return true;
  if (screen === "ayuda") return true;
  if (screen === "usuarios") return false;
  if (screen === "documentos_digitales") return canAccessDocumentosDigitales(user);
  if (screen === "panel_admin_sitio") return canAccessArquitecturaSistema(user);
  if (screen === "ingresos_ventas") {
    return canAccessIngresosVentasModulo(user) || canAccessSimuladorVentaGanado(user);
  }
  if (screen === "simulador_venta_ganado") {
    return canAccessSimuladorVentaGanado(user);
  }
  const mod = moduloForScreen(screen);
  if (MODULOS_SOLO_ADMIN.includes(mod)) return user.rol === "admin";
  if (MODULOS_ACCESO_TODOS.includes(mod)) return true;
  return user.permisos.includes(mod);
}

/** Configuración de vencimientos impuestos: una vez por cuenta (admin, gestor N1/N2). Lectores solo consultan. */
export function canConfigurarVencimientosImpuestos(user: AuthUser | null): boolean {
  return canWriteModulo(user, "presupuesto");
}

export function canWrite(user: AuthUser | null): boolean {
  return Boolean(user?.puede_escribir);
}

/** Mapa del campo: colaborativo por cuenta; cualquier integrante con acceso puede editar. */
export function canWriteCampoMapa(user: AuthUser | null): boolean {
  return canAccessScreen(user, "campo_mapa");
}

/** Tareas operativas: colaborativo por cuenta; cualquier integrante con acceso puede editar. */
export function canWriteTareasOperativas(user: AuthUser | null): boolean {
  return canAccessScreen(user, "tareas_operativas");
}
