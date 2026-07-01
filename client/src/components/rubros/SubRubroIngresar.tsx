import { useEffect, useState } from "react";
import {
  createSubRubro,
  fetchSubRubroGrupos,
  updateSubRubro,
} from "../../api";
import type { SubRubro, SubRubroForm } from "../../types";
import { normalizarTituloRubro } from "../../utils/formText";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  editRow: SubRubro | null;
  /** Grupo precargado al crear desde el listado (filtro activo). */
  initialGrupo?: string;
  onSaved: () => void;
  onCancelEdit: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const emptyForm = (): SubRubroForm => ({
  nombre: "",
  grupo: "",
  activo: true,
});

export default function SubRubroIngresar({
  apiOnline,
  editRow,
  initialGrupo = "",
  onSaved,
  onCancelEdit,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<SubRubroForm>(emptyForm);
  const [grupos, setGrupos] = useState<string[]>([]);
  const editId = editRow?.id ?? null;

  useEffect(() => {
    if (!apiOnline) return;
    fetchSubRubroGrupos()
      .then(setGrupos)
      .catch(() => setGrupos([]));
  }, [apiOnline]);

  useEffect(() => {
    if (editRow) {
      setForm({
        nombre: editRow.nombre,
        grupo: editRow.grupo,
        activo: editRow.activo !== 0,
      });
      return;
    }
    setForm(
      initialGrupo.trim()
        ? { ...emptyForm(), grupo: initialGrupo.trim() }
        : emptyForm()
    );
  }, [editRow, initialGrupo]);

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
    const payload = {
      ...form,
      grupo: normalizarTituloRubro(form.grupo),
      nombre: normalizarTituloRubro(form.nombre),
    };
    try {
      if (editId) {
        await updateSubRubro(editId, payload);
        onSuccess("Sub-rubro actualizado");
      } else {
        await createSubRubro(payload);
        onSuccess("Sub-rubro creado");
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
          <PageModuleHeadRow
            icon={{ source: "hub", id: "config_rubros" }}
            title={editId ? "Editar sub-rubro" : "Ingresar sub-rubro"}
            subtitle="Detalle dentro del rubro (ej. Sueldos, UTE, Fletes Ganado). Los activos aparecen al registrar gastos."
          />
        </div>

        <form className="form-grid" onSubmit={guardar}>
          <div className="field">
            <label htmlFor="subrubro-grupo">Grupo *</label>
            <input
              id="subrubro-grupo"
              required
              data-sin-mayusculas="true"
              list="subrubro-grupos-list"
              placeholder="Ej: agricultura, veterinaria..."
              value={form.grupo}
              onChange={(e) => setForm((f) => ({ ...f, grupo: e.target.value }))}
            />
            <datalist id="subrubro-grupos-list">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <label htmlFor="subrubro-nombre">Nombre del sub-rubro *</label>
            <input
              id="subrubro-nombre"
              required
              data-sin-mayusculas="true"
              placeholder="Ej: fertilizantes, honorarios..."
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>

          <div className="field checkbox-field span-2">
            <label>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              Activo (visible al cargar gastos)
            </label>
          </div>

          <div className="form-actions span-2">
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={nuevo}>
                Nuevo sub-rubro
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              {editId ? "Guardar cambios" : "Crear sub-rubro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
