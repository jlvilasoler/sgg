import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  listStockEquinaDispositivoFotos,
  listStockGanaderaDispositivoFotos,
  marcarStockEquinaDispositivoFotoPrincipal,
  marcarStockGanaderaDispositivoFotoPrincipal,
  quitarStockEquinaDispositivoFoto,
  quitarStockGanaderaDispositivoFoto,
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
  disabled?: boolean;
  /** Solo muestra la galería, sin botones de edición. */
  soloLectura?: boolean;
  onChange: (meta: StockDispositivoFotoMeta) => void;
  onError: (msg: string) => void;
}

export default function StockDispositivoFotoCard({
  modulo,
  clave,
  disabled = false,
  soloLectura = false,
  onChange,
  onError,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [meta, setMeta] = useState<StockDispositivoFotoMeta>(emptyMeta);

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

  useEffect(() => {
    let cancel = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    setCargando(true);
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
        if (!cancel) setCargando(false);
      });
    return () => {
      cancel = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar solo al cambiar dispositivo
  }, [clave, modulo]);

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
    if (disabled || guardando || cargando) return;
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
          principal ? " stock-edit-foto-frame--filled" : ""
        }`}
      >
        {cargando ? (
          <div className="stock-edit-foto-placeholder">
            <span className="stock-edit-foto-placeholder-text">Cargando fotos…</span>
          </div>
        ) : principal ? (
          <img
            src={principal.url}
            alt="Foto principal del animal"
            className="stock-edit-foto-img"
            decoding="async"
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
                <div
                  className={`stock-edit-foto-thumb stock-edit-foto-thumb--static${
                    foto.es_principal ? " stock-edit-foto-thumb--principal" : ""
                  }`}
                  title={foto.es_principal ? "Foto principal" : undefined}
                >
                  <img src={foto.url} alt="" className="stock-edit-foto-thumb-img" />
                  {foto.es_principal ? (
                    <span className="stock-edit-foto-thumb-badge">Principal</span>
                  ) : null}
                </div>
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
                    <img src={foto.url} alt="" className="stock-edit-foto-thumb-img" />
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
              disabled={disabled || guardando || cargando || meta.fotos.length >= MAX_FOTOS}
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
