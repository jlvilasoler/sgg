import { useCallback, useEffect, useRef, useState } from "react";
import {
  agregarChatContactoExterno,
  buscarChatMensajes,
  crearChatCanal,
  enviarChatAdjunto,
  enviarChatMensaje,
  enviarPresencia,
  fetchChatBootstrap,
  fetchChatContacts,
  fetchChatMessages,
  fetchChatPresence,
  guardarChatWallpaper,
  marcarChatLeido,
  renombrarChatCanal,
} from "../api";
import type { AuthUser, ChatChannel, ChatContact, ChatMessage, ChatSearchHit } from "../types";
import { formatChatPresence, presenceStatusClass } from "../utils/chat-presence";
import { bubbleColorForSender, bubbleStyleVars } from "../utils/chat-bubble-colors";
import { isDirectMessagePeer, isGroupChannelPeer, peerTabLabel } from "../utils/chat-peers";
import { playChatNotificationSound } from "../utils/chat-notification-sound";
import {
  getChatSidebarCache,
  invalidateChatSidebarCache,
  prefetchChatSidebar,
  setChatSidebarCache,
} from "../utils/chat-sidebar-cache";
import { resaltarTexto, truncarConHighlight } from "../utils/chat-search";
import UserAvatar, { DEFAULT_USER_AVATAR } from "./UserAvatar";
import ChatEmojiPicker from "./chat/ChatEmojiPicker";
import ChatMessageAttachmentView from "./chat/ChatMessageAttachment";
import ChatWallpaperPicker from "./chat/ChatWallpaperPicker";
import { chatWallpaperClass } from "./chat/chat-wallpapers";

export const CHAT_GENERAL_PEER_ID = 0;

const MESSAGES_PAGE = 50;

function formatFechaHoraMensaje(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const fecha = d.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("es-UY", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fecha} · ${hora}`;
}

function ChatChannelAvatar({
  channel,
  className = "",
}: {
  channel: ChatChannel;
  className?: string;
}) {
  return (
    <span
      className={`chat-interno-channel-avatar${
        channel.es_sistema ? " chat-interno-channel-avatar--team" : " chat-interno-channel-avatar--group"
      }${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      {channel.es_sistema ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9.5" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : (
        "#"
      )}
    </span>
  );
}

function formatDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
  onOpenFullscreen?: () => void;
  onUnreadChange?: (total: number) => void;
}

