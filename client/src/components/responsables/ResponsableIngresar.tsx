import { useCallback, useEffect, useState } from "react";
import { createResponsable, fetchResponsables, updateResponsable } from "../../api";
import type { Responsable, ResponsableForm } from "../../types";
import { aMayusculas } from "../../utils/formText";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  editResponsable: Responsable | null;
  onSaved: () => void;
  onCancelEdit: () => void;
  onEditarExistente?: (r: Responsable) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const OBS_MAX = 500;

const emptyForm = (): ResponsableForm => ({
  nombre: "",
  observaciones: "",
  activo: true,
});

export default function ResponsableIngresar({
  apiOnline,
  editResponsable,
  onSaved,
  onCancelEdit,
  onEditarExistente,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<ResponsableForm>(emptyForm);
  const [guardando, setGuardando] = useState(false);
  const [activos, setActivos] = useState<Responsable[]>([]);
  const [cargandoActivos, setCargandoActivos] = useState(true);
  const editId = editResponsable?.id ?? null;
  const obsLen = (form.observaciones ?? "").length;

  const cargarActivos = useCallback(async () => {
    if (!apiOnline) {
      setActivos([]);
      setCargandoActivos(false);
      return;
    }
    setCargandoActivos(true);
    try {
      setActivos(await fetchResponsables(true, { ambitoCuenta: true }));
    } catch {
      setActivos([]);
    } finally {
      setCargandoActivos(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void cargarActivos();
  }, [cargarActivos]);

  useEffect(() => {
    if (editResponsable) {
      setForm({
        nombre: aMayusculas(editResponsable.nombre),
        observaciones: editResponsable.observaciones ?? "",
        activo: editResponsable.activo !== 0,
      });
      return;
    }
    setForm(emptyForm());
  }, [editResponsable]);

  const nuevo = () => {
    onCancelEdit();
    setForm(emptyForm());
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
        await updateResponsable(editId, form);
        onSuccess("Asignación actualizada");
      } else {
        await createResponsable(form);
        onSuccess("Asignación guardada");
        setForm(emptyForm());
      }
      await cargarActivos();
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="subseccion-panel responsable-module responsable-ingresar-page">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Asignación de presupuesto
      </button>

      <div className="card responsable-module-shell">
        <header className="responsable-module-page-head">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "resp_ingresar" }}
            kicker="Asignación de presupuesto"
            title={editId ? "Editar asignación" : "Nueva asignación"}
            subtitle={
              editId
                ? "Modificá los datos de la persona seleccionada."
                : "Completá el formulario para agregar una persona al catálogo de su cuenta."
            }
            titleClassName="responsable-module-page-title"
            subClassName="responsable-module-page-sub"
          />
          {editId ? (
            <span className="responsable-module-mode-badge">Modo edición</span>
          ) : null}
        </header>

        <section
          className="responsable-activos-panel"
          aria-label="Asignaciones activas en la cuenta"
        >
          <div className="responsable-activos-panel-head">
            <div>
              <h3>En uso en su cuenta</h3>
              <p>Nombres activos al registrar gastos y en filtros.</p>
            </div>
            <span className="responsable-module-stat-pill" aria-live="polite">
              {cargandoActivos ? "…" : `${activos.length} activo${activos.length === 1 ? "" : "s"}`}
            </span>
          </div>

          {cargandoActivos ? (
            <div className="responsable-activos-empty">
              <span className="responsable-activos-empty-icon" aria-hidden>⋯</span>
              <p>Cargando asignaciones…</p>
            </div>
          ) : !apiOnline ? (
            <div className="responsable-activos-empty">
              <p>Sin conexión con la API</p>
            </div>
          ) : activos.length === 0 ? (
            <div className="responsable-activos-empty">
              <span className="responsable-activos-empty-icon" aria-hidden>
                <HubMenuIcon id="config_responsables" className="menu-app-icon-svg" />
              </span>
              <p>Todavía no hay asignaciones activas en esta cuenta.</p>
              <span className="muted">Guardá la primera asignación con el formulario de abajo.</span>
            </div>
          ) : (
            <>
              <ul className="responsable-ingresar-chips">
                {activos.map((r) => {
                  const seleccionado = editId === r.id;
                  const obs = (r.observaciones ?? "").trim();
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`responsable-ingresar-chip${seleccionado ? " is-selected" : ""}`}
                        title={obs ? `Observaciones: ${obs}` : "Editar asignación"}
                        onClick={() => onEditarExistente?.(r)}
                      >
                        <span className="responsable-ingresar-chip-name">{r.nombre}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="responsable-activos-hint">Clic en un nombre para editarlo.</p>
            </>
          )}
        </section>

        <form className="responsable-ingresar-form" onSubmit={guardar}>
          <div className="responsable-ingresar-grid">
            <section className="responsable-form-block" aria-labelledby="resp-seccion-datos">
              <h3 id="resp-seccion-datos" className="responsable-form-block-title">
                Datos principales
              </h3>
              <div className="field">
                <label htmlFor="resp-nombre">Nombre completo</label>
                <input
                  id="resp-nombre"
                  required
                  autoComplete="name"
                  data-sin-mayusculas="true"
                  placeholder="Apellido y nombre"
                  value={form.nombre}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nombre: aMayusculas(e.target.value) }))
                  }
                />
                <p className="field-hint">Obligatorio. Se muestra tal como lo ingresás.</p>
              </div>
            </section>

            <section className="responsable-form-block" aria-labelledby="resp-seccion-obs">
              <h3 id="resp-seccion-obs" className="responsable-form-block-title">
                Observaciones
              </h3>
              <div className="field">
                <label htmlFor="resp-observaciones">Notas internas</label>
                <textarea
                  id="resp-observaciones"
                  rows={5}
                  maxLength={OBS_MAX}
                  data-sin-mayusculas="true"
                  placeholder="Notas internas sobre esta asignación…"
                  value={form.observaciones ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, observaciones: e.target.value }))
                  }
                />
                <div className="responsable-ingresar-meta">
                  <p className="field-hint">Opcional. Solo visible en este catálogo.</p>
                  <span className="responsable-ingresar-counter" aria-live="polite">
                    {obsLen}/{OBS_MAX}
                  </span>
                </div>
              </div>
            </section>

            <section
              className="responsable-form-block responsable-form-block--full"
              aria-labelledby="resp-seccion-estado"
            >
              <h3 id="resp-seccion-estado" className="responsable-form-block-title">
                Disponibilidad
              </h3>
              <label
                className={`responsable-ingresar-toggle${form.activo ? " is-on" : ""}`}
                htmlFor="resp-activo"
              >
                <input
                  id="resp-activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <span className="responsable-ingresar-toggle-track" aria-hidden />
                <span className="responsable-ingresar-toggle-copy">
                  <strong>{form.activo ? "Activo" : "Inactivo"}</strong>
                  <span>
                    {form.activo
                      ? "Visible al registrar gastos y en filtros del listado."
                      : "Oculto en gastos nuevos; sigue en el historial existente."}
                  </span>
                </span>
              </label>
            </section>
          </div>

          <footer className="responsable-ingresar-foot">
            {editId ? (
              <button type="button" className="btn btn-secondary" onClick={nuevo}>
                Nueva asignación
              </button>
            ) : (
              <span />
            )}
            <div className="responsable-ingresar-foot-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onVolver}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!apiOnline || guardando}
              >
                {guardando
                  ? "Guardando…"
                  : editId
                    ? "Guardar cambios"
                    : "Guardar asignación"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
