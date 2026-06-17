import { useEffect, useMemo, useRef, useState } from "react";
import { fetchStockGanaderaDispositivos } from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import { etiquetaCaravana } from "./stock-ganadera-utils";

interface Props {
  id: string;
  apiOnline: boolean;
  disabled?: boolean;
  variant?: "default" | "baja";
  excludeClaves?: Set<string>;
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

export default function BuscadorCaravanaActiva({
  id,
  apiOnline,
  disabled = false,
  variant = "default",
  excludeClaves,
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

  useEffect(() => {
    if (!apiOnline) {
      setActivos([]);
      return;
    }
    let cancel = false;
    setLoading(true);
    fetchStockGanaderaDispositivos({})
      .then((rows) => {
        if (cancel) return;
        setActivos(rows.filter((d) => d.estado === "VIVO"));
      })
      .catch((e) => {
        if (cancel) return;
        onError?.(e instanceof Error ? e.message : "Error al cargar caravanas activas");
        setActivos([]);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [apiOnline, refreshKey, onError]);

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

  const disponibles = useMemo(
    () =>
      activos.filter((d) => !excludeClaves?.has(d.clave)),
    [activos, excludeClaves]
  );

  const lista = useMemo(() => {
    const filtrada = disponibles.filter((d) => coincideBusqueda(d, busqueda));
    return filtrada.slice(0, 80);
  }, [disponibles, busqueda]);

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
    variant === "baja" ? " stock-buscador-caravana--baja" : "";

  return (
    <div
      className={`stock-buscador-caravana${variantClass}`}
      ref={rootRef}
    >
      <div className="stock-buscador-caravana-input-wrap">
        <input
          ref={inputRef}
          id={id}
          type="search"
          className="mayusculas-auto stock-buscador-caravana-input"
          placeholder="Buscar caravana activa por EID o VID…"
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
          aria-label={abierto ? "Cerrar listado" : "Ver caravanas activas"}
          aria-expanded={abierto}
          onClick={() => (abierto ? setAbierto(false) : abrir())}
        >
          {loading ? "…" : "▾"}
        </button>
      </div>

      {abierto && apiOnline && (
        <div className="stock-buscador-caravana-panel" role="listbox">
          <p className="stock-buscador-caravana-meta">
            {loading
              ? "Cargando caravanas activas…"
              : `${disponibles.length} caravana(s) activa(s)${
                  busqueda.trim() ? ` · ${lista.length} coincidencia(s)` : ""
                }`}
          </p>
          <ul className="stock-buscador-caravana-lista">
            {lista.length === 0 ? (
              <li className="stock-buscador-caravana-empty">
                {loading
                  ? "Cargando…"
                  : busqueda.trim()
                    ? "Sin coincidencias en el stock activo."
                    : "No hay caravanas activas disponibles."}
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
                    {d.sexo ? (
                      <span className="stock-buscador-caravana-opcion-sub">
                        {d.sexo}
                        {d.empresa ? ` · ${d.empresa}` : ""}
                      </span>
                    ) : null}
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
