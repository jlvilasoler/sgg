import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStockControlSanitarioCantidadOpcion,
  fetchStockControlSanitarioCantidadOpciones,
  type StockDispositivoModulo,
} from "../../api";
import {
  CANTIDADES_REMEDIO_PRESET,
  mergeCantidadOpciones,
} from "./stock-control-sanitario-cantidades";

const MAX_CANTIDAD_LEN = 80;

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  apiOnline: boolean;
  modulo: StockDispositivoModulo;
  historialCantidades?: string[];
  onError: (msg: string) => void;
}

export default function StockControlSanitarioCantidadSelect({
  value,
  onChange,
  disabled = false,
  apiOnline,
  modulo,
  historialCantidades = [],
  onError,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [catalogoDb, setCatalogoDb] = useState<string[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  const loadCatalogo = useCallback(async () => {
    if (!apiOnline) {
      setCatalogoDb([]);
      return;
    }
    setLoadingCatalogo(true);
    try {
      const rows = await fetchStockControlSanitarioCantidadOpciones(modulo);
      setCatalogoDb(rows.map((r) => r.valor));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar cantidades");
      setCatalogoDb([]);
    } finally {
      setLoadingCatalogo(false);
    }
  }, [apiOnline, modulo, onError]);

  useEffect(() => {
    if (!abierto) return;
    void loadCatalogo();
  }, [abierto, loadCatalogo]);

  const todasLasCantidades = useMemo(
    () => mergeCantidadOpciones(catalogoDb, historialCantidades, value),
    [catalogoDb, historialCantidades, value]
  );

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todasLasCantidades;
    return todasLasCantidades.filter((c) => c.toLowerCase().includes(t));
  }, [busqueda, todasLasCantidades]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaCantidad("");
  }, []);

  const elegir = useCallback(
    (cantidad: string) => {
      onChange(cantidad);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaCantidad("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaCantidad(sugerida.trim().slice(0, MAX_CANTIDAD_LEN));
    setModoNuevo(true);
  };

  const guardarNueva = async () => {
    const nombre = nuevaCantidad.trim().slice(0, MAX_CANTIDAD_LEN);
    if (!nombre) return;

    const yaExiste = todasLasCantidades.some(
      (c) => c.localeCompare(nombre, "es", { sensitivity: "accent" }) === 0
    );
    if (yaExiste) {
      onChange(nombre);
      cerrar();
      return;
    }

    if (!apiOnline) {
      onError("API no conectada");
      return;
    }

    setGuardandoNueva(true);
    try {
      const creada = await createStockControlSanitarioCantidadOpcion(modulo, nombre);
      setCatalogoDb((prev) => {
        if (prev.some((x) => x.toLowerCase() === creada.valor.toLowerCase())) return prev;
        return [...prev, creada.valor].sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );
      });
      onChange(creada.valor);
      cerrar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar cantidad");
    } finally {
      setGuardandoNueva(false);
    }
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
  const totalPreset = CANTIDADES_REMEDIO_PRESET.length;

  return (
    <div className="stock-control-sanitario-cantidad-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id="cs-producto-cantidad-trigger"
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
            title="Quitar cantidad"
            aria-label="Quitar cantidad"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="cs-cantidad-busqueda" className="sr-only">
              Buscar cantidad
            </label>
            <input
              ref={searchRef}
              id="cs-cantidad-busqueda"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar cantidad…"
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
            {loadingCatalogo
              ? "Cargando catálogo…"
              : busqueda.trim()
                ? `${listaFiltrada.length} coincidencia(s) de ${todasLasCantidades.length}`
                : `${totalPreset} preset · ${catalogoDb.length} en catálogo · buscá o agregá`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nueva cantidad"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !guardandoNueva) {
                  e.preventDefault();
                  void guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nueva cantidad</p>
              </div>
              <div className="field">
                <label htmlFor="cs-cantidad-nueva">Cantidad</label>
                <input
                  ref={nuevaRef}
                  id="cs-cantidad-nueva"
                  type="text"
                  className="proveedor-panel-input"
                  maxLength={MAX_CANTIDAD_LEN}
                  placeholder="Ej. 15 ml, 3 dosis…"
                  value={nuevaCantidad}
                  disabled={guardandoNueva}
                  onChange={(e) => setNuevaCantidad(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaCantidad.trim() || guardandoNueva}
                  onClick={() => void guardarNueva()}
                >
                  {guardandoNueva ? "Guardando…" : "Guardar y usar"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={guardandoNueva}
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
                  <span>Nueva cantidad</span>
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
              ? listaFiltrada.map((c) => (
                  <li key={c}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === c}
                      onClick={() => elegir(c)}
                    >
                      {c}
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
