import { useEffect, useState } from "react";
import { fetchPresupuestoDocumentoBlob, presupuestoDocumentoUrl } from "../api";
import type { Presupuesto, PresupuestoDocumentoAdjunto } from "../types";
import { IconCancelar, IconDescargar, IconDocumento } from "./icons/ActionIcons";

interface Props {
  row: Presupuesto;
  documento: PresupuestoDocumentoAdjunto;
  onClose: () => void;
}

export default function PresupuestoDocumentoModal({ row, documento, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await fetchPresupuestoDocumentoBlob(row.id);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "No se pudo cargar el documento");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [row.id]);

  const esPdf = documento.mime === "application/pdf" || /\.pdf$/i.test(documento.nombre);
  const esImagen = documento.mime.startsWith("image/");

  return (
    <div
      className="pd-overlay presupuesto-doc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="presupuesto-doc-modal-title"
      onClick={onClose}
    >
      <div className="pd-dialog presupuesto-doc-modal" onClick={(e) => e.stopPropagation()}>
        <header className="presupuesto-doc-modal-head">
          <div className="presupuesto-doc-modal-head-main">
            <span className="presupuesto-doc-modal-icon" aria-hidden>
              <IconDocumento size={20} />
            </span>
            <div className="presupuesto-doc-modal-titles">
              <p className="presupuesto-doc-modal-kicker">Comprobante adjunto</p>
              <h2 id="presupuesto-doc-modal-title" className="presupuesto-doc-modal-title">
                Operación N° {row.nro_registro}
              </h2>
              <p className="presupuesto-doc-modal-sub" title={documento.nombre}>
                {documento.nombre}
              </p>
            </div>
          </div>
          <div className="presupuesto-doc-modal-actions">
            <a
              className="btn btn-icon-only presupuesto-doc-modal-download"
              href={presupuestoDocumentoUrl(row.id, true)}
              download={documento.nombre}
              target="_blank"
              rel="noopener noreferrer"
              title="Descargar comprobante"
              aria-label="Descargar comprobante"
            >
              <IconDescargar size={18} />
            </a>
            <button
              type="button"
              className="btn btn-icon-only presupuesto-doc-modal-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <IconCancelar size={18} />
            </button>
          </div>
        </header>

        <div className="presupuesto-doc-modal-body">
          {loading ? (
            <p className="muted presupuesto-doc-modal-status">Cargando documento…</p>
          ) : error ? (
            <p className="presupuesto-doc-modal-error" role="alert">
              {error}
            </p>
          ) : blobUrl && esPdf ? (
            <iframe
              className="presupuesto-doc-modal-frame"
              src={blobUrl}
              title={documento.nombre}
            />
          ) : blobUrl && esImagen ? (
            <img
              className="presupuesto-doc-modal-image"
              src={blobUrl}
              alt={documento.nombre}
            />
          ) : blobUrl ? (
            <div className="presupuesto-doc-modal-fallback">
              <p className="muted">Vista previa no disponible para este formato.</p>
              <a
                className="btn btn-primary"
                href={presupuestoDocumentoUrl(row.id, true)}
                download={documento.nombre}
              >
                Descargar archivo
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
