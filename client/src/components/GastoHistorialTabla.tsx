import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePresupuesto, fetchPresupuesto, presupuestoDocumentoUrl } from "../api";
import type { AuthUser, Presupuesto } from "../types";
import { confirmAction } from "../utils/confirm";
import { empresaClass, empresaCorta, fmtDate, fmtNum } from "../utils";
import GastoAccionesMenu from "./GastoAccionesMenu";
import { PresupuestoDetalleModalView } from "./PresupuestoDetalleModal";
import PresupuestoDocumentoModal from "./PresupuestoDocumentoModal";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "./TablePagination";

const COLS_BASE = 11;

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onEdit: (row: Presupuesto) => void;
  onError: (msg: string) => void;
  onDeleted?: () => void;
  refreshKey?: number;
}

/** Total en USD del registro: dólares directos + pesos/TC + reales/TC. */
function totalUsdDe(r: Presupuesto): number {
  const desdePesos = r.pesos > 0 && r.tc_usd > 0 ? r.pesos / r.tc_usd : 0;
  const desdeReales = r.reales > 0 && r.tc_reales > 0 ? r.reales / r.tc_reales : 0;
  const directo = r.dolares_usd > 0 ? r.dolares_usd : 0;
  const total = directo + desdePesos + desdeReales;
  return total > 0 ? total : r.saldo_usd;
}

function CeldaTexto({
  value,
  vacio = "—",
}: {
  value: string | null | undefined;
  vacio?: string;
}) {
  const texto = (value ?? "").trim() || vacio;
  return (
    <span className="cell-ellipsis" title={texto !== vacio ? texto : undefined}>
      {texto}
    </span>
  );
}

