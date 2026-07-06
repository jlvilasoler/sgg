import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  Check,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  aprobarGastoAutoPendiente,
  createGastoAutomatizacion,
  deleteGastoAutomatizacion,
  fetchGastosAutomatizacion,
  fetchPresupuesto,
  rechazarGastoAutoPendiente,
  updateGastoAutomatizacion,
} from "../../api";
import type {
  AuthUser,
  Catalogos,
  GastoAutomatizacion,
  GastoAutoPendiente,
  Presupuesto,
} from "../../types";
import { fmtDate, fmtNum } from "../../utils/format";
import { confirmAction } from "../../utils/confirm";
import { canWriteModulo, canAprobarGastosAutomatizacion } from "../../utils/auth-permissions";
import { empresaCorta } from "../../utils";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import AutomatizacionNuevaPanel from "./AutomatizacionNuevaPanel";
import AutomatizacionPlantillaForm from "./AutomatizacionPlantillaForm";
import {
  plantillaFormDesdeAutomatizacion,
  programacionResumen,
  type AutomatizacionPlantillaFormState,
} from "./automatizacion-plantilla-form";

const AUTO_ICON_THEME = HUB_ICON_THEMES.presupuesto_automatizacion;

interface Props {
  currentUser: AuthUser;
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function esResponsable(plantilla: GastoAutomatizacion, user: AuthUser): boolean {
  if (plantilla.responsable_user_id === user.id) return true;
  if (
    plantilla.responsable_email.trim().toLowerCase() === user.email.trim().toLowerCase()
  ) {
    return true;
  }
  return user.rol === "admin" || user.rol === "editor";
}

function diaMesLabel(p: GastoAutomatizacion): string {
  const intervalo = p.intervalo_meses === 1 ? "cada mes" : `cada ${p.intervalo_meses} meses`;
  return `día ${p.dia_mes} · ${intervalo}`;
}

function formToCreatePayload(form: AutomatizacionPlantillaFormState) {
  return {
    presupuesto_id: form.presupuesto_id,
    nombre: form.nombre.trim(),
    dia_mes: form.dia_mes,
    intervalo_meses: form.intervalo_meses,
    fecha_inicio: form.fecha_inicio,
    empresa: form.empresa,
    codigo_proveedor: form.codigo_proveedor,
    razon_social_proveedor: form.razon_social_proveedor,
    concepto: form.concepto.trim(),
    observaciones: form.observaciones,
    rubro: form.rubro,
    sub_rubro: form.sub_rubro,
    responsable_gasto: form.responsable_gasto,
    funcionario_cedula: form.funcionario_cedula,
    nro_factura: form.nro_factura,
    nro_operacion_origen: form.nro_operacion_origen,
    pesos: form.pesos,
    dolares_usd: form.dolares_usd,
    reales: form.reales,
    tc_usd: form.tc_usd,
    tc_reales: form.tc_reales,
    saldo_usd: form.saldo_usd,
  };
}

function formToUpdatePayload(form: AutomatizacionPlantillaFormState) {
  const base = formToCreatePayload(form);
  const { presupuesto_id: _omit, ...rest } = base;
  return { ...rest, activo: form.activo };
}

export default function AutomatizacionGastos({
  currentUser,
  catalogos,
  apiOnline,
  onError,
  onSuccess,
}: Props) {
  const puedeEscribir = canWriteModulo(currentUser, "presupuesto");
  const puedeAprobar = canAprobarGastosAutomatizacion(currentUser);
  const [loading, setLoading] = useState(true);
  const [plantillas, setPlantillas] = useState<GastoAutomatizacion[]>([]);
  const [pendientes, setPendientes] = useState<GastoAutoPendiente[]>([]);
  const [gastosCuenta, setGastosCuenta] = useState<Presupuesto[]>([]);
  const [panelNueva, setPanelNueva] = useState(false);
  const [editando, setEditando] = useState<GastoAutomatizacion | null>(null);
  const [formEdit, setFormEdit] = useState<AutomatizacionPlantillaFormState | null>(null);
  const [editMoneyKey, setEditMoneyKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pendientesAprobacion = useMemo(
    () =>
      puedeAprobar
        ? pendientes.filter((p) => p.estado === "pendiente_aprobacion")
        : [],
    [pendientes, puedeAprobar]
  );

  const cargar = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [auto, gastos] = await Promise.all([
        fetchGastosAutomatizacion(),
        fetchPresupuesto({}),
      ]);
      setPlantillas(auto.plantillas);
      setPendientes(auto.pendientes);
      setGastosCuenta(gastos);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cargar automatizaciones");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrirNueva = () => setPanelNueva(true);

  const cerrarNueva = () => setPanelNueva(false);

  const guardarNueva = async (form: AutomatizacionPlantillaFormState) => {
    setBusyId(-1);
    try {
      await createGastoAutomatizacion(formToCreatePayload(form));
      setPanelNueva(false);
      onSuccess("Automatización creada. El administrador de la cuenta aprobará cada pago mensual.");
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo crear la automatización");
    } finally {
      setBusyId(null);
    }
  };

  const abrirEditar = (p: GastoAutomatizacion) => {
    setEditando(p);
    setFormEdit(plantillaFormDesdeAutomatizacion(p));
    setEditMoneyKey((k) => k + 1);
  };

  const guardarEditar = async () => {
    if (!editando || !formEdit) return;
    setBusyId(editando.id);
    try {
      await updateGastoAutomatizacion(editando.id, formToUpdatePayload(formEdit));
      setEditando(null);
      setFormEdit(null);
      onSuccess("Automatización actualizada");
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusyId(null);
    }
  };

  const togglePausa = async (p: GastoAutomatizacion) => {
    setBusyId(p.id);
    try {
      await updateGastoAutomatizacion(p.id, { activo: !p.activo });
      onSuccess(p.activo ? "Automatización pausada" : "Automatización reanudada");
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setBusyId(null);
    }
  };

  const eliminar = async (p: GastoAutomatizacion) => {
    const ok = await confirmAction({
      title: "Eliminar automatización",
      message: `¿Eliminar «${p.nombre}»? No se generarán más pagos automáticos.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await deleteGastoAutomatizacion(p.id);
      onSuccess("Automatización eliminada");
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  const aprobar = async (p: GastoAutoPendiente) => {
    const ok = await confirmAction({
      title: "Aprobar pago automático",
      message: `Se registrará el pago «${p.plantilla.nombre}» con fecha ${fmtDate(p.fecha_programada)} y monto ${formatUsd(p.plantilla.saldo_usd)}.`,
      confirmText: "Aprobar pago",
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      const result = await aprobarGastoAutoPendiente(p.id);
      onSuccess(
        `Pago registrado — operación #${result.presupuesto.nro_registro}`,
        "Pago automático"
      );
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo aprobar");
    } finally {
      setBusyId(null);
    }
  };

  const rechazar = async (p: GastoAutoPendiente) => {
    const ok = await confirmAction({
      title: "Omitir este mes",
      message: `No se registrará el pago «${p.plantilla.nombre}» en ${p.periodo}. Podés aprobarlo el mes que viene si actualizás la plantilla.`,
      confirmText: "Omitir mes",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await rechazarGastoAutoPendiente(p.id);
      onSuccess("Pago omitido para este mes");
      await cargar();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo omitir");
    } finally {
      setBusyId(null);
    }
  };

  const activasCount = plantillas.filter((p) => p.activo).length;
  const pausadasCount = plantillas.filter((p) => !p.activo).length;
  const hayGastos = gastosCuenta.length > 0;

  const iconStyle = {
    "--sg-hub-icon-bg": AUTO_ICON_THEME.accentSoft,
    "--sg-hub-icon-fg": AUTO_ICON_THEME.accent,
  } as CSSProperties;

  const kpiStrip = (
    <section className="sg-hub-kpi-strip presupuesto-auto-kpi-strip" aria-label="Resumen">
      <SgHubKpi
        variant={pendientesAprobacion.length > 0 ? "dark" : "light"}
        kicker="Tu gestión"
        value={loading || !apiOnline ? "—" : String(pendientesAprobacion.length)}
        hint={
          puedeAprobar
            ? "Pagos automáticos esperando tu aprobación este mes."
            : "Solo el administrador de la cuenta aprueba los pagos automáticos."
        }
        trend={pendientesAprobacion.length > 0 ? "Requieren acción" : "Al día"}
        bars={<SgMiniBars highlight={pendientesAprobacion.length > 0 ? "last" : "mid"} />}
      />
      <SgHubKpi
        kicker="Reglas activas"
        value={loading || !apiOnline ? "—" : String(activasCount)}
        hint="Automatizaciones que generarán solicitudes en los próximos meses."
        bars={<SgMiniBars />}
      />
      <SgHubKpi
        kicker="Pausadas"
        value={loading || !apiOnline ? "—" : String(pausadasCount)}
        hint="Reglas detenidas temporalmente por el responsable."
        bars={<SgMiniBars highlight="mid" />}
      />
    </section>
  );

  return (
    <div
      className={`presupuesto-auto-page${panelNueva ? " is-creating" : ""}`}
    >
      {!panelNueva ? (
        <div className="presupuesto-auto-main presupuesto-hub-workspace presupuesto-auto">
          {kpiStrip}

          <section className="sg-hub-panel presupuesto-auto-intro-panel" aria-label="Cómo funciona">
            <div className="presupuesto-auto-intro-layout">
              <span className="sg-hub-module-icon presupuesto-auto-intro-icon" style={iconStyle}>
                <HubMenuIcon id="presupuesto_automatizacion" />
              </span>
              <div className="presupuesto-auto-intro-copy">
                <p className="sg-hub-panel-kicker">Flujo mensual</p>
                <h2 className="sg-hub-panel-title">Gastos rutinarios automatizados</h2>
                <p className="presupuesto-auto-intro-text muted">
                  Elegí un gasto que se repite cada mes y programá el día del pago. Cuando
                  llegue la fecha, el administrador de la cuenta deberá aprobarlo antes de
                  registrarlo — podés actualizar montos o pausar la regla si sos responsable.
                </p>
              </div>
              {puedeEscribir ? (
                <button
                  type="button"
                  className="sg-hub-cta presupuesto-auto-new-btn"
                  onClick={abrirNueva}
                  disabled={!apiOnline || loading || !hayGastos}
                >
                  <Plus size={16} aria-hidden />
                  Nueva automatización
                </button>
              ) : null}
            </div>
          </section>

      {puedeAprobar && pendientesAprobacion.length > 0 ? (
        <section
          className="sg-hub-panel presupuesto-auto-pendientes-panel"
          aria-label="Pendientes de aprobación"
        >
          <div className="sg-hub-panel-head presupuesto-hub-panel-head-row">
            <div>
              <p className="sg-hub-panel-kicker">Antes de pagar</p>
              <h2 className="sg-hub-panel-title">
                Pendientes de aprobación ({pendientesAprobacion.length})
              </h2>
            </div>
          </div>
          <ul className="presupuesto-hub-recent-list presupuesto-auto-list">
            {pendientesAprobacion.map((p) => (
              <li key={p.id}>
                <article className="presupuesto-hub-recent-item presupuesto-hub-recent-item--latest presupuesto-auto-pendiente-item">
                  <span className="presupuesto-hub-recent-icon" aria-hidden>
                    <CalendarClock size={18} strokeWidth={1.65} />
                  </span>
                  <span className="presupuesto-hub-recent-body">
                    <span className="presupuesto-hub-recent-top">
                      <span className="presupuesto-hub-recent-title">{p.plantilla.nombre}</span>
                      <span className="presupuesto-hub-recent-badge">Aprobar</span>
                    </span>
                    <span className="presupuesto-hub-recent-meta">
                      {empresaCorta(p.plantilla.empresa)} · {p.periodo} ·{" "}
                      {fmtDate(p.fecha_programada)}
                    </span>
                    <span className="presupuesto-hub-recent-foot">
                      <span>{p.plantilla.concepto}</span>
                      <span className="presupuesto-hub-recent-usd">
                        {formatUsd(p.plantilla.saldo_usd)}
                        {p.plantilla.pesos > 0 ? ` · $ ${fmtNum(p.plantilla.pesos, 0)}` : ""}
                      </span>
                    </span>
                    <span className="presupuesto-auto-item-actions">
                      <button
                        type="button"
                        className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                        onClick={() => abrirEditar(p.plantilla)}
                        disabled={busyId === p.id}
                      >
                        <Pencil size={14} aria-hidden />
                        Actualizar
                      </button>
                      <button
                        type="button"
                        className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact presupuesto-auto-btn-omit"
                        onClick={() => void rechazar(p)}
                        disabled={busyId === p.id}
                      >
                        <X size={14} aria-hidden />
                        Omitir mes
                      </button>
                      <button
                        type="button"
                        className="sg-hub-cta sg-hub-cta--compact"
                        onClick={() => void aprobar(p)}
                        disabled={busyId === p.id}
                      >
                        <Check size={14} aria-hidden />
                        Aprobar pago
                      </button>
                    </span>
                  </span>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="sg-hub-panel presupuesto-auto-plantillas-panel" aria-label="Automatizaciones">
        <div className="sg-hub-panel-head presupuesto-hub-panel-head-row">
          <div>
            <p className="sg-hub-panel-kicker">Reglas programadas</p>
            <h2 className="sg-hub-panel-title">Mis automatizaciones</h2>
          </div>
        </div>

        {loading ? (
          <ul className="presupuesto-hub-recent-skeleton-list" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={`auto-skel-${i}`}>
                <div className="presupuesto-hub-recent-skeleton-row" aria-hidden>
                  <span className="presupuesto-hub-recent-skeleton-icon" />
                  <span className="presupuesto-hub-recent-skeleton-lines">
                    <span />
                    <span />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : plantillas.length === 0 ? (
          <div className="presupuesto-hub-recent-empty">
            <p className="presupuesto-hub-recent-empty-text">
              No hay automatizaciones todavía.
            </p>
            <p className="muted">
              Creá una a partir de un gasto que ya ingresaste y que se repite todos los meses.
            </p>
            {puedeEscribir && hayGastos ? (
              <button
                type="button"
                className="sg-hub-cta presupuesto-hub-recent-cta"
                onClick={abrirNueva}
                disabled={!apiOnline}
              >
                <Plus size={16} aria-hidden />
                Nueva automatización
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="presupuesto-hub-recent-list presupuesto-auto-list">
            {plantillas.map((p) => {
              const soyResponsable = esResponsable(p, currentUser);
              return (
                <li key={p.id}>
                  <article
                    className={`presupuesto-hub-recent-item presupuesto-auto-plantilla-item${p.activo ? "" : " is-paused"}`}
                  >
                    <span
                      className="sg-hub-module-icon presupuesto-auto-plantilla-icon"
                      style={iconStyle}
                      aria-hidden
                    >
                      <HubMenuIcon id="presupuesto_automatizacion" />
                    </span>
                    <span className="presupuesto-hub-recent-body">
                      <span className="presupuesto-hub-recent-top">
                        <span className="presupuesto-hub-recent-title">{p.nombre}</span>
                        <span
                          className={`presupuesto-auto-badge${p.activo ? " is-active" : ""}`}
                        >
                          {p.activo ? "Activa" : "Pausada"}
                        </span>
                      </span>
                      <span className="presupuesto-hub-recent-meta">
                        {diaMesLabel(p)} · {empresaCorta(p.empresa)}
                      </span>
                      <span className="presupuesto-hub-recent-foot">
                        <span className="muted">
                          Responsable: {p.responsable_nombre || p.responsable_email}
                          {!soyResponsable ? " (otro usuario)" : ""}
                        </span>
                        <span className="presupuesto-hub-recent-usd">{formatUsd(p.saldo_usd)}</span>
                      </span>
                      {soyResponsable && puedeEscribir ? (
                        <span className="presupuesto-auto-item-actions">
                          <button
                            type="button"
                            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                            title="Editar montos y día"
                            onClick={() => abrirEditar(p)}
                            disabled={busyId === p.id}
                          >
                            <Pencil size={14} aria-hidden />
                            Editar
                          </button>
                          <button
                            type="button"
                            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                            title={p.activo ? "Pausar" : "Reanudar"}
                            onClick={() => void togglePausa(p)}
                            disabled={busyId === p.id}
                          >
                            {p.activo ? (
                              <Pause size={14} aria-hidden />
                            ) : (
                              <Play size={14} aria-hidden />
                            )}
                            {p.activo ? "Pausar" : "Reanudar"}
                          </button>
                          <button
                            type="button"
                            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact presupuesto-auto-btn-omit"
                            title="Eliminar"
                            onClick={() => void eliminar(p)}
                            disabled={busyId === p.id}
                          >
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
        </div>
      ) : (
        <aside className="presupuesto-auto-right" aria-label="Nueva automatización">
          {kpiStrip}
          <AutomatizacionNuevaPanel
            gastos={gastosCuenta}
            catalogos={catalogos}
            apiOnline={apiOnline}
            busy={busyId === -1}
            onClose={cerrarNueva}
            onSubmit={(form) => void guardarNueva(form)}
            onError={onError}
            onSuccess={onSuccess}
          />
        </aside>
      )}

      {editando && formEdit
        ? createPortal(
            <div
              className="pd-overlay presupuesto-auto-modal-overlay bn-ui"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setEditando(null);
                  setFormEdit(null);
                }
              }}
            >
              <div
                className="pd-dialog presupuesto-auto-modal presupuesto-auto-modal--hub presupuesto-auto-modal--edit presupuesto-module-page"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pres-auto-edit-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="presupuesto-auto-modal-head">
                  <div className="presupuesto-auto-modal-head-main">
                    <span
                      className="sg-hub-module-icon presupuesto-auto-modal-head-icon"
                      style={iconStyle}
                    >
                      <HubMenuIcon id="presupuesto_automatizacion" />
                    </span>
                    <div className="presupuesto-auto-modal-head-copy">
                      <p className="sg-hub-panel-kicker">Actualizar regla</p>
                      <h2 id="pres-auto-edit-title" className="sg-hub-main-title presupuesto-auto-modal-title">
                        {editando.nombre}
                      </h2>
                      <p className="sg-hub-main-sub">
                        {programacionResumen(formEdit)}. Los cambios aplican al próximo pago
                        pendiente.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sg-hub-icon-btn presupuesto-auto-modal-close"
                    aria-label="Cerrar"
                    onClick={() => {
                      setEditando(null);
                      setFormEdit(null);
                    }}
                  >
                    <X size={18} aria-hidden />
                  </button>
                </header>
                <div className="presupuesto-auto-modal-workspace presupuesto-hub-workspace presupuesto-auto-modal-workspace--single">
                  <section className="sg-hub-panel presupuesto-auto-modal-config-panel">
                    <AutomatizacionPlantillaForm
                      form={formEdit}
                      onChange={(patch) =>
                        setFormEdit((prev) => (prev ? { ...prev, ...patch } : prev))
                      }
                      catalogos={catalogos}
                      apiOnline={apiOnline}
                      showActivo
                      moneySyncKey={editMoneyKey}
                      onError={onError}
                      onSuccess={onSuccess}
                    />
                  </section>
                </div>
                <footer className="presupuesto-auto-modal-foot">
                  <button
                    type="button"
                    className="sg-hub-cta sg-hub-cta--ghost"
                    onClick={() => {
                      setEditando(null);
                      setFormEdit(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="sg-hub-cta"
                    onClick={() => void guardarEditar()}
                    disabled={busyId === editando.id}
                  >
                    Guardar cambios
                  </button>
                </footer>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
