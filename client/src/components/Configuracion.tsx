import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import {
  canAccessActividadCuenta,
  canAccessActividadPropia,
  canAccessActividadSagTotal,
  canAccessBillingAdminSuscripciones,
  canAccessBillingMercadoPagoSettings,
  canAccessCatalogoSanitarioProductos,
  canAccessClasificacionProveedores,
  canAccessConfigVencimientosImpuestos,
  canAccessConfigHomeLayout,
  canAccessConfigRubrosSag,
  canAccessConfigDotacionGanadera,
  canAccessConfiguracionSag,
  canAccessControlGlobalCuentas,
  canAccessArquitecturaCuenta,
  canAccessArquitecturaSistema,
  canAccessStockGanaderoAdmin,
  canManageRubrosCatalogo,
  canManageUsuariosCuenta,
} from "../utils/auth-permissions";
import Proveedores from "./Proveedores";
import ClasificacionProveedores from "./proveedores/ClasificacionProveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";
import RubrosSag from "./rubros/RubrosSag";
import StockGanaderoAdmin from "./stock/StockGanaderoAdmin";
import StockEquinoAdmin from "./stock-equino/StockEquinoAdmin";
import AdministradorCuenta from "./AdministradorCuenta";
import SuscripcionCuenta from "./SuscripcionCuenta";
import ArquitecturaSistema from "./ArquitecturaSistema";
import DocumentosDigitales from "./DocumentosDigitales";
import ControlGlobalCuentas from "./ControlGlobalCuentas";
import ConfigSanitarioProductos from "./stock/ConfigSanitarioProductos";
import ConfigVencimientosImpuestos from "./ConfigVencimientosImpuestos";
import BillingMercadoPagoSettings from "./config/BillingMercadoPagoSettings";
import BillingAdminSuscripciones from "./config/BillingAdminSuscripciones";
import ConfigDotacionGanadera from "./config/ConfigDotacionGanadera";
import ConfigHomeLayout from "./config/ConfigHomeLayout";
import ConfigHomeLayoutMonitor from "./config/ConfigHomeLayoutMonitor";
import Usuarios from "./Usuarios";
import UsuariosActividad from "./UsuariosActividad";
import ConfigHubView from "./config/ConfigHubView";
import { configNavScopeForModulo } from "./config/config-hub-items";
import {
  actividadModoPorDefecto,
  actividadTituloPorModo,
  type ActividadVistaModo,
} from "../utils/auth-permissions";

type CatalogoModulo =
  | "responsables"
  | "proveedores"
  | "clasificacion_proveedores"
  | "rubros"
  | "stock_ganadero"
  | "stock_equino"
  | "suscripcion"
  | "admin_cuenta"
  | "usuarios"
  | "registro_actividad";

type SagModulo =
  | "sag_arquitectura"
  | "registro_actividad_total"
  | "control_global_cuentas"
  | "documentos_digitales"
  | "catalogo_sanitario_productos"
  | "dotacion_ganadera"
  | "home_layout"
  | "home_layout_monitor"
  | "rubros_sag"
  | "vencimientos_impuestos"
  | "billing_mp_settings"
  | "billing_suscripciones_plataforma";

type ModuloConfig =
  | "menu"
  | "cuenta_hub"
  | "sag_hub"
  | CatalogoModulo
  | SagModulo;

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  onOpenMiPerfil?: () => void;
  moduloInicial?: ModuloConfig | null;
  actividadModoInicial?: ActividadVistaModo | null;
  onModuloInicialConsumido?: () => void;
}

function nombreCuentaConfig(user: AuthUser | null | undefined): string {
  return (
    user?.cuenta_actividad_nombre?.trim() ||
    user?.empresa_nombre?.trim() ||
    "Cuenta"
  );
}

