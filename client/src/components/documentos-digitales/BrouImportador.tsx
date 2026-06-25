import { useRef, useState } from "react";
import { parseBrouTransferenciaDocument } from "../../api";
import type { BrouTransferenciaParsed } from "../../types";
import { formatBrouImporte } from "../../utils/brou-gasto";

import type { GastoMapeoCampos } from "../../utils/gasto-campos";

interface Props {
  apiOnline: boolean;
  mapeo?: GastoMapeoCampos;
  mapeoComision?: GastoMapeoCampos;
  onError: (msg: string) => void;
  onApplied: (data: BrouTransferenciaParsed) => void;
  onArchivo?: (archivo: File | null) => void;
  archivoAdjunto?: File | null;
}

export default function BrouImportador({
  apiOnline,
  mapeo,
  mapeoComision,
  onError,
  onApplied,
  onArchivo,
  archivoAdjunto,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BrouTransferenciaParsed | null>(null);
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
      const data = await parseBrouTransferenciaDocument(file, mapeo, mapeoComision);
      setPreview(data);
      onApplied(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo leer el comprobante";
      if (/no parece un comprobante brou/i.test(msg)) {
        setAviso(
          "No se detectó transferencia BROU. Podés completar el gasto manualmente; el comprobante se guardará al confirmar."
        );
        return;
      }
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
          {loading ? "Detectando comprobante BROU…" : "Subir comprobante (opcional)"}
        </p>
        <p className="muted brou-import-drop-hint">
          PDF o imagen del comprobante. Si es BROU, el sistema completa los datos automáticamente.
          El archivo queda adjunto a la operación y podés verlo desde la tabla de gastos.
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

      {preview && !loading && (
        <div className="brou-import-preview" aria-live="polite">
          <p className="brou-import-preview-ok">Datos detectados y aplicados al formulario</p>
          <dl className="brou-import-preview-grid">
            <div>
              <dt>N° operación</dt>
              <dd>{preview.numero_operacion}</dd>
            </div>
            <div>
              <dt>N° transferencia</dt>
              <dd>{preview.numero_transferencia || "—"}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{preview.fecha}</dd>
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
                <dd>
                  {formatBrouImporte(preview.comision.moneda, preview.comision.valor)}
                </dd>
              </div>
            ) : null}
            {preview.beneficiario_nombre ? (
              <div className="span-2">
                <dt>Beneficiario</dt>
                <dd>{preview.beneficiario_nombre}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </div>
  );
}
