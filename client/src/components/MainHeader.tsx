import { useCallback, useEffect, useState } from "react";
import LogoSgg from "./LogoSgg";
import MiCuentaModal from "./MiCuentaModal";
import UserAvatar from "./UserAvatar";
import ChatPanel from "./ChatPanel";
import { fetchChatUnread } from "../api";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  onHome: () => void;
  onLogout: () => void;
  onUserUpdated?: (user: AuthUser) => void;
  onPasswordChanged?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function MainHeader({
  user,
  onHome,
  onLogout,
  onUserUpdated,
  onPasswordChanged,
  onError,
}: Props) {
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await fetchChatUnread();
      setChatUnread(data.total);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 20000);
    return () => window.clearInterval(id);
  }, [refreshUnread]);

  const handlePasswordSuccess = (message: string) => {
    setCuentaModalOpen(false);
    onPasswordChanged?.(message);
  };

  const avatar = user.avatar ?? { tipo: "iniciales" as const, url: null };

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
              className={`main-header-chat-btn${chatOpen ? " main-header-chat-btn--active" : ""}`}
              onClick={() => setChatOpen((v) => !v)}
              title="Chat interno (clic para abrir/cerrar)"
              aria-label={`Chat interno${chatUnread > 0 ? `, ${chatUnread} sin leer` : ""}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 18.5V8.8a2.2 2.2 0 0 1 2.2-2.2h9.6A2.2 2.2 0 0 1 19 8.8v5.4a2.2 2.2 0 0 1-2.2 2.2H9.5L5 18.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M8.5 10h7M8.5 13h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {chatUnread > 0 && (
                <span className="main-header-chat-badge">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
            </button>

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
                className="main-header-user-logout"
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

      <ChatPanel
        user={user}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setChatUnread}
      />

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
