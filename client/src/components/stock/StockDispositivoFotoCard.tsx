import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  listStockEquinaDispositivoFotos,
  listStockGanaderaDispositivoFotos,
  marcarStockEquinaDispositivoFotoPrincipal,
  marcarStockGanaderaDispositivoFotoPrincipal,
  quitarStockEquinaDispositivoFoto,
  quitarStockGanaderaDispositivoFoto,
  stockFotoThumbUrl,
  subirStockEquinaDispositivoFoto,
  subirStockGanaderaDispositivoFoto,
  type StockDispositivoFotoMeta,
} from "../../api";

const FOTO_TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FOTO_MB = 4;
const MAX_FOTOS = 20;

const emptyMeta = (): StockDispositivoFotoMeta => ({
  tiene_foto: false,
  foto_url: null,
  foto_actualizado_en: "",
  foto_principal_id: null,
  fotos: [],
});

interface Props {
  modulo: "ganadero" | "equino";
  clave: string;
  /** Metadatos ya conocidos (p. ej. desde la fila del stock). */
  initialMeta?: StockDispositivoFotoMeta | null;
  disabled?: boolean;
  /** Solo muestra la galería, sin botones de edición. */
  soloLectura?: boolean;
  onChange: (meta: StockDispositivoFotoMeta) => void;
  onError: (msg: string) => void;
}

