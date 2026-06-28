import { useEffect, useMemo, useState } from "react";
import { HubMenuCard } from "./HubMenuCard";
import { useHeaderBackStep } from "../header-back";
import type { AuthUser } from "../types";
import { canAccessAdministradorCuentas, canAccessClasificacionProveedores, canAccessDocumentosDigitales, canAccessStockGanaderoAdmin } from "../utils/auth-permissions";
import Proveedores from "./Proveedores";
import ClasificacionProveedores from "./proveedores/ClasificacionProveedores";
import Responsables from "./Responsables";
import Rubros from "./Rubros";
import StockGanaderoAdmin from "./stock/StockGanaderoAdmin";
import AdministradorCuenta from "./AdministradorCuenta";
import ArquitecturaSistema from "./ArquitecturaSistema";
import DocumentosDigitales from "./DocumentosDigitales";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";

type CatalogoModulo =
  | "responsables"
  | "proveedores"
  | "clasificacion_proveedores"
  | "rubros"
  | "stock_ganadero"
  | "admin_cuenta";

type SagModulo = "sag_arquitectura" | "documentos_digitales";

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
    subtitle: "Catálogo de proveedores",
    icon: "config_proveedores",
  },
  {
    id: "clasificacion_proveedores",
    label: "Clasificación proveedores",
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
];

const SAG_MODULOS: {
  id: SagModulo;
  label: string;
  subtitle: string;
  icon: "panel_admin_sitio" | "documentos_digitales";
}[] = [
  {
    id: "sag_arquitectura",
    label: "Administración del sitio",
    subtitle: "Cuentas madre, empresas y usuarios de la plataforma",
    icon: "panel_admin_sitio",
  },
  {
    id: "documentos_digitales",
    label: "Documentos Digitales",
    subtitle: "Archivo y gestión documental global",
    icon: "documentos_digitales",
  },
];

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
    modulo === "admin_cuenta"
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
    if (modulo === "sag_arquitectura" || modulo === "documentos_digitales") {
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
      modulo === "stock_ganadero" &&
      !canAccessStockGanaderoAdmin(currentUser ?? null)
    ) {
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

  if (modulo === "admin_cuenta") {
    return (
      <AdministradorCuenta
        apiOnline={apiOnline}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={backStep?.onBack ?? (() => setModulo("menu"))}
      />
    );
  }

  if (modulo === "sag_arquitectura") {
    return (
      <ArquitecturaSistema
        apiOnline={apiOnline}
        titulo="Administración del sitio"
        volverLabel="Volver a Configuración SAG"
        onVolver={backStep?.onBack ?? (() => setModulo("sag_hub"))}
        onError={onError}
        onSuccess={onSuccess}
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
    if (item.id === "stock_ganadero") {
      return canAccessStockGanaderoAdmin(currentUser ?? null);
    }
    return true;
  });

  const itemsCuenta = [...catalogosVisibles, ...adminCuentaItem];
  const itemsSag = SAG_MODULOS.filter((item) =>
    item.id === "documentos_digitales"
      ? canAccessDocumentosDigitales(currentUser ?? null)
      : true
  );

  if (modulo === "cuenta_hub") {
    return (
      <div className="subseccion-panel configuracion-hub">
        <button type="button" className="subseccion-back" onClick={() => setModulo("menu")}>
          ‹ Volver a Configuración
        </button>
        <div className="card configuracion-hub-card">
          <div className="form-header">
            <h2>Configuración cuenta {cuentaNombre}</h2>
            <p className="muted">
              Catálogos y ajustes operativos de <strong>{cuentaNombre}</strong>: presupuesto
              asignado, proveedores y rubros.
            </p>
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
            <h2>Configuración SAG (Superadministrador)</h2>
            <p className="muted">
              Herramientas globales de la plataforma: cuentas madre, empresas y documentación
              central.
            </p>
          </div>
          <nav className="app-grid" aria-label="Configuración SAG">
            {itemsSag.map((item) => (
              <HubMenuCard
                key={item.id}
                label={item.label}
                subtitle={item.subtitle}
                theme={MENU_APP_THEMES[item.icon]}
                icon={<MenuAppIcon id={item.icon} className="menu-app-icon-svg" />}
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
            <h2>Configuración</h2>
            <p className="muted">
              Elegí si querés configurar su cuenta operativa ({cuentaNombre}) o la plataforma
              completa como superadministrador.
            </p>
          </div>
          <nav className="app-grid" aria-label="Configuración">
            <HubMenuCard
              label="Configuración cuenta"
              subtitle={`Catálogos y ajustes de ${cuentaNombre}`}
              theme={MENU_APP_THEMES.configuracion}
              icon={<MenuAppIcon id="configuracion" className="menu-app-icon-svg" />}
              onClick={() => setModulo("cuenta_hub")}
            />
            <HubMenuCard
              label="Configuración SAG (Superadministrador)"
              subtitle="Cuentas madre, empresas y administración global"
              theme={MENU_APP_THEMES.panel_admin_sitio}
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
          <h2>Configuración</h2>
          <p className="muted">
            Catálogos de apoyo para registrar gastos:{" "}
            <strong>presupuesto asignado</strong>, <strong>proveedores</strong> y{" "}
            <strong>rubros</strong>.
          </p>
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
        </nav>
      </div>
    </div>
  );
}
