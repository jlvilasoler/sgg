import { createPortal } from "react-dom";
import type { StockDispositivoModulo } from "../../api";
import StockControlSanitarioProductoFichaView from "./StockControlSanitarioProductoFichaView";

interface Props {
  open: boolean;
  nombre: string;
  modulo: StockDispositivoModulo;
  apiOnline: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
  onSaved?: (msg: string) => void;
  /** Abre directamente en modo edición (p. ej. panel de configuración). */
  initialEdit?: boolean;
}

export default function StockControlSanitarioProductoFichaModal({
  open,
  nombre,
  modulo,
  apiOnline,
  onClose,
  onError,
  onSaved,
  initialEdit = false,
}: Props) {
  if (!open || !String(nombre ?? "").trim()) return null;

  return createPortal(
    <div
      className="stock-control-sanitario-overlay stock-producto-ficha-overlay stock-producto-ficha-overlay--hub"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-producto-ficha-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="stock-producto-ficha-modal stock-producto-ficha-modal--hub stock-producto-ficha-modal--dispositivo">
        <div className="stock-producto-ficha-accent" aria-hidden />
        <StockControlSanitarioProductoFichaView
          nombre={nombre}
          modulo={modulo}
          apiOnline={apiOnline}
          active={open}
          layout="modal"
          onError={onError}
          onSaved={onSaved}
          initialEdit={initialEdit}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