export { stockFotoMetaFromDispositivo } from "../../api";
export default function StockDispositivoFotoCard({
  modulo,
  clave,
  initialMeta = null,
  disabled = false,
  soloLectura = false,
  onChange,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [guardando, setGuardando] = useState(false);
  const [syncing, setSyncing] = useState(() => !initialMeta?.foto_url);
  const [meta, setMeta] = useState<StockDispositivoFotoMeta>(
    () => initialMeta ?? emptyMeta()
  );

  const subir =
    modulo === "ganadero"
      ? subirStockGanaderaDispositivoFoto
      : subirStockEquinaDispositivoFoto;
  const quitar =
    modulo === "ganadero"
      ? quitarStockGanaderaDispositivoFoto
      : quitarStockEquinaDispositivoFoto;
  const marcarPrincipal =
    modulo === "ganadero"
      ? marcarStockGanaderaDispositivoFotoPrincipal
      : marcarStockEquinaDispositivoFotoPrincipal;

  const principal =
    meta.fotos.find((f) => f.es_principal) ??
    meta.fotos.find((f) => f.id === meta.foto_principal_id) ??
    meta.fotos[0] ??
    null;

  const [vistaFotoId, setVistaFotoId] = useState<number | null>(null);

  const fotoMostrada =
    meta.fotos.find((f) => f.id === vistaFotoId) ?? principal;

  useEffect(() => {
    setVistaFotoId(null);
  }, [clave]);

  useEffect(() => {
    if (vistaFotoId !== null && !meta.fotos.some((f) => f.id === vistaFotoId)) {
      setVistaFotoId(null);
    }
  }, [meta.fotos, vistaFotoId]);

  useEffect(() => {
    let cancel = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    setMeta(initialMeta ?? emptyMeta());
    setSyncing(!initialMeta?.foto_url);
    const load =
      modulo === "ganadero"
        ? listStockGanaderaDispositivoFotos
        : listStockEquinaDispositivoFotos;
    void load(clave, controller.signal)
      .then((data) => {
        if (cancel) return;
        setMeta(data);
      })
      .catch((err) => {
        if (cancel) return;
        if (initialMeta?.foto_url) {
          // Mantener vista previa del listado si falla la galería completa.
          return;
        }
        const msg =
          err instanceof Error && err.name === "AbortError"
            ? "Tiempo de espera agotado al cargar fotos"
            : err instanceof Error
              ? err.message
              : "Error al cargar fotos";
        onError(msg);
        setMeta(emptyMeta());
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancel) setSyncing(false);
      });
    return () => {
      cancel = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar solo al cambiar dispositivo
  }, [clave, modulo, initialMeta?.foto_url]);

  useEffect(() => {
    if (!meta.fotos.length) return;
    for (const foto of meta.fotos) {
      const preload = new Image();
      preload.decoding = "async";
      preload.src = foto.url;
    }
  }, [meta.fotos]);

  const applyMeta = (next: StockDispositivoFotoMeta) => {
    setMeta(next);
    onChange(next);
  };

  const validateFile = (file: File): string | null => {
    if (!FOTO_TIPOS.includes(file.type)) {
      return "Formato no permitido. Usá JPG, PNG, WebP o GIF.";
    }
    if (file.size > MAX_FOTO_MB * 1024 * 1024) {
      return `La imagen no puede superar ${MAX_FOTO_MB} MB`;
    }
    return null;
  };

  const handlePick = () => {
    if (disabled || guardando || syncing) return;
    inputRef.current?.click();
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;

    if (meta.fotos.length + files.length > MAX_FOTOS) {
      onError(`Máximo ${MAX_FOTOS} fotos por animal`);
      return;
    }

    setGuardando(true);
    try {
      let next = meta;
      for (const file of files) {
        const err = validateFile(file);
        if (err) {
          onError(err);
          continue;
        }
        next = await subir(clave, file);
      }
      applyMeta(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setGuardando(false);
    }
  };

  const handlePrincipal = async (fotoId: number) => {
    if (disabled || guardando || principal?.id === fotoId) return;
    setGuardando(true);
    try {
      const next = await marcarPrincipal(clave, fotoId);
      applyMeta(next);
      setVistaFotoId(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al elegir foto principal");
    } finally {
      setGuardando(false);
    }
  };

  const handleQuitar = async (fotoId: number) => {
    if (disabled || guardando) return;
    setGuardando(true);
    try {
      const next = await quitar(clave, fotoId);
      applyMeta(next);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al quitar foto");
    } finally {
      setGuardando(false);
    }
  };

  const showMainLoader = syncing && !fotoMostrada;

  return (
    <div
      className={`stock-edit-foto-card${
        soloLectura ? " stock-edit-foto-card--solo-lectura" : ""
      }`}
      aria-label="Foto del animal"
    >
      <h4 className="stock-edit-foto-title">Foto del animal</h4>
      <div
        className={`stock-edit-foto-frame${
          fotoMostrada ? " stock-edit-foto-frame--filled" : ""
        }`}
      >
        {showMainLoader ? (
          <div className="stock-edit-foto-placeholder">
            <span className="stock-edit-foto-placeholder-text">Cargando fotos…</span>
          </div>
        ) : fotoMostrada ? (
          <img
            key={fotoMostrada.id}
            src={fotoMostrada.url}
            alt="Foto del animal"
            className="stock-edit-foto-img"
            decoding="async"
            loading="eager"
            fetchPriority="high"
          />
        ) : (
          <div className="stock-edit-foto-placeholder">
            <span className="stock-edit-foto-placeholder-icon" aria-hidden>
              📷
            </span>
            <span className="stock-edit-foto-placeholder-text">
              Sin foto cargada
            </span>
          </div>
        )}
      </div>

      {meta.fotos.length > 0 ? (
        <div
          className="stock-edit-foto-thumbs"
          role="list"
          aria-label="Galería de fotos del animal"
        >
          {meta.fotos.map((foto) => (
            <div key={foto.id} className="stock-edit-foto-thumb-wrap" role="listitem">
              {soloLectura ? (
                <button
                  type="button"
                  className={`stock-edit-foto-thumb stock-edit-foto-thumb--preview${
                    foto.es_principal ? " stock-edit-foto-thumb--principal" : ""
                  }${fotoMostrada?.id === foto.id ? " stock-edit-foto-thumb--activa" : ""}`}
                  onClick={() => setVistaFotoId(foto.id)}
                  title={
                    foto.es_principal
                      ? "Foto principal"
                      : "Ver esta foto"
                  }
                  aria-label={
                    foto.es_principal
                      ? "Ver foto principal"
                      : "Ver esta foto en grande"
                  }
                  aria-pressed={fotoMostrada?.id === foto.id}
                >
                  <img
                    src={stockFotoThumbUrl(foto)}
                    alt=""
                    className="stock-edit-foto-thumb-img"
                    decoding="async"
                    loading="eager"
                  />
                  {foto.es_principal ? (
                    <span className="stock-edit-foto-thumb-badge">Principal</span>
                  ) : null}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`stock-edit-foto-thumb${
                      foto.es_principal ? " stock-edit-foto-thumb--principal" : ""
                    }`}
                    onClick={() => void handlePrincipal(foto.id)}
                    disabled={disabled || guardando}
                    title={
                      foto.es_principal
                        ? "Foto principal"
                        : "Usar como foto principal"
                    }
                    aria-label={
                      foto.es_principal
                        ? "Foto principal"
                        : "Marcar como foto principal"
                    }
                    aria-pressed={foto.es_principal}
                  >
                    <img
                      src={stockFotoThumbUrl(foto)}
                      alt=""
                      className="stock-edit-foto-thumb-img"
                      decoding="async"
                      loading="eager"
                    />
                    {foto.es_principal ? (
                      <span className="stock-edit-foto-thumb-badge">Principal</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="stock-edit-foto-thumb-remove"
                    onClick={() => void handleQuitar(foto.id)}
                    disabled={disabled || guardando}
                    title="Quitar foto"
                    aria-label="Quitar foto"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!soloLectura ? (
        <>
          <div className="stock-edit-foto-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePick}
              disabled={disabled || guardando || syncing || meta.fotos.length >= MAX_FOTOS}
            >
              {guardando
                ? "Guardando…"
                : meta.fotos.length
                  ? "Agregar foto"
                  : "Subir foto"}
            </button>
            {principal ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleQuitar(principal.id)}
                disabled={disabled || guardando}
              >
                Quitar principal
              </button>
            ) : null}
          </div>
          <p className="stock-edit-foto-hint muted">
            JPG, PNG, WebP o GIF · máx. {MAX_FOTO_MB} MB · hasta {MAX_FOTOS} fotos
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={FOTO_TIPOS.join(",")}
            multiple
            className="stock-edit-foto-input"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => void handleFiles(e)}
          />
        </>
      ) : null}
    </div>
  );
}
