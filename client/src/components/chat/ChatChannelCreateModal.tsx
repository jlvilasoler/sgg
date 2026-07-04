import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import ChatChannelIcon from "./ChatChannelIcon";

interface Props {
  open: boolean;
  name: string;
  busy: boolean;
  error?: string | null;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function ChatChannelCreateModal({
  open,
  name,
  busy,
  error,
  onNameChange,
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

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 2;

  return createPortal(
    <div
      className="pd-overlay usuarios-form-modal-overlay bn-ui chat-channel-create-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="usuarios-form-modal chat-channel-create-modal chat-hub-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="usuarios-form-modal-head chat-external-add-head">
          <div className="chat-external-add-head-row">
            <span className="chat-external-add-head-icon chat-channel-create-head-icon" aria-hidden>
              <ChatChannelIcon />
            </span>
            <div className="usuarios-form-modal-head-main">
              <p className="usuarios-form-modal-kicker sg-hub-panel-kicker">Chat · Canales</p>
              <h2 id={titleId} className="usuarios-form-modal-title">
                Nuevo canal
              </h2>
              <p className="usuarios-form-modal-sub">
                Defina un espacio de comunicación grupal para su equipo.
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
          <div className="chat-external-add-guide chat-channel-create-guide">
            <p>
              Hacé un espacio de conversación grupal dentro de su cuenta.
              Su finalidad es reunir en un mismo lugar el intercambio de mensajes entre los usuarios, para mejorar la operación diaria.
            </p>
            <p>
              En un canal, se puede comunicar novedades, coordinar tareas y mantener un historial
              compartido de la conversación. Los participantes con acceso al chat podrán ingresar,
              leer y enviar mensajes en ese espacio.
            </p>
          </div>

          <div className="usuarios-form-modal-panel usuarios-form-modal-panel--secondary">
            <div className="field">
              <label htmlFor={inputId}>Nombre del canal</label>
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                autoComplete="off"
                placeholder="Ej. Ventas, Sanidad, Reuniones…"
                value={name}
                maxLength={60}
                disabled={busy}
                onChange={(e) => onNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSubmit) {
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
            disabled={busy || !canSubmit}
            onClick={onSubmit}
          >
            {busy ? "Creando…" : "Crear canal"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
