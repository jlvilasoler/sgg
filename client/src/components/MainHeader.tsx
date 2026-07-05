import { useRef } from "react";
import LogoSgg from "./LogoSgg";
import UserAvatar from "./UserAvatar";
import { APP_FULL_NAME, APP_NAME } from "../brand";
import type { AuthUser } from "../types";
import { useChatExternalRequestsOptional } from "../context/ChatExternalRequestsContext";

interface Props {
  user: AuthUser;
  onHome: () => void;
  showBack?: boolean;
  onBack?: () => void;
  backTitle?: string;
  onLogout: () => void;
  onOpenCuenta: () => void;
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
  onOpenCuenta,
}: Props) {
  const headerRef = useRef<HTMLElement>(null);
  const chatReq = useChatExternalRequestsOptional();
  const pendingCuenta = chatReq?.snoozedCount ?? 0;

  const avatar = user.avatar ?? { tipo: "iniciales" as const, url: null };

  return (
    <>
      <header ref={headerRef} className="main-header">
        <div className="layout-chrome main-header-inner">
          <button type="button" className="main-brand" onClick={onHome} title="Volver al menú">
            <LogoSgg className="main-brand-icon" />
            <div className="main-brand-copy">
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
                className={`main-header-user-trigger${pendingCuenta > 0 ? " main-header-user-trigger--pending" : ""}`}
                onClick={onOpenCuenta}
                title={
                  pendingCuenta > 0
                    ? `${user.rol_label} · ${user.email} · ${pendingCuenta} solicitud${pendingCuenta === 1 ? "" : "es"} de chat pendiente${pendingCuenta === 1 ? "" : "s"} en Mi cuenta`
                    : `${user.rol_label} · ${user.email}`
                }
                aria-label={
                  pendingCuenta > 0
                    ? `${user.nombre}: mi cuenta (${pendingCuenta} solicitud${pendingCuenta === 1 ? "" : "es"} de chat pendiente${pendingCuenta === 1 ? "" : "s"})`
                    : `${user.nombre}: mi cuenta y foto de perfil`
                }
              >
                <span className="main-header-user-avatar-wrap">
                  <UserAvatar nombre={user.nombre} avatar={avatar} showLock />
                  {pendingCuenta > 0 && (
                    <span
                      className="main-header-pending-badge"
                      aria-hidden
                    >
                      {pendingCuenta > 9 ? "9+" : pendingCuenta}
                    </span>
                  )}
                </span>

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
    </>
  );
}
