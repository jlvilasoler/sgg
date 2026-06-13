import { useCallback, useRef, useState } from "react";
import {
  importStockGanaderoBajaFile,
  importStockGanaderoBajaText,
  type TipoBajaImport,
} from "../../api";

interface Props {
  apiOnline: boolean;
  onImported: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const COLUMNAS = ["EID", "VID", "Date", "Time", "Condición"] as const;
const EXTENSIONES_ACEPTADAS = [".txt", ".csv"] as const;

const TIPOS_BAJA: { value: TipoBajaImport; label: string; hint: string }[] = [
  {
    value: "VENDIDO",
    label: "Venta",
    hint: "Dispositivos vendidos — estado Vendido",
  },
  {
    value: "FRIGORIFICO",
    label: "Frigorífico",
    hint: "Enviados a frigorífico — estado Frigorífico",
  },
];

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

export default function StockGanaderoImportarBaja({
  apiOnline,
  onImported,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [tipoBaja, setTipoBaja] = useState<TipoBajaImport>("VENDIDO");
  const [file, setFile] = useState<File | null>(null);
  const [paste, setPaste] = useState("");
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
      const r = await importStockGanaderoBajaFile(file, tipoBaja);
      onSuccess(r.message, "Bajas importadas");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar bajas");
    } finally {
      setImporting(false);
    }
  };

  const importarTexto = async () => {
    if (!paste.trim()) {
      onError("Pegá el contenido del archivo");
      return;
    }
    setImporting(true);
    try {
      const r = await importStockGanaderoBajaText(paste, tipoBaja);
      onSuccess(r.message, "Bajas importadas");
      setPaste("");
      onImported();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar bajas");
    } finally {
      setImporting(false);
    }
  };

  const lineCount = paste.trim() ? paste.trim().split(/\r?\n/).length : 0;
  const tipoLabel = TIPOS_BAJA.find((t) => t.value === tipoBaja)?.label ?? "";

  return (
    <div className="subseccion-panel stock-import-page stock-import-page--baja">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Bajas de Dispositivos
      </button>

      <div className="stock-import-hero card stock-import-hero--baja">
        <div className="stock-import-hero-icon stock-import-hero-icon--baja" aria-hidden>
          📤
        </div>
        <div className="stock-import-hero-text">
          <h2>Importar bajas</h2>
          <p>
            Cargá un TXT con caravanas vendidas o enviadas a frigorífico. Cada
            dispositivo se marca en <strong>Stock Ganadero</strong> con la fecha
            del archivo (columna Date).
          </p>
        </div>
      </div>

      {!apiOnline && (
        <div className="stock-import-offline" role="status">
          Conectá la API (puerto 3001) para importar bajas.
        </div>
      )}

      <div className="stock-baja-tipo card">
        <span className="stock-import-spec-label">Tipo de baja</span>
        <div className="stock-baja-tipo-opciones" role="radiogroup" aria-label="Tipo de baja">
          {TIPOS_BAJA.map((t) => (
            <label
              key={t.value}
              className={`stock-baja-tipo-opcion${
                tipoBaja === t.value ? " stock-baja-tipo-opcion--activa" : ""
              }`}
            >
              <input
                type="radio"
                name="tipo-baja"
                value={t.value}
                checked={tipoBaja === t.value}
                disabled={!apiOnline || importing}
                onChange={() => setTipoBaja(t.value)}
              />
              <span className="stock-baja-tipo-opcion-titulo">{t.label}</span>
              <span className="stock-baja-tipo-opcion-hint">{t.hint}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="stock-import-spec card">
        <span className="stock-import-spec-label">Columnas del archivo</span>
        <div className="stock-import-chips">
          {COLUMNAS.map((col) => (
            <span key={col} className="stock-import-chip">
              {col}
            </span>
          ))}
        </div>
        <p className="stock-import-spec-hint">
          Mismo formato que la importación de lecturas · La columna{" "}
          <strong>Date</strong> define mes y año de {tipoLabel.toLowerCase()} · Solo
          dispositivos ya cargados en el stock
        </p>
      </div>

      <div className="stock-import-grid">
        <section className="stock-import-panel card">
          <header className="stock-import-panel-head">
            <span className="stock-import-panel-icon" aria-hidden>
              📄
            </span>
            <div>
              <h3>Archivo .txt / .csv</h3>
              <p>Lista de caravanas a dar de baja</p>
            </div>
          </header>

          <div
            className={`stock-dropzone stock-dropzone--baja${dragOver ? " is-dragover" : ""}${file ? " has-file" : ""}`}
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
            aria-label="Zona para soltar archivo de bajas"
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
                  o hacé clic para buscar · <strong>.txt</strong> o <strong>.csv</strong>
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            className="stock-import-action stock-import-action--baja"
            disabled={!apiOnline || importing || !file}
            onClick={() => void importarArchivo()}
          >
            {importing ? (
              <>
                <span className="stock-import-spinner" aria-hidden />
                Procesando…
              </>
            ) : (
              <>Aplicar bajas ({tipoLabel})</>
            )}
          </button>
        </section>

        <div className="stock-import-divider" aria-hidden>
          <span>o</span>
        </div>

        <section className="stock-import-panel card">
          <header className="stock-import-panel-head">
            <span className="stock-import-panel-icon" aria-hidden>
              📋
            </span>
            <div>
              <h3>Pegar contenido</h3>
              <p>Copiá y pegá directo del export</p>
            </div>
          </header>

          <div className="stock-paste-wrap">
            <textarea
              className="stock-paste"
              rows={10}
              spellCheck={false}
              placeholder={`EID\tVID\tDate\tTime\tCondición\n858 000041989349\t\t8/12/2023\t15:08:36\t`}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              disabled={!apiOnline || importing}
              aria-label="Contenido del archivo de bajas"
            />
            {lineCount > 0 && (
              <span className="stock-paste-badge">{lineCount} línea(s)</span>
            )}
          </div>

          <button
            type="button"
            className="stock-import-action stock-import-action--baja-secondary"
            disabled={!apiOnline || importing || !paste.trim()}
            onClick={() => void importarTexto()}
          >
            {importing ? (
              <>
                <span className="stock-import-spinner" aria-hidden />
                Procesando…
              </>
            ) : (
              <>Importar texto ({tipoLabel})</>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
