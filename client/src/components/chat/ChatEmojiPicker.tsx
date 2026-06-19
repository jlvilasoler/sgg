import { useEffect, useRef, useState } from "react";
import {
  CHAT_EMOJI_CATEGORIES,
  loadRecentEmojis,
  saveRecentEmoji,
} from "./chat-emojis";

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function ChatEmojiPicker({ onPick, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [recent, setRecent] = useState<string[]>(() => loadRecentEmojis());
  const [activeId, setActiveId] = useState(
    recent.length > 0 ? "recent" : CHAT_EMOJI_CATEGORIES[0].id
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".chat-interno-emoji-btn")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  const pick = (emoji: string) => {
    setRecent(saveRecentEmoji(emoji));
    onPick(emoji);
  };

  const activeCategory =
    activeId === "recent"
      ? { id: "recent", icon: "🕒", label: "Recientes", emojis: recent }
      : CHAT_EMOJI_CATEGORIES.find((c) => c.id === activeId) ?? CHAT_EMOJI_CATEGORIES[0];

  return (
    <div className="chat-emoji-picker" ref={panelRef} role="dialog" aria-label="Selector de emojis">
      <div className="chat-emoji-picker-tabs" role="tablist" aria-label="Categorías">
        {recent.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeId === "recent"}
            className={`chat-emoji-picker-tab${activeId === "recent" ? " chat-emoji-picker-tab--active" : ""}`}
            title="Recientes"
            onClick={() => setActiveId("recent")}
          >
            🕒
          </button>
        )}
        {CHAT_EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={activeId === cat.id}
            className={`chat-emoji-picker-tab${activeId === cat.id ? " chat-emoji-picker-tab--active" : ""}`}
            title={cat.label}
            onClick={() => setActiveId(cat.id)}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      <div className="chat-emoji-picker-head">
        <span>{activeCategory.label}</span>
        <button
          type="button"
          className="chat-emoji-picker-close"
          onClick={onClose}
          aria-label="Cerrar emojis"
        >
          ✕
        </button>
      </div>

      <div className="chat-emoji-picker-grid" role="tabpanel">
        {activeCategory.emojis.length === 0 ? (
          <p className="chat-emoji-picker-empty muted">Sin emojis recientes todavía</p>
        ) : (
          activeCategory.emojis.map((emoji, idx) => (
            <button
              key={`${activeCategory.id}-${emoji}-${idx}`}
              type="button"
              className="chat-emoji-picker-item"
              onClick={() => pick(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
