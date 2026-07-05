import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import {
  canAccessActividadSagTotal,
  canAccessCatalogoSanitarioProductos,
  canAccessClasificacionProveedores,
  canAccessConfigVencimientosImpuestos,
  canAccessControlGlobalCuentas,
  canAccessStockGanaderoAdmin,
  canManageUsuariosCuenta,
} from "../utils/auth-permissions";
import Proveedores from "./Proveedores";
import ClasificacionProveedores from "./proveedores/ClasificacionProveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";
import StockGanaderoAdmin from "./stock/StockGanaderoAdmin";
import StockEquinoAdmin from "./stock-equino/StockEquinoAdmin";
import AdministradorCuenta from "./AdministradorCuenta";
import ArquitecturaSistema from "./ArquitecturaSistema";
import DocumentosDigitales from "./DocumentosDigitales";
import ControlGlobalCuentas from "./ControlGlobalCuentas";
import ConfigSanitarioProductos from "./stock/ConfigSanitarioProductos";
import ConfigVencimientosImpuestos from "./ConfigVencimientosImpuestos";
import Usuarios from "./Usuarios";
import UsuariosActividad from "./UsuariosActividad";
import ConfigHubView from "./config/ConfigHubView";
import { configNavScopeForModulo } from "./config/config-hub-items";

type CatalogoModulo =
  | "responsables"
  | "proveedores"
  | "clasificacion_proveedores"
  | "rubros"
  | "stock_ganadero"
  | "stock_equino"
  | "admin_cuenta"
  | "usuarios";

type SagModulo =
  | "sag_arquitectura"
  | "registro_actividad_total"
  | "control_global_cuentas"
  | "documentos_digitales"
  | "catalogo_sanitario_productos"
  | "vencimientos_impuestos";

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
}: Props) {
  const [modulo, setModulo] = useState<ModuloConfig>("menu");
  const esSuperAdmin = Boolean(currentUser?.es_super_admin);
  const cuentaNombre = nombreCuentaConfig(currentUser);

  const volverConfigDashboard = useCallback(
    (targetModulo: ModuloConfig) => {
      const scope = configNavScopeForModulo(targetModulo);
      if (scope === "sag") {
        setModulo("sag_hub");
      } else if (scope === "cuenta" && esSuperAdmin) {
        setModulo("cuenta_hub");
      } else {
        setModulo("menu");
      }
    },
    [esSuperAdmin]
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
    if (scope === "cuenta" && esSuperAdmin && modulo !== "cuenta_hub") {
      return "Configuración cuenta";
    }
    return "Configuración";
  }, [modulo, esSuperAdmin]);

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
      setModulo(esSuperAdmin ? "cuenta_hub" : "menu");
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
      modulo === "vencimientos_impuestos" &&
      !canAccessConfigVencimientosImpuestos(currentUser ?? null)
    ) {
      setModulo("sag_hub");
    }
    if (modulo === "usuarios" && !canManageUsuariosCuenta(currentUser ?? null)) {
      setModulo(esSuperAdmin ? "cuenta_hub" : "menu");
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

  if (modulo === "rubros") {
    return wrapConfigSubmodule(
      "rubros",
      <Rubros
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={() => volverConfigDashboard("rubros")}
        volverLabel={esSuperAdmin ? "a Configuración cuenta" : "a Configuración"}
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

  if (modulo === "admin_cuenta") {
    return wrapConfigSubmodule(
      "admin_cuenta",
      <AdministradorCuenta
        apiOnline={apiOnline}
        currentUser={currentUser!}
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
        volverLabel={
          esSuperAdmin ? "Volver a Configuración cuenta" : "Volver a Configuración"
        }
        onVolver={() => volverConfigDashboard("usuarios")}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (modulo === "sag_arquitectura") {
    return wrapConfigSubmodule(
      "sag_arquitectura",
      <ArquitecturaSistema
        apiOnline={apiOnline}
        currentUser={currentUser}
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
