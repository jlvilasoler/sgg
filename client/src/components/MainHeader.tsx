import { useState } from "react";
import LogoSgg from "./LogoSgg";
import CambiarPasswordModal, { userInicialesFromNombre } from "./CambiarPasswordModal";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  onHome: () => void;
  onLogout: () => void;
  onPasswordChanged?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function MainHeader({
  user,
  onHome,
  onLogout,
  onPasswordChanged,
  onError,
}: Props) {
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const handlePasswordSuccess = (message: string) => {
    setPasswordModalOpen(false);
    onPasswordChanged?.(message);
  };

  return (
    <>
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
            <button
              type="button"
              className="main-header-user-avatar-btn"
              onClick={() => setPasswordModalOpen(true)}
              title="Cambiar contraseña"
              aria-label={`${user.nombre}: cambiar contraseña`}
            >
              <span className="main-header-user-avatar" aria-hidden>
                {userInicialesFromNombre(user.nombre)}
              </span>
              <span className="main-header-user-avatar-lock" aria-hidden>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 11V8a5 5 0 0 1 10 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="10"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
            </button>
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

      <CambiarPasswordModal
        user={user}
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onSuccess={handlePasswordSuccess}
        onError={(msg) => onError?.(msg)}
      />
    </>
  );
}
