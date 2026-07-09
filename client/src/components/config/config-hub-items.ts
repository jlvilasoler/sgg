import type { AuthUser } from "../../types";
import type { SgHubItem, SgHubNavSection } from "../hub/SgHubTypes";
import {
  canAccessActividadCuenta,
  canAccessActividadPropia,
  canAccessActividadSagTotal,
  canAccessArquitecturaCuenta,
  canAccessArquitecturaSistema,
  canAccessBillingAdminSuscripciones,
  canAccessBillingMercadoPagoSettings,
  canAccessCatalogoSanitarioProductos,
  canAccessClasificacionProveedores,
  canAccessConfigVencimientosImpuestos,
  canAccessConfigDotacionGanadera,
  canAccessConfigHomeLayout,
  canAccessConfigRubrosSag,
  canAccessConfiguracionSag,
  canAccessControlGlobalCuentas,
  canAccessDocumentosDigitales,
  canAccessEnvioNotificaciones,
  canAccessStockGanaderoAdmin,
  canManageRubrosCatalogo,
  canManageUsuariosCuenta,
} from "../../utils/auth-permissions";

const CATALOGOS: SgHubItem[] = [
  {
    id: "responsables",
    label: "Asignación de Presupuesto",
    subtitle: "Personas a quien se asigna el gasto",
    icon: "config_responsables",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    subtitle: "Catálogo de Proveedores",
    icon: "config_proveedores",
  },
  {
    id: "rubros",
    label: "Rubros",
    subtitle: "Rubros y sub-rubros del catálogo",
    icon: "config_rubros",
  },
  {
    id: "stock_ganadero",
    label: "Administración de Stock Ganadero",
    subtitle: "Vaciar y administrar la base de dispositivos",
    icon: "stock_dispositivos",
  },
  {
    id: "stock_equino",
    label: "Administración de Stock Equino",
    subtitle: "Vaciar y administrar la base de dispositivos equinos",
    icon: "stock_dispositivos",
  },
];

const SAG_ITEMS: SgHubItem[] = [
  {
    id: "sag_arquitectura",
    label: "Arquitectura del sistema",
    subtitle: "Stack, módulos y estructura técnica de SAG",
    icon: "arquitectura_sistema",
  },
  {
    id: "registro_actividad_total",
    label: "Registro de actividad SAG",
    subtitle: "Todas las cuentas · solo superadministrador",
    icon: "usuarios_permisos_rol",
  },
  {
    id: "control_global_cuentas",
    label: "Centro de control de cuentas",
    subtitle: "Supervisión bancaria · cartera cliente",
    icon: "config_admin_cuenta",
  },
  {
    id: "catalogo_sanitario_productos",
    label: "Catálogo sanitario",
    subtitle: "Remedios y fichas técnicas",
    icon: "stock_sanidad",
  },
  {
    id: "rubros_sag",
    label: "Rubros y sub-rubros SAG",
    subtitle: "Catálogo base y rubros creados por cada cuenta",
    icon: "config_rubros",
  },
  {
    id: "home_layout",
    label: "Inicio por cuenta",
    subtitle: "Qué ve cada Gestor N1, N2 y Lector en el home",
    icon: "arquitectura_sistema",
  },
  {
    id: "home_layout_monitor",
    label: "Monitor de usuarios",
    subtitle: "Control de cómo cada usuario tiene su pantalla Inicio",
    icon: "usuarios_permisos_rol",
  },
  {
    id: "dotacion_ganadera",
    label: "Dotación ganadera",
    subtitle: "Unidades ganaderas por categoría etaria",
    icon: "stock_dispositivos",
  },
  {
    id: "clasificacion_proveedores",
    label: "Clasificación Proveedores",
    subtitle: "Costos de producción, gastos admin. y comerciales",
    icon: "config_clasificacion_proveedores",
  },
  {
    id: "documentos_digitales",
    label: "Documentos Digitales",
    subtitle: "Archivo y gestión documental global",
    icon: "config_rubros",
  },
  {
    id: "vencimientos_impuestos",
    label: "Vencimientos Impuestos",
    subtitle: "Calendarios y fechas por departamento",
    icon: "config_responsables",
  },
  {
    id: "billing_mp_settings",
    label: "Tema Mercado Pago",
    subtitle: "Checkout, marca y días de prueba",
    icon: "config_admin_cuenta",
  },
  {
    id: "billing_suscripciones_plataforma",
    label: "Suscripciones plataforma",
    subtitle: "Estado en tiempo real de todas las cuentas",
    icon: "config_admin_cuenta",
  },
  {
    id: "envio_notificaciones",
    label: "Envío de Notificaciones",
    subtitle: "Avisos puntuales a usuarios de las cuentas",
    icon: "usuarios_permisos_rol",
  },
];

