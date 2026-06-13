import { useState } from "react";
import { importDivisasFile, importDivisasText, insertDivisa } from "../../api";
import type { TipoCambioForm } from "../../types";
import { PAR_DIVISA_TC_LABEL } from "../../types";
import type { DivisasMonedaConfig } from "./divisas-config";

interface Props {
  config: DivisasMonedaConfig;
  apiOnline: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function DivisasImportar({
  config,
  apiOnline,
  onImported,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState<TipoCambioForm>({
    fecha: new Date().toISOString().slice(0, 10),
    par: config.par,
    valor: 0,
  });

  const importarArchivo = async () => {
    if (!file) {
      onError("Seleccioná un archivo CSV o Excel");
      return;
    }
    setImporting(true);
    try {
      const r = await importDivisasFile(file);
      onSuccess(r.message);
      setFile(null);
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const importarTexto = async () => {
    if (!paste.trim()) {
      onError("Pegá el contenido CSV");
      return;
    }
    setImporting(true);
    try {
      const r = await importDivisasText(paste);
      onSuccess(r.message);
      setPaste("");
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const guardarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    if (manual.valor <= 0) {
      onError("El TC debe ser mayor a 0");
      return;
    }
    try {
      await insertDivisa({ ...manual, par: config.par });
      onSuccess("Tipo de cambio guardado");
      onImported();
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
          <h2>Importar — {config.titulo}</h2>
          <p className="muted">
            Columnas: <code>fecha</code>, <code>{config.columnaCsv}</code> (separador{" "}
            <code>;</code> o <code>,</code>). También podés incluir la otra moneda (
            <code>uyu_usd</code> / <code>brl_usd</code>). Las fechas existentes no se
            modifican.
          </p>
        </div>

        <div className="divisas-import-block">
          <label className="import-label">Archivo (.csv, .xlsx, .xls)</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={!apiOnline}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!apiOnline || importing || !file}
            onClick={importarArchivo}
          >
            {importing ? "Importando..." : "Subir archivo"}
          </button>
        </div>

        <div className="divisas-import-block">
          <label className="import-label">O pegar CSV aquí</label>
          <textarea
            className="divisas-paste"
            rows={6}
            placeholder={`fecha;${config.columnaCsv}\n2026-06-01;${config.par === "UYU_USD" ? "40.20" : "5.60"}`}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            disabled={!apiOnline}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!apiOnline || importing}
            onClick={importarTexto}
          >
            Importar texto
          </button>
        </div>

        <p className="hint-muted">
          Plantilla de ejemplo: <code>data/divisas-ejemplo.csv</code>
        </p>
      </div>

      <div className="card">
        <div className="form-header">
          <h2>Carga manual (un día)</h2>
        </div>
        <form onSubmit={guardarManual}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="tc-fecha">Fecha *</label>
              <input
                type="date"
                id="tc-fecha"
                required
                value={manual.fecha}
                onChange={(e) => setManual((m) => ({ ...m, fecha: e.target.value }))}
              />
            </div>
            <div className="field money">
              <label htmlFor="tc-valor">{PAR_DIVISA_TC_LABEL[config.par]} *</label>
              <input
                type="number"
                id="tc-valor"
                step="0.0001"
                min={0}
                required
                value={manual.valor || ""}
                onChange={(e) =>
                  setManual((m) => ({ ...m, valor: Number(e.target.value) }))
                }
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              Guardar TC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
