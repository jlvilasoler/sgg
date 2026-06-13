import { useEffect, useMemo, useRef, useState } from "react";
import {
  BANCO_OTRO,
  esBancoOtro,
  getBancoInfo,
  listarBancosCatalogo,
} from "../../constants/bancosUruguay";
import BancoLogo from "./BancoLogo";

interface Props {
  id?: string;
  value: string;
  onChange: (nombre: string) => void;
  label?: string;
}

function esBancoCatalogoEstandar(nombre: string): boolean {
  return !!getBancoInfo(nombre);
}

export default function SelectorBanco({
  id = "f-banco",
  value,
  onChange,
  label = "Banco",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoOtro, setModoOtro] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const catalogo = useMemo(() => listarBancosCatalogo(value), [value]);

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return catalogo;
    return catalogo.filter(
      (b) =>
        b.nombre.toLowerCase().includes(t) ||
        b.iniciales.toLowerCase().includes(t) ||
        b.domain.toLowerCase().includes(t)
    );
  }, [catalogo, busqueda]);

  useEffect(() => {
    const v = value.trim();
    if (!v) return;
    if (esBancoCatalogoEstandar(v) || getBancoInfo(v)) {
      setModoOtro(false);
    } else if (!esBancoOtro(v)) {
      setModoOtro(true);
    }
  }, [value]);

  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [abierto]);

  const elegir = (nombre: string) => {
    if (nombre === BANCO_OTRO) {
      setModoOtro(true);
      onChange("");
    } else {
      setModoOtro(false);
      onChange(nombre);
    }
    setAbierto(false);
    setBusqueda("");
  };

  const textoTrigger = value.trim()
    ? value
    : modoOtro
      ? BANCO_OTRO
      : "Seleccionar banco…";

  const mostrarOtroInput = modoOtro || esBancoOtro(value);

  return (
    <div className="banco-selector field" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        id={id}
        className="banco-selector-trigger"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((o) => !o)}
      >
        {value.trim() && !mostrarOtroInput ? (
          <BancoLogo nombre={value} size="sm" />
        ) : (
          <span className="banco-logo banco-logo--sm banco-logo-fallback banco-logo-fallback--otro">
            🏦
          </span>
        )}
        <span
          className={
            value.trim() || modoOtro ? "banco-selector-trigger-text" : "banco-selector-trigger-text is-placeholder"
          }
        >
          {textoTrigger}
        </span>
        <span className="banco-selector-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {abierto && (
        <div className="banco-selector-panel" role="listbox">
          <div className="banco-selector-search">
            <input
              ref={searchRef}
              type="search"
              className="banco-selector-search-input"
              placeholder="Buscar banco…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar banco"
            />
          </div>
          <ul className="banco-selector-list">
            {lista.map((b) => (
              <li key={b.nombre}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === b.nombre}
                  className={value === b.nombre ? "is-selected" : ""}
                  onClick={() => elegir(b.nombre)}
                >
                  <BancoLogo nombre={b.nombre} size="sm" />
                  <span>{b.nombre}</span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                role="option"
                className={mostrarOtroInput ? "is-selected" : ""}
                onClick={() => elegir(BANCO_OTRO)}
              >
                <span className="banco-logo banco-logo--sm banco-logo-fallback banco-logo-fallback--otro">
                  ✏️
                </span>
                <span>{BANCO_OTRO}</span>
              </button>
            </li>
          </ul>
        </div>
      )}

      {mostrarOtroInput && (
        <input
          className="banco-otro-input"
          aria-label="Nombre del banco"
          placeholder="Escribí el nombre del banco"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
