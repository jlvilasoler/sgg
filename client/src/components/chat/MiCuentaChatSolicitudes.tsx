import { useChatExternalRequestsOptional } from "../../context/ChatExternalRequestsContext";
import UserAvatar from "../UserAvatar";

export default function MiCuentaChatSolicitudes() {
  const chatReq = useChatExternalRequestsOptional();
  if (!chatReq || chatReq.snoozedCount === 0) return null;

  const { snoozedPending, busy, accept, reject } = chatReq;
  const countLabel =
    snoozedPending.length === 1
      ? "1 solicitud pendiente"
      : `${snoozedPending.length} solicitudes pendientes`;

  return (
    <section
      className="sg-hub-panel mi-cuenta-panel mi-cuenta-block mi-cuenta-block--chat"
      aria-labelledby="mi-cuenta-chat-solicitudes-title"
    >
      <header className="mi-cuenta-block-head">
        <h3 id="mi-cuenta-chat-solicitudes-title" className="mi-cuenta-block-title">
          Chat · Solicitudes Pendientes
          <span className="mi-cuenta-block-badge">{snoozedPending.length}</span>
        </h3>
        <p className="mi-cuenta-block-desc muted">
          {countLabel} para decidir. Confirmá para habilitar el chat entre cuentas o eliminá la
          solicitud.
        </p>
      </header>

      {chatReq.error && (
        <p className="mi-cuenta-block-error" role="alert">
          {chatReq.error}
        </p>
      )}

      <div className="mi-cuenta-chat-cards-box" aria-label="Solicitudes para confirmar o eliminar">
        <ul className="mi-cuenta-chat-panel">
          {snoozedPending.map((req) => (
            <li key={req.id} className="mi-cuenta-chat-card">
            <div className="mi-cuenta-chat-card-main">
              <UserAvatar
                nombre={req.requester_nombre}
                avatar={req.requester_avatar}
                variant="list"
                className="mi-cuenta-chat-card-avatar"
              />
              <div className="mi-cuenta-chat-card-copy">
                <p className="mi-cuenta-chat-card-text">
                  <strong>{req.requester_nombre}</strong> quiere conectarse para chatear entre
                  cuentas.
                </p>
                <p className="mi-cuenta-chat-card-meta">{req.requester_cuenta}</p>
              </div>
            </div>
            <div className="mi-cuenta-chat-card-btns">
              <button
                type="button"
                className="mi-cuenta-chat-card-btn mi-cuenta-chat-card-btn--confirm"
                disabled={busy}
                onClick={() => void accept(req.id)}
              >
                {busy ? "…" : "Confirmar"}
              </button>
              <button
                type="button"
                className="mi-cuenta-chat-card-btn mi-cuenta-chat-card-btn--delete"
                disabled={busy}
                onClick={() => void reject(req.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
        </ul>
      </div>
    </section>
  );
}
