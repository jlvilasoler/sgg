import { useCallback, useEffect, useRef, useState } from "react";
import {
  enviarChatMensaje,
  fetchChatContacts,
  fetchChatMessages,
  marcarChatLeido,
} from "../api";
import type { AuthUser, ChatContact, ChatMessage } from "../types";

export const CHAT_GENERAL_PEER_ID = 0;

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

function formatDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "short" });
}

function truncar(texto: string, max: number): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

interface Props {
  user: AuthUser;
  variant?: "page" | "panel";
  onClose?: () => void;
  onUnreadChange?: (total: number) => void;
}

export default function ChatInterno({
  variant = "page",
  onClose,
  onUnreadChange,
}: Props) {
  const [peerId, setPeerId] = useState(CHAT_GENERAL_PEER_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [generalUnread, setGeneralUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(variant === "page");

  const listRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const lastIdRef = useRef(0);
  const peerRef = useRef(peerId);
  peerRef.current = peerId;

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const markRead = useCallback(
    async (targetPeer: number, msgs: ChatMessage[]) => {
      const last = msgs[msgs.length - 1];
      if (!last) return;
      try {
        const unread = await marcarChatLeido(targetPeer, last.id);
        onUnreadChange?.(unread.total);
        if (targetPeer === CHAT_GENERAL_PEER_ID) {
          setGeneralUnread(unread.general);
        } else {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === targetPeer ? { ...c, unread_count: 0 } : c
            )
          );
        }
      } catch {
        /* no bloquear */
      }
    },
    [onUnreadChange]
  );

  const loadContacts = useCallback(async () => {
    const data = await fetchChatContacts();
    setContacts(data.contacts);
    setGeneralUnread(data.general_unread);
    onUnreadChange?.(data.total_unread);
    return data;
  }, [onUnreadChange]);

  const loadMessages = useCallback(
    async (targetPeer: number, opts?: { initial?: boolean }) => {
      const initial = opts?.initial === true;
      if (initial) setLoading(true);
      setError(null);
      try {
        const msgs = await fetchChatMessages(targetPeer, { limit: 100 });
        if (peerRef.current !== targetPeer) return;
        setMessages(msgs);
        lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0;
        if (msgs.length > 0) {
          void markRead(targetPeer, msgs);
        }
        requestAnimationFrame(() => scrollToBottom(false));
      } catch (e) {
        if (peerRef.current === targetPeer) {
          setError(e instanceof Error ? e.message : "Error al cargar mensajes");
        }
      } finally {
        if (peerRef.current === targetPeer && initial) setLoading(false);
      }
    },
    [markRead, scrollToBottom]
  );

  const pollNew = useCallback(async () => {
    const targetPeer = peerRef.current;
    const since = lastIdRef.current;
    if (since <= 0) return;
    try {
      const nuevos = await fetchChatMessages(targetPeer, { since_id: since, limit: 50 });
      if (nuevos.length === 0 || peerRef.current !== targetPeer) return;
      setMessages((prev) => {
        const merged = [...prev, ...nuevos];
        lastIdRef.current = merged[merged.length - 1]?.id ?? since;
        void markRead(targetPeer, merged);
        return merged;
      });
      requestAnimationFrame(() => scrollToBottom(true));
    } catch {
      /* silencioso en polling */
    }
  }, [markRead, scrollToBottom]);

  useEffect(() => {
    void (async () => {
      try {
        await loadContacts();
        await loadMessages(peerId, { initial: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al iniciar chat");
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  useEffect(() => {
    void loadMessages(peerId, { initial: true });
    if (variant === "panel") setSidebarOpen(false);
  }, [peerId, loadMessages, variant]);

  useEffect(() => {
    const pollMsgs = window.setInterval(() => void pollNew(), 4000);
    const pollContacts = window.setInterval(() => void loadContacts(), 12000);
    return () => {
      window.clearInterval(pollMsgs);
      window.clearInterval(pollContacts);
    };
  }, [pollNew, loadContacts]);

  const selectPeer = (id: number) => {
    setPeerId(id);
    setDraft("");
    if (variant === "panel") setSidebarOpen(false);
  };

  const peerLabel =
    peerId === CHAT_GENERAL_PEER_ID
      ? "Equipo SGG"
      : contacts.find((c) => c.id === peerId)?.nombre ?? "Mensaje directo";

  const peerSubtitle =
    peerId === CHAT_GENERAL_PEER_ID
      ? "Canal general · todos los usuarios"
      : contacts.find((c) => c.id === peerId)?.rol_label ?? "";

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await enviarChatMensaje(peerId, text);
      setDraft("");
      setMessages((prev) => {
        const next = [...prev, msg];
        lastIdRef.current = msg.id;
        return next;
      });
      requestAnimationFrame(() => scrollToBottom(true));
      draftRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  };

  const onDraftKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  let lastDay = "";

  return (
    <div className={`chat-interno chat-interno--${variant}`}>
      <aside
        className={`chat-interno-sidebar${sidebarOpen ? " chat-interno-sidebar--open" : ""}`}
        aria-label="Conversaciones"
      >
        <div className="chat-interno-sidebar-head">
          <h2>{variant === "panel" ? "Chats" : "Mensajes"}</h2>
          {variant === "panel" && (
            <button
              type="button"
              className="chat-interno-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Volver al chat"
            >
              ‹
            </button>
          )}
        </div>

        <button
          type="button"
          className={`chat-interno-channel${peerId === CHAT_GENERAL_PEER_ID ? " chat-interno-channel--active" : ""}`}
          onClick={() => selectPeer(CHAT_GENERAL_PEER_ID)}
        >
          <span className="chat-interno-channel-avatar chat-interno-channel-avatar--team" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="9.5" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </span>
          <span className="chat-interno-channel-body">
            <span className="chat-interno-channel-name">Equipo SGG</span>
            <span className="chat-interno-channel-preview">Canal general de la empresa</span>
          </span>
          {generalUnread > 0 && (
            <span className="chat-interno-badge">{generalUnread > 99 ? "99+" : generalUnread}</span>
          )}
        </button>

        <p className="chat-interno-sidebar-label">Personas</p>
        <div className="chat-interno-contacts">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chat-interno-channel${peerId === c.id ? " chat-interno-channel--active" : ""}`}
              onClick={() => selectPeer(c.id)}
            >
              <span className="chat-interno-channel-avatar" aria-hidden>
                {iniciales(c.nombre)}
              </span>
              <span className="chat-interno-channel-body">
                <span className="chat-interno-channel-name">{c.nombre}</span>
                <span className="chat-interno-channel-preview">
                  {c.last_message ? truncar(c.last_message, 42) : c.rol_label}
                </span>
              </span>
              {c.unread_count > 0 && (
                <span className="chat-interno-badge">{c.unread_count > 99 ? "99+" : c.unread_count}</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-interno-main">
        <header className="chat-interno-main-head">
          <button
            type="button"
            className="chat-interno-menu-btn"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Ver conversaciones"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="chat-interno-main-head-text">
            <h3>{peerLabel}</h3>
            <p>{peerSubtitle}</p>
          </div>
          {variant === "panel" && onClose && (
            <button
              type="button"
              className="chat-interno-panel-close"
              onClick={onClose}
              aria-label="Ocultar chat"
              title="Ocultar chat (Esc)"
            >
              ✕
            </button>
          )}
          {variant === "page" && onClose && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Volver
            </button>
          )}
        </header>

        <div className="chat-interno-messages" ref={listRef} role="log" aria-live="polite">
          {loading ? (
            <p className="chat-interno-status">Cargando mensajes…</p>
          ) : messages.length === 0 ? (
            <div className="chat-interno-empty">
              <p>Sin mensajes todavía.</p>
              <p className="muted">Escribí el primero para iniciar la conversación.</p>
            </div>
          ) : (
            messages.map((m) => {
              const day = formatDia(m.creado_en);
              const showDay = day !== lastDay;
              if (showDay) lastDay = day;
              return (
                <div key={m.id}>
                  {showDay && <div className="chat-interno-day">{day}</div>}
                  <div
                    className={`chat-interno-bubble-row${m.es_propio ? " chat-interno-bubble-row--own" : ""}`}
                  >
                    {!m.es_propio && (
                      <span className="chat-interno-bubble-avatar" aria-hidden>
                        {iniciales(m.sender_nombre)}
                      </span>
                    )}
                    <div className={`chat-interno-bubble${m.es_propio ? " chat-interno-bubble--own" : ""}`}>
                      {!m.es_propio && peerId === CHAT_GENERAL_PEER_ID && (
                        <span className="chat-interno-bubble-author">{m.sender_nombre}</span>
                      )}
                      <p className="chat-interno-bubble-text">{m.body}</p>
                      <time className="chat-interno-bubble-time" dateTime={m.creado_en}>
                        {formatHora(m.creado_en)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <p className="chat-interno-error">{error}</p>}

        <footer className="chat-interno-compose">
          <textarea
            ref={draftRef}
            className="chat-interno-input"
            rows={1}
            placeholder={`Mensaje para ${peerId === CHAT_GENERAL_PEER_ID ? "el equipo" : peerLabel}…`}
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            maxLength={2000}
          />
          <button
            type="button"
            className="chat-interno-send"
            disabled={sending || !draft.trim()}
            onClick={() => void send()}
            aria-label="Enviar mensaje"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </footer>
        <p className="chat-interno-compose-hint muted">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </section>

      {sidebarOpen && variant === "panel" && (
        <button
          type="button"
          className="chat-interno-backdrop"
          aria-label="Cerrar lista"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
