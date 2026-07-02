import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  onRemove?: () => void;
  onChangeWallpaper?: () => void;
  onSearch?: () => void;
  onRenameChannel?: () => void;
  removing?: boolean;
  variant?: "sidebar" | "header";
  label?: string;
}

type MenuPlacement = "above" | "below";

interface MenuPosition {
  top: number;
  left: number;
  placement: MenuPlacement;
}

const MENU_ESTIMATE_WIDTH = 196;
const VIEWPORT_PAD = 10;

function menuEstimateHeight(itemCount: number) {
  return Math.max(76, itemCount * 58 + 12);
}

function computeMenuPosition(
  trigger: HTMLElement,
  menuWidth: number,
  menuHeight: number,
  variant: "sidebar" | "header"
): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
  const spaceAbove = rect.top - VIEWPORT_PAD;

  const openAbove =
    variant === "sidebar"
      ? spaceBelow < menuHeight + gap || spaceAbove >= spaceBelow
      : spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;

  const top = openAbove
    ? Math.max(VIEWPORT_PAD, rect.top - menuHeight - gap)
    : Math.min(window.innerHeight - menuHeight - VIEWPORT_PAD, rect.bottom + gap);

  let left = rect.right - menuWidth;
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PAD));

  return { top, left, placement: openAbove ? "above" : "below" };
}

export default function ChatInternoKebabMenu({
  onRemove,
  onChangeWallpaper,
  onSearch,
  onRenameChannel,
  removing = false,
  variant = "sidebar",
  label = "Más opciones",
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const itemCount =
    (onRenameChannel ? 1 : 0) +
    (onChangeWallpaper ? 1 : 0) +
    (onSearch ? 1 : 0) +
    (onRemove ? 1 : 0);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const menu = menuRef.current;
    const width = menu?.offsetWidth || MENU_ESTIMATE_WIDTH;
    const height = menu?.offsetHeight || menuEstimateHeight(itemCount);
    setMenuPos(computeMenuPosition(trigger, width, height, variant));
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    setMenuPos(
      computeMenuPosition(trigger, MENU_ESTIMATE_WIDTH, menuEstimateHeight(itemCount), variant)
    );
    const raf = window.requestAnimationFrame(() => updatePosition());
    return () => window.cancelAnimationFrame(raf);
  }, [open, variant, itemCount]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, variant, itemCount]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu = open
    ? createPortal(
        <div
          id={menuId}
          ref={menuRef}
          className={`chat-interno-kebab-menu chat-interno-kebab-menu--floating${
            menuPos ? ` chat-interno-kebab-menu--${menuPos.placement}` : ""
          }`}
          style={{
            top: menuPos?.top ?? -9999,
            left: menuPos?.left ?? -9999,
            visibility: menuPos ? "visible" : "hidden",
          }}
          role="menu"
        >
          {onRenameChannel && (
            <button
              type="button"
              role="menuitem"
              className="chat-interno-kebab-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onRenameChannel();
              }}
            >
              <span className="chat-interno-kebab-item-icon" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="chat-interno-kebab-item-text">
                <strong>Renombrar canal</strong>
                <small>Cambiar el nombre del canal</small>
              </span>
            </button>
          )}
          {onChangeWallpaper && (
            <button
              type="button"
              role="menuitem"
              className="chat-interno-kebab-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onChangeWallpaper();
              }}
            >
              <span className="chat-interno-kebab-item-icon" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="8.5" cy="10" r="1.4" fill="currentColor" />
                  <path
                    d="M3 15l4.5-4 3 3 5.5-6 4 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="chat-interno-kebab-item-text">
                <strong>Cambiar fondo del chat</strong>
                <small>Fondo de esta conversación</small>
              </span>
            </button>
          )}
          {onSearch && (
            <button
              type="button"
              role="menuitem"
              className="chat-interno-kebab-item"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onSearch();
              }}
            >
              <span className="chat-interno-kebab-item-icon" aria-hidden>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </span>
              <span className="chat-interno-kebab-item-text">
                <strong>Buscar en el chat</strong>
                <small>Mensajes de esta conversación</small>
              </span>
            </button>
          )}
          {onRemove && (
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
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`chat-interno-kebab chat-interno-kebab--${variant}${open ? " chat-interno-kebab--open" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="chat-interno-kebab-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
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
      {menu}
    </div>
  );
}
