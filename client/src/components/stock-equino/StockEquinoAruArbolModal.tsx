import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PedigreeTreeIcon from "./PedigreeTreeIcon";
import { resolverAruArbolEquino } from "../../api";

interface Props {
  open: boolean;
  onClose: () => void;
  registro: string;
  rp: string;
  nombre: string;
  sexo?: string;
  onError: (msg: string) => void;
}

function embedDesdeRegistro(registro: string, raza = "27"): string {
  const qs = new URLSearchParams({
    registro: registro.trim(),
    raza,
  });
  return `/api/stock-equino/aru/arbol-embed?${qs.toString()}`;
}

export default function StockEquinoAruArbolModal({
  open,
  onClose,
  registro,
  rp,
  nombre,
  sexo,
  onError,
}: Props) {
  const titleId = useId();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Preparando árbol…");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [animalNombre, setAnimalNombre] = useState("");
  const [iframeError, setIframeError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setIframeLoading(false);
      setStatusMsg("Preparando árbol…");
      setEmbedUrl(null);
      setAnimalNombre("");
      setIframeError(false);
      setLocalError(null);
      return;
    }

    const reqId = ++requestIdRef.current;
    const reg = registro.trim();
    const nom = nombre.trim();
    const rpVal = rp.trim();

    setIframeError(false);
    setLocalError(null);
    setAnimalNombre(nom);

    if (reg) {
      setEmbedUrl(embedDesdeRegistro(reg));
      setIframeLoading(true);
      setLoading(false);
      setStatusMsg("");
      return;
    }

    setLoading(true);
    setIframeLoading(false);
    setEmbedUrl(null);
    setStatusMsg("Buscando en el registro genealógico…");

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25_000);

    void (async () => {
      try {
        const data = await resolverAruArbolEquino({
          registro: reg,
          rp: rpVal,
          nombre: nom,
          sexo: (sexo as "MACHO" | "HEMBRA" | undefined) ?? "I",
        });
        if (reqId !== requestIdRef.current) return;
        setEmbedUrl(data.embed_path);
        setIframeLoading(true);
        if (data.animal.nombre?.trim()) setAnimalNombre(data.animal.nombre.trim());
        setLoading(false);
        setStatusMsg("");
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        const msg =
          e instanceof Error && e.name === "AbortError"
            ? "El registro genealógico tardó demasiado. Probá de nuevo."
            : e instanceof Error
              ? e.message
              : "No se pudo abrir el árbol genealógico";
        setLocalError(msg);
        setLoading(false);
        setIframeLoading(false);
        onError(msg);
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, registro, rp, nombre, sexo]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; animalNombre?: string } | null;
      if (!data || data.type !== "scg-aru-arbol") return;
      const n = String(data.animalNombre ?? "").trim();
      if (n) setAnimalNombre(n);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("message", onMsg);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("message", onMsg);
    };
  }, [open, onClose]);

  if (!open) return null;

  const reg = registro.trim();
  const rpVal = rp.trim();
  const nombreBase = nombre.trim();
  const showingOriginal =
    !animalNombre ||
    animalNombre.localeCompare(nombreBase, "es", { sensitivity: "accent" }) === 0;
  const canPrint = Boolean(embedUrl && !iframeError && !loading);

  const imprimir = () => {
    try {
      iframeRef.current?.contentWindow?.print();
    } catch {
      /* ignore */
    }
  };

  return createPortal(
    <div
      className="stock-aru-arbol-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="stock-aru-arbol-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="stock-aru-arbol-accent" aria-hidden />

        <header className="stock-aru-arbol-head">
          <div className="stock-aru-arbol-head-brand">
            <span className="stock-aru-arbol-head-icon" aria-hidden>
              <PedigreeTreeIcon size={22} />
            </span>
            <div className="stock-aru-arbol-head-copy">
              <p className="stock-aru-arbol-eyebrow">Pedigree · Cabaña</p>
              <h2 id={titleId} className="stock-aru-arbol-title">
                Árbol genealógico
              </h2>
              {animalNombre ? (
                <p className="stock-aru-arbol-animal">{animalNombre}</p>
              ) : null}
              {(showingOriginal && (reg || rpVal)) && (
                <div className="stock-aru-arbol-meta" aria-label="Identificadores">
                  {reg ? <span className="stock-aru-arbol-chip">REG {reg}</span> : null}
                  {rpVal ? <span className="stock-aru-arbol-chip">RP {rpVal}</span> : null}
                </div>
              )}
            </div>
          </div>
          <div className="stock-aru-arbol-head-actions">
            {canPrint ? (
              <button
                type="button"
                className="stock-aru-arbol-cta stock-aru-arbol-cta--ghost"
                onClick={imprimir}
              >
                Imprimir
              </button>
            ) : null}
            <button
              type="button"
              className="stock-aru-arbol-close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </header>

        <div className="stock-aru-arbol-workspace">
          <div className="stock-aru-arbol-box">
            {localError ? (
              <div className="stock-aru-arbol-fallback">
                <p>{localError}</p>
              </div>
            ) : loading ? (
              <div className="stock-aru-arbol-status">
                <span className="stock-aru-arbol-spinner" aria-hidden />
                <span>{statusMsg}</span>
              </div>
            ) : embedUrl ? (
              iframeError ? (
                <div className="stock-aru-arbol-fallback">
                  <p>No se pudo mostrar el árbol genealógico. Probá de nuevo más tarde.</p>
                </div>
              ) : (
                <>
                  {iframeLoading ? (
                    <div className="stock-aru-arbol-status stock-aru-arbol-status--overlay">
                      <span className="stock-aru-arbol-spinner" aria-hidden />
                      <span>Cargando árbol…</span>
                    </div>
                  ) : null}
                  <iframe
                    ref={iframeRef}
                    className="stock-aru-arbol-iframe"
                    title="Árbol genealógico"
                    src={embedUrl}
                    referrerPolicy="no-referrer"
                    onLoad={() => setIframeLoading(false)}
                    onError={() => {
                      setIframeLoading(false);
                      setIframeError(true);
                    }}
                  />
                </>
              )
            ) : (
              <p className="stock-aru-arbol-status">Sin datos de árbol.</p>
            )}
          </div>

          {!localError && !iframeError && embedUrl ? (
            <p className="stock-aru-arbol-hint">
              Desplazá hacia abajo si hace falta · hacé clic en un ancestro para abrir su línea.
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
