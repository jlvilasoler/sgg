import { useCallback, useEffect, useState } from "react";
import { fetchFuncionarios, fetchPagosPorCedula } from "../../api";
import { formatCuentaOtrosBancos, isBancoSantander } from "../../constants/bancosUruguay";
import BancoLogo from "./BancoLogo";
import type { Catalogos, Funcionario, ResumenPagosFuncionario, VinculoPago } from "../../types";
import { fmtDate, fmtNum } from "../../utils";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  cedulaInicial?: string;
  onError: (msg: string) => void;
  onEditGasto?: (presupuestoId: number) => void;
  onVolver: () => void;
}

const VINCULO_LABEL: Record<VinculoPago, string> = {
  explicito: "Vínculo directo (cédula en gasto)",
  concepto: "Detectado en concepto / nombre",
  rubro: "Rubro de sueldos / jornales",
};

function vinculoCorto(v: VinculoPago): string {
  if (v === "explicito") return "Directo";
  if (v === "rubro") return "Rubro";
  return "Concepto";
}

const COLS_MONEDA = ["$", "USD", "R$", "TOTAL USD"] as const;

export default function SueldosJornales({
  catalogos,
  apiOnline,
  cedulaInicial = "",
  onError,
  onEditGasto,
  onVolver,
}: Props) {
  const [cedula, setCedula] = useState(cedulaInicial);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [resumen, setResumen] = useState<ResumenPagosFuncionario | null>(null);
  const [loading, setLoading] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);

  useEffect(() => {
    setCedula(cedulaInicial);
  }, [cedulaInicial]);

  useEffect(() => {
    if (!apiOnline) return;
    fetchFuncionarios({ soloActivos: true })
      .then(setFuncionarios)
      .catch(() => setFuncionarios([]));
  }, [apiOnline]);

  const buscar = useCallback(async () => {
    const c = cedula.trim();
    if (!c) {
      onError("Ingresá la cédula de identidad");
      return;
    }
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPagosPorCedula(c, {
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        empresa: empresa || undefined,
      });
      setResumen(data);
    } catch (e) {
      setResumen(null);
      onError(e instanceof Error ? e.message : "Error al buscar pagos");
    } finally {
      setLoading(false);
    }
  }, [cedula, fechaDesde, fechaHasta, empresa, apiOnline, onError]);

  useEffect(() => {
    if (cedulaInicial.trim() && apiOnline) {
      buscar();
    }
  }, [cedulaInicial, apiOnline]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al entrar con cédula

  const f = resumen?.funcionario;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Recursos Humanos
      </button>

      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "rrhh_sueldos" }}
            title="Sueldos y Jornales"
            subtitle={
              <>
                Pagos detectados por <strong>cédula</strong>: vínculo en el gasto, número en el
                concepto o nombre del funcionario. Relacionado con rubros de sueldos en{" "}
                <strong>Gastos</strong>.
              </>
            }
          />
        </div>

        <div className="rrhh-search-panel">
          <div className="filters filters-inline filters-wrap mayusculas-auto">
            <div className="field">
              <label htmlFor="rrhh-cedula">Cédula de identidad *</label>
              <input
                id="rrhh-cedula"
                list="rrhh-cedulas-list"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="1234567-8"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), buscar())}
              />
              <datalist id="rrhh-cedulas-list">
                {funcionarios.map((x) => (
                  <option key={x.id} value={x.cedula}>
                    {x.apellido}, {x.nombre}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="rrhh-desde">Desde</label>
              <input
                id="rrhh-desde"
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="rrhh-hasta">Hasta</label>
              <input
                id="rrhh-hasta"
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="rrhh-emp">Empresa</label>
              <select
                id="rrhh-emp"
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
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!apiOnline || loading}
            onClick={buscar}
          >
            {loading ? "Buscando…" : "Buscar pagos"}
          </button>
        </div>
      </div>

      {resumen && (
        <>
          <div className="card rrhh-funcionario-card">
            <div className="rrhh-func-head">
              <div
                className="rrhh-func-avatar"
                aria-hidden
                data-inactivo={f && f.activo === 0 ? "true" : undefined}
              >
                {f
                  ? `${(f.nombre[0] ?? "").toUpperCase()}${(f.apellido[0] ?? "").toUpperCase()}`
                  : "?"}
              </div>
              <div className="rrhh-func-head-text">
                <h3>
                  {f ? `${f.apellido}, ${f.nombre}` : "Sin ficha en Funcionarios"}
                </h3>
                <div className="rrhh-func-head-meta">
                  <span className="rrhh-func-chip">CI {resumen.cedula_display}</span>
                  {f && (
                    <span
                      className={`rrhh-func-chip rrhh-func-chip--estado${
                        f.activo === 0 ? " rrhh-func-chip--inactivo" : ""
                      }`}
                    >
                      {f.activo === 0 ? "Inactivo" : "Activo"}
                    </span>
                  )}
                </div>
                {!f && (
                  <p className="muted rrhh-func-head-hint">
                    Registrá la ficha en Funcionarios para ver los datos bancarios.
                  </p>
                )}
              </div>
            </div>
            {f && (
              <div className="rrhh-func-body">
                <section className="rrhh-func-section">
                  <h4 className="rrhh-func-section-title">Contacto</h4>
                  <ul className="rrhh-contacto-list">
                    <li className="rrhh-contacto-item">
                      <span className="rrhh-contacto-icon" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      </span>
                      <span className="rrhh-contacto-text">
                        <span className="rrhh-dato-label">Domicilio</span>
                        <span className="rrhh-dato-valor">{f.domicilio || "—"}</span>
                        {(f.ciudad || f.departamento) && (
                          <span className="rrhh-dato-subvalor">
                            {[f.ciudad, f.departamento].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </span>
                    </li>
                    <li className="rrhh-contacto-item">
                      <span className="rrhh-contacto-icon" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="rrhh-contacto-text">
                        <span className="rrhh-dato-label">Celular</span>
                        {f.celular ? (
                          <a className="rrhh-dato-valor rrhh-dato-link" href={`tel:${f.celular}`}>
                            {f.celular}
                          </a>
                        ) : (
                          <span className="rrhh-dato-valor">—</span>
                        )}
                      </span>
                    </li>
                    <li className="rrhh-contacto-item">
                      <span className="rrhh-contacto-icon" aria-hidden>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
                          <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="rrhh-contacto-text">
                        <span className="rrhh-dato-label">Email</span>
                        {f.email ? (
                          <a className="rrhh-dato-valor rrhh-dato-link rrhh-email-cell" href={`mailto:${f.email}`}>
                            {f.email}
                          </a>
                        ) : (
                          <span className="rrhh-dato-valor">—</span>
                        )}
                      </span>
                    </li>
                  </ul>
                </section>

                <section className="rrhh-func-section rrhh-func-section--banco">
                  <h4 className="rrhh-func-section-title">
                    <BancoLogo nombre={f.banco} size="sm" className="rrhh-func-banco-logo" />
                    Datos bancarios
                  </h4>
                  <div className="rrhh-datos-grid">
                    <div className="rrhh-dato">
                      <span className="rrhh-dato-label">Banco</span>
                      <span className="rrhh-dato-valor">{f.banco || "—"}</span>
                    </div>
                    <div className="rrhh-dato">
                      <span className="rrhh-dato-label">Sucursal</span>
                      <span className="rrhh-dato-valor">{f.sucursal || "—"}</span>
                    </div>
                    <div className="rrhh-dato">
                      <span className="rrhh-dato-label">Cuenta</span>
                      <span className="rrhh-dato-valor">{f.cuenta || "—"}</span>
                      {f.tipo_cuenta && (
                        <span className="rrhh-dato-subvalor">{f.tipo_cuenta}</span>
                      )}
                    </div>
                    {isBancoSantander(f.banco) && (
                      <div className="rrhh-dato rrhh-dato--destacado">
                        <span className="rrhh-dato-label">Cuenta desde otros bancos</span>
                        <span className="rrhh-dato-valor rrhh-dato-valor--mono">
                          {f.cuenta_otros_bancos ||
                            formatCuentaOtrosBancos(f.sucursal, f.cuenta) ||
                            "—"}
                        </span>
                      </div>
                    )}
                    <div className="rrhh-dato">
                      <span className="rrhh-dato-label">Titular</span>
                      <span className="rrhh-dato-valor">
                        {f.titular_cuenta || `${f.nombre} ${f.apellido}`}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>

          <div className="rrhh-stats-grid">
            <div className="rrhh-stat-card rrhh-stat-card--count">
              <span className="rrhh-stat-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <div className="rrhh-stat-body">
                <span className="rrhh-stat-label">Pagos encontrados</span>
                <span className="rrhh-stat-value">{resumen.total_registros}</span>
              </div>
            </div>
            <div className="rrhh-stat-card rrhh-stat-card--uyu">
              <span className="rrhh-stat-icon" aria-hidden>$</span>
              <div className="rrhh-stat-body">
                <span className="rrhh-stat-label">Total $</span>
                <span className="rrhh-stat-value">{fmtNum(resumen.total_pesos)}</span>
              </div>
            </div>
            <div className="rrhh-stat-card rrhh-stat-card--usd">
              <span className="rrhh-stat-icon" aria-hidden>US$</span>
              <div className="rrhh-stat-body">
                <span className="rrhh-stat-label">Total USD</span>
                <span className="rrhh-stat-value">{fmtNum(resumen.total_usd)}</span>
              </div>
            </div>
            <div className="rrhh-stat-card rrhh-stat-card--brl">
              <span className="rrhh-stat-icon" aria-hidden>R$</span>
              <div className="rrhh-stat-body">
                <span className="rrhh-stat-label">Total R$</span>
                <span className="rrhh-stat-value">{fmtNum(resumen.total_reales)}</span>
              </div>
            </div>
            <div className="rrhh-stat-card rrhh-stat-card--saldo">
              <span className="rrhh-stat-icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="rrhh-stat-body">
                <span className="rrhh-stat-label">Total gastos (TOTAL USD)</span>
                <span className="rrhh-stat-value">{fmtNum(resumen.total_saldo_usd ?? 0)}</span>
              </div>
            </div>
          </div>

          {resumen.por_anio.length > 0 && (
            <div className="card">
              <h3 className="rrhh-section-title">Resumen por año</h3>
              <div className="table-wrap">
                <table className="data-table data-table-compact rrhh-informe-table">
                  <thead>
                    <tr>
                      <th>Año</th>
                      <th className="num">Cant.</th>
                      {COLS_MONEDA.map((c) => (
                        <th key={c} className="num">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.por_anio.map((a) => (
                      <tr key={a.anio}>
                        <td>{a.anio}</td>
                        <td className="num">{a.cantidad}</td>
                        <td className="num">{fmtNum(a.total_pesos)}</td>
                        <td className="num">{fmtNum(a.total_usd)}</td>
                        <td className="num">{fmtNum(a.total_reales ?? 0)}</td>
                        <td className="num">{fmtNum(a.total_saldo_usd ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resumen.por_rubro.length > 0 && (
            <div className="card">
              <h3 className="rrhh-section-title">Resumen por rubro</h3>
              <div className="table-wrap">
                <table className="data-table data-table-compact rrhh-informe-table">
                  <thead>
                    <tr>
                      <th>Rubro</th>
                      <th>Sub-rubro</th>
                      <th className="num">Cant.</th>
                      {COLS_MONEDA.map((c) => (
                        <th key={c} className="num">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.por_rubro.map((r, i) => (
                      <tr key={`${r.rubro}-${r.sub_rubro}-${i}`}>
                        <td>{r.rubro}</td>
                        <td className="muted">{r.sub_rubro || "—"}</td>
                        <td className="num">{r.cantidad}</td>
                        <td className="num">{fmtNum(r.total_pesos)}</td>
                        <td className="num">{fmtNum(r.total_usd)}</td>
                        <td className="num">{fmtNum(r.total_reales ?? 0)}</td>
                        <td className="num">{fmtNum(r.total_saldo_usd ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card rrhh-pagos-card">
            <div className="rrhh-pagos-head">
              <h3 className="rrhh-section-title">Detalle de pagos (gastos)</h3>
              <span className="rrhh-pagos-badge">
                {resumen.pagos.length}{" "}
                {resumen.pagos.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            {resumen.pagos.length === 0 ? (
              <div className="rrhh-empty-state">
                <div className="rrhh-empty-icon" aria-hidden>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="rrhh-empty-title">Sin pagos vinculados</p>
                <p className="muted rrhh-empty-hint">
                  No hay gastos vinculados a esta cédula con los filtros actuales. Al registrar
                  un gasto de sueldos, seleccioná el funcionario por cédula en{" "}
                  <strong>Registrar gasto</strong>.
                </p>
              </div>
            ) : (
              <div className="table-wrap table-wrap-scroll">
                <table className="data-table rrhh-informe-table rrhh-detalle-pagos">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th className="num">Nº reg.</th>
                      <th>Empresa</th>
                      <th>Cód.</th>
                      <th>Proveedor</th>
                      <th>Concepto</th>
                      <th>Fact.</th>
                      <th>Rubro / Sub-rubro</th>
                      {COLS_MONEDA.map((c) => (
                        <th key={c} className="num">
                          {c}
                        </th>
                      ))}
                      <th>Vínculo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.pagos.map((p) => (
                      <tr key={p.id}>
                        <td className="td-fecha">{fmtDate(p.fecha)}</td>
                        <td className="num">{p.nro_registro}</td>
                        <td className="small-cell">{p.empresa}</td>
                        <td className="num">{p.codigo_proveedor || "—"}</td>
                        <td className="small-cell" title={p.razon_social_proveedor}>
                          {p.razon_social_proveedor || "—"}
                        </td>
                        <td className="small-cell">{p.concepto}</td>
                        <td>{p.nro_factura || "—"}</td>
                        <td className="small-cell">
                          {p.rubro}
                          {p.sub_rubro ? (
                            <span className="muted"> / {p.sub_rubro}</span>
                          ) : null}
                        </td>
                        <td className="num">{fmtNum(p.pesos)}</td>
                        <td className="num">{fmtNum(p.dolares_usd)}</td>
                        <td className="num">{fmtNum(p.reales)}</td>
                        <td className="num rrhh-saldo-cell">{fmtNum(p.saldo_usd)}</td>
                        <td>
                          <span
                            className={`badge-vinculo badge-vinculo--${p.vinculo}`}
                            title={VINCULO_LABEL[p.vinculo]}
                          >
                            {vinculoCorto(p.vinculo)}
                          </span>
                        </td>
                        <td className="actions-cell">
                          {onEditGasto && (
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => onEditGasto(p.id)}
                            >
                              Ver gasto
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="rrhh-detalle-totales">
                      <td colSpan={8}>
                        <strong>Totales</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(resumen.total_pesos)}</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(resumen.total_usd)}</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(resumen.total_reales)}</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(resumen.total_saldo_usd ?? 0)}</strong>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
