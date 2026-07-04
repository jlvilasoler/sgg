import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  crearCultivoVentaAgricultura,
  fetchCultivosVentaAgricultura,
  normalizeCultivoNombre,
} from "./ventas-agricultura-cultivos";

const MAX_CULTIVO_LEN = 80;

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  apiOnline?: boolean;
  puedeAgregar?: boolean;
  onError?: (msg: string) => void;
  onCatalogoChanged?: () => void;
}

export default function VentasAgriculturaCultivoSelect({
  id = "va-cultivo",
  value,
  onChange,
  disabled = false,
  apiOnline = true,
  puedeAgregar = false,
  onError = () => {},
  onCatalogoChanged,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoCultivo, setNuevoCultivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [opciones, setOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  const reload = useCallback(async () => {
    if (!apiOnline) {
      setOpciones([]);
      return;
    }
    setCargando(true);
    try {
      setOpciones(await fetchCultivosVentaAgricultura());
    } catch {
      setOpciones([]);
    } finally {
      setCargando(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const todasLasOpciones = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    const push = (raw: string) => {
      const n = normalizeCultivoNombre(raw);
      if (!n) return;
      const key = n.toLocaleLowerCase("es");
      if (seen.has(key)) return;
      seen.add(key);
      list.push(n);
    };
    for (const o of opciones) push(o);
    if (value.trim()) push(value);
    return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [opciones, value]);

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return todasLasOpciones;
    return todasLasOpciones.filter((n) => n.toLowerCase().includes(t));
  }, [busqueda, todasLasOpciones]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevoCultivo("");
  }, []);

  const elegir = useCallback(
    (nombre: string) => {
      onChange(normalizeCultivoNombre(nombre));
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevoCultivo("");
    void reload();
  };

  const abrirNuevo = (sugerida = "") => {
    if (!puedeAgregar) return;
    setNuevoCultivo(sugerida.trim().slice(0, MAX_CULTIVO_LEN));
    setModoNuevo(true);
  };

  const guardarNueva = async () => {
    const nombre = nuevoCultivo.trim().slice(0, MAX_CULTIVO_LEN);
    if (!nombre) return;
    if (!apiOnline) {
      onError("Sin conexión: no se puede guardar el cultivo en el catálogo.");
      return;
    }
    setGuardando(true);
    try {
      const canon = await crearCultivoVentaAgricultura(nombre);
      await reload();
      onCatalogoChanged?.();
      onChange(canon);
      cerrar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar el cultivo");
    } finally {
      setGuardando(false);
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

  const textoSeleccion = normalizeCultivoNombre(value) || "— Seleccionar —";
  const tieneValor = Boolean(normalizeCultivoNombre(value));

  return (
    <div className="ventas-agricultura-cultivo-select stock-control-sanitario-marca-select" ref={rootRef}>
      <div className="stock-control-sanitario-select-shell">
        <button
          type="button"
          id={`${id}-trigger`}
          className="stock-control-sanitario-field-trigger"
          aria-expanded={abierto}
          aria-haspopup="listbox"
          onClick={() => (abierto ? cerrar() : abrir())}
          disabled={disabled}
        >
          {tieneValor ? (
            <span className="stock-control-sanitario-field-trigger-value">{textoSeleccion}</span>
          ) : (
            <span className="stock-control-sanitario-field-trigger-placeholder">
              {textoSeleccion}
            </span>
          )}
        </button>
        {tieneValor && !disabled ? (
          <button
            type="button"
            className="stock-control-sanitario-field-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            title="Quitar cultivo"
            aria-label="Quitar cultivo"
          >
            ×
          </button>
        ) : null}
      </div>

      {abierto && !disabled ? (
        <div className="proveedor-panel stock-control-sanitario-formula-panel">
          <div className="proveedor-panel-search">
            <label htmlFor={`${id}-busqueda`} className="sr-only">
              Buscar cultivo
            </label>
            <input
              ref={searchRef}
              id={`${id}-busqueda`}
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar cultivo…"
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
            {cargando
              ? "Cargando catálogo…"
              : busqueda.trim()
                ? `${listaFiltrada.length} coincidencia(s) de ${todasLasOpciones.length}`
                : `${todasLasOpciones.length} cultivo(s) — del rubro Venta agricultura`}
          </p>

          {modoNuevo && puedeAgregar ? (
            <div
              className="proveedor-panel-nuevo stock-control-sanitario-formula-nuevo"
              role="group"
              aria-label="Nuevo cultivo"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void guardarNueva();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nuevo cultivo</p>
                <p className="muted proveedor-panel-nuevo-hint">
                  Se guarda en Rubros de ingresos por ventas (Venta agricultura).
                </p>
              </div>
              <div className="field">
                <label htmlFor={`${id}-nuevo`}>Nombre</label>
                <input
                  ref={nuevaRef}
                  id={`${id}-nuevo`}
                  type="text"
                  className="proveedor-panel-input"
                  maxLength={MAX_CULTIVO_LEN}
                  placeholder="Ej. Soja, Trigo, Sorgo…"
                  value={nuevoCultivo}
                  onChange={(e) => setNuevoCultivo(e.target.value)}
                />
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm sg-hub-cta"
                  disabled={!nuevoCultivo.trim() || guardando}
                  onClick={() => void guardarNueva()}
                >
                  {guardando ? "Guardando…" : "Guardar y usar"}
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
            {puedeAgregar && !modoNuevo ? (
              <li>
                <button
                  type="button"
                  className="proveedor-dropdown-item-nuevo"
                  onClick={() => abrirNuevo()}
                >
                  <strong>+</strong>
                  <span>Nuevo cultivo</span>
                </button>
              </li>
            ) : null}

            {!modoNuevo && listaFiltrada.length === 0 && busqueda.trim() && puedeAgregar ? (
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
              ? listaFiltrada.map((nombre) => (
                  <li key={nombre}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={normalizeCultivoNombre(value) === nombre}
                      className="stock-control-sanitario-marca-row-btn"
                      onClick={() => elegir(nombre)}
                    >
                      <span className="stock-control-sanitario-marca-row-label">{nombre}</span>
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
