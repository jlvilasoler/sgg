import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { importStockGanaderoFile, importStockGanaderoRows } from "../../api";

interface Props {
  apiOnline: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

type ModoImport = "archivo" | "manual";

interface LecturaManual {
  id: string;
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
}

interface FormLectura {
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
}

const COLUMNAS = ["EID", "VID", "Date", "Time", "Condición"] as const;
const EXTENSIONES_ACEPTADAS = [".txt", ".csv"] as const;

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function horaAhora(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formVacio(): FormLectura {
  return {
    eid: "",
    vid: "",
    fecha: fechaHoy(),
    hora: horaAhora(),
    condicion: "",
  };
}

function esArchivoStockValido(f: File): boolean {
  const name = f.name.toLowerCase();
  if (EXTENSIONES_ACEPTADAS.some((ext) => name.endsWith(ext))) return true;
  const mime = f.type.toLowerCase();
  return (
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel"
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function lecturaDesdeForm(form: FormLectura): Omit<LecturaManual, "id"> | null {
  const eid = form.eid.trim();
  if (!eid) return null;
  if (!form.fecha.trim()) return null;
  return {
    eid,
    vid: form.vid.trim(),
    fecha: form.fecha,
    hora: form.hora.trim(),
    condicion: form.condicion.trim(),
  };
}

let lecturaIdSeq = 0;
function nextLecturaId(): string {
  lecturaIdSeq += 1;
  return `lectura-${lecturaIdSeq}`;
}

export default function StockGanaderoImportar({
  apiOnline,
  onImported,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const formId = useId();
  const [modo, setModo] = useState<ModoImport>("archivo");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormLectura>(() => formVacio());
  const [pendientes, setPendientes] = useState<LecturaManual[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = useCallback(
    (f: File | null) => {
      if (!f) {
        setFile(null);
        return;
      }
      if (!esArchivoStockValido(f)) {
        onError("Solo archivos .txt o .csv (export Tru-Test)");
        return;
      }
      setFile(f);
    },
    [onError]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (!apiOnline || importing) return;
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [apiOnline, importing, pickFile]
  );

  const importarArchivo = async () => {
    if (!file) {
      onError("Seleccioná un archivo .txt o .csv");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockGanaderoFile(file);
      onSuccess(r.message, "Importación completada");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const importarLecturas = async (rows: Omit<LecturaManual, "id">[]) => {
    if (!rows.length) {
      onError("Agregá al menos una lectura");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockGanaderoRows(rows);
      onSuccess(r.message, "Importación completada");
      setPendientes([]);
      setForm(formVacio());
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const agregarPendiente = (e?: FormEvent) => {
    e?.preventDefault();
    const row = lecturaDesdeForm(form);
    if (!row) {
      onError("Completá al menos EID y fecha");
      return;
    }
    setPendientes((prev) => [...prev, { ...row, id: nextLecturaId() }]);
    setForm((prev) => ({
      ...formVacio(),
      fecha: prev.fecha,
      hora: prev.hora,
    }));
  };

  const quitarPendiente = (id: string) => {
    setPendientes((prev) => prev.filter((p) => p.id !== id));
  };

  const importarFormulario = () => {
    const row = lecturaDesdeForm(form);
    if (!row) {
      onError("Completá al menos EID y fecha");
      return;
    }
    void importarLecturas([row]);
  };

  const importarPendientes = () => {
    void importarLecturas(
      pendientes.map(({ eid, vid, fecha, hora, condicion }) => ({
        eid,
        vid,
        fecha,
        hora,
        condicion,
      }))
    );
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card stock-import-shell">
        <div className="form-header stock-import-head">
          <div>
            <h2>Importar lecturas</h2>
            <p className="muted">
              Cargá el export del bastón o lector RFID, o ingresá lecturas una a una.
              Cada registro guarda fecha, hora y condición del animal.
            </p>
          </div>
        </div>

        {!apiOnline && (
          <div className="stock-import-offline" role="status">
            Conectá la API (puerto 3001) para importar lecturas.
          </div>
        )}

        <div className="stock-ganadera-layout stock-import-layout">
          <aside className="stock-facet-sidebar stock-import-sidebar" aria-label="Ayuda de importación">
            <div className="stock-facet-sidebar-head stock-import-sidebar-head">
              <h3 className="stock-facet-sidebar-title">Formato</h3>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Columnas</h4>
              </div>
              <div className="stock-import-chips stock-import-chips--sidebar">
                {COLUMNAS.map((col) => (
                  <span key={col} className="stock-import-chip">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Archivo</h4>
              </div>
              <p className="stock-import-sidebar-note">
                <strong>.txt</strong> o <strong>.csv</strong> (Tru-Test) · Separador tab o{" "}
                <code>;</code>
              </p>
              <p className="stock-import-sidebar-note">
                Fecha <code>AAAA-MM-DD</code> o <code>D/M/AAAA</code> · Hora{" "}
                <code>HH:MM:SS</code>
              </p>
            </div>

            <div className="stock-facet-group">
              <div className="stock-facet-group-head">
                <h4 className="stock-facet-group-title">Carga manual</h4>
              </div>
              <p className="stock-import-sidebar-note">
                Completá el formulario y agregá lecturas a la lista. Podés importar una sola
                o varias en el mismo lote.
              </p>
            </div>
          </aside>

          <div className="stock-ganadera-main stock-import-main">
            <div className="stock-import-tabs" role="tablist" aria-label="Modo de importación">
              <button
                type="button"
                role="tab"
                aria-selected={modo === "archivo"}
                className={`stock-import-tab${modo === "archivo" ? " is-active" : ""}`}
                onClick={() => setModo("archivo")}
              >
                Archivo .txt / .csv
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === "manual"}
                className={`stock-import-tab${modo === "manual" ? " is-active" : ""}`}
                onClick={() => setModo("manual")}
              >
                Carga manual
                {pendientes.length > 0 ? (
                  <span className="stock-import-tab-badge">{pendientes.length}</span>
                ) : null}
              </button>
            </div>

            {modo === "archivo" ? (
              <section className="stock-import-pane" aria-label="Importar desde archivo">
                <div
                  className={`stock-dropzone${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (apiOnline && !importing) setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => {
                    if (apiOnline && !importing && !file) inputRef.current?.click();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (apiOnline && !importing) inputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={apiOnline && !importing ? 0 : -1}
                  aria-label="Zona para soltar archivo TXT o CSV"
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="stock-dropzone-input"
                    accept=".txt,.csv,text/plain,text/csv"
                    disabled={!apiOnline || importing}
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />

                  {file ? (
                    <div className="stock-file-preview">
                      <span className="stock-file-icon" aria-hidden>
                        ✓
                      </span>
                      <div className="stock-file-meta">
                        <strong className="stock-file-name">{file.name}</strong>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="stock-file-clear"
                        disabled={importing}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (inputRef.current) inputRef.current.value = "";
                        }}
                        aria-label="Quitar archivo"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="stock-dropzone-graphic" aria-hidden>
                        ↑
                      </span>
                      <p className="stock-dropzone-title">Soltá el archivo aquí</p>
                      <p className="stock-dropzone-sub">
                        o hacé clic para buscar · Tru-Test, bastón o lector RFID
                      </p>
                    </>
                  )}
                </div>

                <div className="stock-import-pane-foot">
                  <button
                    type="button"
                    className="btn btn-primary stock-import-btn"
                    disabled={!apiOnline || importing || !file}
                    onClick={() => void importarArchivo()}
                  >
                    {importing ? (
                      <>
                        <span className="stock-import-spinner" aria-hidden />
                        Procesando…
                      </>
                    ) : (
                      "Subir e importar"
                    )}
                  </button>
                </div>
              </section>
            ) : (
              <section className="stock-import-pane" aria-label="Carga manual de lecturas">
                <form
                  id={formId}
                  className="stock-import-form"
                  onSubmit={agregarPendiente}
                >
                  <div className="stock-import-form-grid">
                    <div className="field stock-import-field stock-import-field--eid">
                      <label htmlFor={`${formId}-eid`}>EID</label>
                      <input
                        id={`${formId}-eid`}
                        type="text"
                        className="mayusculas-auto"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="858 000041989349"
                        value={form.eid}
                        onChange={(e) => setForm((p) => ({ ...p, eid: e.target.value }))}
                        disabled={!apiOnline || importing}
                      />
                    </div>
                    <div className="field stock-import-field">
                      <label htmlFor={`${formId}-vid`}>VID</label>
                      <input
                        id={`${formId}-vid`}
                        type="text"
                        className="mayusculas-auto"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Opcional"
                        value={form.vid}
                        onChange={(e) => setForm((p) => ({ ...p, vid: e.target.value }))}
                        disabled={!apiOnline || importing}
                      />
                    </div>
                    <div className="field stock-import-field">
                      <label htmlFor={`${formId}-fecha`}>Fecha</label>
                      <input
                        id={`${formId}-fecha`}
                        type="date"
                        value={form.fecha}
                        onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
                        disabled={!apiOnline || importing}
                        required
                      />
                    </div>
                    <div className="field stock-import-field">
                      <label htmlFor={`${formId}-hora`}>Hora</label>
                      <input
                        id={`${formId}-hora`}
                        type="time"
                        step={1}
                        value={form.hora}
                        onChange={(e) => setForm((p) => ({ ...p, hora: e.target.value }))}
                        disabled={!apiOnline || importing}
                      />
                    </div>
                    <div className="field stock-import-field stock-import-field--condicion">
                      <label htmlFor={`${formId}-condicion`}>Condición</label>
                      <input
                        id={`${formId}-condicion`}
                        type="text"
                        className="mayusculas-auto"
                        autoComplete="off"
                        placeholder="Ej. VIVO, VENDIDO…"
                        value={form.condicion}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, condicion: e.target.value }))
                        }
                        disabled={!apiOnline || importing}
                      />
                    </div>
                  </div>

                  <div className="stock-import-form-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={!apiOnline || importing}
                      onClick={() => setForm(formVacio())}
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={!apiOnline || importing || !lecturaDesdeForm(form)}
                      onClick={() => importarFormulario()}
                    >
                      Importar esta lectura
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!apiOnline || importing || !lecturaDesdeForm(form)}
                    >
                      Agregar a la lista
                    </button>
                  </div>
                </form>

                {pendientes.length > 0 ? (
                  <div className="stock-import-queue">
                    <div className="stock-import-queue-head">
                      <h4>Lecturas pendientes</h4>
                      <span className="muted">{pendientes.length} en cola</span>
                    </div>
                    <div className="table-wrap stock-import-queue-table-wrap">
                      <table className="stock-table-pro stock-import-queue-table">
                        <thead>
                          <tr>
                            <th>EID</th>
                            <th>VID</th>
                            <th>Fecha</th>
                            <th>Hora</th>
                            <th>Condición</th>
                            <th className="stock-th--sel" aria-label="Quitar" />
                          </tr>
                        </thead>
                        <tbody>
                          {pendientes.map((row) => (
                            <tr key={row.id}>
                              <td className="stock-td-eid">{row.eid}</td>
                              <td>{row.vid || "—"}</td>
                              <td>{row.fecha}</td>
                              <td>{row.hora || "—"}</td>
                              <td>{row.condicion || "—"}</td>
                              <td className="stock-td--sel">
                                <button
                                  type="button"
                                  className="stock-import-queue-remove"
                                  aria-label="Quitar lectura"
                                  disabled={importing}
                                  onClick={() => quitarPendiente(row.id)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="stock-import-queue-empty muted">
                    Todavía no hay lecturas en la lista. Completá el formulario y usá{" "}
                    <strong>Agregar a la lista</strong> para armar un lote manual.
                  </p>
                )}

                <div className="stock-import-pane-foot">
                  <button
                    type="button"
                    className="btn btn-primary stock-import-btn"
                    disabled={!apiOnline || importing || pendientes.length === 0}
                    onClick={importarPendientes}
                  >
                    {importing ? (
                      <>
                        <span className="stock-import-spinner" aria-hidden />
                        Procesando…
                      </>
                    ) : (
                      `Importar ${pendientes.length} lectura(s)`
                    )}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