export default function GastoHistorialTabla({
  apiOnline,
  currentUser,
  onEdit,
  onError,
  onDeleted,
  refreshKey = 0,
}: Props) {
  const esAdmin = currentUser.rol === "admin";
  const colsTabla = COLS_BASE;
  const [rows, setRows] = useState<Presupuesto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [detalleRow, setDetalleRow] = useState<Presupuesto | null>(null);
  const [documentoRow, setDocumentoRow] = useState<Presupuesto | null>(null);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPresupuesto({
        busqueda: busqueda.trim() || undefined,
      });
      setRows(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar documentos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, busqueda, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const handleDelete = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar registro",
      message:
        "¿Eliminar este documento de PRESUPUESTO? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deletePresupuesto(id);
      if (detalleRow?.id === id) setDetalleRow(null);
      onDeleted?.();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const handleEdit = (row: Presupuesto) => {
    onEdit(row);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (documentoRow?.documento_adjunto) {
    return (
      <PresupuestoDocumentoModal
        row={documentoRow}
        documento={documentoRow.documento_adjunto}
        onClose={() => setDocumentoRow(null)}
      />
    );
  }

  return (
    <section className="listado-pro form-gasto-historial" aria-label="Documentos ingresados">
      <div className="listado-pro-shell">
        <header className="listado-pro-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">Documentos ingresados</h2>
            <p className="listado-pro-head-sub">
              {loading
                ? "Actualizando…"
                : !apiOnline
                  ? "Sin conexión con la API"
                  : rows.length === 0
                    ? esAdmin
                      ? "Sin documentos cargados todavía"
                      : "No ingresaste documentos todavía"
                    : esAdmin
                      ? `${rows.length} documento${rows.length === 1 ? "" : "s"} de todos los usuarios`
                      : `${rows.length} documento${rows.length === 1 ? "" : "s"} ingresados por vos`}
            </p>
          </div>
        </header>

        <div className="filters listado-pro-filters mayusculas-auto form-gasto-historial-filters">
          <div className="field flex-grow">
            <label htmlFor="gasto-hist-busqueda">Buscar</label>
            <input
              type="search"
              id="gasto-hist-busqueda"
              placeholder="Proveedor, factura, concepto, rubro…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
            />
          </div>
          <button type="button" className="btn btn-primary listado-pro-search-btn" onClick={() => void load()}>
            Buscar
          </button>
        </div>

        <div className="table-wrap table-wrap-presupuesto listado-pro-table-wrap">
          <table className="data-table data-table-presupuesto listado-pro-table">
            <colgroup>
              <col className="col-empresa" />
              <col className="col-fecha" />
              <col className="col-cod" />
              <col className="col-razon" />
              <col className="col-concepto" />
              <col className="col-fact" />
              <col className="col-pesos" />
              <col className="col-usd" />
              <col className="col-reales" />
              <col className="col-saldo" />
              <col className="col-acciones" />
            </colgroup>
            <thead>
              <tr>
                <th title="Empresa" data-col="empresa">
                  Emp.
                </th>
                <th data-col="fecha">Fecha</th>
                <th title="Código proveedor" data-col="cod">
                  Cód.
                </th>
                <th title="Razón social proveedor" data-col="razon">
                  Razón
                </th>
                <th data-col="concepto">Concepto</th>
                <th title="Número de factura" data-col="fact">
                  Fact.
                </th>
                <th className="num" data-col="pesos">
                  $
                </th>
                <th className="num" data-col="usd">
                  USD
                </th>
                <th className="num" data-col="reales">
                  R$
                </th>
                <th className="num" title="Total en USD" data-col="saldo">
                  TOTAL USD
                </th>
                <th className="col-acciones-h" aria-label="Acciones" data-col="acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colsTabla} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={colsTabla} className="empty">
                    API no conectada. Ejecutá <code>npm run dev</code> en la carpeta del proyecto.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colsTabla} className="empty">
                    No hay documentos{busqueda.trim() ? " para esa búsqueda" : ""}.
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => (
                  <tr key={r.id} className="listado-pro-row">
                    <td className="td-empresa" data-col="empresa">
                      <span
                        className={`empresa-badge empresa-badge--compact ${empresaClass(r.empresa)}`}
                        title={r.empresa}
                      >
                        {empresaCorta(r.empresa)}
                      </span>
                    </td>
                    <td className="td-fecha" data-col="fecha">
                      {fmtDate(r.fecha)}
                    </td>
                    <td data-col="cod">
                      <CeldaTexto value={r.codigo_proveedor} vacio="" />
                    </td>
                    <td data-col="razon">
                      <CeldaTexto value={r.razon_social_proveedor} vacio="" />
                    </td>
                    <td data-col="concepto">
                      <CeldaTexto value={r.concepto} vacio="" />
                    </td>
                    <td data-col="fact">
                      <CeldaTexto value={r.nro_factura} vacio="" />
                    </td>
                    <td className="num listado-pro-num" data-col="pesos">
                      {fmtNum(r.pesos)}
                    </td>
                    <td className="num listado-pro-num" data-col="usd">
                      {fmtNum(r.dolares_usd)}
                    </td>
                    <td className="num listado-pro-num" data-col="reales">
                      {fmtNum(r.reales)}
                    </td>
                    <td className="num listado-pro-num listado-pro-num--total" data-col="saldo">
                      {fmtNum(totalUsdDe(r))}
                    </td>
                    <td className="actions-cell actions-cell--icons" data-col="acciones">
                      <div className="actions-cell-inner">
                        <GastoAccionesMenu
                          tieneDocumento={Boolean(r.documento_adjunto)}
                          descargarUrl={
                            r.documento_adjunto
                              ? presupuestoDocumentoUrl(r.id, true)
                              : undefined
                          }
                          descargarNombre={r.documento_adjunto?.nombre}
                          onVerDocumento={() => setDocumentoRow(r)}
                          onVerDetalle={() => setDetalleRow(r)}
                          onEditar={() => handleEdit(r)}
                          onBorrar={() => void handleDelete(r.id)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && apiOnline && rows.length > 0 ? (
          <TablePagination
            total={rows.length}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>

      {detalleRow ? (
        <PresupuestoDetalleModalView
          row={detalleRow}
          onClose={() => setDetalleRow(null)}
        />
      ) : null}
    </section>
  );
}
