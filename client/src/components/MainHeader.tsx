import LogoSgg from "./LogoSgg";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  onHome: () => void;
  onLogout: () => void;
}

export default function MainHeader({ user, onHome, onLogout }: Props) {
  return (
    <header className="main-header">
      <div className="layout-frame main-header-inner">
        <button type="button" className="main-brand" onClick={onHome} title="Volver al menú">
          <LogoSgg className="main-brand-icon" />
          <div>
            <span className="main-brand-title">SGG</span>
            <span className="main-brand-sub">Sistema de Gestión Ganadera</span>
          </div>
        </button>

        <div className="main-header-user">
          {!user.puede_escribir && (
            <span className="main-header-badge main-header-badge--readonly">
              Solo lectura
            </span>
          )}
          <div className="main-header-user-info">
            <span className="main-header-user-name">{user.nombre}</span>
            <span className="main-header-user-meta">
              {user.rol_label} · {user.email}
            </span>
          </div>
          <button type="button" className="btn btn-ghost main-header-logout" onClick={onLogout}>
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
