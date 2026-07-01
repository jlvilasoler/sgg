import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOTIVOS_CONTROL_SANITARIO } from "./stock-control-sanitario-motivos";

const STORAGE_KEY = "scg-motivos-control-sanitario-extras";
const MAX_MOTIVO_LEN = 500;

function loadMotivoExtras(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveMotivoExtras(list: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialMotivos?: string[];
}

export default function StockControlSanitarioMotivoSelect({
  value,
  onChange,
  disabled = false,
  historialMotivos = [],
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLTextAreaElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [extras, setExtras] = useState<string[]>(() => loadMotivoExtras());

  const todosLosMotivos = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (m: string) => {
      const t = m.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      seen.add(key);
      list.push(t);
    };
    for (const m of MOTIVOS_CONTROL_SANITARIO) push(m);
    for (const m of extras) push(m);
    for (const m of historialMotivos) push(m);
    if (value.trim()) push(value);
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [extras, historialMotivos, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todosLosMotivos;
    return todosLosMotivos.filter((m) => m.toLowerCase().includes(t));
  }, [busqueda, todosLosMotivos]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevoMotivo("");
  }, []);

  const elegir = useCallback(
    (motivo: string) => {
      onChange(motivo);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevoMotivo("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevoMotivo(sugerida.trim().slice(0, MAX_MOTIVO_LEN));
    setModoNuevo(true);
  };

  const guardarNuevo = () => {
    const nombre = nuevoMotivo.trim().slice(0, MAX_MOTIVO_LEN);
    if (!nombre) return;

    setExtras((prev) => {
      if (prev.some((x) => x.localeCompare(nombre, "es", { sensitivity: "base" }) === 0)) {
        return prev;
      }
      const next = [...prev, nombre].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      );
      saveMotivoExtras(next);
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
    <div className="stock-control-sanitario-motivo-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-control-motivo-trigger"
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
            title="Quitar motivo"
            aria-label="Quitar motivo"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-motivo-busqueda" className="sr-only">
              Buscar motivo
            </label>
            <input
              ref={searchRef}
              id="cs-motivo-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar motivo…"
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
              ? `${listaFiltrada.length} coincidencia(s) de ${todosLosMotivos.length}`
              : `${MOTIVOS_CONTROL_SANITARIO.length} motivos — buscá o agregá uno nuevo`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nuevo motivo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardarNuevo();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nuevo motivo</p>
              </div>
              <div className="field">
                <label htmlFor="cs-motivo-nuevo">Motivo</label>
                <textarea
                  ref={nuevaRef}
                  id="cs-motivo-nuevo"
                  className="proveedor-panel-input"
                  rows={2}
                  maxLength={MAX_MOTIVO_LEN}
                  placeholder="Ej. Tratamiento por herida, control prefaena…"
                  value={nuevoMotivo}
                  onChange={(e) => setNuevoMotivo(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevoMotivo.trim()}
                  onClick={guardarNuevo}
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
                  <span>Nuevo motivo</span>
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
              ? listaFiltrada.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === m}
                      onClick={() => elegir(m)}
                    >
                      {m}
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
