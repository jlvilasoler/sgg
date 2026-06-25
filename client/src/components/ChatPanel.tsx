import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="chat-panel-overlay" role="presentation">
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
