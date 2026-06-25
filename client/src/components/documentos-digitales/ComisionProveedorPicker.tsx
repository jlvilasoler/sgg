import { useEffect, useMemo, useRef, useState } from "react";
import { createProveedor, fetchSiguienteCodProveedor } from "../../api";
import type { Proveedor, ProveedorForm } from "../../types";
import { aMayusculas } from "../../utils/formText";
import {
  COMISION_PROVEEDOR_HEREDAR_VALOR,
  decodeProveedorComision,
  encodeProveedorComision,
  esProveedorComisionHeredar,
} from "../../utils/gasto-campos";

interface Props {
  apiOnline: boolean;
  proveedores: Proveedor[];
  value: string;
  onChange: (value: string) => void;
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

function ordenarPorCodigo(a: Proveedor, b: Proveedor): number {
  return a.cod - b.cod;
}

export default function ComisionProveedorPicker({
  apiOnline,
  proveedores,
  value,
  onChange,
  onError,
  onSuccess,
  onProveedorCreado,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const razonNuevoRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<ProveedorForm>(emptyNuevoForm());
  const [siguienteCod, setSiguienteCod] = useState<number | null>(null);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  const proveedoresOrdenados = useMemo(
    () => [...proveedores].sort(ordenarPorCodigo),
    [proveedores]
  );

  const listaFiltrada = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return proveedoresOrdenados;
    return proveedoresOrdenados.filter(
      (p) =>
        String(p.cod).includes(t) ||
        p.razon_social.toLowerCase().includes(t) ||
        p.rut.toLowerCase().includes(t) ||
        p.ciudad.toLowerCase().includes(t)
    );
  }, [proveedoresOrdenados, busqueda]);

  const textoSeleccion = useMemo(() => {
    if (!value) return "No completar";
    if (esProveedorComisionHeredar(value)) return "Heredar de la transferencia";
    const app = decodeProveedorComision(value);
    if (app) return `${app.cod} — ${app.razon}`;
    return "Seleccionar proveedor…";
  }, [value]);

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

  const elegirProveedor = (p: Proveedor) => {
    onChange(encodeProveedorComision(p.cod, p.razon_social));
    setAbierto(false);
    setBusqueda("");
    setModoNuevo(false);
  };

  const elegirValor = (next: string) => {
    onChange(next);
    setAbierto(false);
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
    const val = typeof v === "string" ? (aMayusculas(v) as ProveedorForm[K]) : v;
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
      onProveedorCreado?.();
      onSuccess?.(`Proveedor #${creado.cod} agregado al catálogo`, "Proveedor creado");
      elegirProveedor(creado);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al crear proveedor");
    } finally {
      setGuardandoNuevo(false);
    }
  };

  const codNuevoLabel = modoNuevo ? nuevoForm.cod : siguienteCod;

  return (
    <div className="comision-proveedor-picker" ref={rootRef}>
      <button
        type="button"
        id="com-mapeo-proveedor"
        className="proveedor-trigger doc-tipo-mapeo-select comision-proveedor-trigger"
        onClick={() => apiOnline && setAbierto((v) => !v)}
        disabled={!apiOnline}
        aria-expanded={abierto}
        aria-haspopup="listbox"
      >
        <span className={value ? "" : "proveedor-trigger-placeholder"}>{textoSeleccion}</span>
      </button>

      {abierto && apiOnline ? (
        <div className="proveedor-panel comision-proveedor-panel">
          <div className="proveedor-panel-search">
            <label htmlFor="busq-comision-proveedor" className="sr-only">
              Buscar proveedor
            </label>
            <input
              ref={searchRef}
              id="busq-comision-proveedor"
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
              ? `${listaFiltrada.length} coincidencia(s) de ${proveedoresOrdenados.length}`
              : `${proveedoresOrdenados.length} proveedor(es) — ordenados por código`}
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
                  <label htmlFor="comision-proveedor-nuevo-cod">Código</label>
                  <input
                    id="comision-proveedor-nuevo-cod"
                    className="proveedor-panel-input proveedor-panel-input-cod"
                    readOnly
                    tabIndex={-1}
                    value={nuevoForm.cod}
                    aria-readonly="true"
                    title="Código asignado automáticamente"
                  />
                </div>
                <div className="field">
                  <label htmlFor="comision-proveedor-nuevo-razon">Razón social *</label>
                  <input
                    ref={razonNuevoRef}
                    id="comision-proveedor-nuevo-razon"
                    className="proveedor-panel-input"
                    placeholder="Razón social"
                    value={nuevoForm.razon_social}
                    onChange={(e) => setCampoNuevo("razon_social", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="comision-proveedor-nuevo-rut">RUT</label>
                  <input
                    id="comision-proveedor-nuevo-rut"
                    className="proveedor-panel-input"
                    placeholder="RUT"
                    value={nuevoForm.rut}
                    onChange={(e) => setCampoNuevo("rut", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="comision-proveedor-nuevo-ciudad">Ciudad</label>
                  <input
                    id="comision-proveedor-nuevo-ciudad"
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

          <ul className="proveedor-dropdown comision-proveedor-opciones" role="listbox">
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

            {!busqueda.trim() && !modoNuevo ? (
              <>
                <li>
                  <button type="button" onClick={() => elegirValor("")}>
                    No completar
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => elegirValor(COMISION_PROVEEDOR_HEREDAR_VALOR)}>
                    Heredar de la transferencia
                  </button>
                </li>
              </>
            ) : null}

            {listaFiltrada.length === 0 && busqueda.trim() && !modoNuevo ? (
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

            {listaFiltrada.length === 0 && !busqueda.trim() && !modoNuevo ? (
              <li className="empty-item">Sin proveedores en el catálogo</li>
            ) : (
              listaFiltrada.map((p) => {
                const val = encodeProveedorComision(p.cod, p.razon_social);
                const activo = value === val;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={activo ? "comision-proveedor-opcion--activa" : undefined}
                      onClick={() => elegirProveedor(p)}
                    >
                      <strong>{p.cod}</strong> — {p.razon_social}
                      {p.ciudad ? <span className="muted-inline"> ({p.ciudad})</span> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
