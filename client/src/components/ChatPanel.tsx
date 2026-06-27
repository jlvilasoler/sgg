import { useEffect, useState } from "react";
import ChatInterno from "./ChatInterno";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onOpenFullscreen?: () => void;
  onUnreadChange?: (total: number) => void;
}

export default function ChatPanel({
  user,
  open,
  onClose,
  onOpenFullscreen,
  onUnreadChange,
}: Props) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`chat-panel-overlay${open ? "" : " chat-panel-overlay--hidden"}`}
      role="presentation"
      aria-hidden={!open}
    >
      <div className="chat-panel-drawer" role="dialog" aria-modal="false" aria-label="Chat">
        <ChatInterno
          user={user}
          variant="panel"
          onClose={onClose}
          onOpenFullscreen={onOpenFullscreen}
          onUnreadChange={onUnreadChange}
        />
      </div>
    </div>
  );
}
