import { useEffect } from "react";
import ChatInterno from "./ChatInterno";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser;
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (total: number) => void;
}

export default function ChatPanel({ user, open, onClose, onUnreadChange }: Props) {
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
    <div className="chat-panel-overlay" role="presentation" onClick={onClose}>
      <div
        className="chat-panel-drawer"
        role="dialog"
        aria-modal="false"
        aria-label="Chat interno"
        onClick={(e) => e.stopPropagation()}
      >
        <ChatInterno
          user={user}
          variant="panel"
          onClose={onClose}
          onUnreadChange={onUnreadChange}
        />
      </div>
    </div>
  );
}