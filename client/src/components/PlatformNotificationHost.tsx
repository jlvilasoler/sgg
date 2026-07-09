import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { dismissPlatformNotification, fetchPendingPlatformNotifications } from "../api";
import type { PlatformNotificationPending } from "../types";
import PlatformNotificationCard from "./PlatformNotificationCard";

interface Props {
  apiOnline: boolean;
  userId: number;
}

export default function PlatformNotificationHost({ apiOnline, userId }: Props) {
  const [queue, setQueue] = useState<PlatformNotificationPending[]>([]);
  const [current, setCurrent] = useState<PlatformNotificationPending | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const loadPending = useCallback(async () => {
    if (!apiOnline) return;
    try {
      const pending = await fetchPendingPlatformNotifications();
      setQueue(pending);
      setCurrent((prev) => {
        if (prev && pending.some((p) => p.id === prev.id)) return prev;
        return pending[0] ?? null;
      });
    } catch {
      /* silencioso: no bloquear el uso de la app */
    }
  }, [apiOnline]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, userId]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [current, queue]);

  const handleDismiss = async () => {
    if (!current || dismissing) return;
    setDismissing(true);
    try {
      await dismissPlatformNotification(current.id);
      const rest = queue.filter((item) => item.id !== current.id);
      setQueue(rest);
      setCurrent(rest[0] ?? null);
    } catch {
      const rest = queue.filter((item) => item.id !== current.id);
      setQueue(rest);
      setCurrent(rest[0] ?? null);
    } finally {
      setDismissing(false);
    }
  };

  if (!current) return null;

  return createPortal(
    <div
      className="empresa-gate platform-notification-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-notification-live-title"
    >
      <PlatformNotificationCard
        titulo={current.titulo}
        mensaje={current.mensaje}
        dismissing={dismissing}
        onDismiss={() => void handleDismiss()}
      />
    </div>,
    document.body,
  );
}