export const CONFIG_MI_PERFIL_ITEM: SgHubItem = {
  id: "mi_perfil",
  label: "Mi perfil",
  subtitle: "Foto, datos personales y contraseña",
  icon: "config_responsables",
};

/**
 * Módulos dentro del hub «Administración de Cuenta».
 * Orden fijo del catálogo operativo de la cuenta.
 */
const CUENTA_ADMIN_NAV_IDS = [
  "responsables",
  "proveedores",
  "rubros",
  "stock_ganadero",
  "stock_equino",
  "admin_cuenta",
  "usuarios",
  "registro_actividad",
] as const;

export const CONFIG_CUENTA_ADMIN_HUB_ITEM: SgHubItem = {
  id: "cuenta_hub",
  label: "Administración de Cuenta",
  subtitle: "Presupuesto, proveedores, rubros, stock, usuarios y arquitectura",
  icon: "config_admin_cuenta",
};

function pickCuentaAdminNavItems(items: SgHubItem[]): SgHubItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return CUENTA_ADMIN_NAV_IDS.map((id) => byId.get(id)).filter(
    (item): item is SgHubItem => item != null
  );
}

export interface ConfigNavLayout {
  sections: SgHubNavSection[];
  items: SgHubItem[];
}

export interface BuildConfigCuentaNavOptions {
  /**
   * true: lista los módulos del hub en el menú lateral.
   * false: solo el botón «Administración de Cuenta» (dashboard principal).
   */
  expandAdmin?: boolean;
}

export function buildConfigCuentaNavLayout(
  user: AuthUser | null | undefined,
  options: BuildConfigCuentaNavOptions = {}
): ConfigNavLayout {
  const { expandAdmin = false } = options;
  const cuentaItems = buildConfigCuentaItems(user);
  const adminItems = pickCuentaAdminNavItems(cuentaItems);
  const adminIds = new Set(adminItems.map((item) => item.id));
  const otherItems = cuentaItems.filter((item) => !adminIds.has(item.id));

  if (!expandAdmin) {
    return {
      sections: [],
      items: [
        ...(adminItems.length > 0 ? [CONFIG_CUENTA_ADMIN_HUB_ITEM] : []),
        ...otherItems,
        CONFIG_MI_PERFIL_ITEM,
      ],
    };
  }

  return {
    sections:
      adminItems.length > 0
        ? [{ id: "cuenta_admin", label: "Administración de Cuenta", items: adminItems }]
        : [],
    items: [...otherItems, CONFIG_MI_PERFIL_ITEM],
  };
}

export function buildConfigNavLayout(
  scope: ConfigNavScope,
  user: AuthUser | null | undefined,
  esSuperAdmin: boolean,
  options: BuildConfigCuentaNavOptions = {}
): ConfigNavLayout {
  if (scope === "sag") {
    if (!canAccessConfiguracionSag(user ?? null)) {
      return { sections: [], items: [CONFIG_MI_PERFIL_ITEM] };
    }
    return {
      sections: [],
      items: [...buildConfigSagItems(user), CONFIG_MI_PERFIL_ITEM],
    };
  }
  if (scope === "main" && esSuperAdmin) {
    return {
      sections: [],
      items: [...buildConfigMainItems(true), CONFIG_MI_PERFIL_ITEM],
    };
  }
  return buildConfigCuentaNavLayout(user, options);
}

export function flattenConfigNavLayout(layout: ConfigNavLayout): SgHubItem[] {
  return [...layout.sections.flatMap((section) => section.items), ...layout.items];
}

