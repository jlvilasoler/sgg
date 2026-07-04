import type { AuthUser } from "../../types";
import type { SgHubItem } from "../hub/SgHubTypes";
import {
  canAccessAdministradorCuentas,
  canAccessActividadSagTotal,
  canAccessArquitecturaSistema,
  canAccessCatalogoSanitarioProductos,
  canAccessClasificacionProveedores,
  canAccessConfigVencimientosImpuestos,
  canAccessControlGlobalCuentas,
  canAccessDocumentosDigitales,
  canAccessStockGanaderoAdmin,
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
    id: "clasificacion_proveedores",
    label: "Clasificación Proveedores",
    subtitle: "Costos de producción, gastos admin. y comerciales",
    icon: "config_clasificacion_proveedores",
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
    label: "Registro de actividad SAG total",
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
];

export function buildConfigCuentaItems(user: AuthUser | null | undefined): SgHubItem[] {
  const items = CATALOGOS.filter((item) => {
    if (item.id === "clasificacion_proveedores") {
      return canAccessClasificacionProveedores(user ?? null);
    }
    if (item.id === "stock_ganadero" || item.id === "stock_equino") {
      return canAccessStockGanaderoAdmin(user ?? null);
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
  if (canAccessAdministradorCuentas(user ?? null)) {
    items.push({
      id: "admin_cuenta",
      label: "Administrador de Cuentas",
      subtitle: "Datos de su cuenta, empresas y usuarios",
      icon: "config_admin_cuenta",
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
    if (item.id === "vencimientos_impuestos") {
      return canAccessConfigVencimientosImpuestos(user ?? null);
    }
    return true;
  });
}

export function buildConfigMainItems(esSuperAdmin: boolean): SgHubItem[] {
  if (!esSuperAdmin) return [];
  return [
    {
      id: "cuenta_hub",
      label: "Configuración cuenta",
      subtitle: "Catálogos y ajustes operativos de la cuenta",
      icon: "config_rubros",
    },
    {
      id: "sag_hub",
      label: "Configuración SAG",
      subtitle: "Administración global de plataforma",
      icon: "arquitectura_sistema",
    },
  ];
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
      title: `Configuración cuenta ${cuentaNombre}`,
      subtitle: "Presupuesto asignado, proveedores, rubros y usuarios.",
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
      title: "Administrador de Cuentas",
      subtitle: "Datos de cuenta, empresas y usuarios.",
    },
    usuarios: { title: "Usuarios", subtitle: "Administración de usuarios de la cuenta." },
    sag_arquitectura: {
      title: "Arquitectura del sistema",
      subtitle: "Stack y módulos técnicos de SAG.",
    },
    registro_actividad_total: {
      title: "Registro de actividad SAG total",
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
    documentos_digitales: {
      title: "Documentos Digitales",
      subtitle: "Archivo documental global.",
    },
    vencimientos_impuestos: {
      title: "Vencimientos Impuestos",
      subtitle: "Calendarios tributarios.",
    },
  };
  return map[id] ?? { title: "Configuración", subtitle: "" };
}

export type ConfigNavScope = "main" | "cuenta" | "sag";

export function buildConfigNavItems(
  scope: ConfigNavScope,
  user: AuthUser | null | undefined,
  esSuperAdmin: boolean
): SgHubItem[] {
  if (scope === "main") {
    return esSuperAdmin ? buildConfigMainItems(true) : buildConfigCuentaItems(user);
  }
  if (scope === "sag") return buildConfigSagItems(user);
  return buildConfigCuentaItems(user);
}

const CUENTA_MODULOS = new Set([
  "responsables",
  "proveedores",
  "clasificacion_proveedores",
  "rubros",
  "stock_ganadero",
  "stock_equino",
  "admin_cuenta",
  "usuarios",
]);

export function configNavScopeForModulo(modulo: string): ConfigNavScope {
  if (
    modulo === "sag_arquitectura" ||
    modulo === "registro_actividad_total" ||
    modulo === "control_global_cuentas" ||
    modulo === "documentos_digitales" ||
    modulo === "catalogo_sanitario_productos" ||
    modulo === "vencimientos_impuestos"
  ) {
    return "sag";
  }
  if (modulo === "sag_hub") return "sag";
  if (modulo === "cuenta_hub" || CUENTA_MODULOS.has(modulo)) return "cuenta";
  return "main";
}
