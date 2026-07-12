import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createVentaAgricultura,
  deleteVentaAgricultura,
  fetchEmpresasOperativas,
  fetchVentasAgricultura,
  patchVentaAgricultura,
  updateVentaAgricultura,
} from "../../api";
import type { AuthUser, Catalogos, VentaAgriculturaRealInput, VentaAgriculturaRow } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { fmtNum } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import {
  ANIOS_AGRICULTURA,
  empresasSelectOptions,
  MESES_AGRICULTURA,
  calcularImporteNetoAgricultura,
  calcularPagosAgricultura,
  calcularTotalProduccionAgricultura,
  calcUsdPorHa,
  FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO,
  FORMA_PAGO_AGRICULTURA_FRACCION_SALDO,
  FORMAS_PAGO_AGRICULTURA,
  formatTonAgricultura,
  normalizeFormaPagoAgricultura,
  pagosNetosAgriculturaDesdePagos,
  type FormaPagoAgricultura,
  OPCIONES_MES_ANIO_AGRICULTURA,
  parseMesAnioAgricultura,
  encodeMesAnioAgricultura,
  formatZafraAgricultura,
  formatOperacionAgricultura,
  formatRendimientoAgricultura,
  formatTotalProduccionAgricultura,
  labelCultivoAgricultura,
  labelEmpresaAgricultura,
  parsePositiveDecimal,
  parseNonNegativeDecimal,
  VENTAS_AGRICULTURA_COPY,
  type EmpresaAgricultura,
  type MesAgricultura,
  type VentasAgriculturaModo,
} from "./ventas-agricultura-utils";
import VentasAgriculturaCultivoSelect from "./VentasAgriculturaCultivoSelect";
import {
  fetchCultivosVentaAgricultura,
  normalizeCultivoNombre,
} from "./ventas-agricultura-cultivos";
import VentasAgriculturaTablaFila from "./VentasAgriculturaTablaFila";
import {
  importeEfectivoAgricultura,
  normalizeVentaAgriculturaRow,
  tonEfectivaAgricultura,
} from "./ventas-agricultura-real-utils";
import { canWriteSimuladorVentaGanado, canWriteIngresosVentas, canManageVentaRubros } from "../../utils/auth-permissions";
import { PageModuleHeadRow } from "../PageModuleHead";
import {
  VentasDashKpi,
  VentasIngresosDashPanel,
  VentasIngresosListPanel,
} from "./VentasIngresosDashUi";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  modo?: VentasAgriculturaModo;
  user?: AuthUser | null;
  embedded?: boolean;
}

