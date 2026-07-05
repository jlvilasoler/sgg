import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, MoreHorizontal } from "lucide-react";
import { useChatExternalRequests } from "../../context/ChatExternalRequestsContext";
import UserAvatar from "../UserAvatar";

export default function ChatExternalRequestHost() {
  const titleId = useId();
  const {
    popupRequest,
    pending,
    busy,
    error,
    snooze,
    accept,
    reject,
    showNextPopup,
    clearError,
  } = useChatExternalRequests();

  const active = popupRequest;

  useEffect(() => {
    if (!active) return;
    clearError();
  }, [active?.id, clearError]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) snooze(active.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, busy, snooze]);

  if (!active) return null;

  const hasMore = pending.filter((r) => r.id !== active.id).length > 0;

  return createPortal(
    <div
      className="fb-request-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) snooze(active.id);
      }}
    >
      <div
        className="fb-request-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="fb-request-popover-head">
          <h2 id={titleId} className="fb-request-popover-title">
            Solicitudes de contacto
          </h2>
          {hasMore ? (
            <button
              type="button"
              className="fb-request-see-all"
              disabled={busy}
              onClick={showNextPopup}
            >
              Ver todas ({pending.length})
            </button>
          ) : (
            <button
              type="button"
              className="fb-request-head-close"
              disabled={busy}
              onClick={() => snooze(active.id)}
              aria-label="Cerrar"
            >
              ×
            </button>
          )}
        </header>

        <article className="fb-request-item">
          <div className="fb-request-item-top">
            <div className="fb-request-avatar-wrap">
              <UserAvatar
                nombre={active.requester_nombre}
                avatar={active.requester_avatar}
                variant="list"
                className="fb-request-avatar"
              />
              <span className="fb-request-avatar-badge" aria-hidden>
                <MessageCircle size={11} strokeWidth={2.5} />
              </span>
            </div>

            <div className="fb-request-copy">
              <p className="fb-request-text">
                <strong>{active.requester_nombre}</strong> quiere conectarse contigo para
                chatear entre cuentas.
              </p>
              <p className="fb-request-meta">{active.requester_cuenta}</p>
            </div>

            <button
              type="button"
              className="fb-request-menu"
              disabled={busy}
              onClick={() => snooze(active.id)}
              aria-label="Más opciones"
            >
              <MoreHorizontal size={20} strokeWidth={2} />
            </button>
          </div>

          {error && (
            <p className="fb-request-error" role="alert">
              {error}
            </p>
          )}

          <div className="fb-request-actions">
            <button
              type="button"
              className="fb-request-btn fb-request-btn--confirm"
              disabled={busy}
              onClick={() => void accept(active.id)}
            >
              {busy ? "…" : "Confirmar"}
            </button>
            <button
              type="button"
              className="fb-request-btn fb-request-btn--delete"
              disabled={busy}
              onClick={() => void reject(active.id)}
            >
              Eliminar
            </button>
          </div>
        </article>

        {hasMore && (
          <p className="fb-request-queue-hint">
            {pending.length - 1} solicitud{pending.length - 1 === 1 ? "" : "es"} más · usá{" "}
            <strong>Ver todas</strong> para revisarlas
          </p>
        )}

        <button
          type="button"
          className="fb-request-snooze"
          disabled={busy}
          onClick={() => snooze(active.id)}
        >
          Decidir después
        </button>
        <p className="fb-request-snooze-hint">
          La solicitud quedará en <strong>Mi cuenta</strong> para que la revises más tarde.
        </p>
      </div>
    </div>,
    document.body,
  );
}
