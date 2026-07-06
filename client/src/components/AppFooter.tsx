import { useCallback, useEffect, useRef, useState } from "react";
import { fetchChatUnread } from "../api";
import { APP_NAME } from "../brand";
import { canAccessChat } from "../utils/auth-permissions";
import { getChatSidebarCache, prefetchChatSidebar } from "../utils/chat-sidebar-cache";
import { playChatNotificationSound } from "../utils/chat-notification-sound";
import type { AuthUser } from "../types";

interface Props {
  user: AuthUser | null;
  chatOpen?: boolean;
  chatPageOpen?: boolean;
  onOpenChat?: () => void;
}

export default function AppFooter({
  user,
  chatOpen = false,
  chatPageOpen = false,
  onOpenChat,
}: Props) {
  const year = new Date().getFullYear();
  const [chatUnread, setChatUnread] = useState(0);
  const prevUnreadRef = useRef(0);
  const unreadInitializedRef = useRef(false);
  const drawerActive = chatOpen && !chatPageOpen;

  const showChat = user != null && canAccessChat(user);
  const showDock = showChat;

  const refreshUnread = useCallback(async () => {
    if (!showChat) return;
    try {
      let total = getChatSidebarCache()?.total_unread;
      if (total == null) {
        const sidebar = await prefetchChatSidebar();
        total = sidebar?.total_unread;
      }
      if (total == null) {
        const data = await fetchChatUnread();
        total = data.total;
      }
      if (unreadInitializedRef.current && !chatOpen && !chatPageOpen && total > prevUnreadRef.current) {
        playChatNotificationSound();
      }
      unreadInitializedRef.current = true;
      prevUnreadRef.current = total;
      setChatUnread(total);
    } catch {
      /* silencioso */
    }
  }, [showChat, chatOpen, chatPageOpen]);

  useEffect(() => {
    if (!showChat) {
      setChatUnread(0);
      return;
    }
    void prefetchChatSidebar();
    void refreshUnread();
    const id = window.setInterval(() => void refreshUnread(), 20000);
    return () => window.clearInterval(id);
  }, [refreshUnread, showChat, chatOpen, chatPageOpen]);

  return (
    <footer className={`app-footer${showDock ? " app-footer--dock" : ""}`}>
      <div className={`layout-chrome app-footer-inner${showDock ? " app-footer-inner--dock" : ""}`}>
        <span className="app-footer-copy">
          © {year} {APP_NAME}
        </span>

        {showDock ? (
          <div className="app-footer-actions">
            <button
              type="button"
              className={`app-footer-chat-btn${drawerActive ? " app-footer-chat-btn--active" : ""}`}
              onClick={() => onOpenChat?.()}
              onMouseEnter={() => void prefetchChatSidebar()}
              onFocus={() => void prefetchChatSidebar()}
              title="Chat"
              aria-label={`Chat${chatUnread > 0 ? `, ${chatUnread} sin leer` : ""}`}
              aria-current={drawerActive ? "page" : undefined}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5 18.5V8.8a2.2 2.2 0 0 1 2.2-2.2h9.6A2.2 2.2 0 0 1 19 8.8v5.4a2.2 2.2 0 0 1-2.2 2.2H9.5L5 18.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 10h7M8.5 13h4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="app-footer-chat-label">Chat</span>
              {chatUnread > 0 && (
                <span className="app-footer-chat-badge">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
