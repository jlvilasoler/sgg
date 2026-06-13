import { useCallback, useEffect, useState } from "react";
import { fetchResumen } from "../api";
import type { Catalogos, ResumenEmpresa, ResumenRubro } from "../types";
import { empresaClass, fmtNum } from "../utils";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
}

export default function Resumen({ catalogos, apiOnline, onError }: Props) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [porEmpresa, setPorEmpresa] = useState<ResumenEmpresa[]>([]);
  const [porRubro, setPorRubro] = useState<ResumenRubro[]>([]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setPorEmpresa([]);
      setPorRubro([]);
      return;
    }
    try {
      const data = await fetchResumen({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        empresa: empresa || undefined,
      });
      setPorEmpresa(data.por_empresa);
      setPorRubro(data.por_rubro);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar resumen");
    }
  }, [apiOnline, fechaDesde, fechaHasta, empresa, onError]);

  useEffect(() => {
    load();
  }, [load]);

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
    </div>
  );
}
