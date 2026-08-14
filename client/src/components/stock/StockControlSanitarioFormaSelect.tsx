import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  catalogoFormasPorModulo,
  type FormaAdminRemedioModulo,
} from "./stock-control-sanitario-formas";

const STORAGE_KEY_GANADERO = "scg-formas-admin-remedio-extras";
const STORAGE_KEY_OVINO = "scg-formas-admin-remedio-extras-ovino";
const MAX_FORMA_LEN = 80;

function storageKey(modulo: FormaAdminRemedioModulo): string {
  return modulo === "ovino" ? STORAGE_KEY_OVINO : STORAGE_KEY_GANADERO;
}

function loadFormaExtras(modulo: FormaAdminRemedioModulo): string[] {
  try {
    const raw = localStorage.getItem(storageKey(modulo));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x.localeCompare("Otra", "es", { sensitivity: "base" }) !== 0);
  } catch {
    return [];
  }
}

function saveFormaExtras(modulo: FormaAdminRemedioModulo, list: string[]): void {
  localStorage.setItem(storageKey(modulo), JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialFormas?: string[];
  modulo?: FormaAdminRemedioModulo;
}

export default function StockControlSanitarioFormaSelect({
  value,
  onChange,
  disabled = false,
  historialFormas = [],
  modulo = "ganadero",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaForma, setNuevaForma] = useState("");
  const [extras, setExtras] = useState<string[]>(() => loadFormaExtras(modulo));

  useEffect(() => {
    setExtras(loadFormaExtras(modulo));
  }, [modulo]);

  const catalogoFormas = useMemo(() => catalogoFormasPorModulo(modulo), [modulo]);

  const todasLasFormas = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (f: string) => {
      const t = f.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      if (t.localeCompare("Otra", "es", { sensitivity: "base" }) === 0) return;
      seen.add(key);
      list.push(t);
    };
    for (const f of catalogoFormas) push(f);
    for (const f of extras) push(f);
    for (const f of historialFormas) push(f);
    if (String(value ?? "").trim()) push(String(value ?? ""));
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [catalogoFormas, extras, historialFormas, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todasLasFormas;
    return todasLasFormas.filter((f) => f.toLowerCase().includes(t));
  }, [busqueda, todasLasFormas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaForma("");
  }, []);

  const elegir = useCallback(
    (forma: string) => {
      onChange(forma);
      cerrar();
    },
    [cerrar, onChange],
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setModoNuevo(false);
    setBusqueda("");
  };

  const guardarNueva = () => {
    const nombre = nuevaForma.trim().slice(0, MAX_FORMA_LEN);
    if (!nombre) return;
    if (nombre.localeCompare("Otra", "es", { sensitivity: "base" }) === 0) return;

    setExtras((prev) => {
      if (prev.some((x) => x.localeCompare(nombre, "es", { sensitivity: "base" }) === 0)) {
        return prev;
      }
      const next = [...prev, nombre].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      );
      saveFormaExtras(modulo, next);
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

  return (
    <div className="stock-control-sanitario-forma-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-producto-forma-trigger"
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
            title="Quitar forma"
            aria-label="Quitar forma de administración"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-forma-busqueda" className="sr-only">
              Buscar forma de administración
            </label>
            <input
              ref={searchRef}
              id="cs-forma-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar forma…"
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
              ? `${listaFiltrada.length} coincidencia(s) de ${todasLasFormas.length}`
              : `${catalogoFormas.length} formas${
                  modulo === "ovino" ? " ovinas" : ""
                } — buscá o agregá una nueva`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nueva forma de administración"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nueva forma de administración</p>
              </div>
              <div className="field">
                <label htmlFor="cs-forma-nueva">Forma</label>
                <input
                  ref={nuevaRef}
                  id="cs-forma-nueva"
                  type="text"
                  className="proveedor-panel-input"
                  maxLength={MAX_FORMA_LEN}
                  placeholder="Ej. Oral (drench), Subcutánea…"
                  value={nuevaForma}
                  onChange={(e) => setNuevaForma(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaForma.trim()}
                  onClick={guardarNueva}
                >
                  Guardar y usar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setModoNuevo(false);
                    setNuevaForma("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="proveedor-option proveedor-option--nueva"
                onClick={() => {
                  setModoNuevo(true);
                  setBusqueda("");
                }}
              >
                <span>+ Nueva forma de administración</span>
              </button>
              <ul className="proveedor-list" role="listbox">
                {listaFiltrada.map((forma) => (
                  <li key={forma}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={
                        value.localeCompare(forma, "es", { sensitivity: "base" }) === 0
                      }
                      className={`proveedor-option${
                        value.localeCompare(forma, "es", { sensitivity: "base" }) === 0
                          ? " is-selected"
                          : ""
                      }`}
                      onClick={() => elegir(forma)}
                    >
                      {forma}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
