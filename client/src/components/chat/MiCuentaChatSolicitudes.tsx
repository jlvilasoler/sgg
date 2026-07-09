import { ThumbsDown, ThumbsUp } from "lucide-react";
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

      <ul
        className="mi-cuenta-chat-req-list"
        aria-label="Solicitudes para confirmar o eliminar"
      >
        {snoozedPending.map((req) => (
          <li key={req.id}>
            <article
              className="home-auto-pendientes-kpi mi-cuenta-chat-req-card"
              aria-label={`Solicitud de chat de ${req.requester_nombre}`}
            >
              <div className="home-auto-pendientes-kpi-body">
                <div className="home-auto-pendientes-kpi-head">
                  <span className="home-auto-pendientes-kpi-link" aria-hidden>
                    <span className="home-auto-pendientes-kpi-dot" />
                    <span className="home-auto-pendientes-kpi-kicker">Solicitud de chat</span>
                  </span>
                </div>

                <div className="home-auto-pendientes-kpi-main">
                  <UserAvatar
                    nombre={req.requester_nombre}
                    avatar={req.requester_avatar}
                    variant="list"
                    className="mi-cuenta-chat-req-avatar"
                  />
                  <div className="home-auto-pendientes-kpi-copy">
                    <p className="home-auto-pendientes-kpi-value" title={req.requester_nombre}>
                      {req.requester_nombre}
                    </p>
                    <p
                      className="home-auto-pendientes-kpi-meta"
                      title={`Quiere conectarse · ${req.requester_cuenta}`}
                    >
                      Quiere conectarse · {req.requester_cuenta}
                    </p>
                  </div>

                  <div className="home-auto-pendientes-kpi-actions">
                    <button
                      type="button"
                      className="home-auto-pendientes-kpi-icon-btn home-auto-pendientes-kpi-icon-btn--no"
                      disabled={busy}
                      title="Eliminar solicitud"
                      aria-label={`Eliminar solicitud de ${req.requester_nombre}`}
                      onClick={() => void reject(req.id)}
                    >
                      <ThumbsDown size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="home-auto-pendientes-kpi-icon-btn home-auto-pendientes-kpi-icon-btn--si"
                      disabled={busy}
                      title="Confirmar solicitud"
                      aria-label={`Confirmar solicitud de ${req.requester_nombre}`}
                      onClick={() => void accept(req.id)}
                    >
                      <ThumbsUp size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
