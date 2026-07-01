import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, FileText, FlaskConical, ImageIcon, Pencil, PillBottle, X } from "lucide-react";
import {
  fetchStockControlSanitarioProductoFicha,
  saveStockControlSanitarioProductoFicha,
  type StockDispositivoModulo,
} from "../../api";
import type { StockControlSanitarioProductoFichaInput } from "../../types";
import {
  buscarMarcaCatalogo,
  formatMarcaPaises,
} from "./stock-control-sanitario-marcas";
import { sanitizeProductoFichaFoto } from "./stock-producto-ficha-foto";

const MAX_FOTO_BYTES = 450_000;

function AutoResizeTextarea({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
  className = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      id={id}
      rows={1}
      maxLength={maxLength}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        requestAnimationFrame(syncHeight);
      }}
    />
  );
}

function FotoProductoPlaceholder() {
  return (
    <div className="stock-edit-foto-placeholder stock-producto-ficha-foto-placeholder">
      <span className="stock-edit-foto-placeholder-icon" aria-hidden>
        <svg viewBox="0 0 24 24" focusable="false">
          <path
            d="M9 3h6l1 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l1-2Zm3 16a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="stock-edit-foto-placeholder-text" role="status">
        No hay foto disponible
      </span>
    </div>
  );
}

export interface ProductoFichaFormState {
  laboratorio: string;
  principio_activo: string;
  presentacion: string;
  via_administracion: string;
  especie: string;
  tiempo_espera_carne: string;
  tiempo_espera_leche: string;
  detalles_tecnicos: string;
  caracteristicas: string;
  foto_data: string;
}

function emptyForm(): ProductoFichaFormState {
  return {
    laboratorio: "",
    principio_activo: "",
    presentacion: "",
    via_administracion: "",
    especie: "Bovinos",
    tiempo_espera_carne: "",
    tiempo_espera_leche: "",
    detalles_tecnicos: "",
    caracteristicas: "",
    foto_data: "",
  };
}

function formFromApi(
  data: Partial<ProductoFichaFormState> | null,
  nombre: string
): ProductoFichaFormState {
  const base = emptyForm();
  const catalogo = buscarMarcaCatalogo(nombre);
  if (!data) {
    if (catalogo) {
      base.caracteristicas = `Comercialización habitual: ${formatMarcaPaises(catalogo.paises)}.`;
    }
    return base;
  }
  return {
    laboratorio: data.laboratorio ?? "",
    principio_activo: data.principio_activo ?? "",
    presentacion: data.presentacion ?? "",
    via_administracion: data.via_administracion ?? "",
    especie: data.especie ?? base.especie,
    tiempo_espera_carne: data.tiempo_espera_carne ?? "",
    tiempo_espera_leche: data.tiempo_espera_leche ?? "",
    detalles_tecnicos: data.detalles_tecnicos ?? "",
    caracteristicas: data.caracteristicas ?? "",
    foto_data: sanitizeProductoFichaFoto(data.foto_data ?? ""),
  };
}

function formToInput(nombre: string, form: ProductoFichaFormState): StockControlSanitarioProductoFichaInput {
  return {
    nombre,
    ...form,
  };
}

interface Props {
  open: boolean;
  nombre: string;
  modulo: StockDispositivoModulo;
  apiOnline: boolean;
  onClose: () => void;
  onError: (msg: string) => void;
  onSaved?: (msg: string) => void;
  /** Abre directamente en modo edición (p. ej. panel de configuración). */
  initialEdit?: boolean;
}

