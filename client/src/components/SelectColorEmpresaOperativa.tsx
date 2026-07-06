import {
  COLORES_CARAVANA,
  etiquetaColorCaravana,
  normalizarColorCaravana,
} from "./stock/stock-dispositivo-color";

interface Props {
  value: string;
  onChange: (color: string) => void;
  coloresOcupados?: string[];
  disabled?: boolean;
  id?: string;
}

export default function SelectColorEmpresaOperativa({
  value,
  onChange,
  coloresOcupados = [],
  disabled = false,
  id,
}: Props) {
  const norm = normalizarColorCaravana(value);
  const ocupados = new Set(
    coloresOcupados.map((c) => normalizarColorCaravana(c)).filter(Boolean)
  );

  return (
    <div className="empresa-operativa-color-picker" id={id}>
      <p className="empresa-operativa-color-picker-hint muted">
        Elegí un color único para esta empresa dentro de la cuenta.
      </p>
      <div
        className="empresa-operativa-color-grid"
        role="listbox"
        aria-label="Color de empresa"
      >
        {COLORES_CARAVANA.map((color) => {
          const tomado = ocupados.has(color.id) && color.id !== norm;
          const selected = norm === color.id;
          return (
            <button
              key={color.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-disabled={tomado}
              disabled={disabled || tomado}
              title={
                tomado
                  ? `${color.label} — ya usado por otra empresa`
                  : color.label
              }
              className={`empresa-operativa-color-option${
                selected ? " empresa-operativa-color-option--selected" : ""
              }${tomado ? " empresa-operativa-color-option--taken" : ""}`}
              onClick={() => onChange(color.id)}
            >
              <span
                className="empresa-operativa-color-option-swatch"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <span className="empresa-operativa-color-option-label">{color.label}</span>
            </button>
          );
        })}
      </div>
      {norm ? (
        <p className="empresa-operativa-color-picker-selected muted">
          Seleccionado: <strong>{etiquetaColorCaravana(norm)}</strong>
        </p>
      ) : (
        <p className="empresa-operativa-color-picker-selected muted">
          Todavía no elegiste un color.
        </p>
      )}
    </div>
  );
}