export function buildConfigCuentaItems(user: AuthUser | null | undefined): SgHubItem[] {
  const items = CATALOGOS.filter((item) => {
    if (item.id === "stock_ganadero" || item.id === "stock_equino") {
      return canAccessStockGanaderoAdmin(user ?? null);
    }
    if (item.id === "rubros") {
      return canManageRubrosCatalogo(user ?? null);
    }
    return true;
  });
  if (canManageUsuariosCuenta(user ?? null)) {
    items.push({
      id: "usuarios",
      label: "Usuarios",
      subtitle: "Administración de usuarios de la cuenta",
      icon: "usuarios_permisos_rol",
    });
  }
  if (canAccessArquitecturaCuenta(user ?? null)) {
    items.push({
      id: "suscripcion",
      label: "Suscripción",
      subtitle: "Plan mensual con Mercado Pago (modo test)",
      icon: "config_admin_cuenta",
    });
    items.push({
      id: "admin_cuenta",
      label: "Arquitectura del sistema",
      subtitle: "Su cuenta, empresas operativas y usuarios",
      icon: "arquitectura_sistema",
    });
  }
  if (canAccessActividadCuenta(user ?? null) || canAccessActividadPropia(user ?? null)) {
    items.push({
      id: "registro_actividad",
      label: "Registro de actividad",
      subtitle: "Historial de accesos y acciones en el sistema",
      icon: "usuarios_permisos_rol",
    });
  }
  return items;
}

export function buildConfigSagItems(user: AuthUser | null | undefined): SgHubItem[] {
  return SAG_ITEMS.filter((item) => {
    if (item.id === "documentos_digitales") return canAccessDocumentosDigitales(user ?? null);
    if (item.id === "registro_actividad_total") return canAccessActividadSagTotal(user ?? null);
    if (item.id === "control_global_cuentas") return canAccessControlGlobalCuentas(user ?? null);
    if (item.id === "sag_arquitectura") return canAccessArquitecturaSistema(user ?? null);
    if (item.id === "catalogo_sanitario_productos") {
      return canAccessCatalogoSanitarioProductos(user ?? null);
    }
    if (item.id === "dotacion_ganadera") {
      return canAccessConfigDotacionGanadera(user ?? null);
    }
    if (item.id === "home_layout") {
      return canAccessConfigHomeLayout(user ?? null);
    }
    if (item.id === "home_layout_monitor") {
      return canAccessConfigHomeLayout(user ?? null);
    }
    if (item.id === "rubros_sag") {
      return canAccessConfigRubrosSag(user ?? null);
    }
    if (item.id === "clasificacion_proveedores") {
      return canAccessClasificacionProveedores(user ?? null);
    }
    if (item.id === "vencimientos_impuestos") {
      return canAccessConfigVencimientosImpuestos(user ?? null);
    }
    if (item.id === "billing_mp_settings") {
      return canAccessBillingMercadoPagoSettings(user ?? null);
    }
    if (item.id === "billing_suscripciones_plataforma") {
      return canAccessBillingAdminSuscripciones(user ?? null);
    }
    if (item.id === "envio_notificaciones") {
      return canAccessEnvioNotificaciones(user ?? null);
    }
    return true;
  });
}

export function buildConfigMainItems(esSuperAdmin: boolean): SgHubItem[] {
  if (!esSuperAdmin) return [];
  return [
    {
      ...CONFIG_CUENTA_ADMIN_HUB_ITEM,
      subtitle: "Catálogos y ajustes operativos de la cuenta",
    },
    {
      id: "sag_hub",
      label: "Configuración SAG",
      subtitle: "Administración global de plataforma",
      icon: "arquitectura_sistema",
    },
  ];
}

/** Ítems del grid cuando está abierto el hub Administración de Cuenta. */
export function buildConfigCuentaAdminGridItems(
  user: AuthUser | null | undefined
): SgHubItem[] {
  return pickCuentaAdminNavItems(buildConfigCuentaItems(user));
}

