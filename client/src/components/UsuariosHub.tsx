import { useCallback, useEffect, useMemo, useState } from "react";
import type { TabId } from "./Header";
import type { AuthUser } from "../types";
import {
  canAccessActividadCuenta,
  canAccessActividadPropia,
  canAccessPermisosPorRol,
  canAccessStockMovimientos,
  canManageUsuariosCuenta,
} from "../utils/auth-permissions";
import { HubMenuCard } from "./HubMenuCard";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import { useHeaderBackContext } from "../header-back";
import Usuarios from "./Usuarios";
import UsuariosActividad from "./UsuariosActividad";
import UsuariosRolesPanel from "./UsuariosRolesModal";
import StockMovimientosAuditoria from "./stock/StockMovimientosAuditoria";
import { PageModuleHeadRow } from "./PageModuleHead";
type VistaUsuarios =
  | "menu"
  | "usuarios_cuentas"
  | "permisos_por_rol"
  | "registro_actividad_cuenta"
  | "registro_actividad_propio"
  | "stock_movimientos";

type SubmenuIcon =
  | { type: "tab"; id: TabId }
  | { type: "hub"; id: HubIconId };

interface SubmenuItem {
  id: Exclude<VistaUsuarios, "menu">;
  label: string;
  subtitle: string;
  icon: SubmenuIcon;
  visible: boolean;
}

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onPermissionsChanged?: () => void;
  onVolver: () => void;
}

function submenuTheme(icon: SubmenuIcon) {
  return icon.type === "tab" ? MENU_APP_THEMES[icon.id] : HUB_ICON_THEMES[icon.id];
}

function submenuIconNode(icon: SubmenuIcon) {
  return icon.type === "tab" ? (
    <MenuAppIcon id={icon.id} className="menu-app-icon-svg" />
  ) : (
    <HubMenuIcon id={icon.id} className="menu-app-icon-svg" />
  );
}

function nombreCuentaActividad(user: AuthUser): string {
  return (
    user.cuenta_actividad_nombre?.trim() ||
    user.empresa_nombre?.trim() ||
    "Cuenta"
  );
}

export default function UsuariosHub({
  user,
  apiOnline,
  onError,
  onSuccess,
  onPermissionsChanged,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<VistaUsuarios>("menu");
  const cuentaNombre = nombreCuentaActividad(user);

  const volverMenu = useCallback(() => {
    setVista("menu");
  }, []);

  const headerBack = useHeaderBackContext();
  useEffect(() => {
    if (!headerBack) return;
    if (vista === "menu") {
      headerBack.setStep(null);
      return;
    }
    headerBack.setStep({
      onBack: volverMenu,
      destinationLabel: "Usuarios",
    });
    return () => headerBack.setStep(null);
  }, [vista, volverMenu, headerBack]);

  const submenu = useMemo<SubmenuItem[]>(
    () => [
      {
        id: "usuarios_cuentas",
        label: "Administración de Usuarios",
        subtitle: "Cuentas, altas y edición de usuarios",
        icon: { type: "tab", id: "usuarios" },
        visible: canManageUsuariosCuenta(user),
      },
      {
        id: "permisos_por_rol",
        label: "Permisos por rol",
        subtitle: "Sectores y acceso de Gestor, Consulta, etc.",
        icon: { type: "hub", id: "usuarios_permisos_rol" },
        visible: canAccessPermisosPorRol(user),
      },
      {
        id: "registro_actividad_cuenta",
        label: `Actividad de cuenta ${cuentaNombre}`,
        subtitle: "Logins, navegación y usuarios de su equipo",
        icon: { type: "tab", id: "registro_actividad" },
        visible: canAccessActividadCuenta(user),
      },
      {
        id: "registro_actividad_propio",
        label: "Mi registro de actividad",
        subtitle: "Su historial de uso en la aplicación",
        icon: { type: "tab", id: "registro_actividad" },
        visible: canAccessActividadPropia(user),
      },
      {
        id: "stock_movimientos",
        label: "Movimientos de dispositivos",
        subtitle: "Altas, bajas y modificaciones de dispositivos",
        icon: { type: "tab", id: "stock_movimientos" },
        visible: canAccessStockMovimientos(user),
      },
    ],
    [user, cuentaNombre]
  );

  const itemsVisibles = submenu.filter((item) => item.visible);

  useEffect(() => {
    if (vista === "permisos_por_rol" && !canAccessPermisosPorRol(user)) {
      setVista("menu");
    }
    if (vista === "usuarios_cuentas" && !canManageUsuariosCuenta(user)) {
      setVista("menu");
    }
  }, [vista, user]);

  if (vista === "usuarios_cuentas" && canManageUsuariosCuenta(user)) {
    return (
      <Usuarios
        apiOnline={apiOnline}
        currentUser={user}
        volverLabel="Volver a Usuarios"
        onVolver={volverMenu}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  if (vista === "permisos_por_rol" && canAccessPermisosPorRol(user)) {
    return (
      <UsuariosRolesPanel
        apiOnline={apiOnline}
        volverLabel="Volver a Usuarios"
        onVolver={volverMenu}
        onError={onError}
        onSuccess={onSuccess}
        onSaved={onPermissionsChanged}
      />
    );
  }

  if (vista === "registro_actividad_cuenta") {
    return (
      <UsuariosActividad
        apiOnline={apiOnline}
        currentUser={user}
        modo="cuenta"
        titulo={`Actividad de cuenta ${cuentaNombre}`}
        subtituloAmbito={`Usuarios y actividad de ${cuentaNombre}`}
        volverLabel="Volver a Usuarios"
        onError={onError}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "registro_actividad_propio") {
    return (
      <UsuariosActividad
        apiOnline={apiOnline}
        currentUser={user}
        modo="propio"
        titulo="Mi registro de actividad"
        subtituloAmbito="Su historial personal en la aplicación"
        volverLabel="Volver a Usuarios"
        onError={onError}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "stock_movimientos") {
    return (
      <StockMovimientosAuditoria
        apiOnline={apiOnline}
        volverLabel="Volver a Usuarios"
        onError={onError}
        onVolver={volverMenu}
      />
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
            icon={{ source: "app", id: "usuarios" }}
            title="Usuarios"
            subtitle="Administración del sistema, cuentas y auditoría."
          />
        </div>
        <nav className="app-grid" aria-label="Usuarios">
          {itemsVisibles.map((item) => (
            <HubMenuCard
              key={item.id}
              label={item.label}
              subtitle={item.subtitle}
              theme={submenuTheme(item.icon)}
              icon={submenuIconNode(item.icon)}
              onClick={() => setVista(item.id)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
