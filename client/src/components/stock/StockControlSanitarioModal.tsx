import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  PillBottle,
  Syringe,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import {
  createStockControlSanitario,
  deleteStockControlSanitario,
  fetchStockControlSanitario,
  type StockDispositivoModulo,
} from "../../api";
import type { StockControlSanitarioInput, StockControlSanitarioRecord, AuthUser } from "../../types";
import StockControlSanitarioFormulaSelect from "./StockControlSanitarioFormulaSelect";
import StockControlSanitarioCantidadSelect from "./StockControlSanitarioCantidadSelect";
import StockControlSanitarioFuncionarioSelect from "./StockControlSanitarioFuncionarioSelect";
import StockControlSanitarioMarcaSelect from "./StockControlSanitarioMarcaSelect";
import StockControlSanitarioFormaSelect from "./StockControlSanitarioFormaSelect";
import StockControlSanitarioMotivoSelect from "./StockControlSanitarioMotivoSelect";
import StockControlSanitarioSectionTitle, {
  StockControlSanitarioIconSvg,
} from "./StockControlSanitarioSectionTitle";

type AdminModo = "fechas" | "periodo";

interface FormState {
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  admin_observaciones: string;
  producto_nombre: string;
  producto_formula: string;
  producto_cantidad: string;
  producto_forma: string;
  producto_espera: string;
  animal_categoria_lote: string;
  animal_id: string;
  control_motivo: string;
  control_funcionario: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  modulo: StockDispositivoModulo;
  clave: string;
  vid: string;
  eid: string;
  animalCategoriaLoteDefault: string;
  animalIdDefault: string;
  /** Si el modal se abrió desde la ficha de un dispositivo, la identificación queda fija. */
  desdeDispositivo?: boolean;
  apiOnline: boolean;
  soloLectura?: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

function funcionarioDefaultDesdeUsuario(user?: AuthUser | null): string {
  if (!user) return "";
  return user.nombre.trim() || user.email.trim();
}

function emptyForm(
  animalCategoriaLoteDefault: string,
  animalIdDefault: string,
  funcionarioDefault = ""
): FormState {
  return {
    admin_fecha_inicio: "",
    admin_fecha_fin: "",
    admin_periodo_nota: "",
    admin_observaciones: "",
    producto_nombre: "",
    producto_formula: "",
    producto_cantidad: "",
    producto_forma: "",
    producto_espera: "",
    animal_categoria_lote: animalCategoriaLoteDefault,
    animal_id: animalIdDefault,
    control_motivo: "",
    control_funcionario: funcionarioDefault,
  };
}

function fmtIsoDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtAdminPeriodo(r: StockControlSanitarioRecord): string {
  const nota = r.admin_periodo_nota.trim();
  if (nota) return nota;
  const ini = r.admin_fecha_inicio.trim();
  const fin = r.admin_fecha_fin.trim();
  if (ini && fin) return `${fmtIsoDate(ini)} – ${fmtIsoDate(fin)}`;
  if (ini) return `Desde ${fmtIsoDate(ini)}`;
  if (fin) return `Hasta ${fmtIsoDate(fin)}`;
  return "—";
}

function fmtCreadoEnParts(iso: string): { fecha: string; hora: string } {
  if (!iso) return { fecha: "", hora: "" };
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return { fecha: iso, hora: "" };
  return {
    fecha: d.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function fmtCreadoPor(val: string): string {
  const t = val.trim();
  if (!t || t === "[object Object]") return "";
  return t;
}

export default function StockControlSanitarioModal({
  open,
  onClose,
  modulo,
  clave,
  vid,
  eid,
  animalCategoriaLoteDefault,
  animalIdDefault,
  desdeDispositivo = false,
  apiOnline,
  soloLectura = false,
  currentUser = null,
  onError,
  onSuccess,
}: Props) {
  const funcionarioDefault = useMemo(
    () => funcionarioDefaultDesdeUsuario(currentUser),
    [currentUser]
  );

  const crearFormularioVacio = useCallback(
    () => emptyForm(animalCategoriaLoteDefault, animalIdDefault, funcionarioDefault),
    [animalCategoriaLoteDefault, animalIdDefault, funcionarioDefault]
  );

  const [registros, setRegistros] = useState<StockControlSanitarioRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(animalCategoriaLoteDefault, animalIdDefault, funcionarioDefault)
  );
  const [adminModo, setAdminModoState] = useState<AdminModo>("fechas");

  const puedeEditar = apiOnline && !soloLectura;

  const animalCategoriaLote = desdeDispositivo
    ? animalCategoriaLoteDefault
    : form.animal_categoria_lote;
  const animalId = desdeDispositivo ? animalIdDefault : form.animal_id;

  useEffect(() => {
    if (!open || !desdeDispositivo) return;
    setForm((prev) => ({
      ...prev,
      animal_categoria_lote: animalCategoriaLoteDefault,
      animal_id: animalIdDefault,
    }));
  }, [open, desdeDispositivo, animalCategoriaLoteDefault, animalIdDefault]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRegistros([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockControlSanitario(modulo, clave);
      setRegistros(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar control sanitario");
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, clave, modulo, onError]);

  useEffect(() => {
    if (!open) return;
    setForm(crearFormularioVacio());
    setAdminModoState("fechas");
    void load();
  }, [open, crearFormularioVacio, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const totalRegistros = registros.length;

  const historialFormulas = useMemo(
    () =>
      registros
        .map((r) => r.producto_formula.trim())
        .filter(Boolean),
    [registros]
  );

  const historialMarcas = useMemo(
    () =>
      registros
        .map((r) => r.producto_nombre.trim())
        .filter(Boolean),
    [registros]
  );

  const historialFormasAdmin = useMemo(
    () =>
      registros
        .map((r) => r.producto_forma.trim())
        .filter(Boolean)
        .filter((f) => f.localeCompare("Otra", "es", { sensitivity: "base" }) !== 0),
    [registros]
  );

  const historialCantidades = useMemo(
    () =>
      registros
        .map((r) => r.producto_cantidad.trim())
        .filter(Boolean),
    [registros]
  );

  const historialFuncionarios = useMemo(
    () =>
      registros
        .map((r) => r.control_funcionario.trim())
        .filter(Boolean),
    [registros]
  );

  const historialMotivos = useMemo(
    () =>
      registros
        .map((r) => r.control_motivo.trim())
        .filter(Boolean),
    [registros]
  );

  const tituloModulo = useMemo(
    () => (modulo === "ganadero" ? "Stock Ganadero" : "Stock Equino"),
    [modulo]
  );

  const patchForm = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const limpiarFormulario = () => {
    setForm(crearFormularioVacio());
    setAdminModoState("fechas");
  };

  const setAdminModo = (modo: AdminModo) => {
    setAdminModoState(modo);
    if (modo === "fechas") {
      patchForm({ admin_periodo_nota: "" });
    } else {
      patchForm({ admin_fecha_inicio: "", admin_fecha_fin: "" });
    }
  };

  const guardar = async () => {
    if (!puedeEditar || guardando) return;

    if (adminModo === "fechas") {
      if (!form.admin_fecha_inicio.trim() && !form.admin_fecha_fin.trim()) {
        onError("Indicá al menos fecha inicio o fecha fin.");
        return;
      }
    } else if (!form.admin_periodo_nota.trim()) {
      onError("Indicá el período de administración.");
      return;
    }

    if (!form.producto_nombre.trim()) {
      onError("Seleccioná el nombre comercial del producto.");
      return;
    }

    const input: StockControlSanitarioInput = {
      admin_fecha_inicio:
        adminModo === "fechas" ? form.admin_fecha_inicio.trim() : "",
      admin_fecha_fin: adminModo === "fechas" ? form.admin_fecha_fin.trim() : "",
      admin_periodo_nota:
        adminModo === "periodo" ? form.admin_periodo_nota.trim() : "",
      admin_observaciones: form.admin_observaciones.trim(),
      producto_nombre: form.producto_nombre.trim(),
      producto_formula: form.producto_formula.trim(),
      producto_cantidad: form.producto_cantidad.trim(),
      producto_forma: form.producto_forma.trim(),
      producto_espera: form.producto_espera.trim(),
      animal_categoria_lote: animalCategoriaLote.trim(),
      animal_id: animalId.trim(),
      control_motivo: form.control_motivo.trim(),
      control_funcionario: form.control_funcionario.trim(),
    };

    setGuardando(true);
    try {
      const nuevo = await createStockControlSanitario(modulo, clave, input);
      setRegistros((prev) => [nuevo, ...prev]);
      limpiarFormulario();
      onSuccess?.("Registro de control sanitario guardado.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar registro");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: number) => {
    if (!puedeEditar || eliminandoId !== null) return;
    if (!window.confirm("¿Eliminar este registro de control sanitario?")) return;

    setEliminandoId(id);
    try {
      await deleteStockControlSanitario(modulo, clave, id);
      setRegistros((prev) => prev.filter((r) => r.id !== id));
      onSuccess?.("Registro eliminado.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar registro");
    } finally {
      setEliminandoId(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="stock-control-sanitario-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-control-sanitario-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="stock-control-sanitario-modal">
        <header className="stock-control-sanitario-head">
          <div className="stock-control-sanitario-head-brand">
            <span
              className="stock-control-sanitario-head-icon stock-control-sanitario-head-icon--main"
              aria-hidden
            >
              <StockControlSanitarioIconSvg icon="header" size={26} />
            </span>
            <div className="stock-control-sanitario-head-main">
              <p className="stock-control-sanitario-kicker">
                <span className="stock-control-sanitario-kicker-icon" aria-hidden>
                  <StockControlSanitarioIconSvg
                    icon={modulo === "ganadero" ? "modulo-ganadero" : "modulo-equino"}
                    size={13}
                  />
                </span>
                {tituloModulo}
              </p>
              <h2 id="stock-control-sanitario-title">Control Sanitario</h2>
              <p className="stock-control-sanitario-sub muted">
                <span className="stock-control-sanitario-sub-item stock-control-sanitario-sub-item--registro">
                  <span className="stock-control-sanitario-sub-item-icon" aria-hidden>
                    <StockControlSanitarioIconSvg icon="registro" size={12} />
                  </span>
                  Registro de remedios
                </span>
                <span className="stock-control-sanitario-sub-item stock-control-sanitario-sub-item--eid">
                  <span className="stock-control-sanitario-sub-item-icon" aria-hidden>
                    <StockControlSanitarioIconSvg icon="eid" size={12} />
                  </span>
                  EID {eid || "—"}
                </span>
                <span className="stock-control-sanitario-sub-item stock-control-sanitario-sub-item--vid">
                  <span className="stock-control-sanitario-sub-item-icon" aria-hidden>
                    <StockControlSanitarioIconSvg icon="vid" size={12} />
                  </span>
                  VID {vid || "—"}
                </span>
                <span className="stock-control-sanitario-sub-item stock-control-sanitario-sub-item--clave">
                  <span className="stock-control-sanitario-sub-item-icon" aria-hidden>
                    <StockControlSanitarioIconSvg icon="clave" size={12} />
                  </span>
                  Clave {clave || "—"}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="stock-control-sanitario-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="stock-control-sanitario-body">
          {puedeEditar ? (
            <form
              className="stock-control-sanitario-form"
              onSubmit={(e) => {
                e.preventDefault();
                void guardar();
              }}
            >
              <section className="stock-control-sanitario-section">
                <div className="stock-control-sanitario-section-head">
                  <StockControlSanitarioSectionTitle icon="admin">
                    Fecha o período de administración
                  </StockControlSanitarioSectionTitle>
                  <div
                    className="stock-control-sanitario-modos"
                    role="tablist"
                    aria-label="Tipo de administración"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adminModo === "fechas"}
                      className={`stock-control-sanitario-modo${
                        adminModo === "fechas" ? " is-active" : ""
                      }`}
                      disabled={guardando}
                      onClick={() => setAdminModo("fechas")}
                    >
                      Fechas
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={adminModo === "periodo"}
                      className={`stock-control-sanitario-modo${
                        adminModo === "periodo" ? " is-active" : ""
                      }`}
                      disabled={guardando}
                      onClick={() => setAdminModo("periodo")}
                    >
                      Período
                    </button>
                  </div>
                </div>
                {adminModo === "fechas" ? (
                  <>
                    <div className="stock-control-sanitario-grid stock-control-sanitario-grid--2">
                      <div className="field">
                        <label htmlFor="cs-admin-inicio">Fecha inicio</label>
                        <input
                          id="cs-admin-inicio"
                          type="date"
                          value={form.admin_fecha_inicio}
                          disabled={guardando}
                          onChange={(e) =>
                            patchForm({ admin_fecha_inicio: e.target.value })
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cs-admin-fin">Fecha fin</label>
                        <input
                          id="cs-admin-fin"
                          type="date"
                          value={form.admin_fecha_fin}
                          disabled={guardando}
                          onChange={(e) => patchForm({ admin_fecha_fin: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="field stock-control-sanitario-admin-observaciones">
                      <label htmlFor="cs-admin-observaciones">Observaciones</label>
                      <textarea
                        id="cs-admin-observaciones"
                        rows={2}
                        maxLength={500}
                        placeholder="Notas..."
                        value={form.admin_observaciones}
                        disabled={guardando}
                        onChange={(e) =>
                          patchForm({ admin_observaciones: e.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="field">
                    <label htmlFor="cs-admin-periodo">Período / nota</label>
                    <input
                      id="cs-admin-periodo"
                      type="text"
                      maxLength={200}
                      placeholder="Ej. 3 días consecutivos, semana 12/2025…"
                      value={form.admin_periodo_nota}
                      disabled={guardando}
                      onChange={(e) => patchForm({ admin_periodo_nota: e.target.value })}
                    />
                  </div>
                )}
              </section>

              <section className="stock-control-sanitario-section">
                <StockControlSanitarioSectionTitle icon="producto">
                  Producto
                </StockControlSanitarioSectionTitle>
                <div className="stock-control-sanitario-grid stock-control-sanitario-grid--2 stock-control-sanitario-grid--producto">
                  <div className="field">
                    <label htmlFor="cs-producto-nombre-trigger">
                      Nombre comercial
                      <span className="stock-control-sanitario-required">*</span>
                    </label>
                    <StockControlSanitarioMarcaSelect
                      value={form.producto_nombre}
                      onChange={(v) => patchForm({ producto_nombre: v })}
                      disabled={guardando}
                      historialMarcas={historialMarcas}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-producto-formula-trigger">Fórmula</label>
                    <StockControlSanitarioFormulaSelect
                      value={form.producto_formula}
                      onChange={(v) => patchForm({ producto_formula: v })}
                      disabled={guardando}
                      historialFormulas={historialFormulas}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-producto-forma-trigger">Forma de administración</label>
                    <StockControlSanitarioFormaSelect
                      value={form.producto_forma}
                      onChange={(v) => patchForm({ producto_forma: v })}
                      disabled={guardando}
                      historialFormas={historialFormasAdmin}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-producto-cantidad-trigger">Cantidad</label>
                    <StockControlSanitarioCantidadSelect
                      value={form.producto_cantidad}
                      onChange={(v) => patchForm({ producto_cantidad: v })}
                      disabled={guardando}
                      apiOnline={apiOnline}
                      modulo={modulo}
                      historialCantidades={historialCantidades}
                      onError={onError}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-producto-espera">Tiempo de espera</label>
                    <input
                      id="cs-producto-espera"
                      type="text"
                      maxLength={80}
                      placeholder="Ej. 28 días carne / 7 días leche"
                      value={form.producto_espera}
                      disabled={guardando}
                      onChange={(e) => patchForm({ producto_espera: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="stock-control-sanitario-section">
                <StockControlSanitarioSectionTitle
                  icon={modulo === "ganadero" ? "animal-vacuno" : "animal-equino"}
                >
                  Identificación animal
                  {desdeDispositivo ? (
                    <span className="stock-control-sanitario-section-hint">
                      del dispositivo
                    </span>
                  ) : null}
                </StockControlSanitarioSectionTitle>
                <div className="stock-control-sanitario-grid stock-control-sanitario-grid--2">
                  <div className="field">
                    <label htmlFor="cs-animal-lote">Categoría o lote</label>
                    <input
                      id="cs-animal-lote"
                      type="text"
                      maxLength={80}
                      placeholder="GEN, lote, categoría…"
                      value={animalCategoriaLote}
                      readOnly={desdeDispositivo}
                      disabled={desdeDispositivo || guardando}
                      className={
                        desdeDispositivo ? "stock-control-sanitario-field--locked" : undefined
                      }
                      onChange={(e) =>
                        patchForm({ animal_categoria_lote: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-animal-id">ID animal</label>
                    <input
                      id="cs-animal-id"
                      type="text"
                      maxLength={64}
                      placeholder="VID, EID o identificador interno"
                      value={animalId}
                      readOnly={desdeDispositivo}
                      disabled={desdeDispositivo || guardando}
                      className={
                        desdeDispositivo ? "stock-control-sanitario-field--locked" : undefined
                      }
                      onChange={(e) => patchForm({ animal_id: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="stock-control-sanitario-section">
                <StockControlSanitarioSectionTitle icon="controles">
                  Controles
                </StockControlSanitarioSectionTitle>
                <div className="stock-control-sanitario-grid stock-control-sanitario-grid--2">
                  <div className="field">
                    <label htmlFor="cs-control-motivo-trigger">Motivo</label>
                    <StockControlSanitarioMotivoSelect
                      value={form.control_motivo}
                      onChange={(v) => patchForm({ control_motivo: v })}
                      disabled={guardando}
                      historialMotivos={historialMotivos}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="cs-control-funcionario-trigger">
                      Nombre funcionario que autorizó
                    </label>
                    <StockControlSanitarioFuncionarioSelect
                      value={form.control_funcionario}
                      onChange={(v) => patchForm({ control_funcionario: v })}
                      disabled={guardando}
                      apiOnline={apiOnline}
                      currentUser={currentUser}
                      historialNombres={historialFuncionarios}
                      onError={onError}
                    />
                  </div>
                </div>
              </section>

              <div className="stock-control-sanitario-form-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={guardando}
                  onClick={limpiarFormulario}
                >
                  Limpiar
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar registro"}
                </button>
              </div>
            </form>
          ) : (
            <p className="stock-control-sanitario-readonly-note muted">
              {!apiOnline
                ? "API no conectada. No se pueden cargar ni editar registros."
                : "Modo solo lectura. Activá Editar en la ficha para agregar registros."}
            </p>
          )}

          <section className="stock-control-sanitario-historial">
            <div className="stock-control-sanitario-historial-panel">
              <div className="stock-control-sanitario-historial-head">
                <StockControlSanitarioSectionTitle icon="historial">
                  Historial de administraciones
                </StockControlSanitarioSectionTitle>
                <span className="stock-control-sanitario-count">
                  {totalRegistros} registro{totalRegistros === 1 ? "" : "s"}
                </span>
              </div>

              {loading ? (
                <p className="stock-control-sanitario-empty">Cargando registros…</p>
              ) : !apiOnline ? (
                <p className="stock-control-sanitario-empty">Sin conexión a la API</p>
              ) : registros.length === 0 ? (
                <p className="stock-control-sanitario-empty">
                  Todavía no hay remedios registrados para este animal.
                </p>
              ) : (
                <ul className="stock-control-sanitario-list">
                  {registros.map((r, index) => {
                    const creadoPor = fmtCreadoPor(r.creado_por);
                    const { fecha, hora } = fmtCreadoEnParts(r.creado_en);
                    const adminPeriodo = fmtAdminPeriodo(r);
                    const isLast = index === registros.length - 1;

                    return (
                      <li
                        key={r.id}
                        className={`stock-control-sanitario-item${isLast ? " is-last" : ""}`}
                      >
                        <div className="stock-control-sanitario-item-rail" aria-hidden>
                          <span className="stock-control-sanitario-item-dot" />
                          {!isLast ? (
                            <span className="stock-control-sanitario-item-line" />
                          ) : null}
                        </div>

                        <article className="stock-control-sanitario-item-card">
                          <header className="stock-control-sanitario-item-top">
                            <div className="stock-control-sanitario-item-brand">
                              <span className="stock-control-sanitario-item-med-icon" aria-hidden>
                                <PillBottle size={14} strokeWidth={2.1} />
                              </span>
                              <div className="stock-control-sanitario-item-brand-text">
                                <div className="stock-control-sanitario-item-title-row">
                                  <h4 className="stock-control-sanitario-item-producto">
                                    {r.producto_nombre || "—"}
                                  </h4>
                                  {(r.producto_forma ||
                                    r.producto_cantidad ||
                                    r.producto_espera) && (
                                    <div className="stock-control-sanitario-item-tags">
                                      {r.producto_forma ? (
                                        <span className="stock-control-sanitario-tag stock-control-sanitario-tag--forma">
                                          <Syringe size={10} strokeWidth={2.2} aria-hidden />
                                          {r.producto_forma}
                                        </span>
                                      ) : null}
                                      {r.producto_cantidad ? (
                                        <span className="stock-control-sanitario-tag stock-control-sanitario-tag--dosis">
                                          {r.producto_cantidad}
                                        </span>
                                      ) : null}
                                      {r.producto_espera ? (
                                        <span className="stock-control-sanitario-tag stock-control-sanitario-tag--espera">
                                          <Timer size={10} strokeWidth={2.2} aria-hidden />
                                          {r.producto_espera}
                                        </span>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                                {r.producto_formula ? (
                                  <p className="stock-control-sanitario-item-formula">
                                    {r.producto_formula}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="stock-control-sanitario-item-when">
                              {fecha || hora ? (
                                <span className="stock-control-sanitario-item-when-chip">
                                  <Calendar size={11} strokeWidth={2.2} aria-hidden />
                                  {[fecha, hora].filter(Boolean).join(" · ")}
                                </span>
                              ) : null}
                              {creadoPor ? (
                                <span className="stock-control-sanitario-item-when-chip stock-control-sanitario-item-when-chip--autor">
                                  <User size={11} strokeWidth={2.2} aria-hidden />
                                  {creadoPor}
                                </span>
                              ) : null}
                              {puedeEditar ? (
                                <button
                                  type="button"
                                  className="stock-control-sanitario-item-delete stock-control-sanitario-item-delete--icon"
                                  disabled={eliminandoId === r.id}
                                  title="Eliminar registro"
                                  aria-label="Eliminar registro"
                                  onClick={() => void eliminar(r.id)}
                                >
                                  <Trash2 size={13} strokeWidth={2.1} aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          </header>

                          <ul className="stock-control-sanitario-item-facts">
                            <li>
                              <span>Administración</span>
                              {adminPeriodo}
                            </li>
                            {r.control_motivo ? (
                              <li>
                                <span>Motivo</span>
                                {r.control_motivo}
                              </li>
                            ) : null}
                            {r.control_funcionario ? (
                              <li>
                                <span>Autorizó</span>
                                {r.control_funcionario}
                              </li>
                            ) : null}
                            {r.admin_observaciones ? (
                              <li className="stock-control-sanitario-item-facts--obs">
                                <span>Obs.</span>
                                {r.admin_observaciones}
                              </li>
                            ) : null}
                            {(r.animal_categoria_lote || r.animal_id) && (
                              <li>
                                <span>Animal</span>
                                {[r.animal_categoria_lote, r.animal_id]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </li>
                            )}
                          </ul>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>

        <footer className="stock-control-sanitario-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
