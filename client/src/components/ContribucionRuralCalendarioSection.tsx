import { useEffect, useMemo, useState } from "react";
import {
  ESTADO_CUOTA_LABEL,
  estadoCuota,
  formatearFechaContribucionRural,
  semaforoVencimientoCuota,
  diasHastaVencimientoCuota,
  diasRestantesLabel,
} from "../utils/contribucion-rural-common";
import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { ModalidadPagoUsuario, PlanCuotasKey } from "../utils/contribucion-rural-view";
import {
  MODALIDAD_PAGO_LABEL,
  labelCuotasFijas,
  modalidadesPago,
  planPorDefecto,
  planesDisponibles,
  proximoVencimientoParaUsuario,
  vistaCalendarioParaUsuario,
} from "../utils/contribucion-rural-view";

interface Props {
  config: ContribucionRuralJurisdiccionConfig;
  modalidadUsuario: ModalidadPagoUsuario;
  planUsuario?: PlanCuotasKey;
  /** Solo muestra la modalidad y el plan elegidos en la configuración de la cuenta. */
  soloPreferenciaCuenta?: boolean;
  defaultExpanded?: boolean;
  expandPulse?: number;
  expandTarget?: boolean;
  /** Vista en modal: siempre expandido, sin acordeón. */
  modoModal?: boolean;
}

