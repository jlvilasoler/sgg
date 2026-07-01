import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStockControlSanitarioEsperaOpcion,
  fetchStockControlSanitarioEsperaOpciones,
  type StockDispositivoModulo,
} from "../../api";
import {
  ESPERAS_CONTROL_SANITARIO_PRESET,
  mergeEsperaOpciones,
} from "./stock-control-sanitario-esperas";

const MAX_ESPERA_LEN = 80;

interface Props {
  idPrefix?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  apiOnline: boolean;
  modulo: StockDispositivoModulo;
  historialEsperas?: string[];
  onError: (msg: string) => void;
}

export default function StockControlSanitarioEsperaSelect({
  idPrefix = "cs",
  value,
  onChange,
  disabled = false,
  apiOnline,
  modulo,
  historialEsperas = [],
  onError,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaEspera, setNuevaEspera] = useState("");
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
      const rows = await fetchStockControlSanitarioEsperaOpciones(modulo);
      setCatalogoDb(rows.map((r) => r.valor));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar tiempos de espera");
      setCatalogoDb([]);
    } finally {
      setLoadingCatalogo(false);
    }
  }, [apiOnline, modulo, onError]);

  useEffect(() => {
    if (!abierto) return;
    void loadCatalogo();
  }, [abierto, loadCatalogo]);

  const todasLasEsperas = useMemo(
    () => mergeEsperaOpciones(catalogoDb, historialEsperas, value),
    [catalogoDb, historialEsperas, value]
  );

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todasLasEsperas;
    return todasLasEsperas.filter((e) => e.toLowerCase().includes(t));
  }, [busqueda, todasLasEsperas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaEspera("");
  }, []);

  const elegir = useCallback(
    (espera: string) => {
      onChange(espera);
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaEspera("");
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaEspera(sugerida.trim().slice(0, MAX_ESPERA_LEN));
    setModoNuevo(true);
  };

  const guardarNueva = async () => {
    const nombre = nuevaEspera.trim().slice(0, MAX_ESPERA_LEN);
    if (!nombre) return;

    const yaExiste = todasLasEsperas.some(
      (e) => e.localeCompare(nombre, "es", { sensitivity: "accent" }) === 0
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
      const creada = await createStockControlSanitarioEsperaOpcion(modulo, nombre);
      setCatalogoDb((prev) => {
        if (prev.some((x) => x.toLowerCase() === creada.valor.toLowerCase())) return prev;
        return [...prev, creada.valor].sort((a, b) =>
          a.localeCompare(b, "es", { sensitivity: "base" })
        );
      });
      onChange(creada.valor);
      cerrar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar tiempo de espera");
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
  const totalPreset = ESPERAS_CONTROL_SANITARIO_PRESET.length;
  const triggerId = `${idPrefix}-producto-espera-trigger`;

  return (
    <div className="stock-control-sanitario-espera-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id={triggerId}
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
            title="Quitar tiempo de espera"
            aria-label="Quitar tiempo de espera"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor={`${idPrefix}-espera-busqueda`} className="sr-only">
              Buscar tiempo de espera
            </label>
            <input
              ref={searchRef}
              id={`${idPrefix}-espera-busqueda`}
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar tiempo de espera…"
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
                ? `${listaFiltrada.length} coincidencia(s) de ${todasLasEsperas.length}`
                : `${totalPreset} preset · ${catalogoDb.length} en catálogo · buscá o agregá`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nuevo tiempo de espera"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !guardandoNueva) {
                  e.preventDefault();
                  void guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nuevo tiempo de espera</p>
              </div>
              <div className="field">
                <label htmlFor={`${idPrefix}-espera-nueva`}>Tiempo de espera</label>
                <input
                  ref={nuevaRef}
                  id={`${idPrefix}-espera-nueva`}
                  type="text"
                  className="proveedor-panel-input mayusculas-auto"
                  maxLength={MAX_ESPERA_LEN}
                  placeholder="Ej. 45 DIAS, 2 MESES LECHE…"
                  value={nuevaEspera}
                  disabled={guardandoNueva}
                  onChange={(e) => setNuevaEspera(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!nuevaEspera.trim() || guardandoNueva}
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
                  <span>Nuevo tiempo de espera</span>
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
              ? listaFiltrada.map((e) => (
                  <li key={e}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === e}
                      onClick={() => elegir(e)}
                    >
                      {e}
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