export default function StockControlSanitarioProductoFichaModal({
  open,
  nombre,
  modulo,
  apiOnline,
  onClose,
  onError,
  onSaved,
  initialEdit = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<ProductoFichaFormState>(() => emptyForm());
  const [actualizadoEn, setActualizadoEn] = useState("");
  const [fotoCargada, setFotoCargada] = useState(true);

  const titulo = nombre.trim() || "Producto";
  const fotoMostrar = useMemo(() => sanitizeProductoFichaFoto(form.foto_data), [form.foto_data]);

  const load = useCallback(async () => {
    if (!open || !nombre.trim()) return;
    if (!apiOnline) {
      setForm(formFromApi(null, nombre));
      setActualizadoEn("");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockControlSanitarioProductoFicha(modulo, nombre);
      setForm(formFromApi(data, nombre));
      setActualizadoEn(data?.actualizado_en ?? "");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar ficha del producto");
      setForm(formFromApi(null, nombre));
      setActualizadoEn("");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, modulo, nombre, onError, open]);

  useEffect(() => {
    if (!open) return;
    setEditando(initialEdit);
    void load();
  }, [open, load, initialEdit]);

  useEffect(() => {
    setFotoCargada(true);
  }, [fotoMostrar]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !guardando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, guardando, onClose]);

  const patch = (patchForm: Partial<ProductoFichaFormState>) => {
    setForm((prev) => ({ ...prev, ...patchForm }));
  };

  const onFotoChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Seleccioná una imagen (JPG, PNG o WebP).");
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      onError("La imagen es muy pesada (máx. ~450 KB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      patch({ foto_data: result });
    };
    reader.onerror = () => onError("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    setGuardando(true);
    try {
      const data = await saveStockControlSanitarioProductoFicha(
        modulo,
        formToInput(nombre, form)
      );
      setForm(formFromApi(data, nombre));
      setActualizadoEn(data.actualizado_en);
      setEditando(false);
      onSaved?.("Ficha del producto guardada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar ficha del producto");
    } finally {
      setGuardando(false);
    }
  };

  const metaActualizacion = useMemo(() => {
    if (!actualizadoEn) return null;
    const d = new Date(actualizadoEn.includes("T") ? actualizadoEn : actualizadoEn.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("es-UY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [actualizadoEn]);

  if (!open || !nombre.trim()) return null;

  return createPortal(
    <div
      className="stock-control-sanitario-overlay stock-producto-ficha-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-producto-ficha-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) onClose();
      }}
    >
      <div className="stock-producto-ficha-modal">
        <div className="stock-producto-ficha-accent" aria-hidden />
        <header className="stock-producto-ficha-head">
          <div className="stock-producto-ficha-head-brand">
            <span className="stock-producto-ficha-head-icon" aria-hidden>
              <PillBottle size={26} strokeWidth={2} />
            </span>
            <div className="stock-producto-ficha-head-copy">
              <p className="stock-producto-ficha-kicker">Ficha del producto</p>
              <h2 id="stock-producto-ficha-title">{titulo}</h2>
              <div className="stock-producto-ficha-head-meta">
                {String(form.especie ?? "").trim() ? (
                  <span className="stock-producto-ficha-badge">{String(form.especie ?? "").trim()}</span>
                ) : null}
                {metaActualizacion ? (
                  <span className="stock-producto-ficha-meta muted">
                    Actualizado {metaActualizacion}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="stock-producto-ficha-head-actions">
            {editando ? (
              <>
                <button
                  type="button"
                  className="stock-producto-ficha-btn-ghost"
                  disabled={guardando}
                  onClick={() => {
                    setEditando(false);
                    void load();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="stock-producto-ficha-btn-save"
                  disabled={guardando || !apiOnline}
                  onClick={() => void guardar()}
                >
                  {guardando ? "Guardando…" : "Guardar ficha"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="stock-producto-ficha-btn-edit"
                disabled={loading || guardando}
                onClick={() => setEditando(true)}
              >
                <Pencil size={15} aria-hidden />
                Editar ficha
              </button>
            )}
            <button
              type="button"
              className="stock-producto-ficha-close"
              disabled={guardando}
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="stock-producto-ficha-loading" aria-busy="true">
            <div className="stock-producto-ficha-loading-pulse" />
            <p className="muted">Cargando ficha técnica…</p>
          </div>
        ) : (
          <div className="stock-producto-ficha-body">
            <div className="stock-producto-ficha-body-top">
              <section className="stock-producto-ficha-col stock-producto-ficha-col--tecnico">
                <div className="stock-producto-ficha-section-head">
                  <span className="stock-producto-ficha-section-icon" aria-hidden>
                    <FlaskConical size={16} strokeWidth={2.25} />
                  </span>
                  <h3 className="stock-producto-ficha-col-title">Detalle técnico</h3>
                </div>

                <div className="stock-producto-ficha-foto-card">
                <div className="stock-producto-ficha-foto-frame">
                  {fotoMostrar && fotoCargada ? (
                    <img
                      src={fotoMostrar}
                      alt={`Foto de ${titulo}`}
                      className="stock-producto-ficha-foto"
                      onError={() => setFotoCargada(false)}
                    />
                  ) : (
                    <FotoProductoPlaceholder />
                  )}
                  {editando ? (
                    <div className="stock-producto-ficha-foto-actions stock-producto-ficha-foto-actions--overlay">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        onChange={(e) => onFotoChange(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        className="stock-producto-ficha-btn-soft"
                        onClick={() => fileRef.current?.click()}
                      >
                        <ImageIcon size={14} aria-hidden />
                        {fotoMostrar ? "Cambiar foto" : "Subir foto"}
                      </button>
                      {fotoMostrar ? (
                        <button
                          type="button"
                          className="stock-producto-ficha-btn-soft stock-producto-ficha-btn-soft--muted"
                          onClick={() => patch({ foto_data: "" })}
                        >
                          Quitar
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="stock-producto-ficha-spec-grid">
                <Campo
                  label="Laboratorio"
                  value={form.laboratorio}
                  editando={editando}
                  onChange={(v) => patch({ laboratorio: v })}
                />
                <Campo
                  label="Principio activo"
                  value={form.principio_activo}
                  editando={editando}
                  onChange={(v) => patch({ principio_activo: v })}
                />
                <Campo
                  label="Presentación"
                  value={form.presentacion}
                  editando={editando}
                  onChange={(v) => patch({ presentacion: v })}
                />
                <Campo
                  label="Vía de administración"
                  value={form.via_administracion}
                  editando={editando}
                  onChange={(v) => patch({ via_administracion: v })}
                />
                <Campo
                  label="Especie"
                  value={form.especie}
                  editando={editando}
                  onChange={(v) => patch({ especie: v })}
                  className="stock-producto-ficha-campo--wide"
                />
              </div>
              </section>

              <section className="stock-producto-ficha-col stock-producto-ficha-col--caracteristicas">
              <div className="stock-producto-ficha-section-head">
                <span className="stock-producto-ficha-section-icon stock-producto-ficha-section-icon--alt" aria-hidden>
                  <Clock size={16} strokeWidth={2.25} />
                </span>
                <h3 className="stock-producto-ficha-col-title">Características</h3>
              </div>

              <div className="stock-producto-ficha-espera-grid">
                <CampoEspera
                  label="Carne"
                  value={form.tiempo_espera_carne}
                  editando={editando}
                  onChange={(v) => patch({ tiempo_espera_carne: v })}
                  placeholder="Ej. 40 DIAS"
                />
                <CampoEspera
                  label="Leche"
                  value={form.tiempo_espera_leche}
                  editando={editando}
                  onChange={(v) => patch({ tiempo_espera_leche: v })}
                  placeholder="Ej. 7 DIAS"
                />
              </div>

              <div className="stock-producto-ficha-prose-card stock-producto-ficha-prose-card--compact">
                <label htmlFor="producto-ficha-caracteristicas" className="stock-producto-ficha-prose-label">
                  <FileText size={14} aria-hidden />
                  Notas y uso
                </label>
                {editando ? (
                  <AutoResizeTextarea
                    id="producto-ficha-caracteristicas"
                    maxLength={4000}
                    className="stock-producto-ficha-textarea mayusculas-auto"
                    value={form.caracteristicas}
                    onChange={(v) => patch({ caracteristicas: v })}
                    placeholder="Indicaciones, período de retiro, observaciones de campo…"
                  />
                ) : (
                  <p className="stock-producto-ficha-texto">
                    {String(form.caracteristicas ?? "").trim() || "—"}
                  </p>
                )}
              </div>
              </section>
            </div>

            <section className="stock-producto-ficha-detalles-panel" aria-label="Detalles técnicos">
              <div className="stock-producto-ficha-prose-card">
                <label htmlFor="producto-ficha-detalles" className="stock-producto-ficha-prose-label">
                  <FileText size={14} aria-hidden />
                  Detalles técnicos
                </label>
                {editando ? (
                  <AutoResizeTextarea
                    id="producto-ficha-detalles"
                    maxLength={4000}
                    className="stock-producto-ficha-textarea mayusculas-auto"
                    value={form.detalles_tecnicos}
                    onChange={(v) => patch({ detalles_tecnicos: v })}
                    placeholder="Composición, dosis, contraindicaciones, almacenamiento…"
                  />
                ) : (
                  <p className="stock-producto-ficha-texto">
                    {String(form.detalles_tecnicos ?? "").trim() || "—"}
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

function Campo({
  label,
  value,
  editando,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  editando: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className={`stock-producto-ficha-campo ${className}`.trim()}>
      <p className="stock-producto-ficha-campo-label">{label}</p>
      <div className="stock-producto-ficha-campo-value">
        {editando ? (
          <input
            id={id}
            type="text"
            className="stock-producto-ficha-input stock-producto-ficha-input--embed mayusculas-auto"
            value={value}
            maxLength={200}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <span>{String(value ?? "").trim() || "—"}</span>
        )}
      </div>
    </div>
  );
}

function CampoEspera({
  label,
  value,
  editando,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editando: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = `espera-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="stock-producto-ficha-espera-card">
      <p className="stock-producto-ficha-espera-kicker">Tiempo de espera</p>
      <p className="stock-producto-ficha-espera-tipo">{label}</p>
      {editando ? (
        <input
          id={id}
          type="text"
          className="stock-producto-ficha-input stock-producto-ficha-input--embed stock-producto-ficha-input--espera mayusculas-auto"
          value={value}
          maxLength={80}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <p className="stock-producto-ficha-espera-valor">{String(value ?? "").trim() || "—"}</p>
      )}
    </div>
  );
}
