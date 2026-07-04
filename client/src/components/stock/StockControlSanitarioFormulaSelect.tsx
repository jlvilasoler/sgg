import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  catalogoFormulasPorModulo,
  type FormulaRemedioModulo,
} from "./stock-control-sanitario-formulas";

const STORAGE_KEY_GANADERO = "scg-formulas-remedio-extras";
const STORAGE_KEY_EQUINO = "scg-formulas-remedio-extras-equino";
const MAX_FORMULA_LEN = 80;

function storageKey(modulo: FormulaRemedioModulo): string {
  return modulo === "equino" ? STORAGE_KEY_EQUINO : STORAGE_KEY_GANADERO;
}

function loadFormulaExtras(modulo: FormulaRemedioModulo): string[] {
  try {
    const raw = localStorage.getItem(storageKey(modulo));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveFormulaExtras(modulo: FormulaRemedioModulo, list: string[]): void {
  localStorage.setItem(storageKey(modulo), JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialFormulas?: string[];
  modulo?: FormulaRemedioModulo;
}

export default function StockControlSanitarioFormulaSelect({
  value,
  onChange,
  disabled = false,
  historialFormulas = [],
  modulo = "ganadero",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaFormula, setNuevaFormula] = useState("");
  const [extras, setExtras] = useState<string[]>(() => loadFormulaExtras(modulo));

  useEffect(() => {
    setExtras(loadFormulaExtras(modulo));
  }, [modulo]);

  const catalogoBase = useMemo(() => catalogoFormulasPorModulo(modulo), [modulo]);

  const todasLasFormulas = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (f: string) => {
      const t = f.trim();
      if (!t || seen.has(t)) return;
      seen.add(t);
      list.push(t);
    };
    for (const f of catalogoBase) push(f);
    for (const f of extras) push(f);
    for (const f of historialFormulas) push(f);
    if (String(value ?? "").trim()) push(String(value ?? ""));
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [catalogoBase, extras, historialFormulas, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todasLasFormulas;
    return todasLasFormulas.filter((f) => f.toLowerCase().includes(t));
  }, [busqueda, todasLasFormulas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaFormula("");
  }, []);

  const elegir = useCallback(
    (formula: string) => {
      onChange(formula);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaFormula("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaFormula(sugerida.trim().slice(0, MAX_FORMULA_LEN));
    setModoNuevo(true);
  };

  const guardarNueva = () => {
    const nombre = nuevaFormula.trim().slice(0, MAX_FORMULA_LEN);
    if (!nombre) return;

    setExtras((prev) => {
      if (prev.some((x) => x.localeCompare(nombre, "es", { sensitivity: "base" }) === 0)) {
        return prev;
      }
      const next = [...prev, nombre].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      );
      saveFormulaExtras(modulo, next);
      return next;
    });
    onChange(nombre);
    cerrar();
  };

  useEffect(() => {
    if (!abierto || modoNuevo) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [abierto, modoNuevo]);

  useEffect(() => {
    if (!modoNuevo) return;
    const t = window.setTimeout(() => nuevaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [modoNuevo]);

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

  const textoSeleccion = value.trim() || "— Seleccionar —";
  const metaLabel =
    modulo === "equino"
      ? `${todasLasFormulas.length} fórmula(s) equina(s) — buscá o agregá una nueva`
      : `${todasLasFormulas.length} fórmula(s) — buscá o agregá una nueva`;

  return (
    <div className="stock-control-sanitario-formula-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-producto-formula-trigger"
          className="stock-control-sanitario-field-trigger"
          aria-expanded={abierto}
          aria-haspopup="listbox"
          onClick={() => (abierto ? cerrar() : abrir())}
          disabled={disabled}
        >
          <span className={value.trim() ? "" : "stock-control-sanitario-field-trigger-placeholder"}>
            {textoSeleccion}
          </span>
        </button>
        {value.trim() && !disabled ? (
          <button
            type="button"
            className="stock-control-sanitario-field-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            title="Quitar fórmula"
            aria-label="Quitar fórmula"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-formula-busqueda" className="sr-only">
              Buscar fórmula
            </label>
            <input
              ref={searchRef}
              id="cs-formula-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar fórmula…"
              value={busqueda}
              disabled={modoNuevo}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (modoNuevo) setModoNuevo(false);
                  else cerrar();
                }
              }}
            />
          </div>
          <p className="proveedor-panel-meta">
            {busqueda.trim()
              ? `${listaFiltrada.length} coincidencia(s) de ${todasLasFormulas.length}`
              : metaLabel}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nueva fórmula"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nueva fórmula</p>
              </div>
              <div className="field">
                <label htmlFor="cs-formula-nueva">Fórmula</label>
                <input
                  ref={nuevaRef}
                  id="cs-formula-nueva"
                  type="text"
                  className="proveedor-panel-input"
                  maxLength={MAX_FORMULA_LEN}
                  placeholder={
                    modulo === "equino"
                      ? "Ej. Ivermectina 1,87% pasta oral, Flunixin 2,5%…"
                      : "Ej. Ivermectina 1%, Albendazol 10%…"
                  }
                  value={nuevaFormula}
                  onChange={(e) => setNuevaFormula(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaFormula.trim()}
                  onClick={guardarNueva}
                >
                  Guardar y usar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setModoNuevo(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          <ul className="proveedor-dropdown" role="listbox">
            {!modoNuevo ? (
              <li>
                <button
                  type="button"
                  className="proveedor-dropdown-item-nuevo"
                  onClick={() => abrirNuevo()}
                >
                  <strong>+</strong>
                  <span>Nueva fórmula</span>
                </button>
              </li>
            ) : null}

            {!modoNuevo && listaFiltrada.length === 0 && busqueda.trim() ? (
              <li>
                <button
                  type="button"
                  className="proveedor-dropdown-item-nuevo proveedor-dropdown-item-nuevo--sugerido"
                  onClick={() => abrirNuevo(busqueda.trim())}
                >
                  <strong>+</strong>
                  <span>Crear «{busqueda.trim()}»</span>
                </button>
              </li>
            ) : null}

            {!modoNuevo
              ? listaFiltrada.map((f) => (
                  <li key={f}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === f}
                      onClick={() => elegir(f)}
                    >
                      {f}
                    </button>
                  </li>
                ))
              : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
