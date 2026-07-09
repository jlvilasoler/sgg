import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImageIcon, Pencil, PillBottle, Save, X } from "lucide-react";
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
import { sanitizeProductoFichaFoto, buildProductoFichaFotoCandidatos } from "./stock-producto-ficha-foto";
import ProductoFichaFotoImg from "./ProductoFichaFotoImg";
import {
  defaultOpenDetalleSections,
  parseDetallesTecnicos,
  type DetalleTecnicoSection,
} from "./stock-producto-ficha-detalles";

const MAX_FOTO_BYTES = 450_000;

function ProductoFichaFotoPlaceholder() {
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
        No hay imagen disponible
      </span>
    </div>
  );
}

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

export interface StockControlSanitarioProductoFichaViewProps {
  nombre: string;
  modulo: StockDispositivoModulo;
  apiOnline: boolean;
  active: boolean;
  layout: "modal" | "page";
  onError: (msg: string) => void;
  onSaved?: (msg: string) => void;
  initialEdit?: boolean;
  onClose?: () => void;
}

export default function StockControlSanitarioProductoFichaView({
  nombre,
  modulo,
  apiOnline,
  active,
  layout,
  onError,
  onSaved,
  initialEdit = false,
  onClose,
}: StockControlSanitarioProductoFichaViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<ProductoFichaFormState>(() => emptyForm(modulo));
  const [actualizadoEn, setActualizadoEn] = useState("");
  const [fotoVisible, setFotoVisible] = useState(true);
  const [vistaFicha, setVistaFicha] = useState<"resumen" | "detalles">("resumen");

  const titulo = String(nombre ?? "").trim() || "Producto";
  const fotoCandidatos = useMemo(
    () => buildProductoFichaFotoCandidatos(titulo, form.foto_data),
    [titulo, form.foto_data],
  );
  const tieneFotoSubida = Boolean(String(form.foto_data ?? "").trim());
  const detalleSecciones = useMemo(
    () => parseDetallesTecnicos(form.detalles_tecnicos),
    [form.detalles_tecnicos],
  );
  const tieneDetalles = detalleSecciones.length > 0 || String(form.detalles_tecnicos ?? "").trim().length > 0;
  const isPage = layout === "page";

  const load = useCallback(async () => {
    if (!active || !String(nombre ?? "").trim()) return;
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
  }, [active, apiOnline, modulo, nombre, onError]);

  useEffect(() => {
    if (!active) return;
    setEditando(initialEdit);
    setVistaFicha("resumen");
    void load();
  }, [active, load, initialEdit]);

  useEffect(() => {
    setFotoVisible(fotoCandidatos.length > 0);
  }, [fotoCandidatos]);

  useEffect(() => {
    if (!active || isPage || !onClose) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !guardando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, guardando, isPage, onClose]);

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

  if (!active || !String(nombre ?? "").trim()) return null;

  const actionButtons = editando ? (
    <>
      <button
        type="button"
        className="stock-producto-ficha-hub-cta stock-producto-ficha-hub-cta--ghost"
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
        className="stock-producto-ficha-hub-cta"
        disabled={guardando || !apiOnline}
        onClick={() => void guardar()}
      >
        <Save size={15} aria-hidden />
        {guardando ? "Guardando…" : "Guardar ficha"}
      </button>
    </>
  ) : (
    <button
      type="button"
      className="stock-producto-ficha-hub-cta stock-producto-ficha-hub-cta--edit"
      disabled={loading || guardando}
      onClick={() => setEditando(true)}
    >
      <Pencil size={15} aria-hidden />
      Editar ficha
    </button>
  );

  return (
    <>
      {!isPage ? (
        <header className="stock-producto-ficha-modal-toolbar">
          <div className="stock-producto-ficha-modal-toolbar-copy">
            <p className="stock-ganadera-detalle-hero-kicker">Ficha del producto</p>
            <p id="stock-producto-ficha-title" className="stock-producto-ficha-modal-toolbar-title">
              {titulo}
            </p>
          </div>
          <div className="stock-producto-ficha-head-actions">
            {actionButtons}
            {onClose ? (
              <button
                type="button"
                className="stock-producto-ficha-close"
                disabled={guardando}
                onClick={onClose}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        </header>
      ) : (
        <div className="stock-producto-ficha-page-actions">
          {actionButtons}
        </div>
      )}

      {loading ? (
        <div
          className={`stock-producto-ficha-loading${isPage ? " stock-producto-ficha-loading--page" : ""}`}
          aria-busy="true"
        >
          <div className="stock-producto-ficha-loading-pulse" />
          <p className="muted">Cargando ficha técnica…</p>
        </div>
      ) : (
        <div
          className={`stock-producto-ficha-body stock-producto-ficha-detalle-scroll${
            isPage ? " stock-producto-ficha-body--page" : ""
          }`}
        >
          <div className="stock-ganadera-detalle-hero stock-producto-ficha-detalle-hero stock-producto-ficha-detalle-hero--con-foto">
            <div className="stock-ganadera-detalle-hero-main stock-producto-ficha-hero-con-foto">
              <div className="stock-producto-ficha-foto-wrap" aria-label="Foto del producto">
                <div
                  className={`stock-edit-foto-frame stock-producto-ficha-foto-frame${
                    fotoVisible ? " stock-edit-foto-frame--filled" : ""
                  }`}
                >
                  {fotoCandidatos.length > 0 && fotoVisible ? (
                    <ProductoFichaFotoImg
                      key={fotoCandidatos.join("|")}
                      nombre={titulo}
                      fotoData={form.foto_data}
                      alt={`Foto de ${titulo}`}
                      onSinFoto={() => setFotoVisible(false)}
                      onConFoto={() => setFotoVisible(true)}
                    />
                  ) : (
                    <ProductoFichaFotoPlaceholder />
                  )}
                </div>
                {editando ? (
                  <div className="stock-producto-ficha-foto-actions">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => onFotoChange(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      className="stock-producto-ficha-hub-cta stock-producto-ficha-hub-cta--edit"
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImageIcon size={14} aria-hidden />
                    {tieneFotoSubida || fotoVisible ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {tieneFotoSubida ? (
                      <button
                        type="button"
                        className="stock-producto-ficha-hub-cta stock-producto-ficha-hub-cta--ghost"
                        onClick={() => patch({ foto_data: "" })}
                      >
                        Quitar foto
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="stock-ganadera-detalle-hero-text">
                <span className="stock-ganadera-detalle-hero-kicker">
                  <PillBottle size={14} strokeWidth={2} aria-hidden className="stock-producto-ficha-hero-kicker-icon" />
                  Producto sanitario
                </span>
                <div className="stock-ganadera-detalle-hero-ids">
                  <span className="stock-ganadera-detalle-hero-badge">{titulo}</span>
                  {String(form.especie ?? "").trim() ? (
                    <span className="stock-ganadera-detalle-hero-badge stock-ganadera-detalle-hero-badge--vid">
                      {String(form.especie).trim()}
                    </span>
                  ) : null}
                </div>
                <div className="stock-ganadera-detalle-hero-meta">
                  {String(form.presentacion ?? "").trim() ? (
                    <span className="stock-ganadera-detalle-hero-stat">{String(form.presentacion).trim()}</span>
                  ) : null}
                  {String(form.via_administracion ?? "").trim() ? (
                    <span className="stock-ganadera-detalle-hero-stat">
                      {String(form.via_administracion).trim()}
                    </span>
                  ) : null}
                  {metaActualizacion ? (
                    <span className="stock-ganadera-detalle-hero-stat">
                      Actualizado {metaActualizacion}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {!editando && tieneDetalles ? (
            <nav
              className="stock-producto-ficha-detalle-tabs"
              role="tablist"
              aria-label="Secciones de la ficha"
            >
              <button
                type="button"
                role="tab"
                aria-selected={vistaFicha === "resumen"}
                className={`stock-producto-ficha-detalle-tab${vistaFicha === "resumen" ? " is-active" : ""}`}
                onClick={() => setVistaFicha("resumen")}
              >
                Resumen
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={vistaFicha === "detalles"}
                className={`stock-producto-ficha-detalle-tab${vistaFicha === "detalles" ? " is-active" : ""}`}
                onClick={() => setVistaFicha("detalles")}
              >
                Detalles técnicos
                {detalleSecciones.length > 0 ? (
                  <span className="stock-producto-ficha-detalle-tab-count">{detalleSecciones.length}</span>
                ) : null}
              </button>
            </nav>
          ) : null}

          <div className="stock-ganadera-detalle-body stock-producto-ficha-detalle-body">
            {(editando || vistaFicha === "resumen") && (
              <>
                <section className="stock-ganadera-detalle-block" aria-label="Identificación">
                  <h3 className="stock-ganadera-detalle-block-title">Identificación</h3>
                  <div className="stock-ganadera-detalle-fields stock-ganadera-detalle-fields--4">
                    <DetalleCampo
                      label="Laboratorio"
                      value={form.laboratorio}
                      editando={editando}
                      onChange={(v) => patch({ laboratorio: v })}
                    />
                    <DetalleCampo
                      label="Principio activo"
                      value={form.principio_activo}
                      editando={editando}
                      onChange={(v) => patch({ principio_activo: v })}
                      full
                    />
                    <DetalleCampo
                      label="Presentación"
                      value={form.presentacion}
                      editando={editando}
                      onChange={(v) => patch({ presentacion: v })}
                    />
                    <DetalleCampo
                      label="Vía de administración"
                      value={form.via_administracion}
                      editando={editando}
                      onChange={(v) => patch({ via_administracion: v })}
                    />
                    {editando ? (
                      <DetalleCampo
                        label="Especie"
                        value={form.especie}
                        editando={editando}
                        onChange={(v) => patch({ especie: v })}
                        full
                      />
                    ) : null}
                  </div>
                </section>

                <section className="stock-ganadera-detalle-block" aria-label="Tiempos de espera">
                  <h3 className="stock-ganadera-detalle-block-title">Tiempos de espera</h3>
                  <div className="stock-ganadera-detalle-fields stock-ganadera-detalle-fields--3">
                    <DetalleCampo
                      label="Carne"
                      value={form.tiempo_espera_carne}
                      editando={editando}
                      onChange={(v) => patch({ tiempo_espera_carne: v })}
                      placeholder="Ej. 40 DIAS"
                      destacado={/consultar/i.test(String(form.tiempo_espera_carne ?? "")) && !editando}
                    />
                    <DetalleCampo
                      label="Leche"
                      value={form.tiempo_espera_leche}
                      editando={editando}
                      onChange={(v) => patch({ tiempo_espera_leche: v })}
                      placeholder="Ej. 7 DIAS"
                      destacado={/consultar/i.test(String(form.tiempo_espera_leche ?? "")) && !editando}
                    />
                  </div>
                </section>

                <section className="stock-ganadera-detalle-block" aria-label="Notas y uso">
                  <h3 className="stock-ganadera-detalle-block-title">Notas y uso</h3>
                  {editando ? (
                    <AutoResizeTextarea
                      id="producto-ficha-caracteristicas"
                      maxLength={4000}
                      className="stock-producto-ficha-textarea stock-producto-ficha-textarea--detalle mayusculas-auto"
                      value={form.caracteristicas}
                      onChange={(v) => patch({ caracteristicas: v })}
                      placeholder="Indicaciones, período de retiro, observaciones de campo…"
                    />
                  ) : (
                    <div className="stock-ganadera-detalle-obs stock-producto-ficha-detalle-obs">
                      <p className="stock-ganadera-detalle-obs-texto">
                        {String(form.caracteristicas ?? "").trim() || "—"}
                      </p>
                    </div>
                  )}
                </section>
              </>
            )}

            {(editando || vistaFicha === "detalles") && (
              <section className="stock-ganadera-detalle-block" aria-label="Detalles técnicos">
                <h3 className="stock-ganadera-detalle-block-title">Detalles técnicos</h3>
                {editando ? (
                  <AutoResizeTextarea
                    id="producto-ficha-detalles"
                    maxLength={4000}
                    className="stock-producto-ficha-textarea stock-producto-ficha-textarea--detalle mayusculas-auto"
                    value={form.detalles_tecnicos}
                    onChange={(v) => patch({ detalles_tecnicos: v })}
                    placeholder="Composición, dosis, contraindicaciones, almacenamiento…"
                  />
                ) : detalleSecciones.length > 0 ? (
                  <DetallesTecnicosAccordion secciones={detalleSecciones} />
                ) : (
                  <p className="stock-ganadera-detalle-valor stock-ganadera-detalle-valor--vacio">
                    Sin detalles técnicos cargados.
                  </p>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </>
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

function DetalleCampo({
  label,
  value,
  editando,
  onChange,
  placeholder,
  full = false,
  destacado = false,
}: {
  label: string;
  value: string;
  editando: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
  destacado?: boolean;
}) {
  const texto = String(value ?? "").trim();
  const vacio = !texto;
  const id = `producto-ficha-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className={`stock-ganadera-detalle-campo${full ? " stock-ganadera-detalle-campo--full" : ""}`}
    >
      <span className="stock-ganadera-detalle-label">{label}</span>
      {editando ? (
        <input
          id={id}
          type="text"
          className="stock-producto-ficha-input stock-producto-ficha-input--detalle mayusculas-auto"
          value={value}
          maxLength={200}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <span
          className={`stock-ganadera-detalle-valor${vacio ? " stock-ganadera-detalle-valor--vacio" : ""}${
            destacado ? " stock-producto-ficha-detalle-valor--info" : ""
          }`}
        >
          {vacio ? "—" : texto}
        </span>
      )}
    </div>
  );
}
