import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteIngresoVenta, fetchIngresosVentas } from "../../api";
import type { IngresoVenta } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { fmtDate, fmtNum, formatNumeroOperacion } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";

interface Props {
  apiOnline: boolean;
  onEdit: (row: IngresoVenta) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  refreshKey?: number;
}

export default function VentaListado({
  apiOnline,
  onEdit,
  onError,
  onSuccess,
  onVolver,
  refreshKey = 0,
}: Props) {
  const [rows, setRows] = useState<IngresoVenta[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(
        await fetchIngresosVentas({
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          busqueda: busqueda.trim() || undefined,
        })
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, fechaDesde, fechaHasta, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [fechaDesde, fechaHasta, busqueda, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const totales = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        pesos: acc.pesos + (Number(r.pesos) || 0),
        usd: acc.usd + (Number(r.dolares_usd) || 0),
        totalUsd: acc.totalUsd + (Number(r.total_usd) || 0),
      }),
      { pesos: 0, usd: 0, totalUsd: 0 }
    );
  }, [rows]);

  const borrar = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar documento",
      message: "¿Eliminar este ingreso por venta?",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteIngresoVenta(id);
      onSuccess("Documento eliminado");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Listado de ingresos por ventas</h2>
          <p className="muted">
            {loading
              ? "Cargando..."
              : `${rows.length} documento(s) — Total USD: ${fmtNum(totales.totalUsd)}`}
          </p>
        </div>

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="venta-f-desde">Desde</label>
            <input
              id="venta-f-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="venta-f-hasta">Hasta</label>
            <input
              id="venta-f-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="field flex-grow">
            <label htmlFor="venta-busq">Buscar</label>
            <input
              id="venta-busq"
              type="search"
              placeholder="Concepto, proveedor, código, nro. factura…"
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
          <table className="data-table">
            <thead>
              <tr>
                <th>N° oper.</th>
                <th>Fecha</th>
                <th>Cód.</th>
                <th>Razón social</th>
                <th>Concepto</th>
                <th>Nro. factura</th>
                <th className="num">Pesos $</th>
                <th className="num">USD</th>
                <th className="num">TC</th>
                <th className="num">Total USD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="empty">
                    Cargando...
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={11} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    Sin documentos con esos filtros
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{formatNumeroOperacion(r.nro_registro)}</td>
                    <td>{fmtDate(r.fecha)}</td>
                    <td className="num">{r.codigo_proveedor || "—"}</td>
                    <td>{r.razon_social_proveedor || "—"}</td>
                    <td>{r.concepto}</td>
                    <td>{r.nro_factura || "—"}</td>
                    <td className="num">{fmtNum(r.pesos)}</td>
                    <td className="num">{fmtNum(r.dolares_usd)}</td>
                    <td className="num">{r.tc_usd > 0 ? fmtNum(r.tc_usd, 4) : "—"}</td>
                    <td className="num">{fmtNum(r.total_usd)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-sm btn-edit"
                        onClick={() => onEdit(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-delete"
                        onClick={() => borrar(r.id)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
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
