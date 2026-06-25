import { useCallback, useEffect, useMemo, useState } from "react";
import type { TabId } from "./Header";
import type { AuthUser } from "../types";
import {
  canAccessStockMovimientos,
  canAccessUsuarioActividad,
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

type VistaUsuarios =
  | "menu"
  | "usuarios_cuentas"
  | "permisos_por_rol"
  | "registro_actividad"
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

export default function UsuariosHub({
  user,
  apiOnline,
  onError,
  onSuccess,
  onPermissionsChanged,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<VistaUsuarios>("menu");

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
        visible: true,
      },
      {
        id: "permisos_por_rol",
        label: "Permisos por rol",
        subtitle: "Sectores y acceso de Gestor, Consulta, etc.",
        icon: { type: "hub", id: "usuarios_permisos_rol" },
        visible: true,
      },
      {
        id: "registro_actividad",
        label: "Registro de actividad",
        subtitle: "Logins, navegación y usuarios en línea",
        icon: { type: "tab", id: "registro_actividad" },
        visible: canAccessUsuarioActividad(user),
      },
      {
        id: "stock_movimientos",
        label: "Movimientos de dispositivos",
        subtitle: "Altas, bajas y modificaciones de dispositivos",
        icon: { type: "tab", id: "stock_movimientos" },
        visible: canAccessStockMovimientos(user),
      },
    ],
    [user]
  );

  const itemsVisibles = submenu.filter((item) => item.visible);

  if (vista === "usuarios_cuentas") {
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

  if (vista === "permisos_por_rol") {
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

  if (vista === "registro_actividad") {
    return (
      <UsuariosActividad
        apiOnline={apiOnline}
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
          <h2>Usuarios</h2>
          <p className="muted">Administración del sistema, cuentas y auditoría.</p>
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
