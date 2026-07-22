import { useEffect, useId, useRef, useState } from "react";
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

const ARU_ARBOL_BASE = "https://aru.org.uy/rrgg/arbol.php";

/** Armado inmediato del árbol cuando hay registro (sin esperar a ARU). */
function arbolUrlRapido(registro: string): string {
  const qs = new URLSearchParams({
    IdSesion: "",
    idFiltro: "R",
    id: registro.trim(),
    idE: "3",
    idR: "27",
  });
  return `${ARU_ARBOL_BASE}?${qs.toString()}`;
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
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Preparando árbol…");
  const [arbolUrl, setArbolUrl] = useState<string | null>(null);
  const [animalLabel, setAnimalLabel] = useState("");
  const [iframeError, setIframeError] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setIframeLoading(false);
      setStatusMsg("Preparando árbol…");
      setArbolUrl(null);
      setAnimalLabel("");
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
    setAnimalLabel([nom, reg, rpVal].filter(Boolean).join(" · "));

    // Camino rápido: con registro mostramos el árbol al instante.
    if (reg) {
      setArbolUrl(arbolUrlRapido(reg));
      setIframeLoading(true);
      setLoading(false);
      setStatusMsg("");
      return;
    }

    setLoading(true);
    setIframeLoading(false);
    setArbolUrl(null);
    setStatusMsg("Buscando el animal en ARU…");

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
        setArbolUrl(data.arbol_url);
        setIframeLoading(true);
        const label = [data.animal.nombre, data.animal.registro, data.animal.rp]
          .filter(Boolean)
          .join(" · ");
        if (label) setAnimalLabel(label);
        setLoading(false);
        setStatusMsg("");
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        const msg =
          e instanceof Error && e.name === "AbortError"
            ? "ARU tardó demasiado. Probá de nuevo o abrí el árbol en una pestaña."
            : e instanceof Error
              ? e.message
              : "No se pudo abrir el árbol en ARU";
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
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
        <header className="stock-aru-arbol-head">
          <div>
            <p className="stock-aru-arbol-kicker">Asociación Rural del Uruguay</p>
            <h2 id={titleId} className="stock-aru-arbol-title">
              Árbol genealógico
            </h2>
            {animalLabel ? (
              <p className="stock-aru-arbol-sub muted">{animalLabel}</p>
            ) : null}
          </div>
          <div className="stock-aru-arbol-head-actions">
            {arbolUrl ? (
              <a
                className="btn btn-secondary btn-sm"
                href={arbolUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en ARU
              </a>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>

        <div className="stock-aru-arbol-body">
          {localError ? (
            <div className="stock-aru-arbol-fallback">
              <p>{localError}</p>
              {arbolUrl ? (
                <a href={arbolUrl} target="_blank" rel="noopener noreferrer">
                  Abrir árbol en ARU
                </a>
              ) : null}
            </div>
          ) : loading ? (
            <p className="stock-aru-arbol-status muted">{statusMsg}</p>
          ) : arbolUrl ? (
            iframeError ? (
              <div className="stock-aru-arbol-fallback">
                <p>No se pudo embeber el árbol. Abrilo en ARU:</p>
                <a href={arbolUrl} target="_blank" rel="noopener noreferrer">
                  {arbolUrl}
                </a>
              </div>
            ) : (
              <>
                {iframeLoading ? (
                  <p className="stock-aru-arbol-status stock-aru-arbol-status--overlay muted">
                    Cargando árbol de ARU…
                  </p>
                ) : null}
                <iframe
                  className="stock-aru-arbol-iframe"
                  title="Árbol genealógico ARU"
                  src={arbolUrl}
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => setIframeLoading(false)}
                  onError={() => {
                    setIframeLoading(false);
                    setIframeError(true);
                  }}
                />
              </>
            )
          ) : (
            <p className="stock-aru-arbol-status muted">Sin URL de árbol.</p>
          )}
        </div>
      </div>
    </div>
  );
}
