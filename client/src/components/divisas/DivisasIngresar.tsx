import { useState } from "react";
import { insertDivisa } from "../../api";
import type { TipoCambioForm } from "../../types";
import { PAR_DIVISA_LABELS, PAR_DIVISA_TC_LABEL } from "../../types";
import type { DivisasMonedaConfig } from "./divisas-config";

interface Props {
  config: DivisasMonedaConfig;
  apiOnline: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function DivisasIngresar({
  config,
  apiOnline,
  onSaved,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<TipoCambioForm>({
    fecha: new Date().toISOString().slice(0, 10),
    par: config.par,
    valor: 0,
  });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    if (form.valor <= 0) {
      onError("El TC debe ser mayor a 0");
      return;
    }
    try {
      await insertDivisa({ ...form, par: config.par });
      onSuccess("Guardado");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Divisas
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Ingresar TC — {config.titulo}</h2>
          <p className="muted">
            {PAR_DIVISA_LABELS[config.par]}. Una vez guardado, el registro no se
            puede editar ni borrar.
          </p>
        </div>

        <form onSubmit={guardar}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="ing-fecha">Fecha *</label>
              <input
                type="date"
                id="ing-fecha"
                required
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div className="field money">
              <label htmlFor="ing-valor">{PAR_DIVISA_TC_LABEL[config.par]} *</label>
              <input
                type="number"
                id="ing-valor"
                step="0.0001"
                min={0}
                required
                value={form.valor || ""}
                onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
