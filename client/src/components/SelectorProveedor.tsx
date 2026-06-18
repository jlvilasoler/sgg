import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProveedor,
  fetchProveedores,
  fetchSiguienteCodProveedor,
} from "../api";
import type { Proveedor, ProveedorForm } from "../types";
import { aMayusculas } from "../utils/formText";
import CheckProveedorIcon from "./icons/CheckProveedorIcon";

interface Props {
  apiOnline: boolean;
  codigo: string;
  razonSocial: string;
  onSelect: (cod: string, razon: string) => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
  onProveedorCreado?: () => void;
}

const emptyNuevoForm = (cod = 0): ProveedorForm => ({
  cod,
  razon_social: "",
  rut: "",
  direccion: "",
  ciudad: "",
});

export default function SelectorProveedor({
  apiOnline,
  codigo,
  razonSocial,
  onSelect,
  onError,
  onSuccess,
  onProveedorCreado,
}: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<ProveedorForm>(emptyNuevoForm());
  const [siguienteCod, setSiguienteCod] = useState<number | null>(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const razonNuevoRef = useRef<HTMLInputElement>(null);

  const cargarProveedores = useCallback(async () => {
    if (!apiOnline) {
      setProveedores([]);
      return;
    }
    try {
      setProveedores(await fetchProveedores());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar proveedores");
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargarProveedores();
  }, [cargarProveedores]);

  useEffect(() => {
    if (!abierto || !apiOnline) {
      setSiguienteCod(null);
      return;
    }
    void fetchSiguienteCodProveedor()
      .then(setSiguienteCod)
      .catch(() => setSiguienteCod(null));
  }, [abierto, apiOnline, proveedores.length]);

  useEffect(() => {
    if (!abierto || modoNuevo) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [abierto, modoNuevo]);

  useEffect(() => {
    if (!modoNuevo) return;
    const t = window.setTimeout(() => razonNuevoRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [modoNuevo]);

  useEffect(() => {
    if (!abierto) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
        setModoNuevo(false);
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
    setModoNuevo(false);
  };

  const abrir = () => {
    if (!apiOnline) return;
    setAbierto(true);
    setBusqueda("");
    setModoNuevo(false);
  };

  const abrirNuevo = async (razonSugerida = "") => {
    if (!apiOnline) return;
    try {
      const cod = siguienteCod ?? (await fetchSiguienteCodProveedor());
      setNuevoForm({
        ...emptyNuevoForm(cod),
        razon_social: aMayusculas(razonSugerida || busqueda.trim()),
      });
      setModoNuevo(true);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo obtener el siguiente código");
    }
  };

  const setCampoNuevo = <K extends keyof ProveedorForm>(k: K, v: ProveedorForm[K]) => {
    const val =
      typeof v === "string" ? (aMayusculas(v) as ProveedorForm[K]) : v;
    setNuevoForm((f) => ({ ...f, [k]: val }));
  };

  const guardarNuevo = async () => {
    if (!nuevoForm.razon_social.trim()) {
      onError("La razón social es obligatoria");
      return;
    }
    setGuardandoNuevo(true);
    try {
      const creado = await createProveedor(nuevoForm);
      await cargarProveedores();
      onProveedorCreado?.();
      onSuccess?.(`Proveedor #${creado.cod} agregado al catálogo`, "Proveedor creado");
      elegir(creado);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al crear proveedor");
    } finally {
      setGuardandoNuevo(false);
    }
  };

  const textoSeleccion =
    codigo && razonSocial ? `${codigo} — ${razonSocial}` : "Seleccionar proveedor del catálogo…";

  const codNuevoLabel = modoNuevo ? nuevoForm.cod : siguienteCod;

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
                  if (modoNuevo) {
                    setModoNuevo(false);
                  } else {
                    setAbierto(false);
                    setBusqueda("");
                  }
                }
              }}
            />
          </div>
          <p className="proveedor-panel-meta">
            {busqueda.trim()
              ? `${lista.length} coincidencia(s) de ${proveedores.length}`
              : `${proveedores.length} proveedor(es) — desplazate o usá el buscador`}
          </p>

          {modoNuevo ? (
            <div
              className="proveedor-panel-nuevo"
              role="group"
              aria-label="Nuevo proveedor"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !guardandoNuevo) {
                  e.preventDefault();
                  void guardarNuevo();
                }
              }}
            >
              <div className="proveedor-panel-nuevo-head">
                <p className="proveedor-panel-nuevo-title">Nuevo proveedor</p>
              </div>
              <div className="proveedor-panel-nuevo-grid">
                <div className="field proveedor-panel-nuevo-cod-field">
                  <label htmlFor="proveedor-nuevo-cod">Código</label>
                  <input
                    id="proveedor-nuevo-cod"
                    className="proveedor-panel-input proveedor-panel-input-cod"
                    readOnly
                    tabIndex={-1}
                    value={nuevoForm.cod}
                    aria-readonly="true"
                    title="Código asignado automáticamente"
                  />
                </div>
                <div className="field">
                  <label htmlFor="proveedor-nuevo-razon">Razón social *</label>
                  <input
                    ref={razonNuevoRef}
                    id="proveedor-nuevo-razon"
                    className="proveedor-panel-input"
                    placeholder="Razón social"
                    value={nuevoForm.razon_social}
                    onChange={(e) => setCampoNuevo("razon_social", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="proveedor-nuevo-rut">RUT</label>
                  <input
                    id="proveedor-nuevo-rut"
                    className="proveedor-panel-input"
                    placeholder="RUT"
                    value={nuevoForm.rut}
                    onChange={(e) => setCampoNuevo("rut", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="proveedor-nuevo-ciudad">Ciudad</label>
                  <input
                    id="proveedor-nuevo-ciudad"
                    className="proveedor-panel-input"
                    placeholder="Ciudad (opcional)"
                    value={nuevoForm.ciudad}
                    onChange={(e) => setCampoNuevo("ciudad", e.target.value)}
                  />
                </div>
              </div>
              <div className="proveedor-panel-nuevo-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={guardandoNuevo}
                  onClick={() => void guardarNuevo()}
                >
                  {guardandoNuevo ? "Guardando…" : "Guardar y usar"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={guardandoNuevo}
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
                  onClick={() => void abrirNuevo()}
                >
                  <strong>+</strong>
                  <span>
                    Nuevo proveedor
                    {codNuevoLabel ? (
                      <span className="proveedor-dropdown-item-nuevo-cod"> · cód. {codNuevoLabel}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ) : null}

            {lista.length === 0 && busqueda.trim() && !modoNuevo ? (
              <li>
                <button
                  type="button"
                  className="proveedor-dropdown-item-nuevo proveedor-dropdown-item-nuevo--sugerido"
                  onClick={() => void abrirNuevo(busqueda.trim())}
                >
                  <strong>+</strong>
                  <span>
                    Crear «{busqueda.trim()}»
                    {codNuevoLabel ? (
                      <span className="proveedor-dropdown-item-nuevo-cod"> · cód. {codNuevoLabel}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ) : null}

            {lista.length === 0 && !busqueda.trim() && !modoNuevo ? (
              <li className="empty-item">Sin proveedores en el catálogo</li>
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
