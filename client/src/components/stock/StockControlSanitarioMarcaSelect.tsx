import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARCAS_REMEDIO_GANADO,
  marcaCoincideBusqueda,
  type MarcaRemedioCatalogo,
  type MarcaRemedioPais,
} from "./stock-control-sanitario-marcas";
import type { StockDispositivoModulo } from "../../api";
import {
  deleteStockControlSanitarioProductoFicha,
  fetchStockControlSanitarioProductoNombresGlobales,
  saveStockControlSanitarioProductoFicha,
} from "../../api";
import type { AuthUser, StockControlSanitarioProductoNombreGlobal } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { IconEliminar } from "../icons/ActionIcons";
import StockControlSanitarioProductoFichaModal from "./StockControlSanitarioProductoFichaModal";

const STORAGE_KEY = "scg-marcas-remedio-extras";
const MAX_MARCA_LEN = 120;
const TOP_MARCAS_DESTACADAS = 10;
const TOP_MARCAS_CUENTA = 8;

interface MarcaExtra {
  nombre: string;
  creada_en: string;
}

type MarcaSeccion = "destacada" | "mas-usada" | "ultima-agregada" | "resto";

interface MarcaOpcion {
  nombre: string;
  paises: readonly MarcaRemedioPais[];
  esPersonalizada: boolean;
  puedeEliminar: boolean;
  seccion: MarcaSeccion;
  usos: number;
  usosCuenta: number;
}

function txt(val: string | null | undefined): string {
  return String(val ?? "").trim();
}

function esFichaStubCatalogo(meta: StockControlSanitarioProductoNombreGlobal): boolean {
  return (
    meta.en_ficha &&
    !meta.tiene_foto &&
    !txt(meta.laboratorio) &&
    !txt(meta.principio_activo)
  );
}

function normalizarMarcaGlobal(
  meta: StockControlSanitarioProductoNombreGlobal
): StockControlSanitarioProductoNombreGlobal {
  return {
    nombre: txt(meta.nombre),
    creado_en: txt(meta.creado_en),
    creado_por: txt(meta.creado_por),
    en_ficha: Boolean(meta.en_ficha),
    laboratorio: txt(meta.laboratorio),
    principio_activo: txt(meta.principio_activo),
    tiene_foto: Boolean(meta.tiene_foto),
    usos: Number(meta.usos ?? 0),
    usos_cuenta: Number(meta.usos_cuenta ?? 0),
  };
}

function autorLabelFromUser(user: AuthUser | null | undefined): string {
  if (!user) return "";
  return user.nombre.trim() || user.email.trim();
}

function puedeEliminarMarcaUsuario(
  meta: StockControlSanitarioProductoNombreGlobal | undefined,
  user: AuthUser | null | undefined
): boolean {
  if (!meta?.en_ficha || !esFichaStubCatalogo(meta)) return false;
  if (!user) return false;
  if (user.es_super_admin) return true;
  const autor = autorLabelFromUser(user);
  const creador = txt(meta.creado_por);
  if (!autor || !creador) return false;
  return creador.toLocaleLowerCase("es") === autor.toLocaleLowerCase("es");
}

