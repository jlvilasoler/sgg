import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARCAS_REMEDIO_GANADO,
  marcaCoincideBusqueda,
  type MarcaRemedioCatalogo,
  type MarcaRemedioPais,
} from "./stock-control-sanitario-marcas";

const STORAGE_KEY = "scg-marcas-remedio-extras";
const MAX_MARCA_LEN = 120;

interface MarcaOpcion {
  nombre: string;
  paises: readonly MarcaRemedioPais[];
  esPersonalizada: boolean;
}

function loadMarcaExtras(): string[] {
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

function saveMarcaExtras(list: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialMarcas?: string[];
}

export default function StockControlSanitarioMarcaSelect({
  value,
  onChange,
  disabled = false,
  historialMarcas = [],
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [extras, setExtras] = useState<string[]>(() => loadMarcaExtras());

  const catalogoPorNombre = useMemo(() => {
    const map = new Map<string, MarcaRemedioCatalogo>();
    for (const m of MARCAS_REMEDIO_GANADO) {
      map.set(m.nombre.toLocaleLowerCase("es-UY"), m);
    }
    return map;
  }, []);

  const todasLasMarcas = useMemo(() => {
    const seen = new Set<string>();
    const list: MarcaOpcion[] = [];
    const push = (nombre: string, esPersonalizada = false) => {
      const t = nombre.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      seen.add(key);
      const catalogo = catalogoPorNombre.get(key);
      list.push({
        nombre: catalogo?.nombre ?? t,
        paises: catalogo?.paises ?? [],
        esPersonalizada: esPersonalizada || !catalogo,
      });
    };
    for (const m of MARCAS_REMEDIO_GANADO) push(m.nombre);
    for (const m of extras) push(m, true);
    for (const m of historialMarcas) push(m);
    if (value.trim()) push(value);
    return list.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
  }, [catalogoPorNombre, extras, historialMarcas, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim();
    if (!t) return todasLasMarcas;
    return todasLasMarcas.filter((m) =>
      m.esPersonalizada
        ? m.nombre.toLowerCase().includes(t.toLowerCase())
        : marcaCoincideBusqueda(
            { nombre: m.nombre, paises: m.paises },
            t
          )
    );
  }, [busqueda, todasLasMarcas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaMarca("");
  }, []);

  const elegir = useCallback(
    (marca: string) => {
      onChange(marca);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaMarca("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaMarca(sugerida.trim().slice(0, MAX_MARCA_LEN));
    setModoNuevo(true);
  };

  const guardarNueva = () => {
    const nombre = nuevaMarca.trim().slice(0, MAX_MARCA_LEN);
    if (!nombre) return;

    setExtras((prev) => {
      if (prev.some((x) => x.localeCompare(nombre, "es", { sensitivity: "base" }) === 0)) {
        return prev;
      }
      const next = [...prev, nombre].sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      );
      saveMarcaExtras(next);
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
    <div className="stock-control-sanitario-marca-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-producto-nombre-trigger"
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
            title="Quitar marca"
            aria-label="Quitar marca"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-marca-busqueda" className="sr-only">
              Buscar marca comercial
            </label>
            <input
              ref={searchRef}
              id="cs-marca-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar marca…"
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
              ? `${listaFiltrada.length} coincidencia(s) de ${todasLasMarcas.length}`
              : `${MARCAS_REMEDIO_GANADO.length} marcas — buscá o agregá una nueva`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nueva marca comercial"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nueva marca comercial</p>
              </div>
              <div className="field">
                <label htmlFor="cs-marca-nueva">Marca</label>
                <input
                  ref={nuevaRef}
                  id="cs-marca-nueva"
                  type="text"
                  className="proveedor-panel-input"
                  maxLength={MAX_MARCA_LEN}
                  placeholder="Ej. Ivomec, Zoetis, Virbac…"
                  value={nuevaMarca}
                  onChange={(e) => setNuevaMarca(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaMarca.trim()}
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
                  <span>Nueva marca comercial</span>
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
                  <li key={m.nombre}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === m.nombre}
                      onClick={() => elegir(m.nombre)}
                    >
                      {m.nombre}
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
