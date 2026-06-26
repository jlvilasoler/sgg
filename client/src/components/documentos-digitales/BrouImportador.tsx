import { useRef, useState } from "react";
import { leerComprobante } from "../../api";
import type { ComprobanteLeido } from "../../types";
import { formatBrouImporte } from "../../utils/brou-gasto";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onApplied: (data: ComprobanteLeido) => void;
  onArchivo?: (archivo: File | null) => void;
  archivoAdjunto?: File | null;
}

export default function BrouImportador({
  apiOnline,
  onError,
  onApplied,
  onArchivo,
  archivoAdjunto,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ComprobanteLeido | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const procesarArchivo = async (file: File) => {
    if (!apiOnline) {
      onError("Sin conexión con la API");
      return;
    }
    setLoading(true);
    setPreview(null);
    setAviso(null);
    onArchivo?.(file);
    try {
      const data = await leerComprobante(file);
      const huboDatos =
        Boolean(data.tipo_detectado) ||
        data.es_brou ||
        Boolean(data.valores_mapeo && Object.keys(data.valores_mapeo).length > 0);
      if (!huboDatos) {
        setAviso(
          "No se reconoció el banco del comprobante. Completá el gasto manualmente; el archivo se guardará igual al confirmar."
        );
      }
      setPreview(data);
      onApplied(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo leer el comprobante";
      setAviso(
        "No se pudieron leer los datos del comprobante. El archivo se guardará igual al confirmar el gasto."
      );
      onError(msg);
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

  const tipo = preview?.tipo_detectado ?? null;
  const valoresMapeo = preview?.valores_mapeo ?? {};
  const camposDetectados = Object.entries(valoresMapeo).filter(([, v]) => Boolean(v?.trim?.()));

  return (
    <div className="brou-import-block">
      <div
        className={`brou-import-drop${loading ? " brou-import-drop--busy" : ""}`}
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
        <div className="brou-import-drop-icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
            <path
              d="M12 16V6m0 0l-3.5 3.5M12 6l3.5 3.5M5 18h14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="brou-import-drop-title">
          {loading ? "Leyendo comprobante…" : "Subir comprobante (opcional)"}
        </p>
        <p className="muted brou-import-drop-hint">
          PDF o imagen del comprobante. El sistema reconoce el banco y completa los datos
          automáticamente. El archivo queda adjunto a la operación y podés verlo desde la tabla de
          gastos.
        </p>
      </div>

      {archivoAdjunto && !loading ? (
        <p className="brou-import-archivo-adjunto" role="status">
          <span className="brou-import-archivo-adjunto-icon" aria-hidden>
            📎
          </span>
          Comprobante listo para guardar: <strong>{archivoAdjunto.name}</strong>
        </p>
      ) : null}

      {aviso && !loading && (
        <p className="brou-import-aviso muted" role="status">
          {aviso}
        </p>
      )}

      {preview && !loading && (tipo || preview.es_brou) && (
        <div className="brou-import-preview" aria-live="polite">
          <p className="brou-import-preview-ok">
            {tipo ? (
              <>
                Detectado: <strong>{tipo.nombre}</strong>
                {tipo.origen ? (
                  <span className="brou-import-preview-ruta">
                    {" "}
                    ({tipo.origen}
                    {tipo.destino ? ` → ${tipo.destino}` : ""})
                  </span>
                ) : null}
              </>
            ) : (
              "Transferencia BROU detectada"
            )}
          </p>
          <dl className="brou-import-preview-grid">
            {preview.es_brou ? (
              <>
                <div>
                  <dt>N° operación</dt>
                  <dd>{preview.numero_operacion || "—"}</dd>
                </div>
                <div>
                  <dt>N° transferencia</dt>
                  <dd>{preview.numero_transferencia || "—"}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{preview.fecha || "—"}</dd>
                </div>
                <div>
                  <dt>Importe acreditado</dt>
                  <dd>
                    {formatBrouImporte(
                      preview.importe_acreditar.moneda,
                      preview.importe_acreditar.valor
                    )}
                  </dd>
                </div>
                {preview.comision ? (
                  <div>
                    <dt>Comisión (operación aparte)</dt>
                    <dd>{formatBrouImporte(preview.comision.moneda, preview.comision.valor)}</dd>
                  </div>
                ) : null}
                {preview.beneficiario_nombre ? (
                  <div className="span-2">
                    <dt>Beneficiario</dt>
                    <dd>{preview.beneficiario_nombre}</dd>
                  </div>
                ) : null}
              </>
            ) : camposDetectados.length > 0 ? (
              camposDetectados.map(([campo, valor]) => (
                <div key={campo}>
                  <dt>{campo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))
            ) : (
              <div className="span-2">
                <dd className="muted">
                  Banco reconocido, pero no se encontraron campos para completar. Revisá el mapeo del
                  tipo de documento.
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
