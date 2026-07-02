import { useCallback, useEffect, useRef, useState } from "react";
import {
  aceptarChatSolicitudExterna,
  fetchChatExternalRequests,
  rechazarChatSolicitudExterna,
} from "../../api";
import type { ChatExternalRequest } from "../../types";
import { invalidateChatSidebarCache } from "../../utils/chat-sidebar-cache";
import { playChatNotificationSound } from "../../utils/chat-notification-sound";
import UserAvatar from "../UserAvatar";

interface Props {
  enabled: boolean;
  onAccepted?: (requesterId: number, requesterNombre: string) => void;
}

export default function ChatExternalRequestHost({ enabled, onAccepted }: Props) {
  const [requests, setRequests] = useState<ChatExternalRequest[]>([]);
  const [active, setActive] = useState<ChatExternalRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await fetchChatExternalRequests();
      setRequests(list);

      if (!initializedRef.current) {
        list.forEach((r) => knownIdsRef.current.add(r.id));
        initializedRef.current = true;
        if (list.length > 0) setActive((prev) => prev ?? list[0]);
        return;
      }

      const nuevas = list.filter((r) => !knownIdsRef.current.has(r.id));
      if (nuevas.length > 0) {
        playChatNotificationSound();
        setActive(nuevas[0]);
      }
      list.forEach((r) => knownIdsRef.current.add(r.id));
      knownIdsRef.current.forEach((id) => {
        if (!list.some((r) => r.id === id)) knownIdsRef.current.delete(id);
      });

      setActive((prev) => {
        if (prev && list.some((r) => r.id === prev.id)) return prev;
        return list[0] ?? null;
      });
    } catch {
      /* silencioso en polling */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      setActive(null);
      initializedRef.current = false;
      knownIdsRef.current.clear();
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  const closeModal = () => {
    setActive(null);
    setError(null);
  };

  const accept = async () => {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await aceptarChatSolicitudExterna(active.id);
      invalidateChatSidebarCache();
      onAccepted?.(result.requester_id, result.requester_nombre);
      const remaining = requests.filter((r) => r.id !== active.id);
      setRequests(remaining);
      knownIdsRef.current.delete(active.id);
      setActive(remaining[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aceptar");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!active || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rechazarChatSolicitudExterna(active.id);
      const remaining = requests.filter((r) => r.id !== active.id);
      setRequests(remaining);
      knownIdsRef.current.delete(active.id);
      setActive(remaining[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rechazar");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled || !active) return null;

  return (
    <div className="chat-external-request-overlay" role="presentation">
      <div
        className="chat-external-request-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-external-request-title"
      >
        <h3 id="chat-external-request-title">Solicitud de contacto en el chat</h3>
        <p className="chat-external-request-lead">
          <strong>{active.requester_nombre}</strong> ({active.requester_cuenta}) quiere
          agregarte para chatear entre cuentas.
        </p>
        <div className="chat-external-request-user">
          <UserAvatar
            nombre={active.requester_nombre}
            avatar={active.requester_avatar}
            variant="chat-channel"
          />
          <div>
            <p className="chat-external-request-name">{active.requester_nombre}</p>
            <p className="chat-external-request-cuenta">{active.requester_cuenta}</p>
          </div>
        </div>
        {requests.length > 1 && (
          <p className="chat-external-request-more">
            {requests.length - 1} solicitud{requests.length - 1 === 1 ? "" : "es"} más pendiente
            {requests.length - 1 === 1 ? "" : "s"}.
          </p>
        )}
        {error && <p className="chat-external-request-error">{error}</p>}
        <div className="chat-external-request-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void reject()}>
            Rechazar
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void accept()}>
            {busy ? "…" : "Autorizar"}
          </button>
        </div>
        <button
          type="button"
          className="chat-external-request-later"
          disabled={busy}
          onClick={closeModal}
        >
          Decidir después
        </button>
      </div>
    </div>
  );
}