function agregadaEnMesActual(creadoEn: string | null | undefined): boolean {
  const raw = txt(creadoEn);
  if (!raw) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function marcaKey(nombre: string): string {
  return nombre.toLocaleLowerCase("es-UY");
}

function ordenarMarcasPorSeccion(
  items: MarcaOpcion[],
  marcasGlobalesPorNombre: Map<string, StockControlSanitarioProductoNombreGlobal>
): MarcaOpcion[] {
  const withUsos = items.map((m) => {
    const meta = marcasGlobalesPorNombre.get(marcaKey(m.nombre));
    return {
      item: m,
      meta,
      usos: meta?.usos ?? 0,
      usosCuenta: meta?.usos_cuenta ?? 0,
    };
  });

  const keysDestacadas = new Set(
    withUsos
      .filter((x) => x.usos > 0)
      .sort((a, b) => b.usos - a.usos || a.item.nombre.localeCompare(b.item.nombre, "es"))
      .slice(0, TOP_MARCAS_DESTACADAS)
      .map((x) => marcaKey(x.item.nombre))
  );

  const keysMasUsadas = new Set(
    withUsos
      .filter((x) => x.usosCuenta > 0 && !keysDestacadas.has(marcaKey(x.item.nombre)))
      .sort(
        (a, b) =>
          b.usosCuenta - a.usosCuenta || a.item.nombre.localeCompare(b.item.nombre, "es")
      )
      .slice(0, TOP_MARCAS_CUENTA)
      .map((x) => marcaKey(x.item.nombre))
  );

  const ultimasCandidatas = withUsos
    .filter(({ item, meta }) => {
      const key = marcaKey(item.nombre);
      if (keysDestacadas.has(key) || keysMasUsadas.has(key)) return false;
      if (!meta?.en_ficha || !esFichaStubCatalogo(meta)) return false;
      return agregadaEnMesActual(meta.creado_en);
    })
    .sort((a, b) => {
      const ta = a.meta?.creado_en ?? "";
      const tb = b.meta?.creado_en ?? "";
      return tb.localeCompare(ta) || a.item.nombre.localeCompare(b.item.nombre, "es");
    });

  const keysUltimas = new Set(ultimasCandidatas.map((x) => marcaKey(x.item.nombre)));

  const destacadas = withUsos
    .filter((x) => keysDestacadas.has(marcaKey(x.item.nombre)))
    .sort((a, b) => b.usos - a.usos || a.item.nombre.localeCompare(b.item.nombre, "es"))
    .map(({ item, usos, usosCuenta }) => ({
      ...item,
      seccion: "destacada" as const,
      usos,
      usosCuenta,
    }));

  const masUsadas = withUsos
    .filter((x) => keysMasUsadas.has(marcaKey(x.item.nombre)))
    .sort(
      (a, b) =>
        b.usosCuenta - a.usosCuenta || a.item.nombre.localeCompare(b.item.nombre, "es")
    )
    .map(({ item, usos, usosCuenta }) => ({
      ...item,
      seccion: "mas-usada" as const,
      usos,
      usosCuenta,
    }));

  const ultimas = ultimasCandidatas.map(({ item, meta, usos, usosCuenta }) => ({
    ...item,
    seccion: "ultima-agregada" as const,
    usos: meta?.usos ?? usos,
    usosCuenta: meta?.usos_cuenta ?? usosCuenta,
  }));

  const resto = withUsos
    .filter((x) => {
      const key = marcaKey(x.item.nombre);
      return (
        !keysDestacadas.has(key) && !keysMasUsadas.has(key) && !keysUltimas.has(key)
      );
    })
    .sort((a, b) => a.item.nombre.localeCompare(b.item.nombre, "es", { sensitivity: "base" }))
    .map(({ item, usos, usosCuenta }) => ({
      ...item,
      seccion: "resto" as const,
      usos,
      usosCuenta,
    }));

  return [...destacadas, ...masUsadas, ...ultimas, ...resto];
}

function etiquetaSeccionMarca(
  seccion: MarcaSeccion,
  prev: MarcaSeccion | null,
  busqueda: string
): string | null {
  if (busqueda.trim()) return null;
  if (seccion === "destacada" && prev !== "destacada") return "Destacadas";
  if (seccion === "mas-usada" && prev !== "mas-usada") return "Más usadas";
  if (seccion === "ultima-agregada" && prev !== "ultima-agregada") return "Últimas agregadas";
  return null;
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
  currentUser?: AuthUser | null;
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
  currentUser = null,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nuevaRef = useRef<HTMLInputElement>(null);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevaMarca, setNuevaMarca] = useState("");
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [fichaNombre, setFichaNombre] = useState("");
  const [marcasGlobales, setMarcasGlobales] = useState<
    StockControlSanitarioProductoNombreGlobal[]
  >([]);

  const reloadMarcas = useCallback(async () => {
    if (!apiOnline) {
      setMarcasGlobales([]);
      return;
    }
    try {
      const list = await fetchStockControlSanitarioProductoNombresGlobales();
      setMarcasGlobales(
        list.map(normalizarMarcaGlobal).filter((m) => m.nombre)
      );
    } catch {
      setMarcasGlobales([]);
    }
  }, [apiOnline]);

  useEffect(() => {
    void reloadMarcas();
  }, [reloadMarcas]);

  useEffect(() => {
    if (!apiOnline) return;
    const legacy = loadMarcaExtras();
    if (legacy.length === 0) return;
    void (async () => {
      for (const extra of legacy) {
        try {
          await saveStockControlSanitarioProductoFicha(modulo, { nombre: extra.nombre });
        } catch {
          /* omitir duplicados o errores puntuales */
        }
      }
      saveMarcaExtras([]);
      await reloadMarcas();
    })();
  }, [apiOnline, modulo, reloadMarcas]);

  const marcasGlobalesPorNombre = useMemo(() => {
    const map = new Map<string, StockControlSanitarioProductoNombreGlobal>();
    for (const meta of marcasGlobales) {
      map.set(meta.nombre.toLocaleLowerCase("es-UY"), meta);
    }
    return map;
  }, [marcasGlobales]);

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
      opts?: { esPersonalizada?: boolean; puedeEliminar?: boolean }
    ) => {
      const t = nombre.trim();
      if (!t) return;
      const key = t.toLocaleLowerCase("es-UY");
      if (seen.has(key)) return;
      seen.add(key);
      const catalogo = catalogoPorNombre.get(key);
      const global = marcasGlobalesPorNombre.get(key);
      list.push({
        nombre: catalogo?.nombre ?? t,
        paises: catalogo?.paises ?? [],
        esPersonalizada: opts?.esPersonalizada ?? !catalogo,
        puedeEliminar:
          opts?.puedeEliminar ?? puedeEliminarMarcaUsuario(global, currentUser),
        seccion: "resto",
        usos: global?.usos ?? 0,
        usosCuenta: global?.usos_cuenta ?? 0,
      });
    };
    for (const m of MARCAS_REMEDIO_GANADO) push(m.nombre);
    for (const meta of marcasGlobales) {
      push(meta.nombre, {
        esPersonalizada: !catalogoPorNombre.has(meta.nombre.toLocaleLowerCase("es-UY")),
        puedeEliminar: puedeEliminarMarcaUsuario(meta, currentUser),
      });
    }
    for (const m of historialMarcas) push(m);
    if (value.trim()) push(value);

    return ordenarMarcasPorSeccion(list, marcasGlobalesPorNombre);
  }, [catalogoPorNombre, currentUser, historialMarcas, marcasGlobales, marcasGlobalesPorNombre, value]);

  const destacadasCount = useMemo(
    () => todasLasMarcas.filter((m) => m.seccion === "destacada").length,
    [todasLasMarcas]
  );

  const masUsadasCount = useMemo(
    () => todasLasMarcas.filter((m) => m.seccion === "mas-usada").length,
    [todasLasMarcas]
  );

  const ultimasAgregadasCount = useMemo(
    () => todasLasMarcas.filter((m) => m.seccion === "ultima-agregada").length,
    [todasLasMarcas]
  );

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim();
    if (!t) return todasLasMarcas;
    const filtradas = todasLasMarcas.filter((m) =>
      m.esPersonalizada
        ? m.nombre.toLowerCase().includes(t.toLowerCase())
        : marcaCoincideBusqueda({ nombre: m.nombre, paises: m.paises }, t)
    );
    return filtradas.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
  }, [busqueda, todasLasMarcas]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaMarca("");
  }, []);

  const elegir = useCallback(
    (marca: string, opts?: { abrirFicha?: boolean }) => {
      onChange(marca);
      if (opts?.abrirFicha) {
        setFichaNombre(marca.trim());
        setFichaAbierta(true);
      }
      cerrar();
    },
    [onChange, cerrar]
  );

  const abrirFichaProducto = useCallback(
    (nombre: string) => {
      const n = nombre.trim();
      if (!n || disabled) return;
      setFichaNombre(n);
      setFichaAbierta(true);
      setAbierto(false);
      setBusqueda("");
      setModoNuevo(false);
      setNuevaMarca("");
    },
    [disabled]
  );

  const abrir = () => {
    if (disabled) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
    setNuevaMarca("");
    void reloadMarcas();
  };

  const abrirNuevo = (sugerida = "") => {
    setNuevaMarca(sugerida.trim().slice(0, MAX_MARCA_LEN));
    setModoNuevo(true);
  };

  const eliminarMarcaExtra = async (nombre: string) => {
    if (!apiOnline) return;

    const meta = marcasGlobalesPorNombre.get(nombre.toLocaleLowerCase("es-UY"));
    if (!puedeEliminarMarcaUsuario(meta, currentUser)) return;

    const ok = await confirmAction({
      title: "Eliminar marca comercial",
      message: `¿Eliminar «${nombre}» del catálogo compartido?\n\nNo borra registros sanitarios ya cargados; solo la quita del listado de sugerencias.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await deleteStockControlSanitarioProductoFicha(nombre);
      await reloadMarcas();
      if (value.toLocaleLowerCase("es-UY") === nombre.toLocaleLowerCase("es-UY")) {
        onChange("");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar la marca");
    }
  };

  const guardarNueva = async () => {
    const nombre = nuevaMarca.trim().slice(0, MAX_MARCA_LEN);
    if (!nombre) return;

    if (!apiOnline) {
      onError("Sin conexión: no se puede compartir la marca con otras cuentas.");
      return;
    }

    setGuardandoMarca(true);
    try {
      await saveStockControlSanitarioProductoFicha(modulo, { nombre });
      await reloadMarcas();
      onChange(nombre);
      cerrar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar la marca");
    } finally {
      setGuardandoMarca(false);
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
  const tieneValor = Boolean(value.trim());

  const abrirFicha = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !tieneValor) return;
    abrirFichaProducto(value);
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
              : marcasGlobales.length > 0
                ? `${marcasGlobales.length} nombre(s) compartido(s)${
                    destacadasCount > 0 ? ` · ${destacadasCount} destacada(s)` : ""
                  }${
                    masUsadasCount > 0 ? ` · ${masUsadasCount} más usada(s) en tu cuenta` : ""
                  }${
                    ultimasAgregadasCount > 0
                      ? ` · ${ultimasAgregadasCount} agregada(s) este mes`
                      : ""
                  }`
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
                  void guardarNueva();
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
                  disabled={!nuevaMarca.trim() || guardandoMarca}
                  onClick={() => void guardarNueva()}
                >
                  {guardandoMarca ? "Guardando…" : "Guardar y usar"}
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
                  const prevSeccion = index > 0 ? listaFiltrada[index - 1]?.seccion ?? null : null;
                  const etiqueta = etiquetaSeccionMarca(m.seccion, prevSeccion, busqueda);
                  return (
                    <li key={m.nombre}>
                      {etiqueta ? (
                        <p
                          className={`stock-control-sanitario-marca-destacadas-label${
                            m.seccion === "ultima-agregada"
                              ? " stock-control-sanitario-marca-seccion-label--ultimas"
                              : m.seccion === "mas-usada"
                                ? " stock-control-sanitario-marca-seccion-label--cuenta"
                                : ""
                          }`}
                        >
                          {etiqueta}
                        </p>
                      ) : null}
                      <div
                        className={`stock-control-sanitario-marca-row${
                          m.seccion !== "resto"
                            ? " stock-control-sanitario-marca-row--destacada"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={value === m.nombre}
                          className="stock-control-sanitario-marca-row-btn"
                          onClick={() =>
                            elegir(m.nombre, {
                              abrirFicha:
                                m.seccion === "destacada" ||
                                m.seccion === "ultima-agregada",
                            })
                          }
                        >
                          <span className="stock-control-sanitario-marca-row-label">{m.nombre}</span>
                          {m.seccion === "destacada" && m.usos > 0 ? (
                            <span className="stock-control-sanitario-marca-usos-badge">
                              {m.usos}
                            </span>
                          ) : null}
                          {m.seccion === "mas-usada" && m.usosCuenta > 0 ? (
                            <span className="stock-control-sanitario-marca-usos-badge stock-control-sanitario-marca-usos-badge--cuenta">
                              {m.usosCuenta}
                            </span>
                          ) : null}
                          {m.seccion === "ultima-agregada" ? (
                            <span className="stock-control-sanitario-marca-destacada-badge">
                              Nuevo
                            </span>
                          ) : null}
                        </button>
                        {m.puedeEliminar ? (
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
        nombre={fichaNombre || value}
        modulo={modulo}
        apiOnline={apiOnline}
        onClose={() => {
          setFichaAbierta(false);
          setFichaNombre("");
        }}
        onError={onError}
        onSaved={(msg) => {
          onFichaSaved?.(msg);
          void reloadMarcas();
        }}
      />
    </div>
  );
}
