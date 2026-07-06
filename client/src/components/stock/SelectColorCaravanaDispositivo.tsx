import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  COLORES_CARAVANA,
  etiquetaColorCaravana,
  hexColorCaravana,
  normalizarColorCaravana,
} from "./stock-dispositivo-color";

interface Props {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
  id?: string;
  selectClassName?: string;
}

function ColorSwatch({ colorId }: { colorId: string }) {
  const hex = hexColorCaravana(colorId);
  return (
    <span
      className={`stock-color-caravana-swatch${hex ? "" : " stock-color-caravana-swatch--empty"}`}
      style={hex ? { backgroundColor: hex } : undefined}
      aria-hidden
    />
  );
}

export default function SelectColorCaravanaDispositivo({
  value,
  onChange,
  disabled = false,
  id,
  selectClassName = "stock-edit-select",
}: Props) {
  const norm = normalizarColorCaravana(value);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);

  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        cerrar();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [abierto, cerrar]);

  const elegir = (colorId: string) => {
    onChange(colorId);
    cerrar();
  };

  const etiqueta = etiquetaColorCaravana(norm);

  return (
    <div className="stock-color-caravana-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`stock-color-caravana-trigger ${selectClassName}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listboxId}
        onClick={() => {
          if (disabled) return;
          setAbierto((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") cerrar();
        }}
      >
        <ColorSwatch colorId={norm} />
        <span className="stock-color-caravana-trigger-label">{etiqueta}</span>
        <span className="stock-color-caravana-trigger-chevron" aria-hidden>
          <svg viewBox="0 0 20 20" focusable="false">
            <path
              d="M5.5 7.5 10 12l4.5-4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {abierto && !disabled ? (
        <ul
          id={listboxId}
          className="stock-color-caravana-menu"
          role="listbox"
          aria-label="Color de caravana"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!norm}
              className={`stock-color-caravana-option${!norm ? " stock-color-caravana-option--selected" : ""}`}
              onClick={() => elegir("")}
            >
              <ColorSwatch colorId="" />
              <span>—</span>
            </button>
          </li>
          {COLORES_CARAVANA.map((color) => (
            <li key={color.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={norm === color.id}
                className={`stock-color-caravana-option${
                  norm === color.id ? " stock-color-caravana-option--selected" : ""
                }`}
                onClick={() => elegir(color.id)}
              >
                <ColorSwatch colorId={color.id} />
                <span>{color.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