export default function VentasAgricultura({
  catalogos,
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  modo = "ingresos",
  user = null,
  embedded = false,
}: Props) {
  const copy = VENTAS_AGRICULTURA_COPY[modo];
  const [empresasCuenta, setEmpresasCuenta] = useState<string[]>(catalogos.empresas);
  const empresasOpciones = useMemo(
    () => empresasSelectOptions(empresasCuenta),
    [empresasCuenta]
  );
  const esSimulador = modo === "simulador";
  const puedeEditar = esSimulador
    ? canWriteSimuladorVentaGanado(user)
    : canWriteIngresosVentas(user);
  const puedeAgregarCultivo = canManageVentaRubros(user);
  const formRef = useRef<HTMLFormElement>(null);
  const [empresa, setEmpresa] = useState<EmpresaAgricultura>("");
  const [zafraInicio, setZafraInicio] = useState("");
  const [zafraFin, setZafraFin] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [cultivosCatalogo, setCultivosCatalogo] = useState<string[]>([]);
  const [rendimiento, setRendimiento] = useState("");
  const [precioIngreso, setPrecioIngreso] = useState("");
  const [precio, setPrecio] = useState("");
  const [formaPago, setFormaPago] = useState<FormaPagoAgricultura>("FRACCIONADO");
  const [pagoIngresoCobrado, setPagoIngresoCobrado] = useState(false);
  const [impuestos, setImpuestos] = useState("");
  const [flete, setFlete] = useState("");
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<VentaAgriculturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroMes, setFiltroMes] = useState<MesAgricultura>("");
  const [filtroAnio, setFiltroAnio] = useState<number | "">("");
  const [filtroCultivo, setFiltroCultivo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [editingRealId, setEditingRealId] = useState<number | null>(null);

  const reloadCultivosCatalogo = useCallback(async () => {
    if (!apiOnline) {
      setCultivosCatalogo([]);
      return;
    }
    try {
      setCultivosCatalogo(await fetchCultivosVentaAgricultura());
    } catch {
      setCultivosCatalogo([]);
    }
  }, [apiOnline]);

  useEffect(() => {
    void reloadCultivosCatalogo();
  }, [reloadCultivosCatalogo]);

  useEffect(() => {
    if (!apiOnline) {
      setEmpresasCuenta([]);
      return;
    }
    fetchEmpresasOperativas()
      .then(setEmpresasCuenta)
      .catch(() => setEmpresasCuenta(catalogos.empresas));
  }, [apiOnline, catalogos.empresas]);

  useEffect(() => {
    if (empresa && empresasCuenta.length > 0 && !empresasCuenta.includes(empresa)) {
      setEmpresa("");
    }
    if (filtroEmpresa && empresasCuenta.length > 0 && !empresasCuenta.includes(filtroEmpresa)) {
      setFiltroEmpresa("");
    }
  }, [empresasCuenta, empresa, filtroEmpresa]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingRealId, setSavingRealId] = useState<number | null>(null);
  const [patchingId, setPatchingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const hasNum = useMemo(() => parsePositiveDecimal(hectareas), [hectareas]);
  const rendimientoNum = useMemo(() => parsePositiveDecimal(rendimiento), [rendimiento]);
  const precioIngresoNum = useMemo(() => parsePositiveDecimal(precioIngreso), [precioIngreso]);
  const precioNum = useMemo(() => parsePositiveDecimal(precio), [precio]);
  const impuestosNum = useMemo(() => parseNonNegativeDecimal(impuestos), [impuestos]);
  const fleteNum = useMemo(() => parseNonNegativeDecimal(flete), [flete]);

  const totalProduccion = useMemo(
    () => calcularTotalProduccionAgricultura(hasNum, rendimientoNum),
    [hasNum, rendimientoNum]
  );

  const esPagoFraccionado = formaPago === "FRACCIONADO";

  const pagos = useMemo(
    () =>
      calcularPagosAgricultura(
        totalProduccion,
        esPagoFraccionado ? precioIngresoNum : precioNum,
        precioNum,
        formaPago
      ),
    [totalProduccion, precioIngresoNum, precioNum, formaPago, esPagoFraccionado]
  );

  const importeBruto = pagos.importeBruto;

  const importeTotal = useMemo(
    () => calcularImporteNetoAgricultura(importeBruto, impuestosNum, fleteNum),
    [importeBruto, impuestosNum, fleteNum]
  );

  const pagosNetos = useMemo(
    () => pagosNetosAgriculturaDesdePagos(pagos, impuestosNum, fleteNum),
    [pagos, impuestosNum, fleteNum]
  );

  const puedeGuardar =
    apiOnline &&
    !saving &&
    empresa !== "" &&
    zafraInicio !== "" &&
    zafraFin !== "" &&
    hasNum != null &&
    rendimientoNum != null &&
    precioNum != null &&
    (!esPagoFraccionado || precioIngresoNum != null) &&
    cultivo.trim() !== "";

  const handleFormaPagoChange = (next: FormaPagoAgricultura) => {
    setFormaPago(next);
    if (next === "AL_FINAL") {
      setPagoIngresoCobrado(false);
    }
    if (next === "FRACCIONADO" && !precioIngreso.trim() && precio.trim()) {
      setPrecioIngreso(precio);
    }
  };

  const limpiar = () => {
    setEmpresa("");
    setZafraInicio("");
    setZafraFin("");
    setHectareas("");
    setCultivo("");
    setRendimiento("");
    setPrecioIngreso("");
    setPrecio("");
    setFormaPago("FRACCIONADO");
    setPagoIngresoCobrado(false);
    setImpuestos("");
    setFlete("");
    setEditingId(null);
  };

  const loadFormFromRow = (row: VentaAgriculturaRow) => {
    setEmpresa(row.empresa);
    setZafraInicio(encodeMesAnioAgricultura(row.anio_inicio, row.mes_inicio));
    setZafraFin(encodeMesAnioAgricultura(row.anio_fin, row.mes_fin));
    setCultivo(normalizeCultivoNombre(row.cultivo));
    setHectareas(String(row.hectareas));
    setRendimiento(String(row.rendimiento_ton_ha));
    setPrecioIngreso(String(row.precio_ingreso_usd_ton ?? row.precio_usd_ton));
    setPrecio(String(row.precio_usd_ton));
    setFormaPago(normalizeFormaPagoAgricultura(row.forma_pago_agricultura));
    setPagoIngresoCobrado(row.pago_ingreso_cobrado === true);
    setImpuestos(row.costo_impuestos_usd > 0 ? String(row.costo_impuestos_usd) : "");
    setFlete(row.costo_flete_usd > 0 ? String(row.costo_flete_usd) : "");
    setEditingId(row.id);
    setEditingRealId(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    limpiar();
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
        (await fetchVentasAgricultura({
          empresa: filtroEmpresa || undefined,
          mes: filtroMes !== "" ? filtroMes : undefined,
          anio: filtroAnio !== "" ? filtroAnio : undefined,
          cultivo: filtroCultivo || undefined,
          busqueda: busqueda.trim() || undefined,
        })).map(normalizeVentaAgriculturaRow)
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
    if (!puedeGuardar) return;
    const ini = parseMesAnioAgricultura(zafraInicio);
    const fin = parseMesAnioAgricultura(zafraFin);
    if (!ini || !fin) {
      onError("Seleccioná mes y año de inicio y fin de la zafra");
      return;
    }
    if (fin.anio * 12 + fin.mes < ini.anio * 12 + ini.mes) {
      onError("El mes final debe ser posterior o igual al mes de inicio");
      return;
    }
    if (importeBruto != null && impuestosNum + fleteNum > importeBruto) {
      onError("Impuestos y flete no pueden superar el importe bruto");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        empresa,
        mes_inicio: ini.mes,
        mes_fin: fin.mes,
        anio_inicio: ini.anio,
        anio_fin: fin.anio,
        cultivo: normalizeCultivoNombre(cultivo),
        hectareas: hasNum!,
        rendimiento_ton_ha: rendimientoNum!,
        precio_usd_ton: precioNum!,
        precio_ingreso_usd_ton: esPagoFraccionado ? precioIngresoNum! : precioNum!,
        forma_pago_agricultura: formaPago,
        costo_impuestos_usd: impuestosNum,
        costo_flete_usd: fleteNum,
        pago_ingreso_cobrado: esPagoFraccionado && pagoIngresoCobrado,
      };
      if (editingId != null) {
        await updateVentaAgricultura(editingId, payload);
        onSuccess?.("Simulación actualizada");
      } else {
        await createVentaAgricultura(payload);
        onSuccess?.(copy.guardadoOk);
      }
      limpiar();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : copy.errorGuardar);
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row: VentaAgriculturaRow) => {
    const ok = await confirmAction({
      title: copy.eliminarTitulo,
      message: `¿Eliminar ${labelCultivoAgricultura(row.cultivo)} de ${labelEmpresaAgricultura(row.empresa)} (${formatZafraAgricultura(row.mes_inicio, row.anio_inicio, row.mes_fin, row.anio_fin)})?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(row.id);
    try {
      await deleteVentaAgricultura(row.id);
      if (editingRealId === row.id) setEditingRealId(null);
      if (editingId === row.id) setEditingId(null);
      onSuccess?.(copy.eliminadoOk);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar registro");
    } finally {
      setDeletingId(null);
    }
  };

  const guardarReal = async (row: VentaAgriculturaRow, payload: VentaAgriculturaRealInput) => {
    setSavingRealId(row.id);
    try {
      const res = await patchVentaAgricultura(row.id, { valores_reales: payload });
      setEditingRealId(null);
      onSuccess?.(res.message);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar venta real");
    } finally {
      setSavingRealId(null);
    }
  };

  const handleDestacar = async (row: VentaAgriculturaRow) => {
    setPatchingId(row.id);
    try {
      await patchVentaAgricultura(row.id, { destacada: !(row.destacada ?? false) });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al destacar");
    } finally {
      setPatchingId(null);
    }
  };

  const quitarReal = async (row: VentaAgriculturaRow) => {
    const ok = await confirmAction({
      title: "Quitar venta real",
      message: `¿Volver a pendiente la simulación de ${labelCultivoAgricultura(row.cultivo)}? Se borrarán los datos reales.`,
      confirmText: "Quitar real",
      variant: "danger",
    });
    if (!ok) return;
    setPatchingId(row.id);
    try {
      const res = await patchVentaAgricultura(row.id, { venta_realizada: false });
      if (editingRealId === row.id) setEditingRealId(null);
      onSuccess?.(res.message);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al quitar venta real");
    } finally {
      setPatchingId(null);
    }
  };

  const historialColSpan = 12;

  const rowsVisibles = useMemo(
    () =>
      esSimulador
        ? rows
        : rows.filter((r) => normalizeVentaAgriculturaRow(r).venta_realizada),
    [rows, esSimulador]
  );

  const totalPages = Math.max(1, Math.ceil(rowsVisibles.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rowsVisibles, pageSafe, pageSize),
    [rowsVisibles, pageSafe, pageSize]
  );

  const totales = useMemo(() => {
    const base = rowsVisibles.reduce(
      (acc, r) => {
        const n = normalizeVentaAgriculturaRow(r);
        return {
          has: acc.has + (r.real_hectareas ?? r.hectareas),
          ton: acc.ton + tonEfectivaAgricultura(r),
          imp: acc.imp + n.costo_impuestos_usd,
          flete: acc.flete + n.costo_flete_usd,
          usd: acc.usd + importeEfectivoAgricultura(r),
        };
      },
      { has: 0, ton: 0, imp: 0, flete: 0, usd: 0 },
    );
    return {
      ...base,
      usdHa: calcUsdPorHa(base.usd, base.has),
    };
  }, [rowsVisibles]);

  const tieneFiltrosIngresos = Boolean(
    filtroEmpresa || filtroMes !== "" || filtroAnio !== "" || filtroCultivo || busqueda.trim()
  );

  const ingresosHubKpiStrip = embedded ? (
    <VentasIngresosDashPanel title="Resumen de ventas agrícolas">
      <VentasDashKpi
        kicker="Ventas"
        value={loading || !apiOnline ? "—" : rowsVisibles.length}
        hint="Operaciones cerradas"
        variant="dark"
      />
      <VentasDashKpi
        kicker="Has"
        value={loading || !apiOnline ? "—" : fmtNum(totales.has, 2)}
        hint="Hectáreas totales"
        variant="light"
        highlight="mid"
      />
      <VentasDashKpi
        kicker="Ton"
        value={loading || !apiOnline ? "—" : formatTotalProduccionAgricultura(totales.ton)}
        hint="Producción total"
        variant="light"
      />
      <VentasDashKpi
        kicker="Total USD"
        value={loading || !apiOnline ? "—" : fmtNum(totales.usd, 2)}
        hint="Monto acumulado"
        variant="light"
      />
    </VentasIngresosDashPanel>
  ) : (
    <section
      className="sg-hub-kpi-strip ventas-ingresos-kpi-strip ventas-ingresos-kpi-strip--4"
      aria-label="Totales de ventas agrícolas"
    >
      <article className="sg-hub-kpi sg-hub-kpi--dark">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Ventas</p>
            <p className="sg-hub-kpi-value">
              {loading || !apiOnline ? "—" : rowsVisibles.length}
            </p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Operaciones cerradas</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Has</p>
            <p className="sg-hub-kpi-value">
              {loading || !apiOnline ? "—" : fmtNum(totales.has, 2)}
            </p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Hectáreas totales</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Ton</p>
            <p className="sg-hub-kpi-value">
              {loading || !apiOnline ? "—" : formatTotalProduccionAgricultura(totales.ton)}
            </p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Producción total</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Total USD</p>
            <p className="sg-hub-kpi-value sg-hub-kpi-value--usd">
              {loading || !apiOnline ? "—" : fmtNum(totales.usd, 2)}
            </p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Monto acumulado</p>
      </article>
    </section>
  );

  const ingresosFiltersBar = (
    <div className="ventas-ingresos-hub-filters-box mayusculas-auto">
      <div className="field">
        <label htmlFor="va-f-empresa">Empresa</label>
        <select
          id="va-f-empresa"
          value={filtroEmpresa}
          disabled={!apiOnline || loading}
          onChange={(e) => setFiltroEmpresa(e.target.value)}
        >
          <option value="">Todas</option>
          {empresasOpciones.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="va-f-mes">Mes en zafra</label>
        <select
          id="va-f-mes"
          value={filtroMes === "" ? "" : String(filtroMes)}
          disabled={!apiOnline || loading}
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
          disabled={!apiOnline || loading}
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
          disabled={!apiOnline || loading}
          onChange={(e) => setFiltroCultivo(e.target.value)}
        >
          <option value="">Todos</option>
          {cultivosCatalogo.map((nombre) => (
            <option key={nombre} value={nombre}>
              {nombre}
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
          disabled={!apiOnline || loading}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>
      <div className="ventas-ingresos-hub-filters-actions">
        <button
          type="button"
          className="sg-hub-cta sg-hub-cta--ghost"
          disabled={!apiOnline || loading || !tieneFiltrosIngresos}
          onClick={() => {
            setFiltroEmpresa("");
            setFiltroMes("");
            setFiltroAnio("");
            setFiltroCultivo("");
            setBusqueda("");
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          className="sg-hub-cta"
          disabled={!apiOnline || loading}
          onClick={() => void load()}
        >
          Buscar
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`subseccion-panel${!esSimulador && !embedded ? " ventas-ingresos--hub ventas-agricultura--hub" : ""}`}
    >
      {!embedded ? (
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {copy.volver}
      </button>
      ) : null}

      {esSimulador && puedeEditar && (
      <form
        ref={formRef}
        className={`form-card ventas-agricultura-card${
          embedded ? " sg-hub-panel ventas-simulador-panel ventas-agricultura-form-hub" : " card"
        }`}
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {esSimulador && editingId != null && (
          <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
            <span>Editando simulación #{editingId}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
              Cancelar
            </button>
          </div>
        )}
        {esSimulador && editingRealId != null && editingId == null && (
          <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
            <span>Cargando venta real — completá los datos en la tabla</span>
          </div>
        )}
        {!embedded && (
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "ventas_agricultura" }}
            title={copy.tituloForm}
            subtitle={
              <>
                Simulá la producción y el ingreso por cultivo. Total: <strong>Has × Rendimiento (kg/ha)</strong>.
                Importe estimado: <strong>Total × Precio ÷ 1000</strong>.
              </>
            }
          />
        </div>
        )}

        <div className="form-grid">
          <div className="field">
            <label htmlFor="va-empresa">Empresa</label>
            <select
              id="va-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value as EmpresaAgricultura)}
            >
              <option value="">Seleccionar...</option>
              {empresasOpciones.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ventas-agricultura-zafra span-3">
            <h3 className="ventas-agricultura-zafra-title">Zafra</h3>
            <div className="ventas-agricultura-zafra-grid">
              <div className="field">
                <label htmlFor="va-mes-inicio">Mes de inicio</label>
                <select
                  id="va-mes-inicio"
                  value={zafraInicio}
                  onChange={(e) => setZafraInicio(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {OPCIONES_MES_ANIO_AGRICULTURA.map((item) => (
                    <option key={`ini-${item.value}`} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="va-mes-fin">Mes final</label>
                <select
                  id="va-mes-fin"
                  value={zafraFin}
                  onChange={(e) => setZafraFin(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {OPCIONES_MES_ANIO_AGRICULTURA.map((item) => (
                    <option key={`fin-${item.value}`} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
            <label htmlFor="va-cultivo-trigger">Tipo de cultivo</label>
            <VentasAgriculturaCultivoSelect
              id="va-cultivo"
              value={cultivo}
              onChange={setCultivo}
              disabled={!apiOnline || saving}
              apiOnline={apiOnline}
              puedeAgregar={puedeAgregarCultivo}
              onError={onError}
              onCatalogoChanged={reloadCultivosCatalogo}
            />
          </div>

          <div className="field">
            <label htmlFor="va-rendimiento">Rendimiento (kg/ha)</label>
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

          <div className="field span-3">
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

          <div className="ventas-agricultura-pagos span-3">
            <h3 className="ventas-agricultura-pagos-title">Forma de pago</h3>
            <div
              className="ventas-agricultura-forma-pago-modalidad"
              role="group"
              aria-label="Modalidad de cobro"
            >
              {FORMAS_PAGO_AGRICULTURA.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn btn-secondary btn-sm ventas-agricultura-forma-pago-btn${
                    formaPago === item.id ? " is-active" : ""
                  }`}
                  aria-pressed={formaPago === item.id}
                  title={item.hint}
                  onClick={() => handleFormaPagoChange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="ventas-agricultura-forma-pago-activa muted">
              {FORMAS_PAGO_AGRICULTURA.find((f) => f.id === formaPago)?.hint}
            </p>
            <div
              className={`ventas-agricultura-pagos-grid${
                esPagoFraccionado ? "" : " ventas-agricultura-pagos-grid--solo-final"
              }`}
            >
              {esPagoFraccionado ? (
              <article className="ventas-agricultura-pago-card ventas-agricultura-pago-card--ingreso">
                <header className="ventas-agricultura-pago-head">
                  <h4 className="ventas-agricultura-pago-name">Pago 1</h4>
                  <p className="ventas-agricultura-pago-hint">
                    Al ingresar · {Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO * 100)}% de la
                    producción · precio del momento
                  </p>
                </header>
                <div className="ventas-agricultura-pago-fields">
                  <div className="field">
                    <label htmlFor="va-precio-ingreso">Precio al ingresar (USD/ton)</label>
                    <input
                      id="va-precio-ingreso"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 350"
                      value={precioIngreso}
                      onChange={(e) => setPrecioIngreso(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="va-pago1-ton">Cantidad</label>
                    <input
                      id="va-pago1-ton"
                      type="text"
                      readOnly
                      data-sin-mayusculas="true"
                      className="input-readonly"
                      value={pagos.pago1Ton != null ? formatTonAgricultura(pagos.pago1Ton) : ""}
                      placeholder="40% de la producción"
                      aria-readonly="true"
                    />
                  </div>
                  <div className="field ventas-agricultura-pago-importe">
                    <label>Importe estimado</label>
                    <output className="ventas-agricultura-pago-importe-value">
                      {pagos.pago1Usd != null ? `USD ${fmtNum(pagos.pago1Usd, 2)}` : "—"}
                    </output>
                  </div>
                </div>
                <label className="ventas-agricultura-pago-cobro-check">
                  <input
                    type="checkbox"
                    checked={pagoIngresoCobrado}
                    onChange={(e) => setPagoIngresoCobrado(e.target.checked)}
                  />
                  <span className="ventas-agricultura-pago-cobro-check-text">
                    <strong>Pago 1 ({Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO * 100)}%) cobrado</strong>
                    <span className="muted">
                      Marcá si ya cobraste al ingresar. En Por cobrar queda solo el saldo (
                      {Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_SALDO * 100)}%).
                    </span>
                  </span>
                </label>
              </article>
              ) : null}

              <article className="ventas-agricultura-pago-card ventas-agricultura-pago-card--saldo">
                <header className="ventas-agricultura-pago-head">
                  <h4 className="ventas-agricultura-pago-name">
                    {esPagoFraccionado ? "Pago 2" : "Cobro al finalizar"}
                  </h4>
                  <p className="ventas-agricultura-pago-hint">
                    {esPagoFraccionado
                      ? `Al finalizar · saldo (${Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_SALDO * 100)}%) · precio de venta al cerrar`
                      : "100% de la producción · precio de venta al cerrar"}
                  </p>
                </header>
                <div className="ventas-agricultura-pago-fields">
                  <div className="field">
                    <label htmlFor="va-precio">Precio de venta (USD/ton)</label>
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
                    <label htmlFor="va-pago2-ton">Cantidad</label>
                    <input
                      id="va-pago2-ton"
                      type="text"
                      readOnly
                      data-sin-mayusculas="true"
                      className="input-readonly"
                      value={pagos.pago2Ton != null ? formatTonAgricultura(pagos.pago2Ton) : ""}
                      placeholder={esPagoFraccionado ? "Saldo de la producción" : "100% de la producción"}
                      aria-readonly="true"
                    />
                  </div>
                  <div className="field ventas-agricultura-pago-importe">
                    <label>Importe estimado</label>
                    <output className="ventas-agricultura-pago-importe-value">
                      {pagos.pago2Usd != null ? `USD ${fmtNum(pagos.pago2Usd, 2)}` : "—"}
                    </output>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div className="ventas-agricultura-costos span-3">
            <h3 className="ventas-agricultura-costos-title">Costos de producción</h3>
            <div className="ventas-agricultura-costos-grid">
              <div className="field">
                <label htmlFor="va-impuestos">Impuestos (USD)</label>
                <input
                  id="va-impuestos"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 120"
                  value={impuestos}
                  onChange={(e) => setImpuestos(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="va-flete">Flete (USD)</label>
                <input
                  id="va-flete"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 80"
                  value={flete}
                  onChange={(e) => setFlete(e.target.value)}
                />
              </div>
            </div>
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
          {esPagoFraccionado ? (
            <div className="ventas-agricultura-resumen-item">
              <span className="ventas-agricultura-resumen-label">Pago 1 (ingreso)</span>
              <strong>{pagos.pago1Usd != null ? `USD ${fmtNum(pagos.pago1Usd, 2)}` : "—"}</strong>
            </div>
          ) : null}
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">
              {esPagoFraccionado ? "Pago 2 (saldo)" : "Cobro al finalizar"}
            </span>
            <strong>{pagos.pago2Usd != null ? `USD ${fmtNum(pagos.pago2Usd, 2)}` : "—"}</strong>
          </div>
          <div className="ventas-agricultura-resumen-item">
            <span className="ventas-agricultura-resumen-label">Importe bruto</span>
            <strong>{importeBruto != null ? `USD ${fmtNum(importeBruto, 2)}` : "—"}</strong>
          </div>
          {(impuestosNum > 0 || fleteNum > 0) && (
            <>
              <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--costo">
                <span className="ventas-agricultura-resumen-label">Impuestos</span>
                <strong>− USD {fmtNum(impuestosNum, 2)}</strong>
              </div>
              <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--costo">
                <span className="ventas-agricultura-resumen-label">Flete</span>
                <strong>− USD {fmtNum(fleteNum, 2)}</strong>
              </div>
            </>
          )}
          <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--neto">
            <span className="ventas-agricultura-resumen-label">Importe neto estimado</span>
            <strong>
              {importeTotal != null ? `USD ${fmtNum(importeTotal, 2)}` : "—"}
            </strong>
          </div>
          {esPagoFraccionado && pagoIngresoCobrado && pagos.pago1Usd != null ? (
            <>
              <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--cobrado">
                <span className="ventas-agricultura-resumen-label">
                  Cobrado ({Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO * 100)}% neto)
                </span>
                <strong>USD {fmtNum(pagosNetos.pago1Neto, 2)}</strong>
              </div>
              <div className="ventas-agricultura-resumen-item ventas-agricultura-resumen-item--pendiente">
                <span className="ventas-agricultura-resumen-label">
                  Por cobrar ({Math.round(FORMA_PAGO_AGRICULTURA_FRACCION_SALDO * 100)}% neto)
                </span>
                <strong>USD {fmtNum(pagosNetos.pago2Neto, 2)}</strong>
              </div>
            </>
          ) : null}
        </div>

        <div className="form-actions ventas-agricultura-form-actions">
          <button type="button" className="btn btn-secondary" onClick={limpiar} disabled={saving}>
            Limpiar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!puedeGuardar}>
            {saving
              ? copy.guardando
              : editingId != null
                ? "Actualizar simulación"
                : copy.guardar}
          </button>
        </div>
      </form>
      )}

      {esSimulador && !puedeEditar && (
        <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
          <span>Tu rol solo permite consultar simulaciones guardadas</span>
        </div>
      )}

      {!esSimulador && !puedeEditar && (
        <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
          <span>Tu rol solo permite consultar ingresos por ventas</span>
        </div>
      )}

      {!esSimulador ? (
          <>
            {ingresosHubKpiStrip}
            <VentasIngresosListPanel>
              {ingresosFiltersBar}

              <div className="table-wrap ventas-ingresos-hub-table-box ventas-hub-table-box">
                <table className="data-table ventas-agricultura-table">
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>Zafra</th>
                    <th>Cultivo</th>
                    <th className="num">Has</th>
                    <th className="num" title="Rendimiento kg/ha">
                      Rend. (kg/ha)
                    </th>
                    <th className="num" title="Precio USD por tonelada">
                      Precio USD/ton
                    </th>
                    <th className="num" title="Total toneladas">
                      Total ton
                    </th>
                    <th className="num" title="Impuestos USD">
                      Imp.
                    </th>
                    <th className="num" title="Flete USD">
                      Flete
                    </th>
                    <th className="num" title="Importe neto USD (bruto − impuestos − flete)">
                      USD neto
                    </th>
                    <th className="num" title="USD por hectárea">
                      USD/ha
                    </th>
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
                  ) : rowsVisibles.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="empty">
                        {copy.sinFilas}
                      </td>
                    </tr>
                  ) : (
                    rowsPagina.map((r) => {
                      const hasReal = normalizeVentaAgriculturaRow(r).venta_realizada;
                      const mesIni =
                        hasReal && r.real_mes_inicio != null ? r.real_mes_inicio : r.mes_inicio;
                      const anioIni =
                        hasReal && r.real_anio_inicio != null ? r.real_anio_inicio : r.anio_inicio;
                      const mesFin =
                        hasReal && r.real_mes_fin != null ? r.real_mes_fin : r.mes_fin;
                      const anioFin =
                        hasReal && r.real_anio_fin != null ? r.real_anio_fin : r.anio_fin;
                      const has = r.real_hectareas ?? r.hectareas;
                      const rend = r.real_rendimiento_ton_ha ?? r.rendimiento_ton_ha;
                      const precio = r.real_precio_usd_ton ?? r.precio_usd_ton;
                      const n = normalizeVentaAgriculturaRow(r);
                      const usdHa = calcUsdPorHa(importeEfectivoAgricultura(r), has);
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong>{formatOperacionAgricultura(r.id)}</strong>
                            <span className="sim-historial-op-empresa">
                              {labelEmpresaAgricultura(r.empresa)}
                            </span>
                          </td>
                          <td>{formatZafraAgricultura(mesIni, anioIni, mesFin, anioFin)}</td>
                          <td>{labelCultivoAgricultura(r.cultivo)}</td>
                          <td className="num">{fmtNum(has, 2)}</td>
                          <td className="num">{formatRendimientoAgricultura(rend)}</td>
                          <td className="num">{fmtNum(precio, 2)}</td>
                          <td className="num">
                            {formatTotalProduccionAgricultura(tonEfectivaAgricultura(r))}
                          </td>
                          <td className="num">
                            {n.costo_impuestos_usd > 0
                              ? `USD ${fmtNum(n.costo_impuestos_usd, 2)}`
                              : "—"}
                          </td>
                          <td className="num">
                            {n.costo_flete_usd > 0 ? `USD ${fmtNum(n.costo_flete_usd, 2)}` : "—"}
                          </td>
                          <td className="num">
                            <strong>USD {fmtNum(importeEfectivoAgricultura(r), 2)}</strong>
                          </td>
                          <td className="num">
                            {usdHa != null ? `USD ${fmtNum(usdHa, 2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {!loading && apiOnline && rowsVisibles.length > 0 && (
                  <tfoot>
                    <tr className="data-table-totals">
                      <td colSpan={3}>
                        <strong>Totales ({rowsVisibles.length})</strong>
                      </td>
                      <td className="num">
                        <strong>{fmtNum(totales.has, 2)}</strong>
                      </td>
                      <td colSpan={2} />
                      <td className="num">
                        <strong>{formatTotalProduccionAgricultura(totales.ton)}</strong>
                      </td>
                      <td className="num">
                        <strong>
                          {totales.imp > 0 ? `USD ${fmtNum(totales.imp, 2)}` : "—"}
                        </strong>
                      </td>
                      <td className="num">
                        <strong>
                          {totales.flete > 0 ? `USD ${fmtNum(totales.flete, 2)}` : "—"}
                        </strong>
                      </td>
                      <td className="num">
                        <strong>USD {fmtNum(totales.usd, 2)}</strong>
                      </td>
                      <td className="num">
                        <strong>
                          {totales.usdHa != null ? `USD ${fmtNum(totales.usdHa, 2)}` : "—"}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {!loading && apiOnline && rowsVisibles.length > 0 && (
              <TablePagination
                total={rowsVisibles.length}
                page={pageSafe}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
            </VentasIngresosListPanel>
          </>
      ) : (
      <VentasIngresosListPanel>
        <header className="sim-historial-head ventas-ingresos-list-head">
          <div>
            <h2>{copy.tituloListado}</h2>
            <p className="muted">Historial de simulaciones agrícolas guardadas</p>
          </div>
          {!loading && rows.length > 0 && (
            <span className="sim-historial-count">
              {rows.length} {copy.unidadConteo} — USD {fmtNum(totales.usd, 2)}
            </span>
          )}
        </header>

        {ingresosFiltersBar}

        <div className="sim-historial-table-wrap ventas-ingresos-hub-table-box ventas-hub-table-box">
          <table
            className={
              esSimulador
                ? "sim-historial-table sim-historial-table--agricultura"
                : "data-table ventas-agricultura-table"
            }
          >
            {esSimulador && (
              <colgroup>
                <col style={{ width: "10.5%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "9.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "6.5%" }} />
                <col style={{ width: "11.5%" }} />
              </colgroup>
            )}
            <thead>
              <tr>
                <th className={esSimulador ? "sim-historial-op-meta" : undefined}>Operación</th>
                {esSimulador && <th className="sim-historial-tipo-cell">Tipo</th>}
                <th className={esSimulador ? "sim-historial-cat-cell" : undefined}>
                  {esSimulador ? "Cultivo" : "Zafra"}
                </th>
                {!esSimulador && <th>Cultivo</th>}
                <th className="num">Has</th>
                <th className="num" title="Rendimiento kg/ha">
                  {esSimulador ? "Rend." : "Rend. (kg/ha)"}
                </th>
                <th className="num" title="Precio USD por tonelada">
                  {esSimulador ? "$/ton" : "Precio USD/ton"}
                </th>
                <th className="num" title="Total toneladas">
                  {esSimulador ? "Ton" : "Total ton"}
                </th>
                <th className="num" title="Impuestos USD">
                  Imp.
                </th>
                <th className="num" title="Flete USD">
                  Flete
                </th>
                <th className="num" title="Importe neto USD (bruto − impuestos − flete)">
                  {esSimulador ? "USD neto" : "USD neto"}
                </th>
                <th className="num" title="USD por hectárea">
                  {esSimulador ? "$/ha" : "USD/ha"}
                </th>
                <th className={esSimulador ? "sim-historial-col-actions" : "actions-col"}>
                  {esSimulador ? "Acciones" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 11} className={esSimulador ? "sim-historial-empty" : "empty"}>
                    Cargando...
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 11} className={esSimulador ? "sim-historial-empty" : "empty"}>
                    API no conectada
                  </td>
                </tr>
              ) : rowsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 11} className={esSimulador ? "sim-historial-empty" : "empty"}>
                    {copy.sinFilas}
                  </td>
                </tr>
              ) : esSimulador ? (
                rowsPagina.map((r) => (
                  <VentasAgriculturaTablaFila
                    key={r.id}
                    row={r}
                    puedeEditar={puedeEditar}
                    isPatching={patchingId === r.id}
                    isEditing={editingId === r.id}
                    isEditingReal={editingRealId === r.id}
                    isSavingReal={savingRealId === r.id}
                    isDeleting={deletingId === r.id}
                    onEdit={() => loadFormFromRow(r)}
                    onCancelEdit={cancelEdit}
                    onStartEditReal={() => {
                      setEditingRealId(r.id);
                      setEditingId(null);
                    }}
                    onCancelEditReal={() => setEditingRealId(null)}
                    onSaveReal={(payload) => void guardarReal(r, payload)}
                    onUnmarkReal={() => void quitarReal(r)}
                    onDelete={() => void borrar(r)}
                    onDestacar={() => void handleDestacar(r)}
                    onVerHistorial={() =>
                      onError("Historial de auditoría disponible próximamente para agricultura")
                    }
                  />
                ))
              ) : (
                rowsPagina.map((r) => {
                  const hasReal = normalizeVentaAgriculturaRow(r).venta_realizada;
                  const mesIni = hasReal && r.real_mes_inicio != null ? r.real_mes_inicio : r.mes_inicio;
                  const anioIni = hasReal && r.real_anio_inicio != null ? r.real_anio_inicio : r.anio_inicio;
                  const mesFin = hasReal && r.real_mes_fin != null ? r.real_mes_fin : r.mes_fin;
                  const anioFin = hasReal && r.real_anio_fin != null ? r.real_anio_fin : r.anio_fin;
                  const has = r.real_hectareas ?? r.hectareas;
                  const rend = r.real_rendimiento_ton_ha ?? r.rendimiento_ton_ha;
                  const precio = r.real_precio_usd_ton ?? r.precio_usd_ton;
                  const n = normalizeVentaAgriculturaRow(r);
                  const usdHa = calcUsdPorHa(importeEfectivoAgricultura(r), has);
                  return (
                  <tr key={r.id}>
                    <td>
                      <strong>{formatOperacionAgricultura(r.id)}</strong>
                      <span className="sim-historial-op-empresa">{labelEmpresaAgricultura(r.empresa)}</span>
                    </td>
                    <td>
                      {formatZafraAgricultura(mesIni, anioIni, mesFin, anioFin)}
                    </td>
                    <td>{labelCultivoAgricultura(r.cultivo)}</td>
                    <td className="num">{fmtNum(has, 2)}</td>
                    <td className="num">{formatRendimientoAgricultura(rend)}</td>
                    <td className="num">{fmtNum(precio, 2)}</td>
                    <td className="num">{formatTotalProduccionAgricultura(tonEfectivaAgricultura(r))}</td>
                    <td className="num">
                      {n.costo_impuestos_usd > 0
                        ? `USD ${fmtNum(n.costo_impuestos_usd, 2)}`
                        : "—"}
                    </td>
                    <td className="num">
                      {n.costo_flete_usd > 0 ? `USD ${fmtNum(n.costo_flete_usd, 2)}` : "—"}
                    </td>
                    <td className="num">
                      <strong>USD {fmtNum(importeEfectivoAgricultura(r), 2)}</strong>
                    </td>
                    <td className="num">{usdHa != null ? `USD ${fmtNum(usdHa, 2)}` : "—"}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
            {!loading && apiOnline && rowsVisibles.length > 0 && (
              <tfoot>
                <tr className="data-table-totals">
                  <td colSpan={esSimulador ? 3 : 3}>
                    <strong>Totales ({rowsVisibles.length})</strong>
                  </td>
                  <td className="num">
                    <strong>{fmtNum(totales.has, 2)}</strong>
                  </td>
                  <td colSpan={2} />
                  <td className="num">
                    <strong>{formatTotalProduccionAgricultura(totales.ton)}</strong>
                  </td>
                  <td className="num">
                    <strong>
                      {totales.imp > 0 ? `USD ${fmtNum(totales.imp, 2)}` : "—"}
                    </strong>
                  </td>
                  <td className="num">
                    <strong>
                      {totales.flete > 0 ? `USD ${fmtNum(totales.flete, 2)}` : "—"}
                    </strong>
                  </td>
                  <td className="num">
                    <strong>USD {fmtNum(totales.usd, 2)}</strong>
                  </td>
                  <td className="num">
                    <strong>{totales.usdHa != null ? `USD ${fmtNum(totales.usdHa, 2)}` : "—"}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && apiOnline && rowsVisibles.length > 0 && (
          <TablePagination
            total={rowsVisibles.length}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </VentasIngresosListPanel>
      )}
    </div>
  );
}
