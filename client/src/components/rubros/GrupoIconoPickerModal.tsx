import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { GrupoIconoInfo } from "../../api";
import { BANCO_ICONOS_RUBRO } from "../../constants/iconoBanco";
import { iconoGrupo } from "../../utils/catalogoIconos";

interface Props {
  grupo: string;
  apiOnline: boolean;
  guardando: boolean;
  iconoActual?: GrupoIconoInfo;
  onCerrar: () => void;
  onElegirEmoji: (emoji: string) => void;
  onSubirPc: () => void;
  onRestaurar: () => void;
}

export default function GrupoIconoPickerModal({
  grupo,
  apiOnline,
  guardando,
  iconoActual,
  onCerrar,
  onElegirEmoji,
  onSubirPc,
  onRestaurar,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando) onCerrar();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCerrar, guardando]);

  return createPortal(
    <div
      className="icon-picker-overlay"
      role="presentation"
      onClick={guardando ? undefined : onCerrar}
    >
      <div
        className="icon-picker-modal card"
        role="dialog"
        aria-labelledby="icon-picker-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="icon-picker-header">
          <h3 id="icon-picker-title">Icono de «{grupo}»</h3>
          <button
            type="button"
            className="icon-picker-close"
            aria-label="Cerrar"
            disabled={guardando}
            onClick={onCerrar}
          >
            ×
          </button>
        </div>

        {!apiOnline && (
          <p className="icon-picker-offline" role="status">
            API desconectada: podés ver el banco, pero para guardar reiniciá{" "}
            <code>npm run dev</code> en la carpeta SCG.
          </p>
        )}

        <p className="muted icon-picker-preview-label">Vista actual</p>
        <div className="icon-picker-preview">
          {iconoActual?.tipo === "imagen" ? (
            <img src={iconoActual.url} alt="" />
          ) : iconoActual?.tipo === "emoji" ? (
            <span className="icon-picker-preview-emoji">{iconoActual.emoji}</span>
          ) : (
            <span className="icon-picker-preview-emoji">{iconoGrupo(grupo)}</span>
          )}
        </div>

        <p className="icon-picker-section-title">Banco de iconos</p>
        <div className="icon-banco-grid">
          {BANCO_ICONOS_RUBRO.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`icon-banco-item${
                iconoActual?.tipo === "emoji" && iconoActual.emoji === emoji
                  ? " icon-banco-item--selected"
                  : ""
              }`}
              title={emoji}
              disabled={guardando || !apiOnline}
              onClick={() => onElegirEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="icon-picker-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || !apiOnline}
            onClick={onSubirPc}
          >
            Subir imagen del PC
          </button>
          <button
            type="button"
            className="btn"
            disabled={guardando || !apiOnline || !iconoActual}
            onClick={onRestaurar}
          >
            Icono automático
          </button>
          <button type="button" className="btn" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </button>
        </div>
        {guardando && <p className="muted icon-picker-saving">Guardando…</p>}
      </div>
    </div>,
    document.body
  );
}