export function configHubMeta(
  id: string,
  cuentaNombre: string
): { title: string; subtitle: string } {
  const map: Record<string, { title: string; subtitle: string }> = {
    menu: {
      title: "Dashboard",
      subtitle: "Catálogos de apoyo para registrar y controlar gastos.",
    },
    cuenta_hub: {
      title: "Administración de Cuenta",
      subtitle: `Catálogos y ajustes operativos de ${cuentaNombre}.`,
    },
    sag_hub: {
      title: "Configuración SAG",
      subtitle: "Administración global de la plataforma.",
    },
    responsables: {
      title: "Asignación de Presupuesto",
      subtitle: "Personas a quien se asigna el gasto.",
    },
    proveedores: { title: "Proveedores", subtitle: "Catálogo de proveedores." },
    clasificacion_proveedores: {
      title: "Clasificación Proveedores",
      subtitle: "Costos de producción y gastos administrativos.",
    },
    rubros: { title: "Rubros", subtitle: "Rubros y sub-rubros del catálogo." },
    stock_ganadero: {
      title: "Administración Stock Ganadero",
      subtitle: "Vaciar y administrar dispositivos.",
    },
    stock_equino: {
      title: "Administración Stock Equino",
      subtitle: "Vaciar y administrar dispositivos equinos.",
    },
    admin_cuenta: {
      title: "Arquitectura del sistema",
      subtitle: "Información de su cuenta y empresas operativas.",
    },
    suscripcion: {
      title: "Suscripción",
      subtitle: "Plan mensual con tarjeta vía Mercado Pago.",
    },
    usuarios: { title: "Usuarios", subtitle: "Administración de usuarios de la cuenta." },
    registro_actividad: {
      title: "Registro de actividad",
      subtitle: "Historial de accesos y acciones en el sistema.",
    },
    sag_arquitectura: {
      title: "Arquitectura del sistema",
      subtitle: "Stack y módulos técnicos de SAG.",
    },
    registro_actividad_total: {
      title: "Registro de actividad SAG",
      subtitle: "Todas las cuentas de la plataforma.",
    },
    control_global_cuentas: {
      title: "Centro de control de cuentas",
      subtitle: "Supervisión bancaria y exposición.",
    },
    catalogo_sanitario_productos: {
      title: "Catálogo sanitario",
      subtitle: "Remedios y fichas técnicas.",
    },
    dotacion_ganadera: {
      title: "Dotación ganadera",
      subtitle: "Equivalencias en unidades ganaderas por categoría.",
    },
    home_layout: {
      title: "Inicio por tipo de cuenta",
      subtitle: "Bloques visibles del dashboard Inicio por rol.",
    },
    home_layout_monitor: {
      title: "Monitor de usuarios",
      subtitle: "Control de la pantalla Inicio de cada usuario.",
    },
    rubros_sag: {
      title: "Rubros y sub-rubros SAG",
      subtitle: "Catálogo base compartido y rubros propios de cada cuenta.",
    },
    documentos_digitales: {
      title: "Documentos Digitales",
      subtitle: "Archivo documental global.",
    },
    vencimientos_impuestos: {
      title: "Vencimientos Impuestos",
      subtitle: "Calendarios tributarios.",
    },
    billing_mp_settings: {
      title: "Tema Mercado Pago",
      subtitle: "Marca, motivo de checkout y retorno.",
    },
    billing_suscripciones_plataforma: {
      title: "Suscripciones plataforma",
      subtitle: "Panel en tiempo real para superadministrador.",
    },
    envio_notificaciones: {
      title: "Envío de Notificaciones",
      subtitle: "Avisos puntuales a usuarios de las cuentas.",
    },
    mi_perfil: {
      title: "Mi perfil",
      subtitle: "Tu foto, datos y contraseña de acceso.",
    },
  };
  return map[id] ?? { title: "Configuración", subtitle: "" };
}

export type ConfigNavScope = "main" | "cuenta" | "sag";

export function buildConfigNavItems(
  scope: ConfigNavScope,
  user: AuthUser | null | undefined,
  esSuperAdmin: boolean,
  options: BuildConfigCuentaNavOptions = {}
): SgHubItem[] {
  return flattenConfigNavLayout(buildConfigNavLayout(scope, user, esSuperAdmin, options));
}

const CUENTA_MODULOS = new Set([
  "responsables",
  "proveedores",
  "rubros",
  "stock_ganadero",
  "stock_equino",
  "suscripcion",
  "admin_cuenta",
  "usuarios",
  "registro_actividad",
]);

export function configNavScopeForModulo(modulo: string): ConfigNavScope {
  if (
    modulo === "sag_arquitectura" ||
    modulo === "registro_actividad_total" ||
    modulo === "control_global_cuentas" ||
    modulo === "documentos_digitales" ||
    modulo === "catalogo_sanitario_productos" ||
    modulo === "dotacion_ganadera" ||
    modulo === "home_layout" ||
    modulo === "home_layout_monitor" ||
    modulo === "rubros_sag" ||
    modulo === "clasificacion_proveedores" ||
    modulo === "vencimientos_impuestos" ||
    modulo === "billing_mp_settings" ||
    modulo === "billing_suscripciones_plataforma" ||
    modulo === "envio_notificaciones"
  ) {
    return "sag";
  }
  if (modulo === "sag_hub") return "sag";
  if (modulo === "cuenta_hub" || CUENTA_MODULOS.has(modulo)) return "cuenta";
  return "main";
}
