import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePresupuesto, fetchPresupuesto, presupuestoDocumentoUrl } from "../api";
import { FILTRO_SIN_RESPONSABLE } from "../constants";
import type { Catalogos, Presupuesto } from "../types";
import { confirmAction } from "../utils/confirm";
import { empresaClass, empresaCorta, fmtDate, fmtNum } from "../utils";
import {
  exportPresupuestoListadoCsv,
  exportPresupuestoListadoExcel,
  exportPresupuestoListadoPdf,
} from "../utils/export-presupuesto-listado";
import { IconCsv, IconExcel, IconPdf } from "./icons/ActionIcons";
import GastoAccionesMenu from "./GastoAccionesMenu";
import PresupuestoDocumentoModal from "./PresupuestoDocumentoModal";
import PresupuestoDetallePanel from "./PresupuestoDetalleModal";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onEdit: (row: Presupuesto) => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

const COLS_TABLA = 12;

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

export default function Listado({ catalogos, apiOnline, onEdit, onDeleted, onError, onSuccess }: Props) {
  const [empresa, setEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [responsable, setResponsable] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [rows, setRows] = useState<Presupuesto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState<"excel" | "pdf" | "csv" | null>(null);
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
        empresa: empresa || undefined,
        rubro: rubro || undefined,
        responsable_gasto:
          responsable === FILTRO_SIN_RESPONSABLE
            ? FILTRO_SIN_RESPONSABLE
            : responsable || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        busqueda: busqueda.trim() || undefined,
        ver_todos: true,
      });
      setRows(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, empresa, rubro, responsable, fechaDesde, fechaHasta, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const indicadores = useMemo(() => {
    if (!rows?.length) {
      return { cantidad: 0, pesos: 0, usd: 0, reales: 0, saldoUsd: 0 };
    }
    return rows.reduce(
      (acc, r) => ({
        cantidad: acc.cantidad + 1,
        pesos: acc.pesos + (Number(r.pesos) || 0),
        usd: acc.usd + (Number(r.dolares_usd) || 0),
        reales: acc.reales + (Number(r.reales) || 0),
        saldoUsd: acc.saldoUsd + (Number(r.saldo_usd) || 0),
      }),
      { cantidad: 0, pesos: 0, usd: 0, reales: 0, saldoUsd: 0 }
    );
  }, [rows]);

  const resetFiltros = () => {
    setEmpresa("");
    setRubro("");
    setResponsable("");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
  };

  const subtituloExport = useMemo(() => {
    const partes: string[] = [];
    if (empresa) partes.push(`Empresa: ${empresa}`);
    if (rubro) partes.push(`Rubro: ${rubro}`);
    if (responsable) {
      partes.push(
        responsable === FILTRO_SIN_RESPONSABLE
          ? "Pto. asign.: Sin asignar"
          : `Pto. asign.: ${responsable}`
      );
    }
    if (fechaDesde) partes.push(`Desde: ${fmtDate(fechaDesde)}`);
    if (fechaHasta) partes.push(`Hasta: ${fmtDate(fechaHasta)}`);
    if (busqueda.trim()) partes.push(`Búsqueda: ${busqueda.trim()}`);
    return partes.length ? partes.join(" · ") : "Todos los filtros";
  }, [empresa, rubro, responsable, fechaDesde, fechaHasta, busqueda]);

  const exportar = async (formato: "excel" | "pdf" | "csv") => {
    if (!apiOnline) {
      onError("Conectá la API para exportar");
      return;
    }
    if (loading) return;
    if (!rows?.length) {
      onError("No hay registros para exportar con los filtros actuales");
      return;
    }
    setExportando(formato);
    try {
      if (formato === "excel") {
        await exportPresupuestoListadoExcel(rows);
        onSuccess?.("Excel descargado.");
      } else if (formato === "csv") {
        await exportPresupuestoListadoCsv(rows);
        onSuccess?.("CSV descargado.");
      } else {
        await exportPresupuestoListadoPdf(rows, subtituloExport);
        onSuccess?.("PDF descargado.");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExportando(null);
    }
  };

  const puedeExportar = apiOnline && !loading && (rows?.length ?? 0) > 0;

  const handleDelete = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar registro",
      message:
        "¿Eliminar este registro de PRESUPUESTO? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deletePresupuesto(id);
      if (detalleRow?.id === id) setDetalleRow(null);
      onDeleted();
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  if (detalleRow) {
    return (
      <PresupuestoDetallePanel
        row={detalleRow}
        onVolver={() => setDetalleRow(null)}
        volverLabel="Volver al historial"
      />
    );
  }

  return (
    <div className="listado-pro">
      <div className="listado-pro-shell">
        <header className="listado-pro-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">Historial de operaciones</h2>
            <p className="listado-pro-head-sub">
              {loading
                ? "Actualizando…"
                : !apiOnline
                  ? "Sin conexión con la API"
                  : indicadores.cantidad === 0
                    ? "Sin registros para los filtros aplicados"
                    : `${indicadores.cantidad} operación${
                        indicadores.cantidad === 1 ? "" : "es"
                      } en el período filtrado`}
            </p>
          </div>
        </header>

        <div className="filters filters-presupuesto listado-pro-filters mayusculas-auto">
        <div className="field">
          <label htmlFor="filtro-empresa">Empresa</label>
          <select
            id="filtro-empresa"
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
        <div className="field">
          <label htmlFor="filtro-rubro">Rubro</label>
          <select id="filtro-rubro" value={rubro} onChange={(e) => setRubro(e.target.value)}>
            <option value="">Todos</option>
            {catalogos.rubros.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--pto-asig">
          <label htmlFor="filtro-responsable" title="Presupuesto asignado">
            Pto. asign.
          </label>
          <select
            id="filtro-responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
          >
            <option value="">Todos</option>
            <option value={FILTRO_SIN_RESPONSABLE}>Sin asignar</option>
            {catalogos.responsables.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filtro-desde">Desde</label>
          <input
            type="date"
            id="filtro-desde"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filtro-hasta">Hasta</label>
          <input
            type="date"
            id="filtro-hasta"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
          />
        </div>
        <div className="field flex-grow">
          <label htmlFor="filtro-busqueda">Buscar</label>
          <input
            type="search"
            id="filtro-busqueda"
            placeholder="Proveedor, factura, concepto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button type="button" className="btn listado-pro-reset-btn" onClick={resetFiltros}>
          Reset
        </button>
        <button type="button" className="btn btn-primary listado-pro-search-btn" onClick={load}>
          Buscar
        </button>
      </div>

      <section
        className="listado-indicadores listado-pro-indicadores"
        aria-label="Indicadores acumulados"
      >
        <div className="listado-indicadores-grid listado-pro-kpi-grid">
          <div className="listado-indicador listado-indicador--pesos listado-pro-kpi">
            <span className="listado-indicador-label">Pesos</span>
            <span className="listado-pro-kpi-currency">ARS</span>
            <span className="listado-indicador-valor listado-pro-kpi-valor">
              {loading || !apiOnline ? "—" : fmtNum(indicadores.pesos)}
            </span>
          </div>
          <div className="listado-indicador listado-indicador--usd listado-pro-kpi">
            <span className="listado-indicador-label">Dólares</span>
            <span className="listado-pro-kpi-currency">USD</span>
            <span className="listado-indicador-valor listado-pro-kpi-valor">
              {loading || !apiOnline ? "—" : fmtNum(indicadores.usd)}
            </span>
          </div>
          <div className="listado-indicador listado-indicador--reales listado-pro-kpi">
            <span className="listado-indicador-label">Reales</span>
            <span className="listado-pro-kpi-currency">BRL</span>
            <span className="listado-indicador-valor listado-pro-kpi-valor">
              {loading || !apiOnline ? "—" : fmtNum(indicadores.reales)}
            </span>
          </div>
          <div
            className="listado-indicador listado-indicador--saldo-total listado-pro-kpi listado-pro-kpi--hero"
            title="Suma de la columna Total USD de todas las operaciones del listado filtrado"
          >
            <span className="listado-indicador-label">Total gastos</span>
            <span className="listado-pro-kpi-currency">USD</span>
            <span className="listado-indicador-valor listado-indicador-valor--destacado listado-pro-kpi-valor listado-pro-kpi-valor--hero">
              {loading || !apiOnline ? "—" : fmtNum(indicadores.saldoUsd)}
            </span>
            <span className="listado-indicador-hint">Equivalente acumulado en dólares</span>
          </div>
        </div>
      </section>

      <div className="listado-pro-export-bar" aria-label="Exportar listado">
        <span className="listado-pro-export-label">Descargar</span>
        <button
          type="button"
          className="btn btn-sm listado-pro-export-btn listado-pro-export-btn--csv"
          disabled={!puedeExportar || exportando !== null}
          onClick={() => void exportar("csv")}
          title="Descargar tabla en CSV"
          aria-label="Descargar tabla en CSV"
        >
          <IconCsv size={16} className="btn-action-icon" />
          {exportando === "csv" ? "Exportando…" : "CSV"}
        </button>
        <button
          type="button"
          className="btn btn-sm listado-pro-export-btn listado-pro-export-btn--excel"
          disabled={!puedeExportar || exportando !== null}
          onClick={() => void exportar("excel")}
          title="Descargar tabla en Excel"
          aria-label="Descargar tabla en Excel"
        >
          <IconExcel size={16} className="btn-action-icon" />
          {exportando === "excel" ? "Exportando…" : "Excel"}
        </button>
        <button
          type="button"
          className="btn btn-sm listado-pro-export-btn"
          disabled={!puedeExportar || exportando !== null}
          onClick={() => void exportar("pdf")}
          title="Descargar tabla en PDF"
          aria-label="Descargar tabla en PDF"
        >
          <IconPdf size={16} className="btn-action-icon" />
          {exportando === "pdf" ? "Exportando…" : "PDF"}
        </button>
      </div>

      <div className="table-wrap table-wrap-presupuesto listado-pro-table-wrap">
        <table className="data-table data-table-presupuesto listado-pro-table">
          <colgroup>
            <col className="col-nro" />
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
              <th className="num" title="Número de registro" data-col="nro">
                N°
              </th>
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
                <td colSpan={COLS_TABLA} className="empty">
                  Cargando...
                </td>
              </tr>
            ) : !apiOnline ? (
              <tr>
                <td colSpan={COLS_TABLA} className="empty">
                  API no conectada. Ejecutá <code>npm run dev</code> en la carpeta del proyecto.
                </td>
              </tr>
            ) : !rows?.length ? (
              <tr>
                <td colSpan={COLS_TABLA} className="empty">
                  No hay registros con esos filtros.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="listado-pro-row">
                  <td className="num listado-pro-num" data-col="nro">
                    {r.nro_registro}
                  </td>
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
                    {fmtNum(r.saldo_usd)}
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
                        onEditar={() => onEdit(r)}
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
      </div>

      {documentoRow?.documento_adjunto ? (
        <PresupuestoDocumentoModal
          row={documentoRow}
          documento={documentoRow.documento_adjunto}
          onClose={() => setDocumentoRow(null)}
        />
      ) : null}
    </div>
  );
}
