import { useEffect, useMemo, useState } from "react";
import type {
  ContribucionRuralCalendariosStore,
  ContribucionRuralJurisdiccionId,
  ModalidadPagoVencImp,
  PlanCuotasJurisdiccionKey,
} from "../types/contribucion-rural";
import type { RegimenPrimariaRuralKey } from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";
import { CONTRIBUCION_RURAL_JURISDICCION_ORDER } from "../types/contribucion-rural";
import {
  MODALIDAD_PAGO_LABEL,
  departamentoTienePlanesElegibles,
  labelCuotasFijas,
  normalizarBusquedaJurisdiccion,
  normalizarPlanesCuotasPorJurisdiccion,
  planesDisponibles,
} from "../utils/contribucion-rural-view";
import { escudoDepartamentoSrc } from "../utils/escudos-departamentos";
import { MenuAppIcon } from "./icons/MenuAppIcons";

interface Props {
  store: ContribucionRuralCalendariosStore;
  saving: boolean;
  initialJurisdiccionIds?: ContribucionRuralJurisdiccionId[];
  initialModalidad?: ModalidadPagoVencImp | null;
  initialModalidadPatente?: ModalidadPagoVencImp | null;
  initialSeguirPatente?: boolean;
  initialSeguirBps?: boolean;
  initialSeguirPrimaria?: boolean;
  initialRegimenPrimaria?: RegimenPrimariaRuralKey;
  initialPlanesCuotas?: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
  modoEdicion?: boolean;
  pasoInicialOverride?: Paso;
  onDismiss?: () => void;
  onComplete: (payload: {
    jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
    modalidad_pago: ModalidadPagoVencImp;
    modalidad_pago_patente: ModalidadPagoVencImp;
    planes_cuotas_por_jurisdiccion: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
    seguir_patente_sucive: boolean;
    seguir_bps_caja_rural: boolean;
    seguir_primaria_rural: boolean;
    regimen_primaria_rural: RegimenPrimariaRuralKey;
  }) => void;
}

type Paso = 1 | 2 | 3 | 4 | 5;

const TOTAL_PASOS = 5;

