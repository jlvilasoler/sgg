import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARCAS_REMEDIO_GANADO,
  marcaCoincideBusqueda,
  type MarcaRemedioCatalogo,
  type MarcaRemedioPais,
} from "./stock-control-sanitario-marcas";
import type { StockDispositivoModulo } from "../../api";
import { fetchStockControlSanitarioProductoFichas } from "../../api";
import { confirmAction } from "../../utils/confirm";
import { IconEliminar } from "../icons/ActionIcons";
import StockControlSanitarioProductoFichaModal from "./StockControlSanitarioProductoFichaModal";

const STORAGE_KEY = "scg-marcas-remedio-extras";
const MAX_MARCA_LEN = 120;
const DESTACADO_MS = 30 * 24 * 60 * 60 * 1000;

interface MarcaExtra {
  nombre: string;
  creada_en: string;
}

interface MarcaOpcion {
  nombre: string;
  paises: readonly MarcaRemedioPais[];
  esPersonalizada: boolean;
  /** Marca agregada manualmente en este navegador (localStorage). */
  esExtraManual: boolean;
  destacada: boolean;
}

function esMarcaDestacada(creadaEn: string): boolean {
  if (!creadaEn) return false;
  const t = Date.parse(creadaEn);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < DESTACADO_MS;
}

function loadMarcaExtras(): MarcaExtra[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    if (parsed.every((x) => typeof x === "string")) {
      return (parsed as string[])
        .map((x) => x.trim())
        .filter(Boolean)
        .map((nombre) => ({ nombre, creada_en: "" }));
    }

    return parsed
      .filter(
        (x): x is MarcaExtra =>
          typeof x === "object" &&
          x != null &&
          typeof (x as MarcaExtra).nombre === "string"
      )
      .map((x) => ({
        nombre: x.nombre.trim(),
        creada_en: typeof x.creada_en === "string" ? x.creada_en : "",
      }))
      .filter((x) => x.nombre);
  } catch {
    return [];
  }
}

