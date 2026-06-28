import { useEffect, useState } from "react";
import { createResponsable, updateResponsable } from "../../api";
import type { Responsable, ResponsableForm } from "../../types";
import { aMayusculas } from "../../utils/formText";

interface Props {
  apiOnline: boolean;
  editResponsable: Responsable | null;
  onSaved: () => void;
  onCancelEdit: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const emptyForm = (): ResponsableForm => ({
  nombre: "",
  activo: true,
});

export default function ResponsableIngresar({
  apiOnline,
  editResponsable,
  onSaved,
  onCancelEdit,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<ResponsableForm>(emptyForm);
  const editId = editResponsable?.id ?? null;

  useEffect(() => {
    if (editResponsable) {
      setForm({
        nombre: aMayusculas(editResponsable.nombre),
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
    try {
      if (editId) {
        await updateResponsable(editId, form);
        onSuccess("Nombre actualizado");
      } else {
        await createResponsable(form);
        onSuccess("Nombre guardado");
        setForm(emptyForm());
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a PRESUPUESTO ASIGNADO
      </button>

      <div className="card">
        <div className="form-header">
          <h2>{editId ? "Editar nombre" : "Ingresar nombre"}</h2>
          <p className="muted">
            Los nombres activos aparecen en Presupuesto asignado al registrar gastos y en el
            listado.
          </p>
        </div>

        <form className="form-grid responsable-ingresar-form" onSubmit={guardar}>
          <div className="field span-3">
            <label htmlFor="resp-nombre">Nombre completo *</label>
            <input
              id="resp-nombre"
              required
              data-sin-mayusculas="true"
              placeholder="Ingresar Nombre"
              value={form.nombre}
              onChange={(e) =>
                setForm((f) => ({ ...f, nombre: aMayusculas(e.target.value) }))
              }
            />
          </div>

          <div className="field checkbox-field span-3">
            <label className="checkbox-inline-label" htmlFor="resp-activo">
              <input
                id="resp-activo"
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              <span>Activo (visible en gastos y filtros)</span>
            </label>
          </div>

          <div className="form-actions span-3">
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={nuevo}>
                Nuevo nombre
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              {editId ? "Guardar cambios" : "Guardar nombre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
