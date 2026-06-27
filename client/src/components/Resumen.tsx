import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { fetchResumen } from "../api";
import type {
  Catalogos,
  EstadoFinancieroMes,
  EstadoFinancieroRubro,
  EstadoFinancieroUsd,
  ResumenEmpresa,
  ResumenEmpresaRubro,
  ResumenRubro,
} from "../types";
import { empresaClass, fmtNum } from "../utils";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
}

function pct(parte: number, total: number): string {
  if (!total) return "—";
  return `${((parte / total) * 100).toFixed(1)}%`;
}

function celdaUsd(valor: number): string {
  return valor ? fmtNum(valor) : "—";
}

function lineaSinMovimiento(linea: EstadoFinancieroUsd): boolean {
  return linea.total_saldo_usd === 0;
}

export default function Resumen({ catalogos, apiOnline, onError }: Props) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [porEmpresa, setPorEmpresa] = useState<ResumenEmpresa[]>([]);
  const [porEmpresaRubro, setPorEmpresaRubro] = useState<ResumenEmpresaRubro[]>([]);
  const [porRubro, setPorRubro] = useState<ResumenRubro[]>([]);
  const [estadoFinanciero, setEstadoFinanciero] = useState<EstadoFinancieroRubro[]>([]);
  const [estadoFinancieroMeses, setEstadoFinancieroMeses] = useState<EstadoFinancieroMes[]>(
    []
  );
  const [rubrosAbiertos, setRubrosAbiertos] = useState<Set<string>>(new Set());
  const [empresasAbiertas, setEmpresasAbiertas] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!apiOnline) {
      setPorEmpresa([]);
      setPorEmpresaRubro([]);
      setPorRubro([]);
      setEstadoFinanciero([]);
      setEstadoFinancieroMeses([]);
      return;
    }
    try {
      const data = await fetchResumen({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        empresa: empresa || undefined,
      });
      setPorEmpresa(data.por_empresa);
      setPorEmpresaRubro(data.por_empresa_rubro ?? []);
      setPorRubro(data.por_rubro);
      setEstadoFinanciero(data.estado_financiero ?? []);
      setEstadoFinancieroMeses(data.estado_financiero_meses ?? []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar resumen");
    }
  }, [apiOnline, fechaDesde, fechaHasta, empresa, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setRubrosAbiertos(new Set());
    setEmpresasAbiertas(new Set());
  }, [estadoFinanciero, fechaDesde, fechaHasta, empresa]);

  const toggleRubro = (nombre: string) => {
    setRubrosAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const abrirTodosRubros = () => {
    setRubrosAbiertos(new Set(estadoFinanciero.map((r) => r.rubro)));
  };

  const cerrarTodosRubros = () => {
    setRubrosAbiertos(new Set());
  };

  const toggleEmpresa = (nombre: string) => {
    setEmpresasAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const rubrosPorEmpresa = useMemo(() => {
    const map = new Map<string, ResumenEmpresaRubro[]>();
    for (const row of porEmpresaRubro) {
      const list = map.get(row.empresa) ?? [];
      list.push(row);
      map.set(row.empresa, list);
    }
    return map;
  }, [porEmpresaRubro]);

  const totEmpresa = useMemo(
    () =>
      porEmpresa.reduce(
        (acc, r) => ({
          cantidad: acc.cantidad + r.cantidad,
          pesos: acc.pesos + r.total_pesos,
          usd: acc.usd + r.total_usd,
          reales: acc.reales + r.total_reales,
          saldo: acc.saldo + r.total_saldo_usd,
        }),
        { cantidad: 0, pesos: 0, usd: 0, reales: 0, saldo: 0 }
      ),
    [porEmpresa]
  );

  const totEstado = useMemo(() => {
    const por_mes: Record<string, number> = {};
    for (const mes of estadoFinancieroMeses) por_mes[mes.clave] = 0;
    let saldo = 0;
    for (const r of estadoFinanciero) {
      saldo += r.totales.total_saldo_usd;
      for (const [clave, valor] of Object.entries(r.totales.por_mes)) {
        por_mes[clave] = (por_mes[clave] ?? 0) + valor;
      }
    }
    return { saldo, por_mes };
  }, [estadoFinanciero, estadoFinancieroMeses]);

  const periodoEstadoLabel = useMemo(() => {
    if (estadoFinancieroMeses.length === 0) return "Ejercicio contable (1/7 al 30/6)";
    const inicioY = Number(estadoFinancieroMeses[0].clave.split("-")[0]);
    return `Ejercicio 01/07/${inicioY} – 30/06/${inicioY + 1}`;
  }, [estadoFinancieroMeses]);

  const emitidoLabel = useMemo(
    () =>
      new Date().toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const entidadLabel = empresa || "Consolidado — todas las empresas";
  const hayDatos = porEmpresa.length > 0 || porRubro.length > 0;
  const hayEstado = estadoFinanciero.length > 0;

  return (
    <div className="resumen-page">
      <div className="card resumen-filters-card">
        <header className="resumen-head">
          <h2 className="resumen-head-title">Resumen de gastos</h2>
          <p className="resumen-head-sub">
            Totales acumulados por empresa y rubro según el período filtrado
          </p>
        </header>
        <div className="resumen-filters filters filters-inline mayusculas-auto">
          <div className="field">
            <label htmlFor="resumen-desde">Desde</label>
            <input
              type="date"
              id="resumen-desde"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="resumen-hasta">Hasta</label>
            <input
              type="date"
              id="resumen-hasta"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="resumen-empresa">Empresa (rubros)</label>
            <select
              id="resumen-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            >
              <option value="">Todas</option>
              {catalogos.empresas.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div className="field field--action">
            <span className="field-action-label" aria-hidden="true">
              Actualizar
            </span>
            <button type="button" className="btn btn-primary" onClick={load}>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <div className="resumen-grid">
        <div className="card resumen-panel">
          <h3 className="resumen-panel-title">Totales por empresa</h3>
          <div className="table-wrap">
            <table className="data-table data-table-resumen">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="num">Registros</th>
                  <th className="num">Pesos $</th>
                  <th className="num">USD</th>
                  <th className="num">Reales</th>
                  <th className="num">Total USD</th>
                </tr>
              </thead>
              <tbody>
                {!porEmpresa.length ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      Sin datos
                    </td>
                  </tr>
                ) : (
                  porEmpresa.map((r) => (
                    <tr key={r.empresa}>
                      <td>
                        <span
                          className={`empresa-badge empresa-badge--resumen ${empresaClass(r.empresa)}`}
                        >
                          {r.empresa}
                        </span>
                      </td>
                      <td className="num">{r.cantidad}</td>
                      <td className="num">{fmtNum(r.total_pesos)}</td>
                      <td className="num">{fmtNum(r.total_usd)}</td>
                      <td className="num">{fmtNum(r.total_reales)}</td>
                      <td className="num">{fmtNum(r.total_saldo_usd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card resumen-panel">
          <h3 className="resumen-panel-title">Totales por rubro</h3>
          <div className="table-wrap resumen-table-wrap--fill">
            <table className="data-table data-table-resumen">
              <thead>
                <tr>
                  <th>Rubro</th>
                  <th className="num">Registros</th>
                  <th className="num">Pesos $</th>
                  <th className="num">USD</th>
                </tr>
              </thead>
              <tbody>
                {!porRubro.length ? (
                  <tr>
                    <td colSpan={4} className="empty">
                      Sin datos
                    </td>
                  </tr>
                ) : (
                  porRubro.map((r) => (
                    <tr key={r.rubro}>
                      <td>{r.rubro}</td>
                      <td className="num">{r.cantidad}</td>
                      <td className="num">{fmtNum(r.total_pesos)}</td>
                      <td className="num">{fmtNum(r.total_usd)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="card balance-contable" aria-label="Estado financiero de gastos">
        <header className="balance-doc-head">
          <div className="balance-doc-brand">
            <span className="balance-doc-kicker">Estado financiero</span>
            <h2 className="balance-doc-title">Clasificación presupuestaria</h2>
            <p className="balance-doc-entity">{entidadLabel}</p>
          </div>
          <dl className="balance-doc-meta">
            <div className="balance-doc-meta-item">
              <dt>Período</dt>
              <dd>{periodoEstadoLabel}</dd>
            </div>
            <div className="balance-doc-meta-item">
              <dt>Moneda de presentación</dt>
              <dd>USD (dólares)</dd>
            </div>
            <div className="balance-doc-meta-item">
              <dt>Emitido</dt>
              <dd>{emitidoLabel}</dd>
            </div>
          </dl>
        </header>

        {!hayEstado ? (
          <p className="balance-doc-empty">
            No hay rubros configurados en Configuración → Rubros.
          </p>
        ) : (
          <>
            <div className="balance-doc-section">
              <h3 className="balance-doc-section-title">
                Rubros y sub-rubros del catálogo
                {empresa ? (
                  <span className="balance-doc-section-note"> · {empresa}</span>
                ) : null}
              </h3>
              <div className="balance-doc-section-toolbar">
                <p className="balance-doc-section-desc">
                  Solo moneda USD (total consolidado). Columnas mensuales del
                  ejercicio contable vigente (1/7 al 30/6). Hacé clic en un rubro
                  para ver u ocultar sus sub-rubros.
                </p>
                <div className="balance-doc-section-actions">
                  <button
                    type="button"
                    className="btn btn-sm balance-doc-toolbar-btn"
                    onClick={abrirTodosRubros}
                  >
                    Expandir todos
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm balance-doc-toolbar-btn"
                    onClick={cerrarTodosRubros}
                  >
                    Contraer todos
                  </button>
                </div>
              </div>
              <div className="table-wrap balance-doc-table-scroll">
                <table className="balance-doc-table balance-doc-table--jerarquia balance-doc-table--mensual">
                  <thead>
                    <tr>
                      <th className="balance-col-cuenta balance-col-sticky">
                        Rubro / Sub-rubro
                      </th>
                      {estadoFinancieroMeses.map((mes) => (
                        <th key={mes.clave} className="num balance-col-mes">
                          {mes.label}
                        </th>
                      ))}
                      <th className="num balance-col-total">Total USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estadoFinanciero.map((rubro) => {
                      const abierto = rubrosAbiertos.has(rubro.rubro);
                      const tieneSubs = rubro.sub_rubros.length > 0;
                      return (
                      <Fragment key={rubro.rubro}>
                        <tr
                          className={`balance-rubro-row${
                            abierto ? " is-open" : ""
                          }${tieneSubs ? " balance-rubro-row--toggle" : ""}`}
                        >
                          <td className="balance-col-cuenta balance-col-rubro balance-col-sticky">
                            {tieneSubs ? (
                              <button
                                type="button"
                                className="balance-rubro-toggle"
                                onClick={() => toggleRubro(rubro.rubro)}
                                aria-expanded={abierto}
                              >
                                <span
                                  className={`balance-rubro-chevron${
                                    abierto ? " is-open" : ""
                                  }`}
                                  aria-hidden
                                />
                                <span>{rubro.rubro}</span>
                              </button>
                            ) : (
                              rubro.rubro
                            )}
                          </td>
                          {estadoFinancieroMeses.map((mes) => (
                            <td key={mes.clave} className="num balance-num-total">
                              {celdaUsd(rubro.totales.por_mes[mes.clave] ?? 0)}
                            </td>
                          ))}
                          <td className="num balance-num-total balance-col-total">
                            {fmtNum(rubro.totales.total_saldo_usd)}
                          </td>
                        </tr>
                        {abierto
                          ? rubro.sub_rubros.map((sub) => (
                          <tr
                            key={`${rubro.rubro}-${sub.sub_rubro}`}
                            className={`balance-sub-row${
                              lineaSinMovimiento(sub) ? " balance-sub-row--vacio" : ""
                            }`}
                          >
                            <td className="balance-col-cuenta balance-col-sub balance-col-sticky">
                              {sub.sub_rubro}
                            </td>
                            {estadoFinancieroMeses.map((mes) => (
                              <td key={mes.clave} className="num">
                                {celdaUsd(sub.por_mes[mes.clave] ?? 0)}
                              </td>
                            ))}
                            <td className="num balance-col-total">
                              {lineaSinMovimiento(sub)
                                ? "—"
                                : fmtNum(sub.total_saldo_usd)}
                            </td>
                          </tr>
                        ))
                          : null}
                      </Fragment>
                    );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="balance-doc-total">
                      <td className="balance-col-cuenta balance-col-sticky">TOTAL GASTOS</td>
                      {estadoFinancieroMeses.map((mes) => (
                        <td key={mes.clave} className="num balance-num-total">
                          {celdaUsd(totEstado.por_mes[mes.clave] ?? 0)}
                        </td>
                      ))}
                      <td className="num balance-num-total balance-num-grand balance-col-total">
                        {fmtNum(totEstado.saldo)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {hayDatos ? (
              <div className="balance-doc-section">
                <h3 className="balance-doc-section-title">
                  Distribución por empresa (centro de costo)
                </h3>
                <p className="balance-doc-section-desc">
                  Hacé clic en una empresa para ver u ocultar el desglose por rubro.
                </p>
                <div className="table-wrap">
                  <table className="balance-doc-table balance-doc-table--jerarquia">
                    <thead>
                      <tr>
                        <th className="balance-col-cuenta">Empresa / Rubro</th>
                        <th className="num">Comprob.</th>
                        <th className="num">$ ARS</th>
                        <th className="num">USD</th>
                        <th className="num">R$</th>
                        <th className="num">Total USD</th>
                        <th className="num balance-col-pct">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porEmpresa.map((r) => {
                        const abierto = empresasAbiertas.has(r.empresa);
                        const rubros = rubrosPorEmpresa.get(r.empresa) ?? [];
                        const tieneRubros = rubros.length > 0;
                        return (
                          <Fragment key={r.empresa}>
                            <tr
                              className={`balance-rubro-row${
                                abierto ? " is-open" : ""
                              }${tieneRubros ? " balance-rubro-row--toggle" : ""}`}
                            >
                              <td className="balance-col-cuenta balance-col-rubro">
                                {tieneRubros ? (
                                  <button
                                    type="button"
                                    className="balance-rubro-toggle"
                                    onClick={() => toggleEmpresa(r.empresa)}
                                    aria-expanded={abierto}
                                  >
                                    <span
                                      className={`balance-rubro-chevron${
                                        abierto ? " is-open" : ""
                                      }`}
                                      aria-hidden
                                    />
                                    <span
                                      className={`empresa-badge empresa-badge--resumen ${empresaClass(r.empresa)}`}
                                    >
                                      {r.empresa}
                                    </span>
                                  </button>
                                ) : (
                                  <span
                                    className={`empresa-badge empresa-badge--resumen ${empresaClass(r.empresa)}`}
                                  >
                                    {r.empresa}
                                  </span>
                                )}
                              </td>
                              <td className="num">{r.cantidad}</td>
                              <td className="num">{fmtNum(r.total_pesos)}</td>
                              <td className="num">{fmtNum(r.total_usd)}</td>
                              <td className="num">{fmtNum(r.total_reales)}</td>
                              <td className="num balance-num-total">
                                {fmtNum(r.total_saldo_usd)}
                              </td>
                              <td className="num balance-col-pct">
                                {pct(r.total_saldo_usd, totEmpresa.saldo)}
                              </td>
                            </tr>
                            {abierto
                              ? rubros.map((rub) => (
                                  <tr
                                    key={`${r.empresa}-${rub.rubro}`}
                                    className="balance-sub-row"
                                  >
                                    <td className="balance-col-cuenta balance-col-sub">
                                      {rub.rubro}
                                    </td>
                                    <td className="num">{rub.cantidad}</td>
                                    <td className="num">{fmtNum(rub.total_pesos)}</td>
                                    <td className="num">{fmtNum(rub.total_usd)}</td>
                                    <td className="num">{fmtNum(rub.total_reales)}</td>
                                    <td className="num">
                                      {fmtNum(rub.total_saldo_usd)}
                                    </td>
                                    <td className="num balance-col-pct">
                                      {pct(rub.total_saldo_usd, totEmpresa.saldo)}
                                    </td>
                                  </tr>
                                ))
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="balance-doc-total">
                        <td className="balance-col-cuenta">TOTAL CONSOLIDADO</td>
                        <td className="num">{totEmpresa.cantidad}</td>
                        <td className="num">{fmtNum(totEmpresa.pesos)}</td>
                        <td className="num">{fmtNum(totEmpresa.usd)}</td>
                        <td className="num">{fmtNum(totEmpresa.reales)}</td>
                        <td className="num balance-num-total balance-num-grand">
                          {fmtNum(totEmpresa.saldo)}
                        </td>
                        <td className="num balance-col-pct">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}

            <footer className="balance-doc-foot">
              <div className="balance-doc-foot-grand">
                <span className="balance-doc-foot-label">
                  Total de gastos del período
                </span>
                <span className="balance-doc-foot-value">
                  USD {fmtNum(totEstado.saldo || totEmpresa.saldo)}
                </span>
              </div>
              <p className="balance-doc-foot-note">
                Clasificación según el catálogo de Configuración → Rubros.
                Importes consolidados a dólares estadounidenses (USD) según el
                tipo de cambio de cada operación. Documento generado
                automáticamente; valores sujetos a revisión contable.
              </p>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
