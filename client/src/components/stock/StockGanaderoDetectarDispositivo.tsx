import { useCallback, useId, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  detectarStockGanaderoDispositivos,
  type StockDetectarDispositivoRow,
  type StockDetectarDispositivosResult,
} from "../../api";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

const EXTENSIONES_ACEPTADAS = [".txt", ".csv", ".xlsx", ".xls"] as const;

function esArchivoStockValido(f: File): boolean {
  const name = f.name.toLowerCase();
  if (EXTENSIONES_ACEPTADAS.some((ext) => name.endsWith(ext))) return true;
  const mime = f.type.toLowerCase();
  return (
    mime === "text/plain" ||
    mime === "text/csv" ||
    mime === "application/csv" ||
    mime === "application/vnd.ms-excel" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToSheet(rows: StockDetectarDispositivoRow[]) {
  return rows.map((r) => ({
    EID: r.eid,
    VID: r.vid,
    Date: r.fecha_archivo,
    Time: r.hora_archivo,
    Condición: r.condicion_archivo,
    Empresa: r.empresa,
    Establecimiento: r.establecimiento,
    Sexo: r.sexo,
    "Fecha nacimiento": r.fecha_nacimiento,
    Potrero: r.potrero,
    "Ultima lectura": r.ultima_lectura,
    Edad: r.edad,
    Encontrado: r.encontrado ? "SI" : "NO",
  }));
}

export default function StockGanaderoDetectarDispositivo({
  apiOnline,
  onError,
  onSuccess,
  onVolver: _onVolver,
  embedded = false,
}: Props) {
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<StockDetectarDispositivosResult | null>(
    null
  );

  const pickFile = useCallback(
    (f: File | null) => {
      setResultado(null);
      if (!f) {
        setFile(null);
        return;
      }
      if (!esArchivoStockValido(f)) {
        onError("Solo archivos .txt, .csv o .xlsx (mismo formato que Alta de Dispositivo)");
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
      if (!apiOnline || busy) return;
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [apiOnline, busy, pickFile]
  );

  const cruzar = async () => {
    if (!file) {
      onError("Seleccioná un archivo .txt, .csv o .xlsx");
      return;
    }
    setBusy(true);
    try {
      const data = await detectarStockGanaderoDispositivos(file);
      setResultado(data);
      onSuccess(data.message, "Cruce listo");
    } catch (e) {
      setResultado(null);
      onError(e instanceof Error ? e.message : "Error al detectar dispositivos");
    } finally {
      setBusy(false);
    }
  };

  const descargarTxt = () => {
    if (!resultado?.tsv) return;
    const blob = new Blob([resultado.tsv], {
      type: "text/plain;charset=utf-8",
    });
    descargarBlob(blob, resultado.nombre_sugerido || "detectado.txt");
  };

  const descargarExcel = () => {
    if (!resultado?.rows.length) return;
    const sheet = XLSX.utils.json_to_sheet(rowsToSheet(resultado.rows));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Detectados");
    const base = (resultado.nombre_sugerido || "detectado.txt").replace(
      /\.txt$/i,
      ""
    );
    XLSX.writeFile(wb, `${base}.xlsx`);
  };

  if (!apiOnline) {
    return (
      <div className="stock-import-offline" role="status">
        Sin conexión con el servidor. No se puede cruzar con la base de la cuenta.
      </div>
    );
  }

  const dropzone = (
    <div
      className={`stock-dropzone${embedded ? " stock-dropzone--hub" : ""}${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label="Zona para soltar archivo TXT o Excel"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        id={`${formId}-file`}
        className="stock-dropzone-input"
        type="file"
        accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={busy}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        onClick={(e) => e.stopPropagation()}
      />
      {file ? (
        <div className="stock-dropzone-file">
          <strong>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            aria-label="Quitar archivo"
            onClick={(e) => {
              e.stopPropagation();
              pickFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Quitar
          </button>
        </div>
      ) : (
        <>
          <span className="stock-dropzone-graphic" aria-hidden />
          <p className="stock-dropzone-title">Soltá el archivo aquí</p>
          <p className="stock-dropzone-sub">
            .txt, .csv o .xlsx — columnas EID · VID · Date · Time · Condición
          </p>
        </>
      )}
    </div>
  );

  return (
    <div className="stock-import-pane stock-detectar-pane">
      {!embedded ? (
        <PageModuleHeadRow
          icon={{ source: "hub", id: "stock_detectar" }}
          title="Detectar dispositivo en Base de Datos"
        />
      ) : null}

      <p className="stock-detectar-lead">
        Mismo formato que <strong>Alta de Dispositivo</strong>: archivo{" "}
        <strong>.txt</strong>, <strong>.csv</strong> o <strong>.xlsx</strong> con las columnas{" "}
        <strong>EID</strong> (IDE), <strong>VID</strong> (IDV), <strong>Date</strong> / Fecha,{" "}
        <strong>Time</strong> / Hora y <strong>Condición</strong>. Separador tab o{" "}
        <code>;</code>. El sistema completa empresa, sexo, nacimiento, establecimiento, potrero,
        última lectura y edad según el stock de <strong>esta cuenta</strong> (no se consultan otras
        cuentas).
      </p>

      <div className="stock-import-chips stock-detectar-chips" aria-label="Columnas del archivo">
        <span className="stock-import-chip">EID</span>
        <span className="stock-import-chip">VID</span>
        <span className="stock-import-chip">Date</span>
        <span className="stock-import-chip">Time</span>
        <span className="stock-import-chip">Condición</span>
      </div>

      {dropzone}

      <div className={`stock-import-pane-foot${embedded ? " stock-import-pane-foot--hub" : ""}`}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!file || busy}
          onClick={() => void cruzar()}
        >
          {busy ? (
            <>
              <span className="stock-import-spinner" aria-hidden />
              Cruzando…
            </>
          ) : (
            "Detectar en la base"
          )}
        </button>
      </div>

      {resultado ? (
        <section className="stock-detectar-result" aria-label="Resultado del cruce">
          <div className="stock-detectar-kpis">
            <div>
              <span>Total archivo</span>
              <strong>{resultado.total}</strong>
            </div>
            <div>
              <span>Encontrados</span>
              <strong className="stock-detectar-ok">{resultado.encontrados}</strong>
            </div>
            <div>
              <span>Sin coincidencia</span>
              <strong className="stock-detectar-miss">{resultado.no_encontrados}</strong>
            </div>
          </div>

          <div className="stock-detectar-actions">
            <button type="button" className="btn btn-primary" onClick={descargarTxt}>
              Descargar TXT
            </button>
            <button type="button" className="btn btn-ghost" onClick={descargarExcel}>
              Descargar Excel
            </button>
          </div>

          <div className="stock-detectar-table-wrap">
            <table className="stock-detectar-table">
              <thead>
                <tr>
                  <th>EID</th>
                  <th>VID</th>
                  <th>Empresa</th>
                  <th>Establecimiento</th>
                  <th>Sexo</th>
                  <th>Nacimiento</th>
                  <th>Potrero</th>
                  <th>Última lectura</th>
                  <th>Edad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {resultado.rows.slice(0, 80).map((r, i) => (
                  <tr key={`${r.eid}-${r.vid}-${i}`} className={r.encontrado ? "" : "is-miss"}>
                    <td>{r.eid}</td>
                    <td>{r.vid}</td>
                    <td>{r.empresa || "—"}</td>
                    <td>{r.establecimiento || "—"}</td>
                    <td>{r.sexo || "—"}</td>
                    <td>{r.fecha_nacimiento || "—"}</td>
                    <td>{r.potrero || "—"}</td>
                    <td>{r.ultima_lectura || "—"}</td>
                    <td>{r.edad || "—"}</td>
                    <td>{r.encontrado ? "Encontrado" : "No en esta cuenta"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {resultado.rows.length > 80 ? (
              <p className="stock-detectar-more">
                Mostrando 80 de {resultado.rows.length}. Descargá el archivo para ver todos.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
