import { useCallback, useEffect, useState } from "react";
import { fetchFuncionarios, fetchPagosPorCedula } from "../../api";
import { EMPRESAS } from "../../constants";
import type { Funcionario, ResumenPagosFuncionario, VinculoPago } from "../../types";
import { fmtDate, fmtNum } from "../../utils";

interface Props {
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
          <h2>Sueldos y Jornales</h2>
          <p className="muted">
            Pagos detectados por <strong>cédula</strong>: vínculo en el gasto, número en el
            concepto o nombre del funcionario. Relacionado con rubros de sueldos en{" "}
            <strong>Gastos</strong>.
          </p>
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
                {EMPRESAS.map((e) => (
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
            <div className="rrhh-funcionario-head">
              <div>
                <h3>
                  {f ? `${f.apellido}, ${f.nombre}` : "Sin ficha en Funcionarios"}
                </h3>
                <p className="muted">
                  CI: <strong>{resumen.cedula_display}</strong>
                  {!f && " — registrá la ficha en Funcionarios para datos bancarios."}
                </p>
              </div>
            </div>
            {f && (
              <div className="rrhh-datos-grid">
                <div>
                  <span className="rrhh-dato-label">Domicilio</span>
                  <span>
                    {f.domicilio || "—"}
                    {f.ciudad ? `, ${f.ciudad}` : ""}
                    {f.departamento ? ` (${f.departamento})` : ""}
                  </span>
                </div>
                <div>
                  <span className="rrhh-dato-label">Celular</span>
                  <span>{f.celular || "—"}</span>
                </div>
                <div>
                  <span className="rrhh-dato-label">Email</span>
                  <span>{f.email || "—"}</span>
                </div>
                <div>
                  <span className="rrhh-dato-label">Banco</span>
                  <span>{f.banco || "—"}</span>
                </div>
                <div>
                  <span className="rrhh-dato-label">Cuenta</span>
                  <span>
                    {f.cuenta || "—"}
                    {f.tipo_cuenta ? ` (${f.tipo_cuenta})` : ""}
                  </span>
                </div>
                <div>
                  <span className="rrhh-dato-label">Titular</span>
                  <span>{f.titular_cuenta || `${f.nombre} ${f.apellido}`}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rrhh-stats-grid">
            <div className="rrhh-stat-card">
              <span className="rrhh-stat-label">Pagos encontrados</span>
              <span className="rrhh-stat-value">{resumen.total_registros}</span>
            </div>
            <div className="rrhh-stat-card">
              <span className="rrhh-stat-label">Total $</span>
              <span className="rrhh-stat-value">{fmtNum(resumen.total_pesos)}</span>
            </div>
            <div className="rrhh-stat-card">
              <span className="rrhh-stat-label">Total USD</span>
              <span className="rrhh-stat-value">{fmtNum(resumen.total_usd)}</span>
            </div>
            <div className="rrhh-stat-card">
              <span className="rrhh-stat-label">Total R$</span>
              <span className="rrhh-stat-value">{fmtNum(resumen.total_reales)}</span>
            </div>
            <div className="rrhh-stat-card rrhh-stat-card--saldo">
              <span className="rrhh-stat-label">Total gastos (TOTAL USD)</span>
              <span className="rrhh-stat-value">{fmtNum(resumen.total_saldo_usd ?? 0)}</span>
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

          <div className="card">
            <h3 className="rrhh-section-title">Detalle de pagos (gastos)</h3>
            {resumen.pagos.length === 0 ? (
              <p className="muted">
                No hay gastos vinculados a esta cédula con los filtros actuales. Al registrar
                un gasto de sueldos, seleccioná el funcionario por cédula en Registrar gasto.
              </p>
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
