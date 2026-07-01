import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORMAS_ADMIN_REMEDIO } from "./stock-control-sanitario-formas";

const STORAGE_KEY = "scg-formas-admin-remedio-extras";
const MAX_FORMA_LEN = 80;

function loadFormaExtras(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveFormaExtras(list: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialFormas?: string[];
}

export default function StockControlSanitarioFormaSelect({
  value,
  onChange,
  disabled = false,
  historialFormas = [],
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaForma, setNuevaForma] = useState("");
  const [extras, setExtras] = useState<string[]>(() => loadFormaExtras());

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
    for (const f of FORMAS_ADMIN_REMEDIO) push(f);
    for (const f of extras) push(f);
    for (const f of historialFormas) push(f);
    if (String(value ?? "").trim()) push(String(value ?? ""));
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [extras, historialFormas, value]);

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
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaForma("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaForma(sugerida.trim().slice(0, MAX_FORMA_LEN));
    setModoNuevo(true);
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
        a.localeCompare(b, "es", { sensitivity: "base" })
      );
      saveFormaExtras(next);
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
              : `${FORMAS_ADMIN_REMEDIO.length} formas — buscá o agregá una nueva`}
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
                  placeholder="Ej. Intranasal, Implante…"
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
                  <span>Nueva forma de administración</span>
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
