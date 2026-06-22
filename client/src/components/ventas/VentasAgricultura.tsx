import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createVentaAgricultura,
  deleteVentaAgricultura,
  fetchVentasAgricultura,
} from "../../api";
import type { VentaAgriculturaRow } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { fmtNum } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import {
  ANIOS_AGRICULTURA,
  CULTIVOS_AGRICULTURA,
  EMPRESAS_AGRICULTURA,
  MESES_AGRICULTURA,
  calcularImporteAgricultura,
  calcularTotalProduccionAgricultura,
  formatPeriodoAgricultura,
  formatRendimientoAgricultura,
  formatTotalProduccionAgricultura,
  labelCultivoAgricultura,
  labelEmpresaAgricultura,
  parsePositiveDecimal,
  type CultivoAgriculturaId,
  type EmpresaAgricultura,
  type MesAgricultura,
} from "./ventas-agricultura-utils";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
}

export default function VentasAgricultura({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [empresa, setEmpresa] = useState<EmpresaAgricultura>("");
  const [mes, setMes] = useState<MesAgricultura>("");
  const [anio, setAnio] = useState<number | "">("");
  const [hectareas, setHectareas] = useState("");
  const [cultivo, setCultivo] = useState<CultivoAgriculturaId>("SOJA");
  const [rendimiento, setRendimiento] = useState("");
  const [precio, setPrecio] = useState("");
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<VentaAgriculturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroMes, setFiltroMes] = useState<MesAgricultura>("");
  const [filtroAnio, setFiltroAnio] = useState<number | "">("");
  const [filtroCultivo, setFiltroCultivo] = useState<"" | CultivoAgriculturaId>("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const hasNum = useMemo(() => parsePositiveDecimal(hectareas), [hectareas]);
  const rendimientoNum = useMemo(() => parsePositiveDecimal(rendimiento), [rendimiento]);
  const precioNum = useMemo(() => parsePositiveDecimal(precio), [precio]);

  const totalProduccion = useMemo(
    () => calcularTotalProduccionAgricultura(hasNum, rendimientoNum),
    [hasNum, rendimientoNum]
  );

  const importeTotal = useMemo(
    () => calcularImporteAgricultura(totalProduccion, precioNum),
    [totalProduccion, precioNum]
  );

  const puedeGuardar =
    apiOnline &&
    !saving &&
    empresa !== "" &&
    mes !== "" &&
    anio !== "" &&
    hasNum != null &&
    rendimientoNum != null &&
    precioNum != null;

  const limpiar = () => {
    setEmpresa("");
    setMes("");
    setAnio("");
    setHectareas("");
    setCultivo("SOJA");
    setRendimiento("");
    setPrecio("");
  };

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(
        await fetchVentasAgricultura({
          empresa: filtroEmpresa || undefined,
          mes: filtroMes !== "" ? filtroMes : undefined,
          anio: filtroAnio !== "" ? filtroAnio : undefined,
          cultivo: filtroCultivo || undefined,
          busqueda: busqueda.trim() || undefined,
        })
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar ventas agricultura");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtroEmpresa, filtroMes, filtroAnio, filtroCultivo, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filtroEmpresa, filtroMes, filtroAnio, filtroCultivo, busqueda, pageSize]);

  const guardar = async () => {
    if (!puedeGuardar || empresa === "" || mes === "" || anio === "") return;
    setSaving(true);
    try {
      await createVentaAgricultura({
        empresa,
        mes,
        anio,
        cultivo,
        hectareas: hasNum!,
        rendimiento_ton_ha: rendimientoNum!,
        precio_usd_ton: precioNum!,
      });
      onSuccess?.("Venta agricultura registrada");
      limpiar();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al registrar venta agricultura");
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row: VentaAgriculturaRow) => {
    const ok = await confirmAction({
      title: "Eliminar registro",
      message: `¿Eliminar ${labelCultivoAgricultura(row.cultivo)} de ${labelEmpresaAgricultura(row.empresa)} (${formatPeriodoAgricultura(row.mes, row.anio)})?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteVentaAgricultura(row.id);
      onSuccess?.("Registro eliminado");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar registro");
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const totales = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          has: acc.has + r.hectareas,
          ton: acc.ton + r.total_ton,
          usd: acc.usd + r.importe_usd,
        }),
        { has: 0, ton: 0, usd: 0 }
      ),
    [rows]
  );

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>

      <form
        className="card form-card ventas-agricultura-card"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <div className="form-header">
          <h2>Ingresar Ventas Agricolas</h2>
          <p className="muted">
            Simulá la producción y el ingreso por cultivo. Total: <strong>Has × Rendimiento</strong>.
            Importe estimado: <strong>Total × Precio ÷ 1000</strong>.
          </p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="va-empresa">Empresa</label>
            <select
              id="va-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value as EmpresaAgricultura)}
            >
              <option value="">Seleccionar...</option>
              {EMPRESAS_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-mes">Mes</label>
            <select
              id="va-mes"
              value={mes === "" ? "" : String(mes)}
              onChange={(e) => {
                const v = e.target.value;
                setMes(v === "" ? "" : (Number(v) as MesAgricultura));
              }}
            >
              <option value="">Seleccionar...</option>
              {MESES_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-anio">Año</label>
            <select
              id="va-anio"
              value={anio === "" ? "" : String(anio)}
              onChange={(e) => {
                const v = e.target.value;
                setAnio(v === "" ? "" : Number(v));
              }}
            >
              <option value="">Seleccionar...</option>
              {ANIOS_AGRICULTURA.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-has">Cantidad de has</label>
            <input
              id="va-has"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 120"
              value={hectareas}
              onChange={(e) => setHectareas(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-cultivo">Tipo de cultivo</label>
            <select
              id="va-cultivo"
              value={cultivo}
              onChange={(e) => setCultivo(e.target.value as CultivoAgriculturaId)}
            >
              {CULTIVOS_AGRICULTURA.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="va-rendimiento">Rendimiento (ton/ha)</label>
            <input
              id="va-rendimiento"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 650"
              value={rendimiento}
              onChange={(e) => setRendimiento(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-precio">Precio del cultivo (USD/ton)</label>
            <input
              id="va-precio"
              type="number"
              min="0"
              step="0.01"
              placeholder="Ej: 401"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="va-total-prod">Total (ton)</label>
            <input
              id="va-total-prod"
              type="text"
              readOnly
              data-sin-mayusculas="true"
              className="input-readonly ventas-agricultura-total"
              value={
                totalProduccion != null ? formatTotalProduccionAgricultura(totalProduccion) : ""
              }
              placeholder="Has × Rendimiento"
              aria-readonly="true"
            />
          </div>
        </div>

        <div className="ventas-agricultura-resumen" aria-live="polite">
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">Cálculo</span>
            <strong>
              {hasNum != null && rendimientoNum != null
                ? `${fmtNum(hasNum, 2)} ha × ${formatRendimientoAgricultura(rendimientoNum)}`
                : "Completá has y rendimiento"}
            </strong>
          </div>
          <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--hero">
            <span className="ventas-agricultura-resumen-label">Total producción</span>
            <strong>
              {totalProduccion != null ? formatTotalProduccionAgricultura(totalProduccion) : "—"}
            </strong>
          </div>
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">Importe estimado</span>
            <strong>
              {importeTotal != null ? `USD ${fmtNum(importeTotal, 2)}` : "—"}
            </strong>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={limpiar} disabled={saving}>
            Limpiar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!puedeGuardar}>
            {saving ? "Guardando…" : "Registrar"}
          </button>
        </div>
      </form>

      <div className="card ventas-agricultura-listado">
        <div className="form-header">
          <h2>Ventas Agricolas</h2>
          <p className="muted">
            {loading
              ? "Cargando..."
              : `${rows.length} registro(s) — Total USD: ${fmtNum(totales.usd, 2)}`}
          </p>
        </div>

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="va-f-empresa">Empresa</label>
            <select
              id="va-f-empresa"
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
            >
              <option value="">Todas</option>
              {EMPRESAS_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="va-f-mes">Mes</label>
            <select
              id="va-f-mes"
              value={filtroMes === "" ? "" : String(filtroMes)}
              onChange={(e) => {
                const v = e.target.value;
                setFiltroMes(v === "" ? "" : (Number(v) as MesAgricultura));
              }}
            >
              <option value="">Todos</option>
              {MESES_AGRICULTURA.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="va-f-anio">Año</label>
            <select
              id="va-f-anio"
              value={filtroAnio === "" ? "" : String(filtroAnio)}
              onChange={(e) => {
                const v = e.target.value;
                setFiltroAnio(v === "" ? "" : Number(v));
              }}
            >
              <option value="">Todos</option>
              {ANIOS_AGRICULTURA.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="va-f-cultivo">Cultivo</label>
            <select
              id="va-f-cultivo"
              value={filtroCultivo}
              onChange={(e) => setFiltroCultivo(e.target.value as "" | CultivoAgriculturaId)}
            >
              <option value="">Todos</option>
              {CULTIVOS_AGRICULTURA.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field flex-grow">
            <label htmlFor="va-f-busq">Buscar</label>
            <input
              id="va-f-busq"
              type="search"
              placeholder="Empresa, cultivo, período…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table ventas-agricultura-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Período</th>
                <th>Cultivo</th>
                <th className="num">Has</th>
                <th className="num">Rend. (ton/ha)</th>
                <th className="num">Precio USD/ton</th>
                <th className="num">Total ton</th>
                <th className="num">Importe USD</th>
                <th className="actions-col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Cargando...
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={9} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Sin registros con esos filtros
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => (
                  <tr key={r.id}>
                    <td>{labelEmpresaAgricultura(r.empresa)}</td>
                    <td>{formatPeriodoAgricultura(r.mes, r.anio)}</td>
                    <td>{labelCultivoAgricultura(r.cultivo)}</td>
                    <td className="num">{fmtNum(r.hectareas, 2)}</td>
                    <td className="num">{fmtNum(r.rendimiento_ton_ha, 2)}</td>
                    <td className="num">{fmtNum(r.precio_usd_ton, 2)}</td>
                    <td className="num">{formatTotalProduccionAgricultura(r.total_ton)}</td>
                    <td className="num">
                      <strong>USD {fmtNum(r.importe_usd, 2)}</strong>
                    </td>
                    <td className="actions-col">
                      <button
                        type="button"
                        className="btn btn-sm btn-delete"
                        onClick={() => void borrar(r)}
                        disabled={!apiOnline}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && apiOnline && rows.length > 0 && (
              <tfoot>
                <tr className="data-table-totals">
                  <td colSpan={3}>
                    <strong>Totales ({rows.length})</strong>
                  </td>
                  <td className="num">
                    <strong>{fmtNum(totales.has, 2)}</strong>
                  </td>
                  <td colSpan={2} />
                  <td className="num">
                    <strong>{formatTotalProduccionAgricultura(totales.ton)}</strong>
                  </td>
                  <td className="num">
                    <strong>USD {fmtNum(totales.usd, 2)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && apiOnline && rows.length > 0 && (
          <TablePagination
            total={rows.length}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
