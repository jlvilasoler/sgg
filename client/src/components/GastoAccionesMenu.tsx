import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconDescargar, IconDocumento, IconEditar, IconEliminar, IconVer } from "./icons/ActionIcons";

interface Props {
  tieneDocumento: boolean;
  descargarUrl?: string;
  descargarNombre?: string;
  onVerDocumento: () => void;
  onVerDetalle: () => void;
  onEditar: () => void;
  onBorrar: () => void;
}

interface MenuPos {
  top: number;
  left: number;
}

function IconMenu({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export default function GastoAccionesMenu({
  tieneDocumento,
  descargarUrl,
  descargarNombre,
  onVerDocumento,
  onVerDetalle,
  onEditar,
  onBorrar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<MenuPos>({ top: 0, left: 0 });
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_ANCHO = 190;

  const recalcular = () => {
    const btn = botonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.max(8, rect.right - MENU_ANCHO);
    setPos({ top: rect.bottom + 6, left });
  };

  useLayoutEffect(() => {
    if (abierto) recalcular();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setAbierto(false);
    const onClickFuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        botonRef.current?.contains(t) ||
        menuRef.current?.contains(t)
      ) {
        return;
      }
      setAbierto(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("resize", cerrar);
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const ejecutar = (accion: () => void) => {
    setAbierto(false);
    accion();
  };

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        className={`btn btn-sm btn-icon-only gasto-acciones-trigger${
          abierto ? " is-open" : ""
        }`}
        onClick={() => setAbierto((v) => !v)}
        title="Acciones"
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <IconMenu size={16} />
      </button>

      {abierto
        ? createPortal(
            <div
              ref={menuRef}
              className="gasto-acciones-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left, width: MENU_ANCHO }}
            >
              {tieneDocumento ? (
                <button
                  type="button"
                  role="menuitem"
                  className="gasto-acciones-item gasto-acciones-item--doc"
                  onClick={() => ejecutar(onVerDocumento)}
                >
                  <IconDocumento size={16} />
                  <span>Ver comprobante</span>
                </button>
              ) : null}
              {descargarUrl ? (
                <a
                  role="menuitem"
                  className="gasto-acciones-item gasto-acciones-item--download"
                  href={descargarUrl}
                  download={descargarNombre || true}
                  onClick={() => setAbierto(false)}
                >
                  <IconDescargar size={16} />
                  <span>Descargar</span>
                </a>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="gasto-acciones-item"
                onClick={() => ejecutar(onVerDetalle)}
              >
                <IconVer size={16} />
                <span>Ver detalle</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="gasto-acciones-item"
                onClick={() => ejecutar(onEditar)}
              >
                <IconEditar size={16} />
                <span>Editar</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="gasto-acciones-item gasto-acciones-item--danger"
                onClick={() => ejecutar(onBorrar)}
              >
                <IconEliminar size={16} />
                <span>Borrar</span>
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
