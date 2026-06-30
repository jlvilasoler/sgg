import { useEffect, useMemo, useRef, useState } from "react";
import { fetchStockGanaderaDispositivos, fetchStockGanaderaVentasDispositivos } from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import { normalizarEstadoDispositivo } from "./stock-ganadera-utils";
import {
  categoriasDispositivo,
  coincideCategoriaFiltro,
  etiquetaCaravana,
  filtrarDispositivosActivosStock,
  labelCategoriaFiltro,
} from "./stock-ganadera-utils";

interface CategoriaSelectConfig {
  id: string;
  value: string;
  disabled?: boolean;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface Props {
  id: string;
  apiOnline: boolean;
  disabled?: boolean;
  variant?: "default" | "baja" | "dispositivos" | "cabana";
  excludeClaves?: Set<string>;
  /** Si tiene claves, solo muestra dispositivos con esa categoría de evolución. */
  filtroCategoria?: Set<string>;
  filtroCategoriaLabel?: string;
  /** Select integrado en la barra de búsqueda (opcional). */
  categoriaSelect?: CategoriaSelectConfig;
  refreshKey?: number;
  onError?: (msg: string) => void;
  onSelect: (dispositivo: StockGanaderaDispositivo) => void;
}

function coincideBusqueda(d: StockGanaderaDispositivo, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  const eid = d.eid?.toLowerCase() ?? "";
  const vid = d.vid?.toLowerCase() ?? "";
  if (eid.includes(t) || vid.includes(t)) return true;
  if (digits && (d.clave.includes(digits) || vid.includes(digits))) return true;
  return etiquetaCaravana(d).toLowerCase().includes(t);
}

function textosBuscador(variant: Props["variant"]) {
  if (variant === "cabana") {
    return {
      errorCargar: "Error al cargar dispositivos del stock",
      placeholder: "Buscar dispositivo del stock por EID o VID…",
      toggleAbierto: "Cerrar listado",
      toggleCerrado: "Ver dispositivos del stock",
      metaLoading: "Cargando dispositivos del stock…",
      metaCount: (n: number, filtro?: string, busq?: number) =>
        `${n} dispositivo(s) activo(s) en el stock${filtro ? ` · ${filtro}` : ""}${
          busq != null ? ` · ${busq} coincidencia(s)` : ""
        }`,
      emptyBusqueda: "Sin coincidencias con la búsqueda.",
      emptySinCoincidencias: "Sin coincidencias en el stock activo.",
      emptyCategoria: (label: string) => `No hay dispositivos activos en ${label}.`,
      emptyGeneral: "No hay dispositivos activos en el stock.",
    };
  }
  if (variant === "dispositivos") {
    return {
      errorCargar: "Error al cargar dispositivos activos",
      placeholder: "Buscar dispositivo activo por EID o VID…",
      toggleAbierto: "Cerrar listado",
      toggleCerrado: "Ver dispositivos activos",
      metaLoading: "Cargando dispositivos activos…",
      metaCount: (n: number, filtro?: string, busq?: number) =>
        `${n} dispositivo(s)${filtro ? ` · ${filtro}` : " activo(s)"}${
          busq != null ? ` · ${busq} coincidencia(s)` : ""
        }`,
      emptyBusqueda: "Sin coincidencias con el filtro y la búsqueda.",
      emptySinCoincidencias: "Sin coincidencias en el stock activo.",
      emptyCategoria: (label: string) => `No hay dispositivos activos en ${label}.`,
      emptyGeneral: "No hay dispositivos activos disponibles.",
    };
  }
  return {
    errorCargar: "Error al cargar caravanas activas",
    placeholder: "Buscar caravana activa por EID o VID…",
    toggleAbierto: "Cerrar listado",
    toggleCerrado: "Ver caravanas activas",
    metaLoading: "Cargando caravanas activas…",
    metaCount: (n: number, filtro?: string, busq?: number) =>
      `${n} caravana(s)${filtro ? ` · ${filtro}` : " activa(s)"}${
        busq != null ? ` · ${busq} coincidencia(s)` : ""
      }`,
    emptyBusqueda: "Sin coincidencias con el filtro y la búsqueda.",
    emptySinCoincidencias: "Sin coincidencias en el stock activo.",
    emptyCategoria: (label: string) => `No hay caravanas activas en ${label}.`,
    emptyGeneral: "No hay caravanas activas disponibles.",
  };
}

async function dispositivosParaVariant(
  variant: Props["variant"],
  rows: StockGanaderaDispositivo[]
): Promise<StockGanaderaDispositivo[]> {
  let filtrados: StockGanaderaDispositivo[];
  if (variant === "dispositivos" || variant === "cabana") {
    try {
      const ventas = await fetchStockGanaderaVentasDispositivos();
      filtrados = filtrarDispositivosActivosStock(rows, new Set(ventas.claves));
    } catch {
      filtrados = rows.filter((d) => normalizarEstadoDispositivo(d.estado) === "VIVO");
    }
  } else {
    filtrados = rows.filter((d) => normalizarEstadoDispositivo(d.estado) === "VIVO");
  }

  if (variant === "cabana") {
    return [...filtrados].sort((a, b) => {
      const fa = a.ultima_fecha || "";
      const fb = b.ultima_fecha || "";
      if (fa !== fb) return fb.localeCompare(fa);
      return a.clave.localeCompare(b.clave, "es");
    });
  }
  return filtrados;
}

export default function BuscadorCaravanaActiva({
  id,
  apiOnline,
  disabled = false,
  variant = "default",
  excludeClaves,
  filtroCategoria,
  filtroCategoriaLabel,
  categoriaSelect,
  refreshKey = 0,
  onError,
  onSelect,
}: Props) {
  const [activos, setActivos] = useState<StockGanaderaDispositivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const txt = textosBuscador(variant);
  const esCabana = variant === "cabana";

  useEffect(() => {
    if (!apiOnline) {
      setActivos([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    fetchStockGanaderaDispositivos({})
      .then(async (rows) => {
        if (cancel) return;
        const filtrados = await dispositivosParaVariant(variant, rows);
        if (cancel) return;
        setActivos(filtrados);
      })
      .catch((e) => {
        if (cancel) return;
        onError?.(e instanceof Error ? e.message : txt.errorCargar);
        setActivos([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [apiOnline, refreshKey, onError, txt.errorCargar, variant]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [abierto]);

  const disponibles = useMemo(() => {
    let rows = activos.filter((d) => !excludeClaves?.has(d.clave));
    if (filtroCategoria?.size) {
      rows = rows.filter((d) => coincideCategoriaFiltro(d, filtroCategoria));
    }
    return rows;
  }, [activos, excludeClaves, filtroCategoria]);

  const lista = useMemo(() => {
    const filtrada = disponibles.filter((d) => coincideBusqueda(d, busqueda));
    const max = variant === "cabana" ? 150 : 80;
    return filtrada.slice(0, max);
  }, [disponibles, busqueda, variant]);

  const filtroActivo = Boolean(filtroCategoria?.size);

  const elegir = (d: StockGanaderaDispositivo) => {
    onSelect(d);
    setBusqueda("");
    setAbierto(false);
  };

  const abrir = () => {
    if (disabled || !apiOnline) return;
    setAbierto(true);
  };

  const variantClass =
    variant === "baja"
      ? " stock-buscador-caravana--baja"
      : variant === "cabana"
        ? " stock-buscador-caravana--cabana"
        : "";
  const conCategoria = Boolean(categoriaSelect);

  return (
    <div
      className={`stock-buscador-caravana${variantClass}${conCategoria ? " stock-buscador-caravana--con-cat" : ""}`}
      ref={rootRef}
    >
      <div className="stock-buscador-caravana-input-wrap">
        {categoriaSelect ? (
          <select
            id={categoriaSelect.id}
            className="stock-buscador-caravana-cat"
            value={categoriaSelect.value}
            disabled={disabled || !apiOnline || categoriaSelect.disabled}
            aria-label="Filtrar por categoría"
            onChange={(e) => categoriaSelect.onChange(e.target.value)}
          >
            {categoriaSelect.options.map((o) => (
              <option key={o.value || "__todas__"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        <input
          ref={inputRef}
          id={id}
          type="search"
          className="mayusculas-auto stock-buscador-caravana-input"
          placeholder={txt.placeholder}
          value={busqueda}
          disabled={disabled || !apiOnline}
          autoComplete="off"
          onFocus={abrir}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setAbierto(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setAbierto(false);
              setBusqueda("");
            }
            if (e.key === "Enter" && lista.length === 1) {
              e.preventDefault();
              elegir(lista[0]!);
            }
          }}
        />
        <button
          type="button"
          className="stock-buscador-caravana-toggle"
          disabled={disabled || !apiOnline}
          aria-label={abierto ? txt.toggleAbierto : txt.toggleCerrado}
          aria-expanded={abierto}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
        >
          {loading ? "…" : "▾"}
        </button>
      </div>

      {abierto && apiOnline && (
        <div
          className={`stock-buscador-caravana-panel${esCabana ? " stock-buscador-caravana-panel--fijo" : ""}`}
          role="listbox"
        >
          <p className="stock-buscador-caravana-meta">
            {loading
              ? txt.metaLoading
              : txt.metaCount(
                  disponibles.length,
                  filtroActivo && filtroCategoriaLabel ? filtroCategoriaLabel : undefined,
                  busqueda.trim() ? lista.length : undefined
                )}
          </p>
          <ul className="stock-buscador-caravana-lista">
            {lista.length === 0 ? (
              <li className="stock-buscador-caravana-empty">
                {loading
                  ? "Cargando…"
                  : busqueda.trim()
                    ? filtroActivo
                      ? txt.emptyBusqueda
                      : txt.emptySinCoincidencias
                    : filtroActivo
                      ? txt.emptyCategoria(filtroCategoriaLabel ?? "esta categoría")
                      : txt.emptyGeneral}
              </li>
            ) : (
              lista.map((d) => (
                <li key={d.clave}>
                  <button
                    type="button"
                    role="option"
                    className="stock-buscador-caravana-opcion"
                    onClick={() => elegir(d)}
                  >
                    <span className="stock-buscador-caravana-opcion-main num">
                      {etiquetaCaravana(d)}
                    </span>
                    {(() => {
                      const cats = [...categoriasDispositivo(d)];
                      const catTxt =
                        cats.length > 0
                          ? cats.map((k) => labelCategoriaFiltro(k)).join(" · ")
                          : "";
                      const pedigree =
                        d.cabana_premium && d.nombre_cabana
                          ? `Selección · ${d.nombre_cabana}`
                          : "";
                      const extra = [pedigree, catTxt, d.sexo, d.empresa].filter(Boolean);
                      if (!extra.length) return null;
                      return (
                        <span
                          className={`stock-buscador-caravana-opcion-sub${pedigree ? " stock-buscador-caravana-opcion-sub--pedigree" : ""}`}
                        >
                          {extra.join(" · ")}
                        </span>
                      );
                    })()}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
