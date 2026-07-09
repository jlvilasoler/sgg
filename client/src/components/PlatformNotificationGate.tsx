import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { dismissPlatformNotification, fetchPendingPlatformNotifications } from "../api";
import type { PlatformNotificationPending } from "../types";
import PlatformNotificationCard from "./PlatformNotificationCard";
import { toastError } from "../utils/toast";

interface Props {
  apiOnline: boolean;
  userId: number;
  children: ReactNode;
}

type GatePhase = "checking" | "showing" | "done";

export default function PlatformNotificationGate({ apiOnline, userId, children }: Props) {
  const [phase, setPhase] = useState<GatePhase>("checking");
  const [queue, setQueue] = useState<PlatformNotificationPending[]>([]);
  const [current, setCurrent] = useState<PlatformNotificationPending | null>(null);
  const [dismissing, setDismissing] = useState(false);

  const finishIfEmpty = useCallback((pending: PlatformNotificationPending[]) => {
    if (pending.length === 0) {
      setCurrent(null);
      setPhase("done");
      return;
    }
    setQueue(pending);
    setCurrent(pending[0]);
    setPhase("showing");
  }, []);

  const loadPending = useCallback(async () => {
    if (!apiOnline) {
      setPhase("done");
      return;
    }
    setQueue([]);
    setCurrent(null);
    setPhase("checking");
    try {
      const pending = await fetchPendingPlatformNotifications();
      finishIfEmpty(pending);
    } catch {
      setPhase("done");
    }
  }, [apiOnline, finishIfEmpty]);

  useEffect(() => {
    void loadPending();
  }, [loadPending, userId]);

  const handleDismiss = async () => {
    if (!current || dismissing) return;
    setDismissing(true);
    try {
      await dismissPlatformNotification(current.id);
      const rest = queue.filter((item) => item.id !== current.id);
      finishIfEmpty(rest);
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "No se pudo registrar que leíste el aviso",
      );
    } finally {
      setDismissing(false);
    }
  };

  const overlay =
    phase === "showing" && current
      ? createPortal(
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
        )
      : null;

  return (
    <>
      {children}
      {overlay}
    </>
  );
}
