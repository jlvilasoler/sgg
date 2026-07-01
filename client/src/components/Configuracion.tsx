import { useEffect, useMemo, useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import { canAccessAdministradorCuentas, canAccessActividadSagTotal, canAccessArquitecturaSistema, canAccessCatalogoSanitarioProductos, canAccessClasificacionProveedores, canAccessControlGlobalCuentas, canAccessDocumentosDigitales, canAccessStockGanaderoAdmin, canManageUsuariosCuenta } from "../utils/auth-permissions";
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
import Usuarios from "./Usuarios";
import UsuariosActividad from "./UsuariosActividad";
import type { TabId } from "./Header";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";
import { PageModuleHeadRow } from "./PageModuleHead";

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
  | "catalogo_sanitario_productos";

type SagModuloIcon =
  | { type: "tab"; id: TabId }
  | { type: "hub"; id: HubIconId };

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
}

const CATALOGOS: {
  id: Exclude<CatalogoModulo, "admin_cuenta">;
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
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

const SAG_MODULOS: {
  id: SagModulo;
  label: string;
  subtitle: string;
  icon: SagModuloIcon;
}[] = [
  {
    id: "sag_arquitectura",
    label: "Arquitectura del sistema",
    subtitle: "Stack, módulos y estructura técnica de SAG",
    icon: { type: "hub", id: "arquitectura_sistema" },
  },
  {
    id: "registro_actividad_total",
    label: "Registro de actividad SAG total",
    subtitle: "Solo superadministrador de plataforma · todas las cuentas",
    icon: { type: "tab", id: "registro_actividad" },
  },
  {
    id: "control_global_cuentas",
    label: "Control global de cuentas",
    subtitle: "Solo superadministrador · animales y gastos por cuenta",
    icon: { type: "tab", id: "resumen" },
  },
  {
    id: "catalogo_sanitario_productos",
    label: "Catálogo sanitario",
    subtitle: "Remedios y fichas técnicas · Nombre comercial en Sanidad",
    icon: { type: "hub", id: "stock_sanidad" },
  },
  {
    id: "documentos_digitales",
    label: "Documentos Digitales",
    subtitle: "Archivo y gestión documental global",
    icon: { type: "tab", id: "documentos_digitales" },
  },
];

function sagModuloTheme(icon: SagModuloIcon) {
  return icon.type === "tab" ? MENU_APP_THEMES[icon.id] : HUB_ICON_THEMES[icon.id];
}

function sagModuloIconNode(icon: SagModuloIcon) {
  return icon.type === "tab" ? (
    <MenuAppIcon id={icon.id} className="menu-app-icon-svg" />
  ) : (
    <HubMenuIcon id={icon.id} className="menu-app-icon-svg" />
  );
}

function nombreCuentaConfig(user: AuthUser | null | undefined): string {
  return (
    user?.cuenta_actividad_nombre?.trim() ||
    user?.empresa_nombre?.trim() ||
    "Cuenta"
  );
}

function isCatalogoModulo(modulo: ModuloConfig): modulo is CatalogoModulo {
  return (
    modulo === "responsables" ||
    modulo === "proveedores" ||
    modulo === "clasificacion_proveedores" ||
    modulo === "rubros" ||
    modulo === "stock_ganadero" ||
    modulo === "stock_equino" ||
    modulo === "admin_cuenta" ||
    modulo === "usuarios"
  );
}

export default function Configuracion({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
}: Props) {
  const [modulo, setModulo] = useState<ModuloConfig>("menu");
  const esSuperAdmin = Boolean(currentUser?.es_super_admin);
  const cuentaNombre = nombreCuentaConfig(currentUser);

  const backStep = useMemo(() => {
    if (modulo === "menu") return null;
    if (modulo === "cuenta_hub" || modulo === "sag_hub") {
      return { onBack: () => setModulo("menu"), label: "Configuración" };
    }
    if (modulo === "sag_arquitectura" || modulo === "documentos_digitales" || modulo === "registro_actividad_total" || modulo === "control_global_cuentas" || modulo === "catalogo_sanitario_productos") {
      return { onBack: () => setModulo("sag_hub"), label: "Configuración SAG" };
    }
    if (esSuperAdmin && isCatalogoModulo(modulo)) {
      return { onBack: () => setModulo("cuenta_hub"), label: "Configuración cuenta" };
    }
    return { onBack: () => setModulo("menu"), label: "Configuración" };
  }, [modulo, esSuperAdmin]);

  useHeaderBackStep(
    Boolean(backStep),
    backStep?.onBack ?? (() => setModulo("menu")),
    backStep?.label ?? "Configuración"
  );

  useEffect(() => {
    if (
      modulo === "clasificacion_proveedores" &&
      !canAccessClasificacionProveedores(currentUser ?? null)
    ) {
      setModulo(esSuperAdmin ? "cuenta_hub" : "menu");
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
    if (modulo === "usuarios" && !canManageUsuariosCuenta(currentUser ?? null)) {
      setModulo(esSuperAdmin ? "cuenta_hub" : "menu");
    }
  }, [modulo, currentUser, esSuperAdmin]);

  if (modulo === "responsables") {
    return (
      <Responsables
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "proveedores") {
    return (
      <Proveedores
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "clasificacion_proveedores") {
    return (
      <ClasificacionProveedores
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "rubros") {
    return (
      <Rubros
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onCatalogosChanged={onCatalogosChanged}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
        volverLabel={esSuperAdmin ? "a Configuración cuenta" : "a Configuración"}
      />
    );
  }

  if (modulo === "stock_ganadero") {
    return (
      <StockGanaderoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "stock_equino") {
    return (
      <StockEquinoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "admin_cuenta") {
    return (
      <AdministradorCuenta
        apiOnline={apiOnline}
        currentUser={currentUser!}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (
    modulo === "usuarios" &&
    currentUser &&
    canManageUsuariosCuenta(currentUser)
  ) {
    return (
      <Usuarios
        apiOnline={apiOnline}
        currentUser={currentUser}
        volverLabel={esSuperAdmin ? "Volver a Configuración cuenta" : "Volver a Configuración"}
        onVolver={backStep?.onBack ?? (() => setModulo(esSuperAdmin ? "cuenta_hub" : "menu"))}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (modulo === "sag_arquitectura") {
    return (
      <ArquitecturaSistema
        apiOnline={apiOnline}
        currentUser={currentUser}
        volverLabel="Volver a Configuración SAG"
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
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
    return (
      <UsuariosActividad
        apiOnline={apiOnline}
        currentUser={currentUser}
        modo="total"
        titulo="Registro de actividad SAG total"
        subtituloAmbito="Todas las cuentas y usuarios de la plataforma"
        volverLabel="Volver a Configuración SAG"
        onError={onError}
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
      />
    );
  }

  if (
    modulo === "control_global_cuentas" &&
    currentUser &&
    canAccessControlGlobalCuentas(currentUser)
  ) {
    return (
      <ControlGlobalCuentas
        apiOnline={apiOnline}
        volverLabel="Volver a Configuración SAG"
        onError={onError}
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
      />
    );
  }

  if (modulo === "documentos_digitales") {
    return (
      <DocumentosDigitales
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
      />
    );
  }

  if (
    modulo === "catalogo_sanitario_productos" &&
    currentUser &&
    canAccessCatalogoSanitarioProductos(currentUser)
  ) {
    return (
      <ConfigSanitarioProductos
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        volverLabel="Volver a Configuración SAG"
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
      />
    );
  }

  const adminCuentaItem = canAccessAdministradorCuentas(currentUser ?? null)
    ? [
        {
          id: "admin_cuenta" as const,
          label: "Administrador de Cuentas",
          subtitle: "Datos de su cuenta, empresas y usuarios",
          icon: "config_admin_cuenta" as HubIconId,
        },
      ]
    : [];

  const catalogosVisibles = CATALOGOS.filter((item) => {
    if (item.id === "clasificacion_proveedores") {
      return canAccessClasificacionProveedores(currentUser ?? null);
    }
    if (item.id === "stock_ganadero" || item.id === "stock_equino") {
      return canAccessStockGanaderoAdmin(currentUser ?? null);
    }
    return true;
  });

  const itemsCuenta = [...catalogosVisibles, ...adminCuentaItem];
  const showUsuariosCuenta = canManageUsuariosCuenta(currentUser ?? null);

  const renderUsuariosCuentaCard = () =>
    showUsuariosCuenta ? (
      <HubMenuCard
        key="usuarios"
        label="Usuarios"
        subtitle={`Administración de usuarios de ${cuentaNombre}`}
        theme={MENU_APP_THEMES.usuarios}
        icon={<MenuAppIcon id="usuarios" className="menu-app-icon-svg" />}
        onClick={() => setModulo("usuarios")}
      />
    ) : null;
  const itemsSag = SAG_MODULOS.filter((item) => {
    if (item.id === "documentos_digitales") {
      return canAccessDocumentosDigitales(currentUser ?? null);
    }
    if (item.id === "registro_actividad_total") {
      return canAccessActividadSagTotal(currentUser ?? null);
    }
    if (item.id === "control_global_cuentas") {
      return canAccessControlGlobalCuentas(currentUser ?? null);
    }
    if (item.id === "sag_arquitectura") {
      return canAccessArquitecturaSistema(currentUser ?? null);
    }
    if (item.id === "catalogo_sanitario_productos") {
      return canAccessCatalogoSanitarioProductos(currentUser ?? null);
    }
    return true;
  });

  if (modulo === "cuenta_hub") {
    return (
      <div className="subseccion-panel configuracion-hub">
        <button type="button" className="subseccion-back" onClick={() => setModulo("menu")}>
          ‹ Volver a Configuración
        </button>
        <div className="card configuracion-hub-card">
          <div className="form-header">
            <PageModuleHeadRow
              icon={{ source: "app", id: "configuracion" }}
              title={`Configuración cuenta ${cuentaNombre}`}
              subtitle={
                <>
                  Catálogos y ajustes operativos de <strong>{cuentaNombre}</strong>: presupuesto
                  asignado, proveedores, rubros y usuarios de la cuenta.
                </>
              }
            />
          </div>
          <nav className="app-grid" aria-label="Configuración de cuenta">
            {itemsCuenta.map((item) => (
              <HubMenuCard
                key={item.id}
                label={item.label}
                subtitle={item.subtitle}
                theme={HUB_ICON_THEMES[item.icon]}
                icon={<HubMenuIcon id={item.icon} />}
                onClick={() => setModulo(item.id)}
              />
            ))}
            {renderUsuariosCuentaCard()}
          </nav>
        </div>
      </div>
    );
  }

  if (modulo === "sag_hub") {
    return (
      <div className="subseccion-panel configuracion-hub">
        <button type="button" className="subseccion-back" onClick={() => setModulo("menu")}>
          ‹ Volver a Configuración
        </button>
        <div className="card configuracion-hub-card">
          <div className="form-header">
            <PageModuleHeadRow
              icon={{ source: "app", id: "configuracion" }}
              title="Configuración SAG (Superadministrador)"
              subtitle="Herramientas globales de la plataforma: cuentas madre, empresas y documentación central."
            />
          </div>
          <nav className="app-grid" aria-label="Configuración SAG">
            {itemsSag.map((item) => (
              <HubMenuCard
                key={item.id}
                label={item.label}
                subtitle={item.subtitle}
                theme={sagModuloTheme(item.icon)}
                icon={sagModuloIconNode(item.icon)}
                onClick={() => setModulo(item.id)}
              />
            ))}
          </nav>
        </div>
      </div>
    );
  }

  if (esSuperAdmin) {
    return (
      <div className="subseccion-panel configuracion-hub">
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver al inicio
        </button>
        <div className="card configuracion-hub-card">
          <div className="form-header">
            <PageModuleHeadRow
              icon={{ source: "app", id: "configuracion" }}
              title="Configuración"
              subtitle={
                <>
                  Elegí si querés configurar su cuenta operativa ({cuentaNombre}) o la plataforma
                  completa como superadministrador.
                </>
              }
            />
          </div>
          <nav className="app-grid" aria-label="Configuración">
            <HubMenuCard
              label="Configuración cuenta"
              subtitle={`Catálogos y ajustes de ${cuentaNombre}`}
              theme={MENU_APP_THEMES.configuracion}
              className="hub-menu-card--cuenta"
              icon={<MenuAppIcon id="configuracion" className="menu-app-icon-svg" />}
              onClick={() => setModulo("cuenta_hub")}
            />
            <HubMenuCard
              label="Configuración SAG (Superadministrador)"
              subtitle="Cuentas madre, empresas y administración global"
              theme={MENU_APP_THEMES.panel_admin_sitio}
              className="hub-menu-card--sag-superadmin"
              icon={<MenuAppIcon id="panel_admin_sitio" className="menu-app-icon-svg" />}
              onClick={() => setModulo("sag_hub")}
            />
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className="subseccion-panel configuracion-hub">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al inicio
      </button>
      <div className="card configuracion-hub-card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "app", id: "configuracion" }}
            title="Configuración"
            subtitle={
              <>
                Catálogos de apoyo para registrar gastos:{" "}
                <strong>presupuesto asignado</strong>, <strong>proveedores</strong> y{" "}
                <strong>rubros</strong>.
              </>
            }
          />
        </div>
        <nav className="app-grid" aria-label="Configuración">
          {itemsCuenta.map((item) => (
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={HUB_ICON_THEMES[item.icon]}
              icon={<HubMenuIcon id={item.icon} />}
              onClick={() => setModulo(item.id)}
            />
          ))}
          {renderUsuariosCuentaCard()}
        </nav>
      </div>
    </div>
  );
}
