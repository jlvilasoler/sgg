import { useCallback, useEffect, useState } from "react";
import {
  createProveedor,
  fetchProveedores,
  fetchSiguienteCodProveedor,
  updateProveedor,
} from "../../api";
import type { Proveedor, ProveedorForm } from "../../types";
import { aMayusculas } from "../../utils/formText";
import { HubMenuIcon } from "../icons/HubMenuIcons";

interface Props {
  apiOnline: boolean;
  editProveedor: Proveedor | null;
  onSaved: () => void;
  onCancelEdit: () => void;
  onEditarExistente?: (p: Proveedor) => void;
  onVerListado: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const emptyForm = (): ProveedorForm => ({
  cod: 0,
  razon_social: "",
  rut: "",
  direccion: "",
  ciudad: "",
});

export default function ProveedorIngresar({
  apiOnline,
  editProveedor,
  onSaved,
  onCancelEdit,
  onEditarExistente,
  onVerListado,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<ProveedorForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [recientes, setRecientes] = useState<Proveedor[]>([]);
  const [cargandoRecientes, setCargandoRecientes] = useState(true);
  const editId = editProveedor?.id ?? null;

  const cargarRecientes = useCallback(async () => {
    if (!apiOnline) {
      setRecientes([]);
      setCargandoRecientes(false);
      return;
    }
    setCargandoRecientes(true);
    try {
      const rows = await fetchProveedores("");
      setRecientes(rows.slice(0, 12));
    } catch {
      setRecientes([]);
    } finally {
      setCargandoRecientes(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void cargarRecientes();
  }, [cargarRecientes]);

  useEffect(() => {
    if (editProveedor) {
      setForm({
        cod: editProveedor.cod,
        razon_social: aMayusculas(editProveedor.razon_social),
        rut: aMayusculas(editProveedor.rut),
        direccion: aMayusculas(editProveedor.direccion),
        ciudad: aMayusculas(editProveedor.ciudad),
      });
      return;
    }
    (async () => {
      try {
        const cod = await fetchSiguienteCodProveedor();
        setForm({ ...emptyForm(), cod });
      } catch {
        setForm(emptyForm());
      }
    })();
  }, [editProveedor]);

  const setCampo = <K extends keyof ProveedorForm>(k: K, v: ProveedorForm[K]) => {
    const val =
      typeof v === "string" ? (aMayusculas(v) as ProveedorForm[K]) : v;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const nuevo = () => {
    onCancelEdit();
    void (async () => {
      try {
        const cod = await fetchSiguienteCodProveedor();
        setForm({ ...emptyForm(), cod });
      } catch {
        setForm(emptyForm());
      }
    })();
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    setGuardando(true);
    try {
      if (editId) {
        await updateProveedor(editId, form);
        onSuccess("Proveedor actualizado");
      } else {
        const cod = await fetchSiguienteCodProveedor();
        await createProveedor({ ...form, cod });
        onSuccess("Proveedor agregado");
        setForm({ ...emptyForm(), cod: await fetchSiguienteCodProveedor() });
      }
      await cargarRecientes();
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="subseccion-panel responsable-module responsable-ingresar-page proveedores-module">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ? Volver a Proveedores
      </button>

      <div className="card responsable-module-shell">
        <header className="responsable-module-page-head">
          <div className="responsable-module-page-head-main">
            <div className="responsable-module-page-icon" aria-hidden>
              <HubMenuIcon id="prov_ingresar" className="menu-app-icon-svg" />
            </div>
            <div>
              <span className="responsable-module-kicker">Proveedores</span>
              <h2 className="responsable-module-page-title">
                {editId ? `Editar proveedor #${form.cod}` : "Ingresar proveedor"}
              </h2>
              <p className="responsable-module-page-sub">
                Cada cuenta administra su propia base. Los cádigos se asignan autom?ticamente de
                forma correlativa.
              </p>
            </div>
          </div>
          {editId ? (
            <span className="responsable-module-mode-badge">Modo edición</span>
          ) : null}
        </header>

        <section className="responsable-activos-panel" aria-label="Proveedores recientes">
          <div className="responsable-activos-panel-head">
            <div>
              <h3>En su catálogo</h3>
              <p>Acceso rápido a proveedores ya registrados en la cuenta.</p>
            </div>
            <span className="responsable-module-stat-pill" aria-live="polite">
              {cargandoRecientes
                ? "?"
                : `${recientes.length} mostrado${recientes.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {cargandoRecientes ? (
            <div className="responsable-activos-empty">
              <span className="responsable-activos-empty-icon" aria-hidden>
                ?
              </span>
              <p>Cargando proveedores?</p>
            </div>
          ) : !apiOnline ? (
            <div className="responsable-activos-empty">
              <p>Sin conexi?n con la API</p>
            </div>
          ) : recientes.length === 0 ? (
            <div className="responsable-activos-empty">
              <span className="responsable-activos-empty-icon" aria-hidden>
                <HubMenuIcon id="config_proveedores" className="menu-app-icon-svg" />
              </span>
              <p>Todav?a no hay proveedores en esta cuenta.</p>
              <span className="muted">Complet? el formulario de abajo para el primero.</span>
            </div>
          ) : (
            <>
              <ul className="responsable-ingresar-chips">
                {recientes.map((p) => {
                  const seleccionado = editId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`responsable-ingresar-chip${seleccionado ? " is-selected" : ""}`}
                        title={`Código ${p.cod} ? ${p.razon_social}`}
                        onClick={() => onEditarExistente?.(p)}
                      >
                        <span className="responsable-ingresar-chip-name">
                          #{p.cod} {p.razon_social}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="responsable-activos-hint">Clic en un proveedor para editarlo.</p>
            </>
          )}
        </section>

        <form className="responsable-ingresar-form proveedor-ingresar-form" onSubmit={guardar}>
          <div className="responsable-ingresar-grid">
            <section className="responsable-form-block" aria-labelledby="prov-seccion-id">
              <h3 id="prov-seccion-id" className="responsable-form-block-title">
                Identificación
              </h3>
              <div className="field">
                <label htmlFor="prov-cod">Código proveedor</label>
                <input
                  id="prov-cod"
                  type="number"
                  min={1}
                  required
                  readOnly
                  className="input-readonly"
                  aria-readonly="true"
                  title="Asignado autom?ticamente (correlativo por cuenta)"
                  value={form.cod || ""}
                  tabIndex={-1}
                />
                <p className="field-hint">Correlativo autom?tico de su cuenta.</p>
              </div>
              <div className="field">
                <label htmlFor="prov-razon">Razón Social *</label>
                <input
                  id="prov-razon"
                  required
                  value={form.razon_social}
                  onChange={(e) => setCampo("razon_social", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="prov-rut">RUT</label>
                <input
                  id="prov-rut"
                  value={form.rut}
                  onChange={(e) => setCampo("rut", e.target.value)}
                />
              </div>
            </section>

            <section className="responsable-form-block" aria-labelledby="prov-seccion-ubic">
              <h3 id="prov-seccion-ubic" className="responsable-form-block-title">
                Ubicación
              </h3>
              <div className="field">
                <label htmlFor="prov-dir">Dirección</label>
                <input
                  id="prov-dir"
                  value={form.direccion}
                  onChange={(e) => setCampo("direccion", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="prov-ciudad">Ciudad / localidad</label>
                <input
                  id="prov-ciudad"
                  value={form.ciudad}
                  onChange={(e) => setCampo("ciudad", e.target.value)}
                />
              </div>
            </section>
          </div>

          <footer className="responsable-ingresar-foot">
            {editId ? (
              <button type="button" className="btn btn-secondary" onClick={nuevo}>
                Nuevo proveedor
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={onVerListado}>
                Listado de proveedores
              </button>
            )}
            <div className="responsable-ingresar-foot-actions">
              {editId && (
                <button type="button" className="btn btn-ghost" onClick={onCancelEdit}>
                  Cancelar edici?n
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onVolver}
                disabled={guardando}
              >
                Volver
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!apiOnline || guardando}
              >
                {guardando
                  ? "Guardando?"
                  : editId
                    ? "Guardar cambios"
                    : "Guardar proveedor"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
