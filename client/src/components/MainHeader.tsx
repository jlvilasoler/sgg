import { useCallback, useEffect, useRef, useState } from "react";
import LogoSgg from "./LogoSgg";
import MiCuentaModal from "./MiCuentaModal";
import UserAvatar from "./UserAvatar";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  onHome: () => void;
  showBack?: boolean;
  onBack?: () => void;
  backTitle?: string;
  onLogout: () => void;
  onUserUpdated?: (user: AuthUser) => void;
  onPasswordChanged?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function MainHeader({
  user,
  onHome,
  showBack = false,
  onBack,
  backTitle,
  onLogout,
  onUserUpdated,
  onPasswordChanged,
  onError,
}: Props) {
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const syncToastOffset = useCallback(() => {
    const el = headerRef.current;
    const gap = 12;
    const offset = el ? el.getBoundingClientRect().height + gap : 16;
    document.documentElement.style.setProperty("--toast-top-offset", `${offset}px`);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    syncToastOffset();
    const ro = new ResizeObserver(() => syncToastOffset());
    ro.observe(el);
    window.addEventListener("resize", syncToastOffset);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncToastOffset);
      document.documentElement.style.setProperty("--toast-top-offset", "1rem");
    };
  }, [syncToastOffset]);

  const handlePasswordSuccess = (message: string) => {
    setCuentaModalOpen(false);
    onPasswordChanged?.(message);
  };

  const avatar = user.avatar ?? { tipo: "iniciales" as const, url: null };

  return (
    <>
      <header ref={headerRef} className="main-header">
        <div className="layout-frame main-header-inner">
          <button type="button" className="main-brand" onClick={onHome} title="Volver al menú">
            <LogoSgg className="main-brand-icon" />
            <div>
              <span className="main-brand-title">{APP_NAME}</span>
              <span className="main-brand-sub">{APP_FULL_NAME}</span>
            </div>
          </button>

          <div className="main-header-user">
            {!user.puede_escribir && (
              <span className="main-header-badge main-header-badge--readonly">
                Solo lectura
              </span>
            )}

            <div className="main-header-actions">
              {showBack && onBack && (
                <button
                  type="button"
                  className="main-header-back-btn"
                  onClick={onBack}
                  title={backTitle ? `Volver a ${backTitle}` : "Volver a la pantalla anterior"}
                  aria-label={backTitle ? `Volver a ${backTitle}` : "Volver a la pantalla anterior"}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M15 18l-6-6 6-6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="main-header-back-label">Volver</span>
                </button>
              )}

            </div>

            <div className="main-header-user-panel">
              <button
                type="button"
                className="main-header-user-trigger"
                onClick={() => setCuentaModalOpen(true)}
                title={`${user.rol_label} · ${user.email}`}
                aria-label={`${user.nombre}: mi cuenta y foto de perfil`}
              >
                <UserAvatar nombre={user.nombre} avatar={avatar} showLock />

                <span className="main-header-user-identity">
                  <span className="main-header-user-name">{user.nombre}</span>
                  <span className="main-header-user-meta">
                    <span className="main-header-user-role-chip" data-rol={user.rol}>
                      {user.rol_label}
                    </span>
                    <span className="main-header-user-email">{user.email}</span>
                  </span>
                </span>
              </button>

              <span className="main-header-user-divider" aria-hidden />

              <button
                type="button"
                className="main-header-panel-action main-header-panel-action--logout"
                onClick={onLogout}
                title="Cerrar sesión"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M16 17l5-5-5-5M21 12H9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <MiCuentaModal
        user={user}
        open={cuentaModalOpen}
        onClose={() => setCuentaModalOpen(false)}
        onUserUpdated={(u) => onUserUpdated?.(u)}
        onPasswordChanged={handlePasswordSuccess}
        onError={(msg) => onError?.(msg)}
      />
    </>
  );
}
