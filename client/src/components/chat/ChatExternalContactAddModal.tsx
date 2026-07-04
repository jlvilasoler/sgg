import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { APP_NAME } from "../../brand";
import ChatExternalPeopleIcon from "./ChatExternalPeopleIcon";

interface Props {
  open: boolean;
  email: string;
  busy: boolean;
  error?: string | null;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function ChatExternalContactAddModal({
  open,
  email,
  busy,
  error,
  onEmailChange,
  onSubmit,
  onClose,
}: Props) {
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="pd-overlay usuarios-form-modal-overlay bn-ui chat-external-add-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="usuarios-form-modal chat-external-add-modal chat-hub-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="usuarios-form-modal-head chat-external-add-head">
          <div className="chat-external-add-head-row">
            <span className="chat-external-add-head-icon" aria-hidden>
              <ChatExternalPeopleIcon />
            </span>
            <div className="usuarios-form-modal-head-main">
              <p className="usuarios-form-modal-kicker sg-hub-panel-kicker">Chat · Otras cuentas</p>
              <h2 id={titleId} className="usuarios-form-modal-title">
                Agregar contacto
              </h2>
              <p className="usuarios-form-modal-sub">
                Conectá con un usuario de otra cuenta en {APP_NAME} mediante su correo de acceso.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="usuarios-form-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="usuarios-form-modal-body">
          <div className="chat-external-add-guide">
            <ul className="chat-external-add-steps">
              <li>
                Ingresá el <strong>correo electrónico</strong> con el que esa persona inicia
                sesión en la aplicación.
              </li>
              <li className="chat-external-add-steps-note">
                Solo podés agregar usuarios con <strong>cuenta operativa y activa</strong> en la
                plataforma. Si el correo no está registrado, la solicitud no podrá completarse.
              </li>
            </ul>
          </div>

          <div className="usuarios-form-modal-panel usuarios-form-modal-panel--secondary">
            <div className="field">
              <label htmlFor={inputId}>Correo electrónico del usuario</label>
              <input
                ref={inputRef}
                id={inputId}
                type="email"
                autoComplete="email"
                placeholder="nombre@correo.com"
                value={email}
                maxLength={120}
                disabled={busy}
                onChange={(e) => onEmailChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
              />
            </div>
          </div>

          {error && (
            <p className="chat-external-add-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <footer className="usuarios-form-modal-footer">
          <button
            type="button"
            className="sg-hub-cta sg-hub-cta--ghost usuarios-form-modal-cancel"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="sg-hub-cta"
            disabled={busy || !email.trim()}
            onClick={onSubmit}
          >
            {busy ? "Enviando…" : "Enviar solicitud"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
