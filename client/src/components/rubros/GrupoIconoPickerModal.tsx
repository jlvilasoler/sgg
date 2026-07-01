import type { GrupoIconoInfo } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import { BANCO_ICONOS_RUBRO } from "../../constants/iconoBanco";
import { iconoGrupo } from "../../utils/catalogoIconos";
import SubseccionInlinePanel from "../SubseccionInlinePanel";

interface Props {
  grupo: string;
  apiOnline: boolean;
  guardando: boolean;
  iconoActual?: GrupoIconoInfo;
  onVolver: () => void;
  onElegirEmoji: (emoji: string) => void;
  onSubirPc: () => void;
  onRestaurar: () => void;
}

export default function GrupoIconoPickerPanel({
  grupo,
  apiOnline,
  guardando,
  iconoActual,
  onVolver,
  onElegirEmoji,
  onSubirPc,
  onRestaurar,
}: Props) {
  useHeaderBackStep(true, onVolver, "Rubros");

  return (
    <SubseccionInlinePanel
      onVolver={onVolver}
      volverLabel="Volver a Rubros"
      icon={{ source: "hub", id: "config_rubros" }}
      title={`Icono de «${grupo}»`}
      description="Elegí un emoji del banco, subí una imagen o restaurá el icono automático."
      cardClassName="icon-picker-inline"
      footer={
        <>
          <button type="button" className="btn btn-ghost" disabled={guardando} onClick={onVolver}>
            Volver
          </button>
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
            className="btn btn-secondary"
            disabled={guardando || !apiOnline || !iconoActual}
            onClick={onRestaurar}
          >
            Icono automático
          </button>
        </>
      }
    >
      {!apiOnline && (
        <p className="icon-picker-offline" role="status">
          API desconectada: podés ver el banco, pero para guardar reiniciá{" "}
          <code>npm run dev</code> en la carpeta del proyecto.
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

      {guardando && <p className="muted icon-picker-saving">Guardando…</p>}
    </SubseccionInlinePanel>
  );
}

/** @deprecated Usar GrupoIconoPickerPanel */
export { GrupoIconoPickerPanel as GrupoIconoPickerModal };
