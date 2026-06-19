import { useEffect, useRef } from "react";
import { CHAT_WALLPAPER_PRESETS } from "./chat-wallpapers";

interface Props {
  currentId: string;
  peerLabel: string;
  saving?: boolean;
  onSelect: (wallpaperId: string) => void;
  onClose: () => void;
}

export default function ChatWallpaperPicker({
  currentId,
  peerLabel,
  saving = false,
  onSelect,
  onClose,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".chat-interno-wallpaper-btn")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  return (
    <div
      className="chat-wallpaper-picker"
      ref={panelRef}
      role="dialog"
      aria-label="Elegir fondo del chat"
    >
      <div className="chat-wallpaper-picker-head">
        <h4>Fondo del chat</h4>
        <p className="muted">{peerLabel}</p>
      </div>
      <div className="chat-wallpaper-picker-grid" role="listbox" aria-label="Fondos disponibles">
        {CHAT_WALLPAPER_PRESETS.map((wp) => (
          <button
            key={wp.id}
            type="button"
            role="option"
            aria-selected={currentId === wp.id}
            className={`chat-wallpaper-picker-item${
              currentId === wp.id ? " chat-wallpaper-picker-item--active" : ""
            }`}
            title={wp.label}
            disabled={saving}
            onClick={() => onSelect(wp.id)}
          >
            <span
              className={`chat-wallpaper-picker-preview chat-wallpaper-preview--${wp.id}`}
              aria-hidden
            />
            <span className="chat-wallpaper-picker-label">{wp.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