function saveMarcaExtras(list: MarcaExtra[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  historialMarcas?: string[];
  apiOnline?: boolean;
  modulo?: StockDispositivoModulo;
  onError?: (msg: string) => void;
  onFichaSaved?: (msg: string) => void;
  /** Solo superadministrador: puede eliminar marcas agregadas manualmente. */
  puedeEliminarMarca?: boolean;
}

export default function StockControlSanitarioMarcaSelect({
  value,
  onChange,
  disabled = false,
  historialMarcas = [],
  apiOnline = true,
  modulo = "ganadero",
  onError = () => {},
  onFichaSaved,
  puedeEliminarMarca = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [extras, setExtras] = useState<MarcaExtra[]>(() => loadMarcaExtras());
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [marcasApi, setMarcasApi] = useState<string[]>([]);

  useEffect(() => {
    if (!apiOnline) {
      setMarcasApi([]);
      return;
    }
    let cancelled = false;
    void fetchStockControlSanitarioProductoFichas()
      .then((list) => {
        if (!cancelled) {
          setMarcasApi(list.map((p) => p.nombre).filter(Boolean));
        }
      })
      .catch(() => {
        if (!cancelled) setMarcasApi([]);
      });
    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  const extrasPorNombre = useMemo(() => {
    const map = new Map<string, MarcaExtra>();
    for (const extra of extras) {
      map.set(extra.nombre.toLocaleLowerCase("es-UY"), extra);
    }
    return map;
  }, [extras]);

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
    const push = (
      nombre: string,
      opts?: { esPersonalizada?: boolean; esExtraManual?: boolean; creadaEn?: string }
    ) => {
      const t = nombre.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      seen.add(key);
      const catalogo = catalogoPorNombre.get(key);
      const extra = extrasPorNombre.get(key);
      const creadaEn = opts?.creadaEn ?? extra?.creada_en ?? "";
      list.push({
        nombre: catalogo?.nombre ?? t,
        paises: catalogo?.paises ?? [],
        esPersonalizada: opts?.esPersonalizada ?? !catalogo,
        esExtraManual: opts?.esExtraManual ?? Boolean(extra),
        destacada: esMarcaDestacada(creadaEn),
      });
    };
    for (const m of MARCAS_REMEDIO_GANADO) push(m.nombre);
    for (const nombre of marcasApi) push(nombre);
    for (const m of extras) {
      push(m.nombre, { esPersonalizada: true, esExtraManual: true, creadaEn: m.creada_en });
    }
    for (const m of historialMarcas) push(m);
    if (value.trim()) push(value);

    return list.sort((a, b) => {
      if (a.destacada !== b.destacada) return a.destacada ? -1 : 1;
      if (a.destacada && b.destacada) {
        const ta =
          extrasPorNombre.get(a.nombre.toLocaleLowerCase("es-UY"))?.creada_en ?? "";
        const tb =
          extrasPorNombre.get(b.nombre.toLocaleLowerCase("es-UY"))?.creada_en ?? "";
        return tb.localeCompare(ta);
      }
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });
  }, [catalogoPorNombre, extras, extrasPorNombre, historialMarcas, marcasApi, value]);

  const destacadasCount = useMemo(
    () => todasLasMarcas.filter((m) => m.destacada).length,
    [todasLasMarcas]
  );

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
    if (apiOnline) {
      void fetchStockControlSanitarioProductoFichas()
        .then((list) => setMarcasApi(list.map((p) => p.nombre).filter(Boolean)))
        .catch(() => {});
    }
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaMarca(sugerida.trim().slice(0, MAX_MARCA_LEN));
    setModoNuevo(true);
  };

  const eliminarMarcaExtra = async (nombre: string) => {
    if (!puedeEliminarMarca) return;

    const ok = await confirmAction({
      title: "Eliminar marca comercial",
      message: `¿Eliminar «${nombre}» de las marcas agregadas manualmente?\n\nNo borra registros sanitarios ya cargados; solo la quita del listado de sugerencias.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    const key = nombre.toLocaleLowerCase("es-UY");
    setExtras((prev) => {
      const next = prev.filter((x) => x.nombre.toLocaleLowerCase("es-UY") !== key);
      saveMarcaExtras(next);
      return next;
    });
    if (value.toLocaleLowerCase("es-UY") === key) {
      onChange("");
    }
  };

  const guardarNueva = () => {
    const nombre = nuevaMarca.trim().slice(0, MAX_MARCA_LEN);
    if (!nombre) return;

    const ahora = new Date().toISOString();
    const key = nombre.toLocaleLowerCase("es-UY");

    setExtras((prev) => {
      const idx = prev.findIndex((x) => x.nombre.toLocaleLowerCase("es-UY") === key);
      const next =
        idx >= 0
          ? prev.map((x, i) => (i === idx ? { ...x, creada_en: ahora } : x))
          : [...prev, { nombre, creada_en: ahora }];
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
  const tieneValor = Boolean(value.trim());

  const abrirFicha = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !tieneValor) return;
    setFichaAbierta(true);
  };

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
          {tieneValor ? (
            <span
              role="link"
              tabIndex={0}
              className="stock-control-sanitario-marca-ficha-link"
              title="Ver ficha del producto"
              onClick={abrirFicha}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") abrirFicha(e);
              }}
            >
              {value}
            </span>
          ) : (
            <span className="stock-control-sanitario-field-trigger-placeholder">
              {textoSeleccion}
            </span>
          )}
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
              : marcasApi.length > 0
                ? `${marcasApi.length} en catálogo central · ${destacadasCount} destacada(s) este mes`
                : destacadasCount > 0
                  ? `${MARCAS_REMEDIO_GANADO.length} marcas · ${destacadasCount} destacada(s) este mes`
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
              ? listaFiltrada.map((m, index) => {
                  const mostrarSeparador =
                    !busqueda.trim() &&
                    m.destacada &&
                    (index === 0 || !listaFiltrada[index - 1]?.destacada);
                  return (
                    <li key={m.nombre}>
                      {mostrarSeparador ? (
                        <p className="stock-control-sanitario-marca-destacadas-label">
                          Destacadas (último mes)
                        </p>
                      ) : null}
                      <div
                        className={`stock-control-sanitario-marca-row${
                          m.destacada ? " stock-control-sanitario-marca-row--destacada" : ""
                        }`}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={value === m.nombre}
                          className="stock-control-sanitario-marca-row-btn"
                          onClick={() => elegir(m.nombre)}
                        >
                          <span className="stock-control-sanitario-marca-row-label">{m.nombre}</span>
                          {m.destacada ? (
                            <span className="stock-control-sanitario-marca-destacada-badge">
                              Nuevo
                            </span>
                          ) : null}
                        </button>
                        {puedeEliminarMarca && m.esExtraManual ? (
                          <button
                            type="button"
                            className="stock-control-sanitario-marca-row-delete"
                            title={`Eliminar «${m.nombre}»`}
                            aria-label={`Eliminar marca ${m.nombre}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void eliminarMarcaExtra(m.nombre);
                            }}
                          >
                            <IconEliminar size={15} />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              : null}
          </ul>
        </div>
      ) : null}

      <StockControlSanitarioProductoFichaModal
        open={fichaAbierta}
        nombre={value}
        modulo={modulo}
        apiOnline={apiOnline}
        onClose={() => setFichaAbierta(false)}
        onError={onError}
        onSaved={onFichaSaved}
      />
    </div>
  );
}
