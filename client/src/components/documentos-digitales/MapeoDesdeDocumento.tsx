import { useMemo, useRef, useState, useEffect } from "react";
import { detectarCamposDocumento } from "../../api";
import type { CampoDocumentoDetectado } from "../../types";
import {
  GASTO_DESTINO_IDS,
  GASTO_DESTINO_LABELS,
  type GastoDestinoId,
  type GastoMapeoCampos,
  normalizeGastoMapeo,
} from "../../utils/gasto-campos";

interface Props {
  apiOnline: boolean;
  mapeo: GastoMapeoCampos;
  onMapeoChange: (mapeo: GastoMapeoCampos) => void;
  onError: (msg: string) => void;
  onTitulosDetectados?: (titulos: string[]) => void;
}

export default function MapeoDesdeDocumento({
  apiOnline,
  mapeo,
  onMapeoChange,
  onError,
  onTitulosDetectados,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [archivo, setArchivo] = useState("");
  const [campos, setCampos] = useState<CampoDocumentoDetectado[]>([]);

  const titulosDisponibles = useMemo(() => {
    const fromPdf = campos.map((c) => c.etiqueta);
    const fromMapeo = Object.values(mapeo).filter(Boolean);
    return [...new Set([...fromPdf, ...fromMapeo])].sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "accent" })
    );
  }, [campos, mapeo]);

  useEffect(() => {
    onTitulosDetectados?.(titulosDisponibles);
  }, [titulosDisponibles, onTitulosDetectados]);

  const valorMuestra = (etiqueta: string) =>
    campos.find((c) => c.etiqueta === etiqueta)?.valor_muestra ?? "";

  const procesarArchivo = async (file: File) => {
    if (!apiOnline) {
      onError("Sin conexión con la API");
      return;
    }
    setLoading(true);
    try {
      const data = await detectarCamposDocumento(file);
      setCampos(data.campos);
      setArchivo(file.name);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo leer el documento");
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void procesarArchivo(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void procesarArchivo(file);
  };

  const setMapeo = (destino: GastoDestinoId, etiqueta: string) => {
    const next = normalizeGastoMapeo(mapeo);
    if (etiqueta.trim()) {
      next[destino] = etiqueta.trim();
    } else {
      delete next[destino];
    }
    onMapeoChange(next);
  };

  return (
    <div className="doc-mapeo-desde-doc">
      <div
        className={`doc-mapeo-upload${loading ? " doc-mapeo-upload--busy" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        role="button"
        tabIndex={0}
        aria-busy={loading}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="brou-import-input"
          onChange={onFileChange}
          disabled={loading || !apiOnline}
        />
        <p className="doc-mapeo-upload-title">
          {loading
            ? "Leyendo títulos de campos del PDF…"
            : "Subir documento de ejemplo (PDF o imagen)"}
        </p>
        <p className="muted doc-mapeo-upload-hint">
          El sistema detecta automáticamente los <strong>títulos de los campos</strong> del
          comprobante. Después conectás cada uno con el formulario de gasto de forma manual.
        </p>
        {archivo && !loading ? (
          <p className="doc-mapeo-upload-archivo muted">Archivo: {archivo}</p>
        ) : null}
      </div>

      {campos.length > 0 && !loading ? (
        <div className="doc-mapeo-detectados">
          <h4>Títulos detectados en el documento</h4>
          <p className="muted doc-tipo-campos-hint">
            Estos son los nombres de campo que el sistema encontró en tu PDF. Usalos en las
            conexiones de abajo.
          </p>
          <div className="doc-mapeo-detectados-table-wrap">
            <table className="doc-mapeo-detectados-table">
              <thead>
                <tr>
                  <th>Título del campo (PDF)</th>
                  <th>Valor de ejemplo</th>
                </tr>
              </thead>
              <tbody>
                {campos.map((c, i) => (
                  <tr key={`${c.etiqueta}-${i}`}>
                    <td className="doc-mapeo-titulo">{c.etiqueta}</td>
                    <td className="doc-mapeo-valor">{c.valor_muestra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <h4>Conectar con el formulario de gasto</h4>
      <p className="muted doc-tipo-campos-hint">
        {campos.length > 0
          ? "Para cada campo del gasto, elegí qué título del documento lo completa."
          : "Subí un PDF de ejemplo para ver los títulos detectados, o elegí manualmente si ya conocés los nombres."}
      </p>

      <div className="doc-tipo-mapeo-grid">
        {GASTO_DESTINO_IDS.map((destino) => {
          const valor = mapeo[destino] ?? "";
          return (
            <div key={destino} className="doc-tipo-mapeo-row">
              <label className="doc-tipo-mapeo-destino" htmlFor={`mapeo-${destino}`}>
                {GASTO_DESTINO_LABELS[destino]}
              </label>
              <span className="doc-tipo-mapeo-flecha" aria-hidden>
                ←
              </span>
              <select
                id={`mapeo-${destino}`}
                className="doc-tipo-mapeo-select"
                value={valor}
                onChange={(e) => setMapeo(destino, e.target.value)}
              >
                <option value="">No completar</option>
                {titulosDisponibles.map((etiqueta) => (
                  <option key={etiqueta} value={etiqueta}>
                    {etiqueta}
                    {valorMuestra(etiqueta) ? ` — ${valorMuestra(etiqueta)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