export default function ChatInterno({
  variant = "page",
  onClose,
  onOpenFullscreen,
  onUnreadChange,
}: Props) {
  const isPanel = variant === "panel";
  const [peerId, setPeerId] = useState(CHAT_GENERAL_PEER_ID);
  const [openTabs, setOpenTabs] = useState<number[]>(isPanel ? [] : [CHAT_GENERAL_PEER_ID]);
  const [panelPickedChat, setPanelPickedChat] = useState(!isPanel);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [externalContacts, setExternalContacts] = useState<ChatContact[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(variant === "page" || isPanel);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [highlightTerm, setHighlightTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchAllChats, setSearchAllChats] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperByPeer, setWallpaperByPeer] = useState<Record<number, string>>({});
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [renamingChannelId, setRenamingChannelId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [addingExternal, setAddingExternal] = useState(false);
  const [externalEmail, setExternalEmail] = useState("");
  const [addingExternalBusy, setAddingExternalBusy] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState(false);
  const [incomingSender, setIncomingSender] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastIdRef = useRef(0);
  const peerRef = useRef(peerId);
  const loadingOlderRef = useRef(false);
  const skipPeerLoadRef = useRef(false);
  const draftByPeerRef = useRef<Record<number, string>>({});
  const prevTotalUnreadRef = useRef(0);
  const contactsInitializedRef = useRef(false);
  const bootstrappedRef = useRef(false);
  peerRef.current = peerId;
  loadingOlderRef.current = loadingOlder;

  const pendingPreviewRef = useRef<string | null>(null);

  const clearPendingFile = useCallback(() => {
    setPendingFile(null);
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current);
      pendingPreviewRef.current = null;
    }
    setPendingPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

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
        prevTotalUnreadRef.current = unread.total;
        onUnreadChange?.(unread.total);
        if (isGroupChannelPeer(targetPeer)) {
          setChannels((prev) =>
            prev.map((c) =>
              c.peer_id === targetPeer ? { ...c, unread_count: 0 } : c
            )
          );
        } else {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === targetPeer ? { ...c, unread_count: 0 } : c
            )
          );
          setExternalContacts((prev) =>
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
    if (contactsInitializedRef.current && data.total_unread > prevTotalUnreadRef.current) {
      playChatNotificationSound();
    }
    contactsInitializedRef.current = true;
    prevTotalUnreadRef.current = data.total_unread;
    setChannels(data.channels);
    setContacts(data.contacts);
    setExternalContacts(data.external_contacts ?? []);
    setOnlineCount(data.online_count);
    onUnreadChange?.(data.total_unread);
    setChatSidebarCache({
      channels: data.channels,
      contacts: data.contacts,
      external_contacts: data.external_contacts ?? [],
      general_unread: data.general_unread,
      total_unread: data.total_unread,
      online_count: data.online_count,
    });
    return data;
  }, [onUnreadChange]);

  const refreshPresence = useCallback(async () => {
    try {
      const data = await fetchChatPresence();
      setOnlineCount(data.online_count);
      setContacts((prev) =>
        prev.map((c) => ({
          ...c,
          presencia: data.users[c.id] ?? c.presencia,
        }))
      );
      setExternalContacts((prev) =>
        prev.map((c) => ({
          ...c,
          presencia: data.users[c.id] ?? c.presencia,
        }))
      );
    } catch {
      /* silencioso */
    }
  }, []);

  const scrollToMessage = useCallback((messageId: number) => {
    const el = listRef.current?.querySelector(`[data-msg-id="${messageId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const loadMessagesAround = useCallback(
    async (targetPeer: number, messageId: number) => {
      setLoading(true);
      setError(null);
      try {
        const msgs = await fetchChatMessages(targetPeer, {
          around_id: messageId,
          limit: 60,
        });
        if (peerRef.current !== targetPeer) return;
        setMessages(msgs);
        lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0;
        setHasMoreOlder(msgs.length >= 40);
        if (msgs.length > 0) void markRead(targetPeer, msgs);
        requestAnimationFrame(() => scrollToMessage(messageId));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar mensajes");
      } finally {
        setLoading(false);
      }
    },
    [markRead, scrollToMessage]
  );

  const loadMessages = useCallback(
    async (targetPeer: number, opts?: { initial?: boolean }) => {
      const initial = opts?.initial === true;
      if (initial) setLoading(true);
      setError(null);
      try {
        const msgs = await fetchChatMessages(targetPeer, { limit: MESSAGES_PAGE });
        if (peerRef.current !== targetPeer) return;
        setMessages(msgs);
        lastIdRef.current = msgs[msgs.length - 1]?.id ?? 0;
        setHasMoreOlder(msgs.length >= MESSAGES_PAGE);
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

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !hasMoreOlder) return;
    const targetPeer = peerRef.current;
    const firstId = messages[0]?.id;
    if (!firstId) return;

    const container = listRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const older = await fetchChatMessages(targetPeer, {
        before_id: firstId,
        limit: MESSAGES_PAGE,
      });
      if (peerRef.current !== targetPeer) return;
      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }
      setHasMoreOlder(older.length >= MESSAGES_PAGE);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevHeight;
        }
      });
    } catch {
      /* silencioso */
    } finally {
      setLoadingOlder(false);
    }
  }, [hasMoreOlder, messages]);

  const notifyIncoming = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    playChatNotificationSound();
    setIncomingSender(incoming[incoming.length - 1]?.sender_nombre ?? null);
    setIncomingAlert(true);
  }, []);

  const pollNew = useCallback(async () => {
    const targetPeer = peerRef.current;
    const since = lastIdRef.current;
    if (since <= 0) return;
    try {
      const nuevos = await fetchChatMessages(targetPeer, { since_id: since, limit: 50 });
      if (nuevos.length === 0 || peerRef.current !== targetPeer) return;
      const incoming = nuevos.filter((m) => !m.es_propio);
      if (incoming.length > 0) notifyIncoming(incoming);
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
  }, [markRead, scrollToBottom, notifyIncoming]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        if (isPanel) {
          const cached = getChatSidebarCache();
          if (cached) {
            bootstrappedRef.current = true;
            setChannels(cached.channels);
            setContacts(cached.contacts);
            setExternalContacts(cached.external_contacts ?? []);
            setOnlineCount(cached.online_count);
            setWallpaperByPeer({});
            setMessages([]);
            lastIdRef.current = 0;
            setHasMoreOlder(false);
            contactsInitializedRef.current = true;
            prevTotalUnreadRef.current = cached.total_unread;
            onUnreadChange?.(cached.total_unread);
            setLoading(false);
          } else {
            setLoading(true);
          }

          const data = await prefetchChatSidebar(true);
          if (cancelled || !data) return;
          bootstrappedRef.current = true;
          setChannels(data.channels);
          setContacts(data.contacts);
          setExternalContacts(data.external_contacts ?? []);
          setOnlineCount(data.online_count);
          setWallpaperByPeer({});
          setMessages([]);
          lastIdRef.current = 0;
          setHasMoreOlder(false);
          contactsInitializedRef.current = true;
          prevTotalUnreadRef.current = data.total_unread;
          onUnreadChange?.(data.total_unread);
        } else {
          setLoading(true);
          const data = await fetchChatBootstrap(peerId, MESSAGES_PAGE);
          if (cancelled) return;
          bootstrappedRef.current = true;
          setChannels(data.channels);
          setContacts(data.contacts);
          setExternalContacts(data.external_contacts ?? []);
          setOnlineCount(data.online_count);
          setWallpaperByPeer(data.wallpapers.by_peer);
          setMessages(data.messages);
          lastIdRef.current = data.messages[data.messages.length - 1]?.id ?? 0;
          setHasMoreOlder(data.messages.length >= MESSAGES_PAGE);
          contactsInitializedRef.current = true;
          prevTotalUnreadRef.current = data.total_unread;
          onUnreadChange?.(data.total_unread);
          setChatSidebarCache({
            channels: data.channels,
            contacts: data.contacts,
            external_contacts: data.external_contacts ?? [],
            general_unread: data.general_unread,
            total_unread: data.total_unread,
            online_count: data.online_count,
          });
          if (data.messages.length > 0) void markRead(peerId, data.messages);
          requestAnimationFrame(() => scrollToBottom(false));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al iniciar chat");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount only

  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) URL.revokeObjectURL(pendingPreviewRef.current);
    };
  }, []);

  const selectWallpaper = async (wallpaperId: string) => {
    const targetPeer = peerRef.current;
    setSavingWallpaper(true);
    try {
      const saved = await guardarChatWallpaper(targetPeer, wallpaperId);
      setWallpaperByPeer((prev) => ({
        ...prev,
        [saved.peer_id]: saved.wallpaper_id,
      }));
      setWallpaperOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el fondo");
    } finally {
      setSavingWallpaper(false);
    }
  };

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    if (skipPeerLoadRef.current) return;
    if (isPanel && !panelPickedChat) return;
    void loadMessages(peerId, { initial: true });
    setHighlightId(null);
    setHighlightTerm("");
    setSearchResults([]);
    setWallpaperOpen(false);
    setIncomingAlert(false);
    setIncomingSender(null);
    clearPendingFile();
    if (isPanel && panelPickedChat) setSidebarOpen(false);
  }, [peerId, panelPickedChat, loadMessages, isPanel, clearPendingFile]);

  useEffect(() => {
    if (!incomingAlert) return;
    const id = window.setTimeout(() => setIncomingAlert(false), 5000);
    return () => window.clearTimeout(id);
  }, [incomingAlert]);

  useEffect(() => {
    if (!searchOpen) return;
    searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await buscarChatMensajes(q, {
            peer_id: searchAllChats ? undefined : peerId,
            limit: 40,
          });
          setSearchResults(hits);
        } catch {
          setSearchResults([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchOpen, searchAllChats, peerId]);

  const onMessagesScroll = () => {
    const el = listRef.current;
    if (!el || loadingOlderRef.current || !hasMoreOlder) return;
    if (el.scrollTop < 80) void loadOlderMessages();
  };

  const goToSearchHit = async (hit: ChatSearchHit) => {
    const term = searchQuery.trim();
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHighlightId(hit.id);
    setHighlightTerm(term);
    window.setTimeout(() => {
      setHighlightId(null);
      setHighlightTerm("");
    }, 3200);

    if (hit.peer_id !== peerId) {
      skipPeerLoadRef.current = true;
      draftByPeerRef.current[peerId] = draft;
      setOpenTabs((prev) => (prev.includes(hit.peer_id) ? prev : [...prev, hit.peer_id]));
      setPeerId(hit.peer_id);
      setDraft(draftByPeerRef.current[hit.peer_id] ?? "");
      peerRef.current = hit.peer_id;
      await loadMessagesAround(hit.peer_id, hit.id);
      skipPeerLoadRef.current = false;
      return;
    }

    const exists = messages.some((m) => m.id === hit.id);
    if (exists) {
      scrollToMessage(hit.id);
      return;
    }
    await loadMessagesAround(peerId, hit.id);
  };

  useEffect(() => {
    const pollMsgs = window.setInterval(() => void pollNew(), 4000);
    const pollContacts = window.setInterval(() => void loadContacts(), 12000);
    const pollPresence = window.setInterval(() => void refreshPresence(), 12000);
    return () => {
      window.clearInterval(pollMsgs);
      window.clearInterval(pollContacts);
      window.clearInterval(pollPresence);
    };
  }, [pollNew, loadContacts, refreshPresence]);

  useEffect(() => {
    enviarPresencia("chat");
    const id = window.setInterval(() => enviarPresencia("chat"), 25000);
    return () => window.clearInterval(id);
  }, []);

  const openChannel = (id: number) => {
    draftByPeerRef.current[peerId] = draft;
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPeerId(id);
    setDraft(draftByPeerRef.current[id] ?? "");
    if (isPanel) {
      setPanelPickedChat(true);
      setSidebarOpen(false);
    }
  };

  const closeTab = (id: number) => {
    if (openTabs.length <= 1) return;
    const nextTabs = openTabs.filter((t) => t !== id);
    setOpenTabs(nextTabs);
    delete draftByPeerRef.current[id];
    if (peerId === id) {
      const next = nextTabs[nextTabs.length - 1];
      openChannel(next);
    }
  };

  const crearCanal = async () => {
    const nombre = newChannelName.trim();
    if (nombre.length < 2) {
      setError("El nombre del canal debe tener al menos 2 caracteres");
      return;
    }
    setError(null);
    try {
      const channel = await crearChatCanal(nombre);
      setChannels((prev) =>
        [...prev, channel].sort((a, b) => {
          if (a.es_sistema !== b.es_sistema) return a.es_sistema ? -1 : 1;
          return a.nombre.localeCompare(b.nombre, "es");
        })
      );
      setCreatingChannel(false);
      setNewChannelName("");
      openChannel(channel.peer_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el canal");
    }
  };

  const agregarContactoExterno = async () => {
    const email = externalEmail.trim();
    if (!email || addingExternalBusy) return;
    setAddingExternalBusy(true);
    setError(null);
    try {
      const contact = await agregarChatContactoExterno(email);
      setExternalContacts((prev) => {
        if (prev.some((c) => c.id === contact.id)) {
          return prev.map((c) => (c.id === contact.id ? contact : c));
        }
        return [...prev, contact];
      });
      setAddingExternal(false);
      setExternalEmail("");
      invalidateChatSidebarCache();
      openChannel(contact.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar el contacto");
    } finally {
      setAddingExternalBusy(false);
    }
  };

  const guardarRenombre = async () => {
    if (renamingChannelId === null) return;
    const nombre = renameDraft.trim();
    if (nombre.length < 2) {
      setError("El nombre del canal debe tener al menos 2 caracteres");
      return;
    }
    setError(null);
    try {
      const updated = await renombrarChatCanal(renamingChannelId, nombre);
      setChannels((prev) =>
        prev
          .map((c) => (c.id === updated.id ? updated : c))
          .sort((a, b) => {
            if (a.es_sistema !== b.es_sistema) return a.es_sistema ? -1 : 1;
            return a.nombre.localeCompare(b.nombre, "es");
          })
      );
      setRenamingChannelId(null);
      setRenameDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo renombrar el canal");
    }
  };

  const activeChannel =
    isGroupChannelPeer(peerId) ? channels.find((c) => c.peer_id === peerId) ?? null : null;

  const peerContact =
    isDirectMessagePeer(peerId)
      ? contacts.find((c) => c.id === peerId) ??
        externalContacts.find((c) => c.id === peerId) ??
        null
      : null;

  const peerLabel = peerTabLabel(peerId, channels, contacts, externalContacts);
  const currentWallpaper = wallpaperByPeer[peerId] ?? "default";
  const wallpaperClass = chatWallpaperClass(currentWallpaper);

  const peerSubtitle = isGroupChannelPeer(peerId)
    ? activeChannel?.es_sistema
      ? onlineCount > 0
        ? `${onlineCount} en línea ahora · canal del equipo`
        : "Canal del equipo · todos los usuarios"
      : "Canal grupal · todos los usuarios"
    : peerContact && externalContacts.some((c) => c.id === peerContact.id)
      ? `${peerContact.rol_label} · ${formatChatPresence(peerContact.presencia)}`
      : formatChatPresence(peerContact?.presencia);

  const onlineContacts = [...contacts, ...externalContacts].filter((c) => c.presencia.online);

  const renderDmContact = (c: ChatContact, opts?: { external?: boolean }) => (
    <button
      key={c.id}
      type="button"
      className={`chat-interno-channel${peerId === c.id ? " chat-interno-channel--active" : ""}`}
      onClick={() => openChannel(c.id)}
    >
      <span
        className={`chat-interno-avatar-wrap${
          c.presencia.online
            ? " chat-interno-avatar-wrap--online"
            : " chat-interno-avatar-wrap--offline"
        }`}
      >
        <UserAvatar
          nombre={c.nombre}
          avatar={c.avatar}
          variant="chat-channel"
        />
      </span>
      <span className="chat-interno-channel-body">
        <span className="chat-interno-channel-name">{c.nombre}</span>
        <span
          className={`chat-interno-channel-status ${
            opts?.external ? "" : presenceStatusClass(c.presencia)
          }`}
        >
          {opts?.external ? c.rol_label : formatChatPresence(c.presencia)}
        </span>
        <span className="chat-interno-channel-preview">
          {c.last_message ? truncar(c.last_message, 42) : "Sin mensajes"}
        </span>
      </span>
      {c.unread_count > 0 && (
        <span className="chat-interno-badge">{c.unread_count > 99 ? "99+" : c.unread_count}</span>
      )}
    </button>
  );

  useEffect(() => {
    draftByPeerRef.current[peerId] = draft;
  }, [draft, peerId]);

  useEffect(() => {
    setEmojiOpen(false);
    setSearchOpen(false);
    setRenamingChannelId(null);
  }, [peerId]);

  const insertEmoji = (emoji: string) => {
    const el = draftRef.current;
    if (!el) {
      setDraft((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + emoji + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onPickFile = (file: File | null) => {
    clearPendingFile();
    if (!file) return;
    setPendingFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      pendingPreviewRef.current = url;
      setPendingPreview(url);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (sending || (!text && !pendingFile)) return;
    setSending(true);
    setError(null);
    try {
      const msg = pendingFile
        ? await enviarChatAdjunto(peerId, pendingFile, text)
        : await enviarChatMensaje(peerId, text);
      setDraft("");
      clearPendingFile();
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
          {isPanel && (
            panelPickedChat ? (
              <button
                type="button"
                className="chat-interno-close"
                onClick={() => setSidebarOpen(false)}
                aria-label="Volver al chat"
              >
                ‹
              </button>
            ) : onClose ? (
              <div className="chat-interno-panel-actions">
                {onOpenFullscreen && (
                  <button
                    type="button"
                    className="chat-interno-panel-expand"
                    onClick={onOpenFullscreen}
                    aria-label="Abrir chat en pantalla completa"
                    title="Abrir en vista completa"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="chat-interno-panel-close"
                  onClick={onClose}
                  aria-label="Cerrar chat"
                  title="Cerrar chat (Esc)"
                >
                  ✕
                </button>
              </div>
            ) : null
          )}
        </div>

        <div className="chat-interno-sidebar-section-head">
          <p className="chat-interno-sidebar-label">Canales</p>
          <button
            type="button"
            className="chat-interno-channel-add"
            onClick={() => {
              setCreatingChannel((v) => !v);
              setNewChannelName("");
            }}
            title="Nuevo canal"
            aria-label="Crear canal"
          >
            +
          </button>
        </div>

        {creatingChannel && (
          <div className="chat-interno-channel-create">
            <input
              type="text"
              className="chat-interno-channel-create-input"
              placeholder="Nombre del canal…"
              value={newChannelName}
              maxLength={60}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void crearCanal();
                if (e.key === "Escape") setCreatingChannel(false);
              }}
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void crearCanal()}>
              Crear
            </button>
          </div>
        )}

        <div className="chat-interno-channels">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`chat-interno-channel${peerId === ch.peer_id ? " chat-interno-channel--active" : ""}`}
              onClick={() => openChannel(ch.peer_id)}
            >
              <ChatChannelAvatar channel={ch} />
              <span className="chat-interno-channel-body">
                <span className="chat-interno-channel-name">{ch.nombre}</span>
                <span className="chat-interno-channel-preview">
                  {ch.es_sistema && onlineCount > 0
                    ? `${onlineCount} ${onlineCount === 1 ? "persona en línea" : "personas en línea"}`
                    : ch.last_message
                      ? truncar(ch.last_message, 42)
                      : "Sin mensajes"}
                </span>
              </span>
              {ch.unread_count > 0 && (
                <span className="chat-interno-badge">
                  {ch.unread_count > 99 ? "99+" : ch.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>

        {onlineContacts.length > 0 && (
          <>
            <p className="chat-interno-sidebar-label">
              En línea ({onlineContacts.length})
            </p>
            <div className="chat-interno-online-strip">
              {onlineContacts.map((c) => (
                <button
                  key={`online-${c.id}`}
                  type="button"
                  className={`chat-interno-online-chip${peerId === c.id ? " chat-interno-online-chip--active" : ""}`}
                  title={`${c.nombre} · ${formatChatPresence(c.presencia)}`}
                  onClick={() => openChannel(c.id)}
                >
                  <span className="chat-interno-avatar-wrap chat-interno-avatar-wrap--online">
                    <UserAvatar nombre={c.nombre} avatar={c.avatar} variant="chat-channel" />
                  </span>
                  <span className="chat-interno-online-chip-name">{c.nombre.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="chat-interno-sidebar-label">Personas</p>
        <div className="chat-interno-contacts">
          {contacts.map((c) => renderDmContact(c))}
        </div>

        <div className="chat-interno-sidebar-section-head">
          <p className="chat-interno-sidebar-label">Otras cuentas</p>
          <button
            type="button"
            className="chat-interno-channel-add"
            onClick={() => {
              setAddingExternal((v) => !v);
              setExternalEmail("");
            }}
            title="Agregar usuario de otra cuenta"
            aria-label="Agregar contacto externo"
          >
            +
          </button>
        </div>

        {addingExternal && (
          <div className="chat-interno-channel-create">
            <input
              type="email"
              className="chat-interno-channel-create-input"
              placeholder="Correo del usuario…"
              value={externalEmail}
              maxLength={120}
              onChange={(e) => setExternalEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void agregarContactoExterno();
                if (e.key === "Escape") setAddingExternal(false);
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={addingExternalBusy}
              onClick={() => void agregarContactoExterno()}
            >
              {addingExternalBusy ? "…" : "Agregar"}
            </button>
          </div>
        )}

        <div className="chat-interno-contacts chat-interno-contacts--external">
          {externalContacts.length === 0 ? (
            <p className="chat-interno-contacts-empty">
              Agregá usuarios de otras cuentas por correo electrónico.
            </p>
          ) : (
            externalContacts.map((c) => renderDmContact(c, { external: true }))
          )}
        </div>
      </aside>

      {(variant !== "panel" || panelPickedChat) && (
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
            {activeChannel && (
              <ChatChannelAvatar channel={activeChannel} className="chat-interno-main-head-avatar" />
            )}
            {peerContact && (
              <span
                className={`chat-interno-avatar-wrap${
                  peerContact.presencia.online
                    ? " chat-interno-avatar-wrap--online"
                    : " chat-interno-avatar-wrap--offline"
                }`}
              >
                <UserAvatar
                  nombre={peerContact.nombre}
                  avatar={peerContact.avatar}
                  variant="chat-channel"
                  className="chat-interno-main-head-avatar"
                />
              </span>
            )}
            <div>
              {renamingChannelId !== null && activeChannel?.id === renamingChannelId ? (
                <div className="chat-interno-rename-row">
                  <input
                    type="text"
                    className="chat-interno-rename-input"
                    value={renameDraft}
                    maxLength={60}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void guardarRenombre();
                      if (e.key === "Escape") setRenamingChannelId(null);
                    }}
                    autoFocus
                  />
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void guardarRenombre()}>
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setRenamingChannelId(null)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="chat-interno-main-head-title-row">
                  <h3 className={incomingAlert ? "chat-interno-main-head-name--alert" : undefined}>
                    {peerLabel}
                  </h3>
                  {incomingAlert && (
                    <span className="chat-interno-incoming-badge" role="status" aria-live="polite">
                      {isGroupChannelPeer(peerId) && incomingSender
                        ? `Nuevo mensaje · ${incomingSender}`
                        : "Nuevo mensaje"}
                    </span>
                  )}
                </div>
              )}
              <p className={presenceStatusClass(peerContact?.presencia)}>{peerSubtitle}</p>
            </div>
          </div>
          {activeChannel && renamingChannelId === null && (
            <button
              type="button"
              className="chat-interno-rename-btn"
              onClick={() => {
                setRenamingChannelId(activeChannel.id);
                setRenameDraft(activeChannel.nombre);
              }}
              title="Renombrar canal"
              aria-label="Renombrar canal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {variant === "panel" && (onClose || onOpenFullscreen) && (
            <div className="chat-interno-panel-actions chat-interno-panel-actions--main">
              {onOpenFullscreen && (
                <button
                  type="button"
                  className="chat-interno-panel-expand"
                  onClick={onOpenFullscreen}
                  aria-label="Abrir chat en pantalla completa"
                  title="Abrir en vista completa"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              {onClose && (
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
            </div>
          )}
          {variant === "page" && onClose && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Volver
            </button>
          )}
          <div className="chat-interno-head-tools">
            <button
              type="button"
              className={`chat-interno-wallpaper-btn${wallpaperOpen ? " chat-interno-wallpaper-btn--active" : ""}`}
              onClick={() => {
                setWallpaperOpen((v) => !v);
                setSearchOpen(false);
                setEmojiOpen(false);
              }}
              title="Cambiar fondo del chat"
              aria-label="Cambiar fondo del chat"
              aria-expanded={wallpaperOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
                <path
                  d="M3 15l4.5-4 3 3 5.5-6 4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`chat-interno-search-btn${searchOpen ? " chat-interno-search-btn--active" : ""}`}
              onClick={() => {
                setSearchOpen((v) => !v);
                setWallpaperOpen(false);
              }}
              title="Buscar en el chat"
              aria-label="Buscar mensajes"
              aria-expanded={searchOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {openTabs.length > 1 && (
          <div className="chat-interno-tabs" role="tablist" aria-label="Canales abiertos">
            {openTabs.map((tabPeer) => (
              <div
                key={tabPeer}
                className={`chat-interno-tab${tabPeer === peerId ? " chat-interno-tab--active" : ""}`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tabPeer === peerId}
                  className="chat-interno-tab-btn"
                  onClick={() => openChannel(tabPeer)}
                >
                  {peerTabLabel(tabPeer, channels, contacts, externalContacts)}
                </button>
                <button
                  type="button"
                  className="chat-interno-tab-close"
                  onClick={() => closeTab(tabPeer)}
                  aria-label={`Cerrar ${peerTabLabel(tabPeer, channels, contacts, externalContacts)}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {wallpaperOpen && (
          <ChatWallpaperPicker
            currentId={currentWallpaper}
            peerLabel={peerLabel}
            saving={savingWallpaper}
            onSelect={(id) => void selectWallpaper(id)}
            onClose={() => setWallpaperOpen(false)}
          />
        )}

        {searchOpen && (
          <div className="chat-interno-search-panel">
            <input
              ref={searchRef}
              type="search"
              className="chat-interno-search-input"
              placeholder={
                searchAllChats
                  ? "Buscar en todas las conversaciones…"
                  : "Buscar en esta conversación…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <label className="chat-interno-search-scope">
              <input
                type="checkbox"
                checked={searchAllChats}
                onChange={(e) => setSearchAllChats(e.target.checked)}
              />
              Buscar en todos los chats
            </label>
            <div className="chat-interno-search-results" role="listbox" aria-label="Resultados de búsqueda">
              {searchQuery.trim().length < 2 ? (
                <p className="chat-interno-search-hint muted">Escribí al menos 2 caracteres</p>
              ) : searching ? (
                <p className="chat-interno-search-hint muted">Buscando…</p>
              ) : searchResults.length === 0 ? (
                <p className="chat-interno-search-hint muted">Sin resultados</p>
              ) : (
                searchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="chat-interno-search-hit"
                    onClick={() => void goToSearchHit(hit)}
                  >
                    <span className="chat-interno-search-hit-meta">
                      <strong>{hit.peer_label}</strong>
                      <span>{hit.sender_nombre}</span>
                      <time dateTime={hit.creado_en}>{formatFechaHoraMensaje(hit.creado_en)}</time>
                    </span>
                    <span className="chat-interno-search-hit-body">
                      {truncarConHighlight(hit.body, searchQuery)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div
          className={`chat-interno-messages${wallpaperClass ? ` ${wallpaperClass}` : ""}`}
          ref={listRef}
          role="log"
          aria-live="polite"
          onScroll={onMessagesScroll}
        >
          {loadingOlder && (
            <p className="chat-interno-load-older">Cargando mensajes anteriores…</p>
          )}
          {!loadingOlder && hasMoreOlder && messages.length > 0 && (
            <p className="chat-interno-load-older chat-interno-load-older--hint muted">
              Subí para ver mensajes más antiguos
            </p>
          )}
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
              const bubbleColor = bubbleColorForSender(m.sender_id, m.es_propio);
              return (
                <div key={m.id}>
                  {showDay && <div className="chat-interno-day">{day}</div>}
                  <div
                    data-msg-id={m.id}
                    className={`chat-interno-bubble-row${m.es_propio ? " chat-interno-bubble-row--own" : ""}${
                      highlightId === m.id ? " chat-interno-bubble-row--highlight" : ""
                    }`}
                  >
                    {!m.es_propio && (
                      <UserAvatar
                        nombre={m.sender_nombre}
                        avatar={m.sender_avatar ?? DEFAULT_USER_AVATAR}
                        variant="chat-bubble"
                      />
                    )}
                    <div
                      className={`chat-interno-bubble${m.es_propio ? " chat-interno-bubble--own" : " chat-interno-bubble--other"}`}
                      style={bubbleStyleVars(bubbleColor)}
                    >
                      {!m.es_propio && isGroupChannelPeer(peerId) && (
                        <span className="chat-interno-bubble-author">{m.sender_nombre}</span>
                      )}
                      {m.attachment && (
                        <ChatMessageAttachmentView
                          messageId={m.id}
                          attachment={m.attachment}
                          onImageClick={setImagePreviewUrl}
                        />
                      )}
                      {m.body.trim() && (
                        <p className="chat-interno-bubble-text">
                          {highlightTerm && highlightId === m.id
                            ? resaltarTexto(m.body, highlightTerm)
                            : m.body}
                        </p>
                      )}
                      <time
                        className="chat-interno-bubble-time"
                        dateTime={m.creado_en}
                        title={formatFechaHoraMensaje(m.creado_en)}
                      >
                        {formatFechaHoraMensaje(m.creado_en)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && <p className="chat-interno-error">{error}</p>}

        {pendingFile && (
          <div className="chat-interno-pending-file">
            {pendingPreview ? (
              <img src={pendingPreview} alt="" className="chat-interno-pending-thumb" />
            ) : (
              <span className="chat-interno-pending-file-icon" aria-hidden>
                📎
              </span>
            )}
            <span className="chat-interno-pending-name">{pendingFile.name}</span>
            <button
              type="button"
              className="chat-interno-pending-remove"
              onClick={clearPendingFile}
              aria-label="Quitar adjunto"
            >
              ✕
            </button>
          </div>
        )}

        <footer className="chat-interno-compose">
          <input
            ref={fileInputRef}
            type="file"
            className="chat-interno-file-input"
            accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
          <div className="chat-interno-compose-tools">
            <button
              type="button"
              className="chat-interno-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Adjuntar foto o archivo"
              title="Adjuntar foto o archivo"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={`chat-interno-emoji-btn${emojiOpen ? " chat-interno-emoji-btn--active" : ""}`}
              onClick={() => {
                setEmojiOpen((v) => !v);
                setWallpaperOpen(false);
              }}
              disabled={sending}
              aria-label="Insertar emoji"
              aria-expanded={emojiOpen}
              title="Emojis"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M8.5 10.2h.01M15.5 10.2h.01"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M8.8 14.4c.9 1.1 2.1 1.7 3.2 1.7s2.3-.6 3.2-1.7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            {emojiOpen && (
              <ChatEmojiPicker
                onPick={insertEmoji}
                onClose={() => setEmojiOpen(false)}
              />
            )}
          </div>
          <textarea
            ref={draftRef}
            className="chat-interno-input"
            rows={1}
            placeholder={`Mensaje para ${isGroupChannelPeer(peerId) ? activeChannel?.nombre ?? "el canal" : peerLabel}…`}
            value={draft}
            disabled={sending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onDraftKey}
            maxLength={2000}
          />
          <button
            type="button"
            className="chat-interno-send"
            disabled={sending || (!draft.trim() && !pendingFile)}
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
          Enter para enviar · Shift+Enter para nueva línea · Máx. 12 MB por archivo
        </p>
      </section>
      )}

      {imagePreviewUrl && (
        <button
          type="button"
          className="chat-interno-image-lightbox"
          aria-label="Cerrar imagen"
          onClick={() => setImagePreviewUrl(null)}
        >
          <img src={imagePreviewUrl} alt="Vista ampliada" />
        </button>
      )}

      {sidebarOpen && isPanel && panelPickedChat && (
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
