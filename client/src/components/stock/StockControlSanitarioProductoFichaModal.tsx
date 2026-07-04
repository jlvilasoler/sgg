import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileText, ImageIcon, Pencil, PillBottle, X } from "lucide-react";
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
import {
  defaultOpenDetalleSections,
  parseDetallesTecnicos,
  type DetalleTecnicoSection,
} from "./stock-producto-ficha-detalles";

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

function emptyForm(modulo: StockDispositivoModulo): ProductoFichaFormState {
  return {
    laboratorio: "",
    principio_activo: "",
    presentacion: "",
    via_administracion: "",
    especie: modulo === "equino" ? "Equinos" : "Bovinos",
    tiempo_espera_carne: "",
    tiempo_espera_leche: "",
    detalles_tecnicos: "",
    caracteristicas: "",
    foto_data: "",
  };
}

function formFromApi(
  data: Partial<ProductoFichaFormState> | null,
  nombre: string,
  modulo: StockDispositivoModulo
): ProductoFichaFormState {
  const base = emptyForm(modulo);
  const catalogo = buscarMarcaCatalogo(nombre, modulo);
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
  const [form, setForm] = useState<ProductoFichaFormState>(() => emptyForm(modulo));
  const [actualizadoEn, setActualizadoEn] = useState("");
  const [fotoCargada, setFotoCargada] = useState(true);
  const [vistaFicha, setVistaFicha] = useState<"resumen" | "detalles">("resumen");

  const titulo = String(nombre ?? "").trim() || "Producto";
  const fotoMostrar = useMemo(() => sanitizeProductoFichaFoto(form.foto_data), [form.foto_data]);
  const detalleSecciones = useMemo(
    () => parseDetallesTecnicos(form.detalles_tecnicos),
    [form.detalles_tecnicos],
  );
  const tieneDetalles = detalleSecciones.length > 0 || String(form.detalles_tecnicos ?? "").trim().length > 0;

  const load = useCallback(async () => {
    if (!open || !String(nombre ?? "").trim()) return;
    if (!apiOnline) {
      setForm(formFromApi(null, nombre, modulo));
      setActualizadoEn("");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockControlSanitarioProductoFicha(modulo, nombre);
      setForm(formFromApi(data, nombre, modulo));
      setActualizadoEn(data?.actualizado_en ?? "");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar ficha del producto");
      setForm(formFromApi(null, nombre, modulo));
      setActualizadoEn("");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, modulo, nombre, onError, open]);

  useEffect(() => {
    if (!open) return;
    setEditando(initialEdit);
    setVistaFicha("resumen");
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
      setForm(formFromApi(data, nombre, modulo));
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

  if (!open || !String(nombre ?? "").trim()) return null;

  return createPortal(
    <div
      className="stock-control-sanitario-overlay stock-producto-ficha-overlay stock-producto-ficha-overlay--hub"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-producto-ficha-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) onClose();
      }}
    >
      <div className="stock-producto-ficha-modal stock-producto-ficha-modal--hub">
        <div className="stock-producto-ficha-accent" aria-hidden />
        <header className="stock-producto-ficha-head stock-producto-ficha-hub-head-box">
          <div className="stock-producto-ficha-head-brand">
            <span className="stock-producto-ficha-head-icon" aria-hidden>
              <PillBottle size={26} strokeWidth={2} />
            </span>
            <div className="stock-producto-ficha-head-copy">
              <p className="sg-hub-panel-kicker">Ficha del producto</p>
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
          <div className="stock-producto-ficha-body stock-producto-ficha-hub-workspace">
            {!editando && tieneDetalles ? (
              <nav
                className="stock-producto-ficha-hub-box stock-producto-ficha-hub-tabs-box"
                aria-label="Secciones de la ficha"
              >
                <div className="stock-producto-ficha-tabs">
                  <button
                    type="button"
                    className={`stock-producto-ficha-tab${vistaFicha === "resumen" ? " is-active" : ""}`}
                    onClick={() => setVistaFicha("resumen")}
                  >
                    Resumen
                  </button>
                  <button
                    type="button"
                    className={`stock-producto-ficha-tab${vistaFicha === "detalles" ? " is-active" : ""}`}
                    onClick={() => setVistaFicha("detalles")}
                  >
                    Detalles técnicos
                    {detalleSecciones.length > 0 ? (
                      <span className="stock-producto-ficha-tab-count">{detalleSecciones.length}</span>
                    ) : null}
                  </button>
                </div>
              </nav>
            ) : null}

            {(editando || vistaFicha === "resumen") && (
              <>
                <div className="stock-producto-ficha-hub-box">
                <div className="stock-producto-ficha-hero">
                  <div className="stock-producto-ficha-hero-foto">
                    <div className="stock-producto-ficha-foto-frame stock-producto-ficha-foto-frame--compact">
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
                            {fotoMostrar ? "Cambiar" : "Subir"}
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

                  <div className="stock-producto-ficha-hero-copy">
                    <div className="stock-producto-ficha-chips">
                      {String(form.presentacion ?? "").trim() ? (
                        <span className="stock-producto-ficha-chip">{String(form.presentacion).trim()}</span>
                      ) : null}
                      {String(form.via_administracion ?? "").trim() ? (
                        <span className="stock-producto-ficha-chip stock-producto-ficha-chip--muted">
                          {String(form.via_administracion).trim()}
                        </span>
                      ) : null}
                    </div>
                    <div className="stock-producto-ficha-spec-grid stock-producto-ficha-spec-grid--hero">
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
                        className="stock-producto-ficha-campo--wide"
                      />
                      {editando ? (
                        <>
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
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
                </div>

                <div className="stock-producto-ficha-hub-box">
                <div className="stock-producto-ficha-resumen-grid">
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
                      <p className="stock-producto-ficha-texto stock-producto-ficha-texto--notas">
                        {String(form.caracteristicas ?? "").trim() || "—"}
                      </p>
                    )}
                  </div>
                </div>
                </div>
              </>
            )}

            {(editando || vistaFicha === "detalles") && (
              <section
                className="stock-producto-ficha-hub-box stock-producto-ficha-detalles-panel"
                aria-label="Detalles técnicos"
              >
                {editando ? (
                  <div className="stock-producto-ficha-prose-card">
                    <label htmlFor="producto-ficha-detalles" className="stock-producto-ficha-prose-label">
                      <FileText size={14} aria-hidden />
                      Detalles técnicos
                    </label>
                    <AutoResizeTextarea
                      id="producto-ficha-detalles"
                      maxLength={4000}
                      className="stock-producto-ficha-textarea stock-producto-ficha-textarea--detalles mayusculas-auto"
                      value={form.detalles_tecnicos}
                      onChange={(v) => patch({ detalles_tecnicos: v })}
                      placeholder="Composición, dosis, contraindicaciones, almacenamiento…"
                    />
                  </div>
                ) : detalleSecciones.length > 0 ? (
                  <DetallesTecnicosAccordion secciones={detalleSecciones} />
                ) : (
                  <p className="stock-producto-ficha-texto muted">Sin detalles técnicos cargados.</p>
                )}
              </section>
            )}
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

function DetallesTecnicosAccordion({ secciones }: { secciones: DetalleTecnicoSection[] }) {
  const [open, setOpen] = useState<Set<number>>(() => defaultOpenDetalleSections(secciones));

  useEffect(() => {
    setOpen(defaultOpenDetalleSections(secciones));
  }, [secciones]);

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="stock-producto-ficha-detalles-acc">
      {secciones.map((sec, index) => {
        const expanded = open.has(index);
        const panelId = `producto-ficha-detalle-${index}`;
        return (
          <div
            key={`${sec.title}-${index}`}
            className={`stock-producto-ficha-detalle-block${expanded ? " is-open" : ""}`}
          >
            <button
              type="button"
              className="stock-producto-ficha-detalle-trigger"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => toggle(index)}
            >
              <span className="stock-producto-ficha-detalle-title">{sec.title}</span>
              <span className="stock-producto-ficha-detalle-meta">
                {sec.items.length} {sec.items.length === 1 ? "ítem" : "ítems"}
              </span>
              <ChevronDown size={16} className="stock-producto-ficha-detalle-chevron" aria-hidden />
            </button>
            {expanded ? (
              <ul id={panelId} className="stock-producto-ficha-detalle-list">
                {sec.items.map((item, i) => (
                  <li key={`${index}-${i}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
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
  const texto = String(value ?? "").trim();
  const esConsulta = /consultar/i.test(texto);
  return (
    <div
      className={`stock-producto-ficha-espera-card${esConsulta && !editando ? " stock-producto-ficha-espera-card--info" : ""}`}
    >
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
        <p className="stock-producto-ficha-espera-valor">{texto || "—"}</p>
      )}
    </div>
  );
}
