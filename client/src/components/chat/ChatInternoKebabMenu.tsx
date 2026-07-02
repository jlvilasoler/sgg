import { useEffect, useId, useRef, useState } from "react";

interface Props {
  onRemove: () => void;
  removing?: boolean;
  variant?: "sidebar" | "header";
  label?: string;
}

export default function ChatInternoKebabMenu({
  onRemove,
  removing = false,
  variant = "sidebar",
  label = "Más opciones del contacto",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`chat-interno-kebab chat-interno-kebab--${variant}${open ? " chat-interno-kebab--open" : ""}`}
    >
      <button
        type="button"
        className="chat-interno-kebab-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={removing}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.65" />
          <circle cx="12" cy="12" r="1.65" />
          <circle cx="12" cy="19" r="1.65" />
        </svg>
      </button>
      {open && (
        <div id={menuId} className="chat-interno-kebab-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="chat-interno-kebab-item chat-interno-kebab-item--danger"
            disabled={removing}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRemove();
            }}
          >
            <span className="chat-interno-kebab-item-icon" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            <span className="chat-interno-kebab-item-text">
              <strong>Eliminar contacto</strong>
              <small>Quitar de Otras cuentas</small>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