function formatearListaDepartamentos(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

function pasoInicial(
  deptos: ContribucionRuralJurisdiccionId[],
  modalidad: ModalidadPagoVencImp | null,
): Paso {
  if (deptos.length === 0) return 1;
  if (!modalidad) return 2;
  return 3;
}

export default function VencimientosImpuestosOnboarding({
  store,
  saving,
  initialJurisdiccionIds = [],
  initialModalidad = null,
  initialModalidadPatente = null,
  initialSeguirPatente = true,
  initialSeguirBps = true,
  initialSeguirPrimaria = true,
  initialRegimenPrimaria = "con_explotacion",
  initialPlanesCuotas = {},
  modoEdicion = false,
  pasoInicialOverride,
  onDismiss,
  onComplete,
}: Props) {
  const [paso, setPaso] = useState<Paso>(
    () => pasoInicialOverride ?? pasoInicial(initialJurisdiccionIds, initialModalidad),
  );
  const [soloPatente, setSoloPatente] = useState(initialJurisdiccionIds.length === 0 && initialSeguirPatente);
  const [busqueda, setBusqueda] = useState("");
  const [jurisdiccionIds, setJurisdiccionIds] = useState<ContribucionRuralJurisdiccionId[]>(
    initialJurisdiccionIds,
  );
  const [modalidadRural, setModalidadRural] = useState<ModalidadPagoVencImp | null>(initialModalidad);
  const [modalidadPatente, setModalidadPatente] = useState<ModalidadPagoVencImp>(
    initialModalidadPatente ?? initialModalidad ?? "cuotas",
  );
  const [seguirPatente, setSeguirPatente] = useState(initialSeguirPatente);
  const [seguirBps, setSeguirBps] = useState(initialSeguirBps);
  const [seguirPrimaria, setSeguirPrimaria] = useState(initialSeguirPrimaria);
  const [regimenPrimaria, setRegimenPrimaria] = useState<RegimenPrimariaRuralKey>(initialRegimenPrimaria);
  const [planesCuotasPorDepto, setPlanesCuotasPorDepto] = useState<
    Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>
  >(() =>
    normalizarPlanesCuotasPorJurisdiccion(
      initialJurisdiccionIds,
      store.jurisdicciones,
      initialPlanesCuotas,
    ),
  );

  const configurarRural = !soloPatente;

  useEffect(() => {
    setPlanesCuotasPorDepto((prev) =>
      normalizarPlanesCuotasPorJurisdiccion(jurisdiccionIds, store.jurisdicciones, prev),
    );
  }, [jurisdiccionIds, store.jurisdicciones]);

  const departamentos = useMemo(() => {
    const q = normalizarBusquedaJurisdiccion(busqueda);
    return CONTRIBUCION_RURAL_JURISDICCION_ORDER.map((id) => store.jurisdicciones[id])
      .filter(Boolean)
      .filter((config) => {
        if (!q) return true;
        const haystack = normalizarBusquedaJurisdiccion(
          `${config.label} ${config.intendenciaLabel}`,
        );
        return haystack.includes(q);
      });
  }, [store, busqueda]);

  const seleccionados = useMemo(
    () => jurisdiccionIds.map((id) => store.jurisdicciones[id]).filter(Boolean),
    [jurisdiccionIds, store],
  );

  const seleccionSet = useMemo(() => new Set(jurisdiccionIds), [jurisdiccionIds]);
  const labelsSeleccionados = seleccionados.map((c) => c.label);

  const puedeContinuarPaso1 = configurarRural ? jurisdiccionIds.length > 0 : true;
  const puedeContinuarPaso2 = modalidadRural !== null;
  const puedeFinalizar =
    (configurarRural ? jurisdiccionIds.length > 0 && modalidadRural !== null : true) &&
    (jurisdiccionIds.length > 0 || seguirPatente || seguirBps || seguirPrimaria);

  const toggleDepartamento = (id: ContribucionRuralJurisdiccionId) => {
    setSoloPatente(false);
    setJurisdiccionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const irASoloPatente = () => {
    setSoloPatente(true);
    setJurisdiccionIds([]);
    setModalidadRural("cuotas");
    setModalidadPatente("cuotas");
    setPaso(3);
  };

  const continuarDesdePaso1 = () => {
    if (configurarRural && jurisdiccionIds.length > 0) {
      setPaso(2);
      return;
    }
    if (soloPatente) {
      setPaso(3);
    }
  };

  const stepClass = (n: Paso) => {
    if (paso === n) return " venc-imp-onboard-step--active";
    if (paso > n) return " venc-imp-onboard-step--done";
    if (!configurarRural && n <= 2) return " venc-imp-onboard-step--skip";
    return "";
  };

  return (
    <div
      className="venc-imp-onboard venc-imp-onboard-hub"
      role="dialog"
      aria-modal="true"
      aria-labelledby="venc-imp-onboard-title"
    >
      <div className="venc-imp-onboard-shell sg-hub venc-imp-onboard-shell--hub">
        <aside className="venc-imp-onboard-aside sg-hub-aside" aria-label="Pasos de configuración">
          <div className="sg-hub-aside-brand">
            <span className="sg-hub-aside-logo venc-imp-hub-aside-logo" aria-hidden>
              <MenuAppIcon id="vencimientos_impuestos" />
            </span>
            <div>
              <p className="sg-hub-aside-kicker">SCG · Módulo</p>
              <p className="sg-hub-aside-title">
                {modoEdicion ? "Preferencias" : "Vencimientos"}
              </p>
            </div>
          </div>
          <p className="venc-imp-onboard-aside-lead">
            {modoEdicion
              ? "Los ajustes que guardes se aplican a todos los usuarios de la cuenta: contribución rural, patente SUCIVE, BPS Caja rural e Impuesto Primaria (DGI)."
              : "Se configura una sola vez para toda la cuenta. El primer Administrador o Gestor que complete estos pasos habilita los vencimientos para el resto del equipo."}
          </p>
          <ol className="venc-imp-onboard-steps" aria-label="Progreso">
            <li className={`venc-imp-onboard-step${stepClass(1)}`}>
              <span className="venc-imp-onboard-step-num">1</span>
              <span className="venc-imp-onboard-step-text">
                <strong>Ubicación</strong>
                <small>Predios rurales</small>
              </span>
            </li>
            <li className={`venc-imp-onboard-step${stepClass(2)}`}>
              <span className="venc-imp-onboard-step-num">2</span>
              <span className="venc-imp-onboard-step-text">
                <strong>Contribución rural</strong>
                <small>Contado o cuotas</small>
              </span>
            </li>
            <li className={`venc-imp-onboard-step${stepClass(3)}`}>
              <span className="venc-imp-onboard-step-num">3</span>
              <span className="venc-imp-onboard-step-text">
                <strong>Patente SUCIVE</strong>
                <small>¿Incluir en su calendario?</small>
              </span>
            </li>
            <li className={`venc-imp-onboard-step${stepClass(4)}`}>
              <span className="venc-imp-onboard-step-num">4</span>
              <span className="venc-imp-onboard-step-text">
                <strong>BPS Caja rural</strong>
                <small>¿Incluir en su calendario?</small>
              </span>
            </li>
            <li className={`venc-imp-onboard-step${stepClass(5)}`}>
              <span className="venc-imp-onboard-step-num">5</span>
              <span className="venc-imp-onboard-step-text">
                <strong>Primaria rural (DGI)</strong>
                <small>¿Incluir en su calendario?</small>
              </span>
            </li>
          </ol>
          {onDismiss && (
            <div className="sg-hub-aside-foot">
              <button
                type="button"
                className="sg-hub-nav-item sg-hub-nav-item--muted"
                onClick={onDismiss}
              >
                Cancelar y volver
              </button>
            </div>
          )}
        </aside>

        <div className="venc-imp-onboard-card sg-hub-main venc-imp-onboard-card--hub">
          <header className="venc-imp-onboard-head sg-hub-main-head venc-imp-onboard-head--hub">
            <div className="venc-imp-onboard-head-box">
              <p className="venc-imp-onboard-kicker sg-hub-panel-kicker">
                {modoEdicion
                  ? "Preferencias de la cuenta"
                  : `Configuración inicial de la cuenta · Paso ${paso} de ${TOTAL_PASOS}`}
              </p>
              <h2 id="venc-imp-onboard-title" className="sg-hub-main-title venc-imp-onboard-head-title">
                {modoEdicion
                  ? "Ajustá el calendario de vencimientos"
                  : "Definamos los vencimientos de la cuenta"}
              </h2>
              <p className="venc-imp-onboard-lead sg-hub-main-sub">
                {modoEdicion
                  ? "Los cambios aplican a toda la cuenta y se reflejan en contribución rural, patente SUCIVE, BPS Caja rural e Impuesto Primaria (DGI)."
                  : "Estos parámetros son compartidos: todos los usuarios de la cuenta verán el mismo calendario. Podés modificarlos después desde Preferencias de la cuenta en este módulo."}
              </p>
            </div>
          </header>

          <div className="venc-imp-onboard-workspace sg-hub-panel">
          {paso === 1 && (
            <section className="venc-imp-onboard-panel" aria-labelledby="venc-imp-onboard-p1">
              <div className="venc-imp-onboard-panel-body">
                <div className="venc-imp-onboard-intro-box">
                  <h3 id="venc-imp-onboard-p1">¿Dónde están sus establecimientos?</h3>
                  <p className="venc-imp-onboard-hint">
                    Seleccioná los departamentos con predios rurales. Si solo le interesa la patente de
                    vehículos, puede omitir este paso.
                  </p>
                </div>

                <div className="venc-imp-onboard-search-box">
                  <label className="venc-imp-onboard-search">
                    <span className="venc-imp-onboard-search-label">Buscar departamento</span>
                    <input
                      type="search"
                      value={busqueda}
                      placeholder="Ej.: Rivera, Salto, Canelones…"
                      onChange={(e) => setBusqueda(e.target.value)}
                      autoFocus
                    />
                  </label>
                </div>

                <div className="venc-imp-onboard-deptos-box">
                  <p className="venc-imp-onboard-deptos-meta">
                    {seleccionados.length > 0
                      ? `${seleccionados.length} seleccionado${seleccionados.length === 1 ? "" : "s"} · `
                      : ""}
                    {departamentos.length} disponible{departamentos.length === 1 ? "" : "s"}
                  </p>

                  <div
                    className="venc-imp-onboard-deptos"
                    role="listbox"
                    aria-label="Departamentos"
                    aria-multiselectable="true"
                  >
                    {departamentos.map((config) => {
                      const activo = seleccionSet.has(config.id);
                      return (
                        <button
                          key={config.id}
                          type="button"
                          role="option"
                          aria-selected={activo}
                          className={`venc-imp-onboard-depto${activo ? " venc-imp-onboard-depto--active" : ""}`}
                          onClick={() => toggleDepartamento(config.id)}
                        >
                          <img
                            className="venc-imp-onboard-depto-escudo"
                            src={escudoDepartamentoSrc(config.id)}
                            alt=""
                            width={24}
                            height={24}
                            loading="lazy"
                            decoding="async"
                          />
                          <span className="venc-imp-onboard-depto-name">{config.label}</span>
                          {activo && <span className="venc-imp-onboard-depto-check" aria-hidden>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <footer className="venc-imp-onboard-actions venc-imp-onboard-actions--split">
                <button type="button" className="venc-imp-link-btn" onClick={irASoloPatente}>
                  Solo impuestos nacionales →
                </button>
                <button
                  type="button"
                  className="venc-imp-onboard-btn venc-imp-onboard-btn--primary sg-hub-cta"
                  disabled={!puedeContinuarPaso1}
                  onClick={continuarDesdePaso1}
                >
                  Continuar
                </button>
              </footer>
            </section>
          )}

          {paso === 2 && configurarRural && seleccionados.length > 0 && (
            <section className="venc-imp-onboard-panel" aria-labelledby="venc-imp-onboard-p2">
              <div className="venc-imp-onboard-panel-body">
                <div className="venc-imp-onboard-selection venc-imp-onboard-selection--inline">
                  <span className="venc-imp-onboard-selection-label">Departamentos</span>
                  <strong>{formatearListaDepartamentos(labelsSeleccionados)}</strong>
                </div>

                <h3 id="venc-imp-onboard-p2">¿Cómo paga la contribución rural?</h3>
                <p className="venc-imp-onboard-hint">
                  Usaremos esta preferencia para los calendarios de{" "}
                  <strong>{formatearListaDepartamentos(labelsSeleccionados)}</strong>.
                </p>

                <div className="venc-imp-onboard-modalidades" role="radiogroup">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modalidadRural === "contado"}
                    className={`venc-imp-onboard-modalidad${modalidadRural === "contado" ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setModalidadRural("contado")}
                  >
                    <span className="venc-imp-onboard-modalidad-icon" aria-hidden>$</span>
                    <span className="venc-imp-onboard-modalidad-title">
                      {MODALIDAD_PAGO_LABEL.contado}
                    </span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      Una fecha anual por departamento, con bonificaciones de la intendencia.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modalidadRural === "cuotas"}
                    className={`venc-imp-onboard-modalidad${modalidadRural === "cuotas" ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setModalidadRural("cuotas")}
                  >
                    <span className="venc-imp-onboard-modalidad-icon venc-imp-onboard-modalidad-icon--cuotas" aria-hidden>⫼</span>
                    <span className="venc-imp-onboard-modalidad-title">
                      {MODALIDAD_PAGO_LABEL.cuotas}
                    </span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      Todas las cuotas del ejercicio con sus vencimientos.
                    </span>
                  </button>
                </div>

                {modalidadRural === "cuotas" && (
                  <div className="venc-imp-onboard-planes-block">
                    <h4 className="venc-imp-onboard-subtitle venc-imp-onboard-subtitle--planes">
                      Cantidad de cuotas por departamento
                    </h4>
                    <p className="venc-imp-onboard-hint">
                      Indique el plan de cuotas de cada departamento según cómo abona en la intendencia.
                    </p>
                    <ul className="venc-imp-onboard-planes-list">
                      {seleccionados.map((config) => {
                        const planes = planesDisponibles(config);
                        const planActivo = planesCuotasPorDepto[config.id];
                        return (
                          <li key={config.id} className="venc-imp-onboard-planes-row">
                            <span className="venc-imp-onboard-planes-depto">{config.label}</span>
                            {departamentoTienePlanesElegibles(config) ? (
                              <div
                                className="venc-imp-onboard-planes-options"
                                role="radiogroup"
                                aria-label={`Plan de cuotas en ${config.label}`}
                              >
                                {planes.map((planKey) => (
                                  <button
                                    key={planKey}
                                    type="button"
                                    role="radio"
                                    aria-checked={planActivo === planKey}
                                    className={`venc-imp-onboard-plan${planActivo === planKey ? " venc-imp-onboard-plan--active" : ""}`}
                                    onClick={() =>
                                      setPlanesCuotasPorDepto((prev) => ({
                                        ...prev,
                                        [config.id]: planKey,
                                      }))
                                    }
                                  >
                                    {config.planes![planKey].label}
                                  </button>
                                ))}
                              </div>
                            ) : planes.length === 1 ? (
                              <span className="venc-imp-onboard-planes-fijo">
                                {config.planes![planes[0]].label}
                              </span>
                            ) : (
                              <span className="venc-imp-onboard-planes-fijo">{labelCuotasFijas(config)}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <footer className="venc-imp-onboard-actions">
                <button type="button" className="venc-imp-onboard-btn" onClick={() => setPaso(1)}>
                  Volver
                </button>
                <button
                  type="button"
                  className="venc-imp-onboard-btn venc-imp-onboard-btn--primary sg-hub-cta"
                  disabled={!puedeContinuarPaso2}
                  onClick={() => {
                    if (modalidadRural) setModalidadPatente(modalidadRural);
                    setPaso(3);
                  }}
                >
                  Continuar
                </button>
              </footer>
            </section>
          )}

          {paso === 3 && (
            <section className="venc-imp-onboard-panel" aria-labelledby="venc-imp-onboard-p3">
              <div className="venc-imp-onboard-panel-body">
                <h3 id="venc-imp-onboard-p3">
                  ¿Desea incluir la patente de rodados (SUCIVE) en su calendario?
                </h3>
                <p className="venc-imp-onboard-hint">
                  El SUCIVE es el sistema nacional de cobro de la patente. Los vencimientos son los
                  mismos en todo el país: seis cuotas bimestrales o pago contado anual con bonificación
                  del 20%.
                </p>

                <div
                  className="venc-imp-onboard-modalidades venc-imp-onboard-modalidades--compact"
                  role="radiogroup"
                  aria-label="Incluir vencimientos de patente SUCIVE"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={seguirPatente}
                    className={`venc-imp-onboard-modalidad${seguirPatente ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirPatente(true)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon" aria-hidden>✓</span>
                    <span className="venc-imp-onboard-modalidad-title">Sí, deseo consultar los vencimientos</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      Tengo vehículos a mi nombre o me interesa estar al tanto de las fechas de la
                      patente de rodados.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!seguirPatente}
                    className={`venc-imp-onboard-modalidad${!seguirPatente ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirPatente(false)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon venc-imp-onboard-modalidad-icon--muted" aria-hidden>
                      —
                    </span>
                    <span className="venc-imp-onboard-modalidad-title">No, omitir por ahora</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      No poseo vehículos registrados o no necesito esta información en el calendario.
                      Podrá activarla más adelante desde preferencias.
                    </span>
                  </button>
                </div>

                {seguirPatente && (
                  <>
                    <h4 className="venc-imp-onboard-subtitle">Forma de pago de la patente</h4>

                    <div className="venc-imp-onboard-modalidades" role="radiogroup" aria-label="Forma de pago de la patente">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={modalidadPatente === "contado"}
                        className={`venc-imp-onboard-modalidad${modalidadPatente === "contado" ? " venc-imp-onboard-modalidad--active" : ""}`}
                        onClick={() => setModalidadPatente("contado")}
                      >
                        <span className="venc-imp-onboard-modalidad-icon" aria-hidden>$</span>
                        <span className="venc-imp-onboard-modalidad-title">
                          {MODALIDAD_PAGO_LABEL.contado}
                        </span>
                        <span className="venc-imp-onboard-modalidad-desc">
                          20% de descuento abonando antes del 1er vencimiento.
                        </span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={modalidadPatente === "cuotas"}
                        className={`venc-imp-onboard-modalidad${modalidadPatente === "cuotas" ? " venc-imp-onboard-modalidad--active" : ""}`}
                        onClick={() => setModalidadPatente("cuotas")}
                      >
                        <span className="venc-imp-onboard-modalidad-icon venc-imp-onboard-modalidad-icon--cuotas" aria-hidden>⫼</span>
                        <span className="venc-imp-onboard-modalidad-title">
                          {MODALIDAD_PAGO_LABEL.cuotas}
                        </span>
                        <span className="venc-imp-onboard-modalidad-desc">
                          Seis cuotas bimestrales con 10% de bonificación por cuota paga en fecha.
                        </span>
                      </button>
                    </div>
                  </>
                )}

                {!seguirPatente && (
                  <p className="venc-imp-onboard-omit-note" role="status">
                    No se mostrará la pestaña de patente SUCIVE. Puede habilitarla cuando lo necesite
                    desde <strong>Cambiar preferencias</strong> en el módulo de vencimientos.
                  </p>
                )}
              </div>

              <footer className="venc-imp-onboard-actions">
                {onDismiss && (
                  <button type="button" className="venc-imp-onboard-btn" onClick={onDismiss}>
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  className="venc-imp-onboard-btn"
                  onClick={() => setPaso(configurarRural && jurisdiccionIds.length > 0 ? 2 : 1)}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="venc-imp-onboard-btn venc-imp-onboard-btn--primary sg-hub-cta"
                  onClick={() => setPaso(4)}
                >
                  Continuar
                </button>
              </footer>
            </section>
          )}

          {paso === 4 && (
            <section className="venc-imp-onboard-panel" aria-labelledby="venc-imp-onboard-p4">
              <div className="venc-imp-onboard-panel-body">
                <h3 id="venc-imp-onboard-p4">
                  ¿Desea incluir los aportes BPS Caja rural en su calendario?
                </h3>
                <p className="venc-imp-onboard-hint">
                  Los aportes de seguridad social del personal rural se pagan en tres cuatrimestres
                  según el calendario nacional del BPS. Las fechas son las mismas en todo el país.
                </p>

                <div
                  className="venc-imp-onboard-modalidades venc-imp-onboard-modalidades--compact"
                  role="radiogroup"
                  aria-label="Incluir vencimientos BPS Caja rural"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={seguirBps}
                    className={`venc-imp-onboard-modalidad${seguirBps ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirBps(true)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon" aria-hidden>✓</span>
                    <span className="venc-imp-onboard-modalidad-title">Sí, deseo consultar los vencimientos</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      Tengo personal rural registrado en BPS o me interesa estar al tanto de las
                      fechas de aportes cuatrimestrales.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!seguirBps}
                    className={`venc-imp-onboard-modalidad${!seguirBps ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirBps(false)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon venc-imp-onboard-modalidad-icon--muted" aria-hidden>
                      —
                    </span>
                    <span className="venc-imp-onboard-modalidad-title">No, omitir por ahora</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      No necesito esta información en el calendario. Podrá activarla más adelante
                      desde preferencias.
                    </span>
                  </button>
                </div>

                {!seguirBps && (
                  <p className="venc-imp-onboard-omit-note" role="status">
                    No se mostrará la pestaña de BPS Caja rural. Puede habilitarla cuando lo necesite
                    desde <strong>Cambiar preferencias</strong> en el módulo de vencimientos.
                  </p>
                )}
              </div>

              <footer className="venc-imp-onboard-actions">
                {onDismiss && (
                  <button type="button" className="venc-imp-onboard-btn" onClick={onDismiss}>
                    Cancelar
                  </button>
                )}
                <button type="button" className="venc-imp-onboard-btn" onClick={() => setPaso(3)}>
                  Volver
                </button>
                <button
                  type="button"
                  className="venc-imp-onboard-btn venc-imp-onboard-btn--primary sg-hub-cta"
                  onClick={() => setPaso(5)}
                >
                  Continuar
                </button>
              </footer>
            </section>
          )}

          {paso === 5 && (
            <section className="venc-imp-onboard-panel" aria-labelledby="venc-imp-onboard-p5">
              <div className="venc-imp-onboard-panel-body">
                <h3 id="venc-imp-onboard-p5">
                  ¿Desea incluir el Impuesto Primaria rural (DGI) en su calendario?
                </h3>
                <p className="venc-imp-onboard-hint">
                  El Impuesto de Enseñanza Primaria sobre padrones rurales se paga en tres cuotas según
                  el calendario nacional de la DGI. Los padrones con explotación agropecuaria deben
                  presentar declaración jurada antes del 30 de abril.
                </p>

                <div
                  className="venc-imp-onboard-modalidades venc-imp-onboard-modalidades--compact"
                  role="radiogroup"
                  aria-label="Incluir vencimientos Impuesto Primaria rural"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={seguirPrimaria}
                    className={`venc-imp-onboard-modalidad${seguirPrimaria ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirPrimaria(true)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon" aria-hidden>✓</span>
                    <span className="venc-imp-onboard-modalidad-title">Sí, deseo consultar los vencimientos</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      Tengo padrones rurales sujetos al impuesto de Primaria o me interesa estar al
                      tanto de las fechas de la DGI.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!seguirPrimaria}
                    className={`venc-imp-onboard-modalidad${!seguirPrimaria ? " venc-imp-onboard-modalidad--active" : ""}`}
                    onClick={() => setSeguirPrimaria(false)}
                  >
                    <span className="venc-imp-onboard-modalidad-icon venc-imp-onboard-modalidad-icon--muted" aria-hidden>
                      —
                    </span>
                    <span className="venc-imp-onboard-modalidad-title">No, omitir por ahora</span>
                    <span className="venc-imp-onboard-modalidad-desc">
                      No necesito esta información en el calendario. Podrá activarla más adelante
                      desde preferencias.
                    </span>
                  </button>
                </div>

                {seguirPrimaria && (
                  <>
                    <h4 className="venc-imp-onboard-subtitle">Tipo de padrón rural</h4>
                    <div
                      className="venc-imp-onboard-modalidades"
                      role="radiogroup"
                      aria-label="Régimen de padrón rural Primaria"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={regimenPrimaria === "con_explotacion"}
                        className={`venc-imp-onboard-modalidad${regimenPrimaria === "con_explotacion" ? " venc-imp-onboard-modalidad--active" : ""}`}
                        onClick={() => setRegimenPrimaria("con_explotacion")}
                      >
                        <span className="venc-imp-onboard-modalidad-title">
                          {REGIMEN_PRIMARIA_RURAL_LABEL.con_explotacion}
                        </span>
                        <span className="venc-imp-onboard-modalidad-desc">
                          Vencimientos fijos y declaración jurada anual (hasta 30/04).
                        </span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={regimenPrimaria === "sin_explotacion"}
                        className={`venc-imp-onboard-modalidad${regimenPrimaria === "sin_explotacion" ? " venc-imp-onboard-modalidad--active" : ""}`}
                        onClick={() => setRegimenPrimaria("sin_explotacion")}
                      >
                        <span className="venc-imp-onboard-modalidad-title">
                          {REGIMEN_PRIMARIA_RURAL_LABEL.sin_explotacion}
                        </span>
                        <span className="venc-imp-onboard-modalidad-desc">
                          Sin explotación agropecuaria ni autoconsumo BPS. Ventanas de pago por cuota.
                        </span>
                      </button>
                    </div>
                  </>
                )}

                {!seguirPrimaria && (
                  <p className="venc-imp-onboard-omit-note" role="status">
                    No se mostrará la pestaña de Primaria rural (DGI). Puede habilitarla cuando lo
                    necesite desde <strong>Cambiar preferencias</strong> en el módulo de vencimientos.
                  </p>
                )}
              </div>

              <footer className="venc-imp-onboard-actions">
                {onDismiss && (
                  <button type="button" className="venc-imp-onboard-btn" onClick={onDismiss}>
                    Cancelar
                  </button>
                )}
                <button type="button" className="venc-imp-onboard-btn" onClick={() => setPaso(4)}>
                  Volver
                </button>
                <button
                  type="button"
                  className="venc-imp-onboard-btn venc-imp-onboard-btn--primary sg-hub-cta"
                  disabled={!puedeFinalizar || saving}
                  onClick={() => {
                    if (!puedeFinalizar) return;
                    const rural: ModalidadPagoVencImp = modalidadRural ?? "cuotas";
                    onComplete({
                      jurisdiccion_ids: jurisdiccionIds,
                      modalidad_pago: rural,
                      modalidad_pago_patente: modalidadPatente,
                      planes_cuotas_por_jurisdiccion: normalizarPlanesCuotasPorJurisdiccion(
                        jurisdiccionIds,
                        store.jurisdicciones,
                        planesCuotasPorDepto,
                      ),
                      seguir_patente_sucive: seguirPatente,
                      seguir_bps_caja_rural: seguirBps,
                      seguir_primaria_rural: seguirPrimaria,
                      regimen_primaria_rural: regimenPrimaria,
                    });
                  }}
                >
                  {saving ? "Guardando…" : modoEdicion ? "Guardar preferencias" : "Ver mis vencimientos"}
                </button>
              </footer>
            </section>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
