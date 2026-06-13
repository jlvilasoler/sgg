import { useEffect, useState } from "react";
import { createRubro, updateRubro } from "../../api";
import type { Rubro, RubroForm } from "../../types";
import { normalizarTituloRubro } from "../../utils/formText";

interface Props {
  apiOnline: boolean;
  editRubro: Rubro | null;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const emptyForm = (): RubroForm => ({
  nombre: "",
  activo: true,
});

export default function RubroIngresar({
  apiOnline,
  editRubro,
  onSaved,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<RubroForm>(emptyForm);
  const editId = editRubro?.id ?? null;

  useEffect(() => {
    if (editRubro) {
      setForm({
        nombre: editRubro.nombre,
        activo: editRubro.activo !== 0,
      });
      return;
    }
    setForm(emptyForm());
  }, [editRubro]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    const payload = { ...form, nombre: normalizarTituloRubro(form.nombre) };
    try {
      if (editId) {
        await updateRubro(editId, payload);
        onSuccess("Rubro actualizado");
      } else {
        await createRubro(payload);
        onSuccess("Rubro creado");
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
        ‹ Volver a Rubros
      </button>

      <div className="card">
        <div className="form-header">
          <h2>{editId ? "Editar rubro" : "Ingresar rubro"}</h2>
          <p className="muted">
            Los rubros activos aparecen al registrar gastos y en los filtros del sistema.
          </p>
        </div>

        <form className="form-grid" onSubmit={guardar}>
          <div className="field span-2">
            <label htmlFor="rubro-nombre">Nombre del rubro *</label>
            <input
              id="rubro-nombre"
              required
              data-sin-mayusculas="true"
              placeholder="Ej: agricultura, fertilizantes..."
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>

          <div className="field checkbox-field">
            <label>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              Activo (visible en gastos y filtros)
            </label>
          </div>

          <div className="form-actions span-2">
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              {editId ? "Guardar cambios" : "Crear rubro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
