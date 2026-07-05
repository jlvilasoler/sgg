import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  aceptarChatSolicitudExterna,
  fetchChatExternalRequests,
  rechazarChatSolicitudExterna,
} from "../api";
import type { ChatExternalRequest } from "../types";
import { invalidateChatSidebarCache } from "../utils/chat-sidebar-cache";
import { playChatNotificationSound } from "../utils/chat-notification-sound";
import {
  pruneSnoozedIds,
  readSnoozedIds,
  snoozeRequest,
  unsnoozeRequest,
} from "../utils/chat-external-requests-snooze";

export interface ChatExternalRequestsContextValue {
  pending: ChatExternalRequest[];
  snoozedPending: ChatExternalRequest[];
  snoozedCount: number;
  popupRequest: ChatExternalRequest | null;
  busy: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  snooze: (requestId: number) => void;
  accept: (requestId: number) => Promise<void>;
  reject: (requestId: number) => Promise<void>;
  showNextPopup: () => void;
  clearError: () => void;
}

const ChatExternalRequestsContext = createContext<ChatExternalRequestsContextValue | null>(
  null
);

interface ProviderProps {
  userId: number;
  enabled: boolean;
  children: ReactNode;
  onAccepted?: (requesterId: number, requesterNombre: string) => void;
}

export function ChatExternalRequestsProvider({
  userId,
  enabled,
  children,
  onAccepted,
}: ProviderProps) {
  const [pending, setPending] = useState<ChatExternalRequest[]>([]);
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(() => readSnoozedIds(userId));
  const [popupId, setPopupId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const syncSnoozed = useCallback(() => {
    setSnoozedIds(readSnoozedIds(userId));
  }, [userId]);

  const pickPopupId = useCallback(
    (list: ChatExternalRequest[], current: number | null): number | null => {
      const snoozed = readSnoozedIds(userId);
      const candidates = list.filter((r) => !snoozed.has(r.id));
      if (current != null && candidates.some((r) => r.id === current)) return current;
      return candidates[0]?.id ?? null;
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = await fetchChatExternalRequests();
      setPending(list);
      pruneSnoozedIds(userId, list.map((r) => r.id));
      syncSnoozed();

      if (!initializedRef.current) {
        list.forEach((r) => knownIdsRef.current.add(r.id));
        initializedRef.current = true;
        setPopupId((prev) => pickPopupId(list, prev));
        return;
      }

      const nuevas = list.filter((r) => !knownIdsRef.current.has(r.id));
      if (nuevas.length > 0) {
        const snoozed = readSnoozedIds(userId);
        const nuevaVisible = nuevas.find((r) => !snoozed.has(r.id));
        if (nuevaVisible) {
          playChatNotificationSound();
          setPopupId(nuevaVisible.id);
        }
      }

      list.forEach((r) => knownIdsRef.current.add(r.id));
      knownIdsRef.current.forEach((id) => {
        if (!list.some((r) => r.id === id)) knownIdsRef.current.delete(id);
      });

      setPopupId((prev) => pickPopupId(list, prev));
    } catch {
      /* silencioso en polling */
    }
  }, [enabled, userId, pickPopupId, syncSnoozed]);

  useEffect(() => {
    initializedRef.current = false;
    knownIdsRef.current.clear();
    setPending([]);
    setPopupId(null);
    setError(null);
    syncSnoozed();
  }, [userId, syncSnoozed]);

  useEffect(() => {
    if (!enabled) {
      setPending([]);
      setPopupId(null);
      initializedRef.current = false;
      knownIdsRef.current.clear();
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  const snooze = useCallback(
    (requestId: number) => {
      snoozeRequest(userId, requestId);
      syncSnoozed();
      setError(null);
      setPopupId(null);
      const snoozed = readSnoozedIds(userId);
      const next = pending.find((r) => !snoozed.has(r.id) && r.id !== requestId);
      if (next) setPopupId(next.id);
    },
    [userId, pending, syncSnoozed]
  );

  const showNextPopup = useCallback(() => {
    const snoozed = readSnoozedIds(userId);
    const candidates = pending.filter((r) => !snoozed.has(r.id));
    if (candidates.length < 2) return;
    const idx = candidates.findIndex((r) => r.id === popupId);
    const next = candidates[(idx + 1) % candidates.length];
    setPopupId(next?.id ?? null);
    setError(null);
  }, [userId, pending, popupId]);

  const afterResolved = useCallback(
    (requestId: number) => {
      unsnoozeRequest(userId, requestId);
      syncSnoozed();
      knownIdsRef.current.delete(requestId);
      const remaining = pending.filter((r) => r.id !== requestId);
      setPending(remaining);
      setPopupId(pickPopupId(remaining, null));
    },
    [userId, pending, pickPopupId, syncSnoozed]
  );

  const accept = useCallback(
    async (requestId: number) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const result = await aceptarChatSolicitudExterna(requestId);
        invalidateChatSidebarCache();
        onAccepted?.(result.requester_id, result.requester_nombre);
        afterResolved(requestId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo confirmar");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [afterResolved, busy, onAccepted]
  );

  const reject = useCallback(
    async (requestId: number) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await rechazarChatSolicitudExterna(requestId);
        afterResolved(requestId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [afterResolved, busy]
  );

  const snoozedPending = useMemo(
    () => pending.filter((r) => snoozedIds.has(r.id)),
    [pending, snoozedIds]
  );

  const popupRequest = useMemo(
    () => pending.find((r) => r.id === popupId) ?? null,
    [pending, popupId]
  );

  const value = useMemo<ChatExternalRequestsContextValue>(
    () => ({
      pending,
      snoozedPending,
      snoozedCount: snoozedPending.length,
      popupRequest,
      busy,
      error,
      refresh,
      snooze,
      accept,
      reject,
      showNextPopup,
      clearError: () => setError(null),
    }),
    [
      pending,
      snoozedPending,
      popupRequest,
      busy,
      error,
      refresh,
      snooze,
      accept,
      reject,
      showNextPopup,
    ]
  );

  return (
    <ChatExternalRequestsContext.Provider value={value}>
      {children}
    </ChatExternalRequestsContext.Provider>
  );
}

export function useChatExternalRequests(): ChatExternalRequestsContextValue {
  const ctx = useContext(ChatExternalRequestsContext);
  if (!ctx) {
    throw new Error("useChatExternalRequests requiere ChatExternalRequestsProvider");
  }
  return ctx;
}

export function useChatExternalRequestsOptional(): ChatExternalRequestsContextValue | null {
  return useContext(ChatExternalRequestsContext);
}