export default function Configuracion({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
  onOpenMiPerfil,
  moduloInicial,
  actividadModoInicial,
  onModuloInicialConsumido,
}: Props) {
  const [modulo, setModulo] = useState<ModuloConfig>("menu");
  const [actividadModo, setActividadModo] = useState<ActividadVistaModo | null>(null);
  const esSuperAdmin = Boolean(currentUser?.es_super_admin);
  const cuentaNombre = nombreCuentaConfig(currentUser);

  const volverConfigDashboard = useCallback(
    (targetModulo: ModuloConfig) => {
      const scope = configNavScopeForModulo(targetModulo);
      if (scope === "sag") {
        setModulo("sag_hub");
      } else if (scope === "cuenta") {
        setModulo("cuenta_hub");
      } else {
        setModulo("menu");
      }
    },
    []
  );

  const wrapConfigSubmodule = useCallback(
    (activeId: ModuloConfig, content: ReactNode) => (
      <ConfigHubView
        activeId={activeId}
        navScope={configNavScopeForModulo(activeId)}
        esSuperAdmin={esSuperAdmin}
        cuentaNombre={cuentaNombre}
        apiOnline={apiOnline}
        currentUser={currentUser}
        onNavigate={(id) => setModulo(id as ModuloConfig)}
        onVolverDashboard={() => volverConfigDashboard(activeId)}
        onVolverInicio={onVolver}
        onOpenMiPerfil={onOpenMiPerfil}
      >
        {content}
      </ConfigHubView>
    ),
    [esSuperAdmin, cuentaNombre, apiOnline, currentUser, onVolver, volverConfigDashboard, onOpenMiPerfil]
  );

  const headerBackLabel = useMemo(() => {
    const scope = configNavScopeForModulo(modulo);
    if (scope === "sag") return "Configuración SAG";
    if (modulo === "cuenta_hub") return "Configuración";
    if (scope === "cuenta") return "Administración de Cuenta";
    return "Configuración";
  }, [modulo]);

  useHeaderBackStep(
    modulo !== "menu",
    () => {
      if (modulo === "cuenta_hub" || modulo === "sag_hub") {
        setModulo("menu");
      } else {
        volverConfigDashboard(modulo);
      }
    },
    headerBackLabel
  );

  useEffect(() => {
    if (!moduloInicial) return;
    setModulo(moduloInicial);
    if (moduloInicial === "registro_actividad" && actividadModoInicial) {
      setActividadModo(actividadModoInicial);
    }
    onModuloInicialConsumido?.();
  }, [moduloInicial, actividadModoInicial, onModuloInicialConsumido]);

  useEffect(() => {
    if (
      (modulo === "sag_hub" || configNavScopeForModulo(modulo) === "sag") &&
      !canAccessConfiguracionSag(currentUser ?? null)
    ) {
      setModulo("menu");
      return;
    }
    if (
      modulo === "clasificacion_proveedores" &&
      !canAccessClasificacionProveedores(currentUser ?? null)
    ) {
      setModulo(esSuperAdmin ? "sag_hub" : "menu");
    }
    if (
      (modulo === "stock_ganadero" || modulo === "stock_equino") &&
      !canAccessStockGanaderoAdmin(currentUser ?? null)
    ) {
      setModulo("cuenta_hub");
    }
    if (
      modulo === "registro_actividad_total" &&
      !canAccessActividadSagTotal(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "control_global_cuentas" &&
      !canAccessControlGlobalCuentas(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "catalogo_sanitario_productos" &&
      !canAccessCatalogoSanitarioProductos(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "dotacion_ganadera" &&
      !canAccessConfigDotacionGanadera(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "home_layout" &&
      !canAccessConfigHomeLayout(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "home_layout_monitor" &&
      !canAccessConfigHomeLayout(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (modulo === "rubros_sag" && !canAccessConfigRubrosSag(currentUser ?? null)) {
      setModulo("sag_hub");
    }
    if (
      modulo === "vencimientos_impuestos" &&
      !canAccessConfigVencimientosImpuestos(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "billing_mp_settings" &&
      !canAccessBillingMercadoPagoSettings(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (
      modulo === "billing_suscripciones_plataforma" &&
      !canAccessBillingAdminSuscripciones(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (modulo === "rubros" && !canManageRubrosCatalogo(currentUser ?? null)) {
      setModulo("cuenta_hub");
    }
    if (modulo === "usuarios" && !canManageUsuariosCuenta(currentUser ?? null)) {
      setModulo("cuenta_hub");
    }
    if (modulo === "admin_cuenta" && !canAccessArquitecturaCuenta(currentUser ?? null)) {
      setModulo("cuenta_hub");
    }
    if (modulo === "suscripcion" && !canAccessArquitecturaCuenta(currentUser ?? null)) {
      setModulo("menu");
    }
    if (modulo === "sag_arquitectura" && !canAccessArquitecturaSistema(currentUser ?? null)) {
      setModulo("sag_hub");
    }
    if (
      modulo === "registro_actividad" &&
      !canAccessActividadCuenta(currentUser ?? null) &&
      !canAccessActividadPropia(currentUser ?? null)
    ) {
      setModulo("cuenta_hub");
    }
  }, [modulo, currentUser, esSuperAdmin]);

  if (modulo === "responsables") {
    return wrapConfigSubmodule(
      "responsables",
      <Responsables
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => volverConfigDashboard("responsables")}
      />
    );
  }

  if (modulo === "proveedores") {
    return wrapConfigSubmodule(
      "proveedores",
      <Proveedores
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("proveedores")}
      />
    );
  }

  if (modulo === "clasificacion_proveedores") {
    return wrapConfigSubmodule(
      "clasificacion_proveedores",
      <ClasificacionProveedores
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("clasificacion_proveedores")}
      />
    );
  }

  if (modulo === "rubros" && canManageRubrosCatalogo(currentUser ?? null)) {
    return wrapConfigSubmodule(
      "rubros",
      <Rubros
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => volverConfigDashboard("rubros")}
        volverLabel="a Administración de Cuenta"
      />
    );
  }

  if (modulo === "stock_ganadero") {
    return wrapConfigSubmodule(
      "stock_ganadero",
      <StockGanaderoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("stock_ganadero")}
      />
    );
  }

  if (modulo === "stock_equino") {
    return wrapConfigSubmodule(
      "stock_equino",
      <StockEquinoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("stock_equino")}
      />
    );
  }

  if (modulo === "suscripcion" && canAccessArquitecturaCuenta(currentUser ?? null)) {
    return wrapConfigSubmodule(
      "suscripcion",
      <SuscripcionCuenta
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("suscripcion")}
      />
    );
  }

  if (modulo === "admin_cuenta" && currentUser && canAccessArquitecturaCuenta(currentUser)) {
    return wrapConfigSubmodule(
      "admin_cuenta",
      <AdministradorCuenta
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("admin_cuenta")}
      />
    );
  }

  if (
    modulo === "usuarios" &&
    currentUser &&
    canManageUsuariosCuenta(currentUser)
  ) {
    return wrapConfigSubmodule(
      "usuarios",
      <Usuarios
        apiOnline={apiOnline}
        currentUser={currentUser}
        embedded
        volverLabel="Volver a Administración de Cuenta"
        onVolver={() => volverConfigDashboard("usuarios")}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (
    modulo === "registro_actividad" &&
    currentUser &&
    (canAccessActividadCuenta(currentUser) || canAccessActividadPropia(currentUser))
  ) {
    const modo = actividadModo ?? actividadModoInicial ?? actividadModoPorDefecto(currentUser);
    const { titulo, subtituloAmbito } = actividadTituloPorModo(currentUser, modo);
    return wrapConfigSubmodule(
      "registro_actividad",
      <UsuariosActividad
        apiOnline={apiOnline}
        currentUser={currentUser}
        modo={modo}
        embedded
        titulo={titulo}
        subtituloAmbito={subtituloAmbito}
        volverLabel="Volver a Administración de Cuenta"
        onError={onError}
        onVolver={() => {
          setActividadModo(null);
          volverConfigDashboard("registro_actividad");
        }}
      />
    );
  }

  if (modulo === "sag_arquitectura" && currentUser && canAccessArquitecturaSistema(currentUser)) {
    return wrapConfigSubmodule(
      "sag_arquitectura",
      <ArquitecturaSistema
        apiOnline={apiOnline}
        currentUser={currentUser}
        embedded
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("sag_arquitectura")}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (
    modulo === "registro_actividad_total" &&
    currentUser &&
    canAccessActividadSagTotal(currentUser)
  ) {
    return wrapConfigSubmodule(
      "registro_actividad_total",
      <UsuariosActividad
        apiOnline={apiOnline}
        currentUser={currentUser}
        modo="total"
        embedded
        titulo="Registro de actividad SAG"
        subtituloAmbito="Todas las cuentas y usuarios de la plataforma"
        volverLabel="Volver a Configuración SAG"
        onError={onError}
        onVolver={() => volverConfigDashboard("registro_actividad_total")}
      />
    );
  }

  if (
    modulo === "control_global_cuentas" &&
    currentUser &&
    canAccessControlGlobalCuentas(currentUser)
  ) {
    return wrapConfigSubmodule(
      "control_global_cuentas",
      <ControlGlobalCuentas
        apiOnline={apiOnline}
        volverLabel="Volver a Configuración SAG"
        onError={onError}
        onVolver={() => volverConfigDashboard("control_global_cuentas")}
      />
    );
  }

  if (modulo === "documentos_digitales") {
    return wrapConfigSubmodule(
      "documentos_digitales",
      <DocumentosDigitales
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("documentos_digitales")}
      />
    );
  }

  if (
    modulo === "catalogo_sanitario_productos" &&
    currentUser &&
    canAccessCatalogoSanitarioProductos(currentUser)
  ) {
    return wrapConfigSubmodule(
      "catalogo_sanitario_productos",
      <ConfigSanitarioProductos
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("catalogo_sanitario_productos")}
      />
    );
  }

  if (
    modulo === "home_layout" &&
    currentUser &&
    canAccessConfigHomeLayout(currentUser)
  ) {
    return wrapConfigSubmodule(
      "home_layout",
      <ConfigHomeLayout
        apiOnline={apiOnline}
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("home_layout")}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (
    modulo === "home_layout_monitor" &&
    currentUser &&
    canAccessConfigHomeLayout(currentUser)
  ) {
    return wrapConfigSubmodule(
      "home_layout_monitor",
      <ConfigHomeLayoutMonitor
        apiOnline={apiOnline}
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("home_layout_monitor")}
        onError={onError}
      />
    );
  }

  if (
    modulo === "rubros_sag" &&
    currentUser &&
    canAccessConfigRubrosSag(currentUser)
  ) {
    return wrapConfigSubmodule(
      "rubros_sag",
      <RubrosSag
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => volverConfigDashboard("rubros_sag")}
        volverLabel="a Configuración SAG"
      />
    );
  }

  if (
    modulo === "dotacion_ganadera" &&
    currentUser &&
    canAccessConfigDotacionGanadera(currentUser)
  ) {
    return wrapConfigSubmodule(
      "dotacion_ganadera",
      <ConfigDotacionGanadera
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("dotacion_ganadera")}
      />
    );
  }

  if (
    modulo === "vencimientos_impuestos" &&
    currentUser &&
    canAccessConfigVencimientosImpuestos(currentUser)
  ) {
    return wrapConfigSubmodule(
      "vencimientos_impuestos",
      <ConfigVencimientosImpuestos
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        volverLabel="Volver a Configuración SAG"
        onVolver={() => volverConfigDashboard("vencimientos_impuestos")}
      />
    );
  }

  if (
    modulo === "billing_mp_settings" &&
    currentUser &&
    canAccessBillingMercadoPagoSettings(currentUser)
  ) {
    return wrapConfigSubmodule(
      "billing_mp_settings",
      <BillingMercadoPagoSettings
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("billing_mp_settings")}
      />
    );
  }

  if (
    modulo === "billing_suscripciones_plataforma" &&
    currentUser &&
    canAccessBillingAdminSuscripciones(currentUser)
  ) {
    return wrapConfigSubmodule(
      "billing_suscripciones_plataforma",
      <BillingAdminSuscripciones
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("billing_suscripciones_plataforma")}
      />
    );
  }

  return (
    <ConfigHubView
      activeId={modulo}
      navScope={configNavScopeForModulo(modulo)}
      esSuperAdmin={esSuperAdmin}
      cuentaNombre={cuentaNombre}
      apiOnline={apiOnline}
      currentUser={currentUser}
      onNavigate={(id) => setModulo(id as ModuloConfig)}
      onVolverDashboard={() => setModulo("menu")}
      onVolverInicio={onVolver}
      onOpenMiPerfil={onOpenMiPerfil}
    />
  );
}