function CuotasTable({
  cuotas,
  rowKeyPrefix,
  esPagoContado,
  destacarCuota,
}: {
  cuotas: { cuota: number; fecha: string }[];
  rowKeyPrefix: string;
  esPagoContado: boolean;
  destacarCuota?: number;
}) {
  const filas = useMemo(
    () =>
      cuotas.map((item) => ({
        ...item,
        estado: estadoCuota(item.fecha),
        fechaLabel: formatearFechaContribucionRural(item.fecha),
      })),
    [cuotas],
  );

  if (filas.length === 0) {
    return (
      <p className="home-contrib-rural-empty-vista">
        Consulte la intendencia para fechas de pago contado en este departamento.
      </p>
    );
  }

  return (
    <div className="home-contrib-rural-table-wrap">
      <table className="home-contrib-rural-table">
        <thead>
          <tr>
            <th scope="col">{esPagoContado ? "Concepto" : "Cuota"}</th>
            <th scope="col">Vencimiento</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={`${rowKeyPrefix}-${f.cuota}`}
              className={[
                `home-contrib-rural-row--${f.estado}`,
                destacarCuota === f.cuota && f.estado !== "vencida"
                  ? "home-contrib-rural-row--destacada"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <td>{esPagoContado ? "Pago contado anual" : `${f.cuota}ª`}</td>
              <td>{f.fechaLabel}</td>
              <td>
                <span className={`home-contrib-rural-badge home-contrib-rural-badge--${f.estado}`}>
                  {ESTADO_CUOTA_LABEL[f.estado]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContribucionRuralCalendarioSection({
  config,
  modalidadUsuario,
  planUsuario,
  soloPreferenciaCuenta = false,
  defaultExpanded = false,
  expandPulse = 0,
  expandTarget = true,
  modoModal = false,
}: Props) {
  const anioActual = new Date().getFullYear();
  const planElegido =
    planUsuario && planesDisponibles(config).includes(planUsuario)
      ? planUsuario
      : planPorDefecto(config);
  const [planActivo, setPlanActivo] = useState<PlanCuotasKey>(() => planElegido);
  const [expanded, setExpanded] = useState(modoModal || defaultExpanded);
  const sectionId = `home-contrib-rural-${config.id}-title`;
  const panelId = `home-contrib-rural-${config.id}-panel`;

  const vista = useMemo(
    () => vistaCalendarioParaUsuario(config, modalidadUsuario, planActivo),
    [config, modalidadUsuario, planActivo],
  );

  useEffect(() => {
    if (modoModal) return;
    if (expandPulse > 0) setExpanded(expandTarget);
  }, [expandPulse, expandTarget, modoModal]);

  useEffect(() => {
    if (soloPreferenciaCuenta) {
      setPlanActivo(planElegido);
      return;
    }
    if (planUsuario && planesDisponibles(config).includes(planUsuario)) {
      setPlanActivo(planUsuario);
    }
  }, [planUsuario, config, soloPreferenciaCuenta, planElegido]);

  useEffect(() => {
    if (soloPreferenciaCuenta) return;
    if (vista.planKey && vista.planesVisibles.includes(vista.planKey)) {
      setPlanActivo(vista.planKey);
    }
  }, [vista.planKey, vista.planesVisibles, soloPreferenciaCuenta]);

  const modalidades = useMemo(() => {
    if (!soloPreferenciaCuenta) return modalidadesPago(config);
    if (modalidadUsuario === "cuotas") {
      if (planUsuario && config.planes?.[planUsuario]) {
        return [
          {
            id: `plan-${planUsuario}`,
            label: config.planes[planUsuario].label,
            detalle: `${config.planes[planUsuario].cuotas.length} vencimientos`,
          },
        ];
      }
      if (config.cuotas?.length) {
        return [{ id: "cuotas-fijas", label: labelCuotasFijas(config) }];
      }
    }
    return [];
  }, [config, modalidadUsuario, planUsuario, soloPreferenciaCuenta]);

  const planesSeleccionables = useMemo(() => {
    if (soloPreferenciaCuenta) {
      if (modalidadUsuario !== "cuotas" || !config.planes) return [];
      if (planUsuario && planesDisponibles(config).includes(planUsuario)) {
        return [planUsuario];
      }
      return [];
    }
    return vista.planesVisibles;
  }, [soloPreferenciaCuenta, modalidadUsuario, config, planUsuario, vista.planesVisibles]);
  const proxima = useMemo(
    () => proximoVencimientoParaUsuario(config, modalidadUsuario, planActivo),
    [config, modalidadUsuario, planActivo],
  );

  const proximaSemaforo = proxima ? semaforoVencimientoCuota(proxima.fecha) : null;
  const proximaDias = proxima ? diasHastaVencimientoCuota(proxima.fecha) : null;

  const fuenteHostname = useMemo(() => {
    const url = config.fuenteUrl.trim();
    if (!url) return "sitio oficial";
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "sitio oficial";
    }
  }, [config.fuenteUrl]);

  if (anioActual !== config.anio) {
    return (
      <section className="home-contrib-rural home-contrib-rural--stale" aria-labelledby={sectionId}>
        <header className="home-contrib-rural-head">
          <div className="home-contrib-rural-head-main">
            <p className="home-contrib-rural-kicker">{config.intendenciaLabel}</p>
            <h2 id={sectionId}>{config.label}</h2>
            <p className="home-contrib-rural-sub">
              Calendario disponible para el ejercicio {config.anio}. Consulte la Intendencia para{" "}
              {anioActual}.
            </p>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section
      className={`home-contrib-rural${modoModal ? " home-contrib-rural--modal" : expanded ? " home-contrib-rural--open" : " home-contrib-rural--collapsed"}`}
      aria-labelledby={modoModal ? undefined : sectionId}
      aria-label={modoModal ? `Calendario ${config.label}` : undefined}
    >
      {!modoModal && (
        <header className="home-contrib-rural-head">
          <button
            type="button"
            className="home-contrib-rural-toggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="home-contrib-rural-toggle-icon" aria-hidden>
              {expanded ? "▾" : "▸"}
            </span>
            <span className="home-contrib-rural-toggle-text">
              <span className="home-contrib-rural-kicker">{config.intendenciaLabel}</span>
              <span id={sectionId} className="home-contrib-rural-title">
                {config.label}
              </span>
              <span className="home-contrib-rural-sub">
                {MODALIDAD_PAGO_LABEL[modalidadUsuario]} · {vista.tituloPlan} · ejercicio {config.anio}
              </span>
            </span>
            {proxima && (
              <span className="home-contrib-rural-highlight home-contrib-rural-highlight--inline">
                Próxima: {vista.esPagoContado ? "contado" : `cuota ${proxima.cuota}`} · {proxima.fechaLabel}
              </span>
            )}
          </button>
        </header>
      )}

      {!soloPreferenciaCuenta && (
        <div className="home-contrib-rural-modalidades-row">
          <span className="home-contrib-rural-modalidad home-contrib-rural-modalidad--user">
            {MODALIDAD_PAGO_LABEL[modalidadUsuario]}
          </span>
          {modalidades.map((m) => (
            <span key={m.id} className="home-contrib-rural-modalidad" title={m.detalle}>
              {m.label}
            </span>
          ))}
        </div>
      )}

      {(modoModal || expanded) && (
        <div id={panelId} className="home-contrib-rural-body">
          {modoModal ? (
            <div className="venc-imp-cal-modal-stack">
              <div className="venc-imp-cal-modal-summary">
                <span className="venc-imp-cal-modal-chip venc-imp-cal-modal-chip--primary">
                  {MODALIDAD_PAGO_LABEL[modalidadUsuario]}
                </span>
                <span className="venc-imp-cal-modal-chip">{vista.tituloPlan}</span>
                <span className="venc-imp-cal-modal-chip venc-imp-cal-modal-chip--muted">
                  Ejercicio {config.anio}
                </span>
              </div>

              {proxima && proximaSemaforo && proximaDias != null && (
                <div
                  className={`venc-imp-cal-modal-proximo venc-imp-cal-modal-proximo--${proximaSemaforo.nivel}`}
                  role="status"
                >
                  <span className="venc-imp-cal-modal-proximo-accent" aria-hidden />
                  <div className="venc-imp-cal-modal-proximo-main">
                    <span className="venc-imp-cal-modal-proximo-label">Próximo vencimiento</span>
                    <strong>
                      {vista.esPagoContado ? "Pago contado" : `Cuota ${proxima.cuota}ª`}
                    </strong>
                    <span>{proxima.fechaLabel}</span>
                  </div>
                  <span className="venc-imp-cal-modal-proximo-dias">
                    {diasRestantesLabel(proximaDias)}
                  </span>
                </div>
              )}

              {vista.esPagoContado && vista.notaModalidad && (
                <p className="venc-imp-cal-modal-nota" role="note">
                  {vista.notaModalidad}
                </p>
              )}

              {config.esPrimariaRural && (
                <div className="venc-imp-cal-modal-cards">
                  {config.declaracionJuradaFecha && (
                    <article
                      className={`venc-imp-cal-modal-card venc-imp-cal-modal-card--dj${
                        diasHastaVencimientoCuota(config.declaracionJuradaFecha) <= 30
                          ? " venc-imp-cal-modal-card--alert"
                          : ""
                      }`}
                    >
                      <h3 className="venc-imp-cal-modal-card-title">Declaración jurada</h3>
                      <p className="venc-imp-cal-modal-card-fecha">
                        {formatearFechaContribucionRural(config.declaracionJuradaFecha)}
                      </p>
                      <p className="venc-imp-cal-modal-card-dias">
                        {diasRestantesLabel(
                          diasHastaVencimientoCuota(config.declaracionJuradaFecha),
                        )}
                      </p>
                      {config.declaracionJuradaNota && (
                        <p className="venc-imp-cal-modal-card-text">{config.declaracionJuradaNota}</p>
                      )}
                      {config.fuenteUrlDj?.trim() && (
                        <a
                          href={config.fuenteUrlDj.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="venc-imp-cal-modal-card-link"
                        >
                          Guía DGI declaración jurada
                        </a>
                      )}
                    </article>
                  )}

                  {config.exoneracionNota && (
                    <article className="venc-imp-cal-modal-card venc-imp-cal-modal-card--info">
                      <h3 className="venc-imp-cal-modal-card-title">Exoneración</h3>
                      <p className="venc-imp-cal-modal-card-text">{config.exoneracionNota}</p>
                    </article>
                  )}
                </div>
              )}

              {!vista.esPagoContado && planesSeleccionables.length > 1 && (
                <div className="home-contrib-rural-plans" role="tablist" aria-label="Plan de cuotas">
                  {planesSeleccionables.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="tab"
                      aria-selected={planActivo === p}
                      className={`home-contrib-rural-plan${planActivo === p ? " home-contrib-rural-plan--active" : ""}`}
                      onClick={() => setPlanActivo(p)}
                    >
                      {config.planes![p].label}
                    </button>
                  ))}
                </div>
              )}

              <section className="venc-imp-cal-modal-table-section" aria-label="Cuotas del calendario">
                <h3 className="venc-imp-cal-modal-section-title">Calendario de cuotas</h3>
                <CuotasTable
                  cuotas={vista.cuotas}
                  rowKeyPrefix={`${config.id}-${modalidadUsuario}-${planActivo}`}
                  esPagoContado={vista.esPagoContado}
                  destacarCuota={proxima?.cuota}
                />
              </section>

              <footer className="venc-imp-cal-modal-foot">
                {config.esPrimariaRural ? (
                  <div className="venc-imp-cal-modal-links">
                    {config.fuenteUrl.trim() && (
                      <a href={config.fuenteUrl.trim()} target="_blank" rel="noopener noreferrer">
                        Vencimientos DGI
                      </a>
                    )}
                    {config.fuenteUrlPadrones?.trim() && (
                      <a
                        href={config.fuenteUrlPadrones.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Padrones rurales
                      </a>
                    )}
                    {config.fuenteUrlPago?.trim() && (
                      <a href={config.fuenteUrlPago.trim()} target="_blank" rel="noopener noreferrer">
                        Sobre pagos
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="venc-imp-cal-modal-foot-source">
                    Fuente: calendario oficial {config.anio}. Verifique prórrogas en{" "}
                    {config.fuenteUrl.trim() ? (
                      <a href={config.fuenteUrl.trim()} target="_blank" rel="noopener noreferrer">
                        {fuenteHostname}
                      </a>
                    ) : (
                      "el sitio oficial"
                    )}
                    .
                  </p>
                )}
              </footer>
            </div>
          ) : (
            <>
          {vista.esPagoContado && vista.notaModalidad && (
            <p className="home-contrib-rural-modalidad-nota" role="note">
              {vista.notaModalidad}
            </p>
          )}

          {config.esPrimariaRural && config.declaracionJuradaFecha && (
            <div className="home-contrib-rural-primaria-dj" role="note">
              <h3 className="home-contrib-rural-primaria-dj-title">Declaración jurada</h3>
              <p>
                Vencimiento:{" "}
                <strong>{formatearFechaContribucionRural(config.declaracionJuradaFecha)}</strong>
              </p>
              {config.declaracionJuradaNota && <p>{config.declaracionJuradaNota}</p>}
              {config.fuenteUrlDj?.trim() && (
                <p>
                  <a href={config.fuenteUrlDj.trim()} target="_blank" rel="noopener noreferrer">
                    Información DGI sobre la declaración jurada
                  </a>
                </p>
              )}
            </div>
          )}

          {config.esPrimariaRural && config.exoneracionNota && (
            <div className="home-contrib-rural-primaria-info" role="note">
              <p>{config.exoneracionNota}</p>
            </div>
          )}

          {!vista.esPagoContado && planesSeleccionables.length > 1 && (
            <div className="home-contrib-rural-plans" role="tablist" aria-label="Plan de cuotas">
              {planesSeleccionables.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={planActivo === p}
                  className={`home-contrib-rural-plan${planActivo === p ? " home-contrib-rural-plan--active" : ""}`}
                  onClick={() => setPlanActivo(p)}
                >
                  {config.planes![p].label}
                </button>
              ))}
            </div>
          )}

          <CuotasTable
            cuotas={vista.cuotas}
            rowKeyPrefix={`${config.id}-${modalidadUsuario}-${planActivo}`}
            esPagoContado={vista.esPagoContado}
          />

          <p className="home-contrib-rural-foot">
            {config.esPatenteSucive ? (
              <>
                Fuente: calendario oficial SUCIVE {config.anio}. Verifique prórrogas en{" "}
              </>
            ) : config.esBpsCajaRural ? (
              <>
                Fuente: calendario oficial BPS Caja rural {config.anio}. Verifique prórrogas en{" "}
              </>
            ) : config.esPrimariaRural ? (
              <>
                Fuente: calendario oficial DGI Impuesto Primaria rural {config.anio}. Verifique
                prórrogas en{" "}
              </>
            ) : (
              <>
                Fuente: calendario de tributos {config.anio} de {config.intendenciaLabel}. Verifique
                prórrogas en{" "}
              </>
            )}
            {config.fuenteUrl.trim() ? (
              <a href={config.fuenteUrl.trim()} target="_blank" rel="noopener noreferrer">
                {fuenteHostname}
              </a>
            ) : (
              "el sitio oficial"
            )}
            .
            {config.fuenteNota && !vista.esPagoContado ? ` ${config.fuenteNota}` : ""}
          </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
