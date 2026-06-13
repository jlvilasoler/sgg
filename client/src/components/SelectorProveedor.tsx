import { useEffect, useMemo, useRef, useState } from "react";
import { fetchProveedores } from "../api";
import type { Proveedor } from "../types";
import CheckProveedorIcon from "./icons/CheckProveedorIcon";

interface Props {
  apiOnline: boolean;
  codigo: string;
  razonSocial: string;
  onSelect: (cod: string, razon: string) => void;
  onError: (msg: string) => void;
}

export default function SelectorProveedor({
  apiOnline,
  codigo,
  razonSocial,
  onSelect,
  onError,
}: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!apiOnline) return;
    fetchProveedores()
      .then(setProveedores)
      .catch((e) => onError(e instanceof Error ? e.message : "Error al cargar proveedores"));
  }, [apiOnline, onError]);

  useEffect(() => {
    if (!abierto) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [abierto]);

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return proveedores;
    return proveedores.filter(
      (p) =>
        String(p.cod).includes(t) ||
        p.razon_social.toLowerCase().includes(t) ||
        p.rut.toLowerCase().includes(t) ||
        p.ciudad.toLowerCase().includes(t)
    );
  }, [proveedores, busqueda]);

  const elegir = (p: Proveedor) => {
    onSelect(String(p.cod), p.razon_social);
    setBusqueda("");
    setAbierto(false);
  };

  const abrir = () => {
    if (!apiOnline) return;
    setAbierto(true);
    setBusqueda("");
  };

  const textoSeleccion =
    codigo && razonSocial ? `${codigo} — ${razonSocial}` : "Seleccionar proveedor del catálogo…";

  return (
    <div className="proveedor-selector field span-2" ref={rootRef}>
      <label>Proveedor (catálogo)</label>
      <div className="selector-row">
        <button
          type="button"
          className="proveedor-trigger"
          onClick={() => (abierto ? setAbierto(false) : abrir())}
          disabled={!apiOnline}
        >
          <span className={codigo ? "" : "proveedor-trigger-placeholder"}>{textoSeleccion}</span>
        </button>
        {codigo && razonSocial && (
          <span
            className="proveedor-check-icon"
            title="Proveedor seleccionado"
            aria-label="Proveedor seleccionado"
          >
            <CheckProveedorIcon size={30} />
          </span>
        )}
        {codigo && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onSelect("", "")}
            title="Quitar proveedor"
          >
            ×
          </button>
        )}
      </div>

      {abierto && apiOnline && (
        <div className="proveedor-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="busq-proveedor-menu" className="sr-only">
              Buscar proveedor
            </label>
            <input
              ref={searchRef}
              id="busq-proveedor-menu"
              type="search"
              className="proveedor-search-input"
              placeholder="Buscar por código, razón social, RUT o ciudad…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAbierto(false);
                  setBusqueda("");
                }
              }}
            />
          </div>
          <p className="proveedor-panel-meta">
            {busqueda.trim()
              ? `${lista.length} coincidencia(s) de ${proveedores.length}`
              : `${proveedores.length} proveedor(es) — desplazate o usá el buscador`}
          </p>
          <ul className="proveedor-dropdown" role="listbox">
            {lista.length === 0 ? (
              <li className="empty-item">Sin resultados para «{busqueda.trim()}»</li>
            ) : (
              lista.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => elegir(p)}>
                    <strong>{p.cod}</strong> — {p.razon_social}
                    {p.ciudad ? <span className="muted-inline"> ({p.ciudad})</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {!apiOnline && (
        <p className="hint-muted">Conectá la API para usar el catálogo de proveedores.</p>
      )}
    </div>
  );
}
