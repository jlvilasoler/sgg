import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePresupuesto, fetchEmpresasOperativas, fetchPresupuesto, presupuestoDocumentoUrl } from "../api";
import { FILTRO_SIN_RESPONSABLE } from "../constants";
import type { AuthUser, Catalogos, Presupuesto } from "../types";
import { confirmAction } from "../utils/confirm";
import {
  ejercicioConfigFromUser,
  ejercicioDesdeHasta,
  ejercicioVigente,
  esEjercicioVigente,
  labelEjercicio,
  listarEjerciciosContables,
  type EjercicioConfig,
} from "../utils/ejercicio-contable";
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
  currentUser?: AuthUser | null;
}

const COLS_TABLA = 11;

type ModalidadFecha = "ejercicio" | "periodo";

function filtrosInicialesEjercicio(cfg?: EjercicioConfig) {
  const v = ejercicioVigente(new Date(), cfg);
  return {
    ejercicio: String(v.anioInicio),
    fechaDesde: v.desde,
    fechaHasta: v.hasta,
  };
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

export default function Listado({ catalogos, apiOnline, onEdit, onDeleted, onError, onSuccess, currentUser }: Props) {
  const ejCfg = useMemo(() => ejercicioConfigFromUser(currentUser), [currentUser]);
  const ejerciciosOpciones = useMemo(
    () => listarEjerciciosContables({ cfg: ejCfg }),
    [ejCfg],
  );
  const iniciales = filtrosInicialesEjercicio(ejCfg);
  const [empresa, setEmpresa] = useState("");
  const [rubro, setRubro] = useState("");
  const [responsable, setResponsable] = useState("");
  const [ejercicio, setEjercicio] = useState(iniciales.ejercicio);
  const [fechaDesde, setFechaDesde] = useState(iniciales.fechaDesde);
  const [fechaHasta, setFechaHasta] = useState(iniciales.fechaHasta);
  const [modalidadFecha, setModalidadFecha] = useState<ModalidadFecha>("ejercicio");
  const [busqueda, setBusqueda] = useState("");
  const [rows, setRows] = useState<Presupuesto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState<"excel" | "pdf" | "csv" | null>(null);
  const [detalleRow, setDetalleRow] = useState<Presupuesto | null>(null);
  const [documentoRow, setDocumentoRow] = useState<Presupuesto | null>(null);
  const [empresas, setEmpresas] = useState<string[]>(catalogos.empresas);

  useEffect(() => {
    if (!apiOnline) {
      setEmpresas([]);
      return;
    }
    fetchEmpresasOperativas()
      .then(setEmpresas)
      .catch(() => setEmpresas(catalogos.empresas));
  }, [apiOnline, catalogos.empresas]);

  useEffect(() => {
    if (empresa && empresas.length > 0 && !empresas.includes(empresa)) {
      setEmpresa("");
    }
  }, [empresas, empresa]);

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
    const v = ejercicioVigente(new Date(), ejCfg);
    setEmpresa("");
    setRubro("");
    setResponsable("");
    setModalidadFecha("ejercicio");
    setEjercicio(String(v.anioInicio));
    setFechaDesde(v.desde);
    setFechaHasta(v.hasta);
    setBusqueda("");
  };

  const onModalidadFechaChange = (modalidad: ModalidadFecha) => {
    setModalidadFecha(modalidad);
    if (modalidad === "ejercicio") {
      const anio = ejercicio || String(ejercicioVigente(new Date(), ejCfg).anioInicio);
      setEjercicio(anio);
      const { desde, hasta } = ejercicioDesdeHasta(Number(anio), ejCfg);
      setFechaDesde(desde);
      setFechaHasta(hasta);
      return;
    }
    setEjercicio("");
  };

  const onEjercicioChange = (value: string) => {
    setEjercicio(value);
    if (!value) {
      setFechaDesde("");
      setFechaHasta("");
      return;
    }
    const { desde, hasta } = ejercicioDesdeHasta(Number(value), ejCfg);
    setFechaDesde(desde);
    setFechaHasta(hasta);
  };

  const onFechaDesdeChange = (value: string) => {
    setFechaDesde(value);
  };

  const onFechaHastaChange = (value: string) => {
    setFechaHasta(value);
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
    if (modalidadFecha === "ejercicio" && ejercicio) {
      const anio = Number(ejercicio);
      partes.push(`Ejercicio: ${labelEjercicio(anio, ejCfg)}`);
    } else {
      if (fechaDesde) partes.push(`Desde: ${fmtDate(fechaDesde)}`);
      if (fechaHasta) partes.push(`Hasta: ${fmtDate(fechaHasta)}`);
    }
    if (busqueda.trim()) partes.push(`Búsqueda: ${busqueda.trim()}`);
    return partes.length ? partes.join(" · ") : "Todos los filtros";
  }, [empresa, rubro, responsable, modalidadFecha, ejercicio, fechaDesde, fechaHasta, busqueda]);

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
        volverLabel="Volver a Presupuesto"
      />
    );
  }

  return (
    <div className="presupuesto-listado--hub presupuesto-hub-workspace">
      <section
        className="presupuesto-hub-filters-box filters filters-presupuesto mayusculas-auto"
        aria-label="Filtros del listado"
      >
        <div className="listado-pro-filters-row listado-pro-filters-row--principal">
            <div className="field">
              <label htmlFor="filtro-empresa">Empresa</label>
              <select
                id="filtro-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
              >
                <option value="">Todas</option>
                {empresas.map((e) => (
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
          </div>

          <div className="listado-pro-filters-row listado-pro-filters-row--fechas">
            <div className="field field--modalidad-fecha">
              <span className="field-action-label" id="filtro-modalidad-fecha-label">
                Filtrar por
              </span>
              <div
                className="listado-fecha-modalidad"
                role="group"
                aria-labelledby="filtro-modalidad-fecha-label"
              >
                <button
                  type="button"
                  className={`listado-fecha-modalidad-btn${
                    modalidadFecha === "ejercicio" ? " is-active" : ""
                  }`}
                  onClick={() => onModalidadFechaChange("ejercicio")}
                  aria-pressed={modalidadFecha === "ejercicio"}
                >
                  Ejercicio
                </button>
                <button
                  type="button"
                  className={`listado-fecha-modalidad-btn${
                    modalidadFecha === "periodo" ? " is-active" : ""
                  }`}
                  onClick={() => onModalidadFechaChange("periodo")}
                  aria-pressed={modalidadFecha === "periodo"}
                >
                  Período
                </button>
              </div>
            </div>
            {modalidadFecha === "ejercicio" ? (
              <div className="field field--ejercicio">
                <label htmlFor="filtro-ejercicio">Ejercicio</label>
                <select
                  id="filtro-ejercicio"
                  value={ejercicio}
                  onChange={(e) => onEjercicioChange(e.target.value)}
                  title="Período del 1 de julio al 30 de junio"
                >
                  <option value="">Todos</option>
                  {ejerciciosOpciones.map((e) => (
                    <option key={e.anioInicio} value={String(e.anioInicio)}>
                      {e.label}
                      {esEjercicioVigente(e.anioInicio, new Date(), ejCfg) ? " (vigente)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="field field--fecha">
                  <label htmlFor="filtro-desde">Desde</label>
                  <input
                    type="date"
                    id="filtro-desde"
                    value={fechaDesde}
                    onChange={(e) => onFechaDesdeChange(e.target.value)}
                  />
                </div>
                <div className="field field--fecha">
                  <label htmlFor="filtro-hasta">Hasta</label>
                  <input
                    type="date"
                    id="filtro-hasta"
                    value={fechaHasta}
                    onChange={(e) => onFechaHastaChange(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="presupuesto-hub-filters-actions listado-pro-filters-actions">
              <button
                type="button"
                className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                onClick={resetFiltros}
              >
                Reset
              </button>
              <button
                type="button"
                className="sg-hub-cta sg-hub-cta--compact"
                onClick={load}
              >
                Buscar
              </button>
            </div>
          </div>
      </section>

      <div className="sg-hub-kpi-strip presupuesto-listado-kpi-strip" aria-label="Indicadores acumulados">
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Pesos · UYU</p>
          <p className="sg-hub-kpi-value">
            {loading || !apiOnline ? "—" : fmtNum(indicadores.pesos)}
          </p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Dólares · USD</p>
          <p className="sg-hub-kpi-value">
            {loading || !apiOnline ? "—" : fmtNum(indicadores.usd)}
          </p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Reales · BRL</p>
          <p className="sg-hub-kpi-value">
            {loading || !apiOnline ? "—" : fmtNum(indicadores.reales)}
          </p>
        </article>
        <article
          className="sg-hub-kpi sg-hub-kpi--dark"
          title="Suma de la columna Total USD de todas las operaciones del listado filtrado"
        >
          <p className="sg-hub-kpi-kicker">Total gastos · USD</p>
          <p className="sg-hub-kpi-value">
            {loading || !apiOnline ? "—" : fmtNum(indicadores.saldoUsd)}
          </p>
          <p className="sg-hub-kpi-hint">Equivalente acumulado en dólares</p>
        </article>
      </div>

      <section className="presupuesto-hub-table-box" aria-label="Tabla de gastos">
        <div className="presupuesto-hub-export-bar" aria-label="Exportar listado">
          <span className="presupuesto-hub-export-label">Descargar</span>
          <button
            type="button"
            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact listado-pro-export-btn listado-pro-export-btn--csv"
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
            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact listado-pro-export-btn listado-pro-export-btn--excel"
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
            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact listado-pro-export-btn"
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
      </section>

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
