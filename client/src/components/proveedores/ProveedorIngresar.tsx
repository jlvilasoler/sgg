import { useEffect, useState } from "react";
import {
  createProveedor,
  fetchSiguienteCodProveedor,
  updateProveedor,
} from "../../api";
import type { Proveedor, ProveedorForm } from "../../types";
import { aMayusculas } from "../../utils/formText";

interface Props {
  apiOnline: boolean;
  editProveedor: Proveedor | null;
  onSaved: () => void;
  onCancelEdit: () => void;
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
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<ProveedorForm>(emptyForm);
  const editId = editProveedor?.id ?? null;

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

  const nuevo = async () => {
    onCancelEdit();
    try {
      const cod = await fetchSiguienteCodProveedor();
      setForm({ ...emptyForm(), cod });
    } catch {
      setForm(emptyForm());
    }
  };

  const setCampo = <K extends keyof ProveedorForm>(k: K, v: ProveedorForm[K]) => {
    const val =
      typeof v === "string" ? (aMayusculas(v) as ProveedorForm[K]) : v;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    try {
      if (editId) {
        await updateProveedor(editId, form);
        onSuccess("Proveedor actualizado");
      } else {
        await createProveedor(form);
        onSuccess("Proveedor agregado");
      }
      onSaved();
      if (!editId) {
        const cod = await fetchSiguienteCodProveedor();
        setForm({ ...emptyForm(), cod });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Proveedores
      </button>

      <div className="card">
        <div className="form-header">
          <h2>{editId ? `Editar proveedor #${form.cod}` : "Ingresar proveedor"}</h2>
          <p className="muted">Base de datos PROVEEDORES</p>
        </div>

        <form className="proveedor-form" onSubmit={guardar}>
          <div className="form-grid proveedor-form-grid">
            <div className="field">
              <label htmlFor="prov-cod">Cód. *</label>
              <input
                id="prov-cod"
                type="number"
                min={1}
                required
                value={form.cod || ""}
                onChange={(e) => setCampo("cod", Number(e.target.value))}
              />
            </div>
            <div className="field span-2">
              <label htmlFor="prov-razon">Razón social *</label>
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
            <div className="field span-2">
              <label htmlFor="prov-dir">Dirección</label>
              <input
                id="prov-dir"
                value={form.direccion}
                onChange={(e) => setCampo("direccion", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="prov-ciudad">Ciudad / Localidad</label>
              <input
                id="prov-ciudad"
                value={form.ciudad}
                onChange={(e) => setCampo("ciudad", e.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              {editId ? "Actualizar proveedor" : "Guardar proveedor"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={nuevo}>
              Nuevo (siguiente código)
            </button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={onCancelEdit}>
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
