import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createVentaArrendamiento,
  deleteVentaArrendamiento,
  fetchEmpresasOperativas,
  fetchVentasArrendamientos,
  patchVentaArrendamiento,
  updateVentaArrendamiento,
} from "../../api";
import type { AuthUser, Catalogos, VentaArrendamientoRealInput, VentaArrendamientoRow } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { fmtNum } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import {
  calcularTotalArrendamiento,
  calcularTotalPagosArrendamiento,
  calcularMontoPagoFinDesdeInicio,
  calcularMontoMensualArrendamiento,
  describeTotalPagosMensual,
  DEPARTAMENTOS_ARRENDAMIENTO,
  empresasSelectOptions,
  fechaFinArrendamientoPorMeses,
  formatOperacionArrendamiento,
  formatPeriodoArrendamiento,
  formatUsdArrendamiento,
  formatUsdPorHaArrendamiento,
  formatMontoPagoInput,
  inferirModalidadArrendamiento,
  labelDepartamentoArrendamiento,
  labelEmpresaArrendamiento,
  labelPeriodoSeleccionadoArrendamiento,
  mesesArrendamiento,
  MODALIDADES_ARRENDAMIENTO,
  pagosCoincidenConArrendamiento,
  CANTIDADES_PAGO_ANUAL,
  inferirCantidadPagosAnual,
  TIPOS_MONTO_PAGO_ARRENDAMIENTO,
  parseMontoPagoArrendamiento,
  parsePositiveDecimal,
  VENTAS_ARRENDAMIENTOS_COPY,
  type DepartamentoArrendamiento,
  type DepartamentoArrendamientoId,
  type EmpresaArrendamiento,
  type ModalidadArrendamiento,
  type FrecuenciaPagoArrendamiento,
  type CantidadPagosAnual,
  type TipoMontoPagoArrendamiento,
  type VentasArrendamientosModo,
} from "./ventas-arrendamientos-utils";
import VentasArrendamientoTablaFila from "./VentasArrendamientoTablaFila";
import {
  arrendamientoHasVentaReal,
  hectareasEfectivasArrendamiento,
  normalizeVentaArrendamientoRow,
  sortHistorialArrendamiento,
  totalUsdEfectivoArrendamiento,
} from "./ventas-arrendamientos-real-utils";
import { canWriteSimuladorVentaGanado, canWriteIngresosVentas } from "../../utils/auth-permissions";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  modo?: VentasArrendamientosModo;
  user?: AuthUser | null;
}

export default function VentasArrendamientos({
  catalogos,
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  modo = "simulador",
  user = null,
}: Props) {
  const copy = VENTAS_ARRENDAMIENTOS_COPY[modo];
  const [empresasCuenta, setEmpresasCuenta] = useState<string[]>(catalogos.empresas);
  const empresasOpciones = useMemo(
    () => empresasSelectOptions(empresasCuenta),
    [empresasCuenta]
  );
  const esSimulador = modo === "simulador";
  const puedeEditar = esSimulador
    ? canWriteSimuladorVentaGanado(user)
    : canWriteIngresosVentas(user);
  const formRef = useRef<HTMLFormElement>(null);

  const [empresa, setEmpresa] = useState<EmpresaArrendamiento>("");
  const [modalidad, setModalidad] = useState<ModalidadArrendamiento>("12_MESES");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [departamento, setDepartamento] = useState<DepartamentoArrendamiento>("");
  const [padron, setPadron] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [precioUsdHa, setPrecioUsdHa] = useState("");
  const [notas, setNotas] = useState("");
  const [pagoFrecuencia, setPagoFrecuencia] = useState<FrecuenciaPagoArrendamiento>("ANUAL");
  const [pagoInicio, setPagoInicio] = useState("");
  const [pagoFin, setPagoFin] = useState("");
  const [pagoInicioMonto, setPagoInicioMonto] = useState("");
  const [pagoFinMonto, setPagoFinMonto] = useState("");
  const [pagoMontoTipo, setPagoMontoTipo] = useState<TipoMontoPagoArrendamiento>("VALOR");
  const [pagosAnualesCantidad, setPagosAnualesCantidad] = useState<CantidadPagosAnual>(2);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<VentaArrendamientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState<"" | DepartamentoArrendamientoId>("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingRealId, setEditingRealId] = useState<number | null>(null);
  const [savingRealId, setSavingRealId] = useState<number | null>(null);
  const [patchingId, setPatchingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const hasNum = useMemo(() => parsePositiveDecimal(hectareas), [hectareas]);
  const precioNum = useMemo(() => parsePositiveDecimal(precioUsdHa), [precioUsdHa]);
  const fechaFinEfectiva = useMemo(() => {
    if (!fechaInicio) return "";
    if (modalidad === "6_MESES") {
      return fechaFinArrendamientoPorMeses(fechaInicio, 6) ?? "";
    }
    if (modalidad === "12_MESES") {
      return fechaFinArrendamientoPorMeses(fechaInicio, 12) ?? "";
    }
    return fechaFin;
  }, [fechaInicio, fechaFin, modalidad]);

  const totalUsd = useMemo(
    () =>
      calcularTotalArrendamiento(hasNum, precioNum, fechaInicio, fechaFinEfectiva, modalidad),
    [hasNum, precioNum, fechaInicio, fechaFinEfectiva, modalidad]
  );

  const pagoInicioMontoNum = useMemo(
    () => parseMontoPagoArrendamiento(pagoInicioMonto, pagoMontoTipo),
    [pagoInicioMonto, pagoMontoTipo]
  );
  const pagoFinMontoNum = useMemo(
    () => parseMontoPagoArrendamiento(pagoFinMonto, pagoMontoTipo),
    [pagoFinMonto, pagoMontoTipo]
  );

  const esPagoAnual = pagoFrecuencia === "ANUAL";
  const esPagoAnualDos = esPagoAnual && pagosAnualesCantidad === 2;

  const totalPagosUsd = useMemo(
    () =>
      calcularTotalPagosArrendamiento(
        pagoInicioMontoNum,
        pagoFinMontoNum,
        pagoMontoTipo,
        totalUsd,
        pagoFrecuencia,
        modalidad,
        fechaInicio,
        fechaFinEfectiva,
        pagosAnualesCantidad
      ),
    [
      pagoInicioMontoNum,
      pagoFinMontoNum,
      pagoMontoTipo,
      totalUsd,
      pagoFrecuencia,
      modalidad,
      fechaInicio,
      fechaFinEfectiva,
      pagosAnualesCantidad,
    ]
  );

  const pagosMensualHint = useMemo(() => {
    if (esPagoAnual || pagoInicioMontoNum == null) return null;
    const meses = mesesArrendamiento(modalidad, fechaInicio, fechaFinEfectiva);
    if (meses == null) return null;
    return describeTotalPagosMensual(pagoInicioMontoNum, meses, pagoMontoTipo, totalUsd);
  }, [
    esPagoAnual,
    pagoInicioMontoNum,
    modalidad,
    fechaInicio,
    fechaFinEfectiva,
    pagoMontoTipo,
    totalUsd,
  ]);

  const pagosValidos = useMemo(
    () => pagosCoincidenConArrendamiento(totalPagosUsd, totalUsd),
    [totalPagosUsd, totalUsd]
  );

  const puedeGuardar =
    apiOnline &&
    !saving &&
    empresa !== "" &&
    fechaInicio !== "" &&
    fechaFinEfectiva !== "" &&
    departamento !== "" &&
    padron.trim() !== "" &&
    hasNum != null &&
    precioNum != null &&
    pagoInicioMontoNum != null &&
    (esPagoAnual ? pagoInicio !== "" : fechaInicio !== "") &&
    (!esPagoAnualDos || (pagoFin !== "" && pagoFinMontoNum != null));

  const motivoNoGuardar = useMemo((): string | null => {
    if (!apiOnline) return "Sin conexión con el servidor";
    if (saving) return "Guardando…";
    if (empresa === "") return "Seleccioná la empresa";
    if (fechaInicio === "" || fechaFinEfectiva === "") {
      return "Completá el período del arrendamiento";
    }
    if (departamento === "") return "Seleccioná el departamento";
    if (padron.trim() === "") return "Ingresá el padrón";
    if (hasNum == null || precioNum == null) {
      return "Completá hectáreas y precio por hectárea";
    }
    if (pagoInicioMontoNum == null) return "Completá el monto del pago";
    if (esPagoAnual && pagoInicio === "") return "Completá la fecha del pago";
    if (esPagoAnualDos && pagoFin === "") return "Completá la fecha del pago final";
    if (esPagoAnualDos && pagoFinMontoNum == null) return "Completá el monto del pago final";
    return null;
  }, [
    apiOnline,
    saving,
    empresa,
    fechaInicio,
    fechaFinEfectiva,
    departamento,
    padron,
    hasNum,
    precioNum,
    pagoInicioMontoNum,
    esPagoAnual,
    esPagoAnualDos,
    pagoInicio,
    pagoFin,
    pagoFinMontoNum,
  ]);

  const handlePagoFrecuenciaChange = (frecuencia: FrecuenciaPagoArrendamiento) => {
    setPagoFrecuencia(frecuencia);
    if (frecuencia === "MENSUAL") {
      setPagoInicio("");
      setPagoFin("");
      setPagoFinMonto("");
      setPagoMontoTipo("VALOR");
    } else {
      setPagosAnualesCantidad(2);
      if (fechaInicio) setPagoInicio(fechaInicio);
      if (fechaFinEfectiva) setPagoFin(fechaFinEfectiva);
    }
  };

  const handleCantidadPagosAnualChange = (cantidad: CantidadPagosAnual) => {
    setPagosAnualesCantidad(cantidad);
    if (cantidad === 1) {
      setPagoFin("");
      setPagoFinMonto("");
      if (fechaInicio) setPagoInicio(fechaInicio);
    } else {
      if (fechaInicio) setPagoInicio(fechaInicio);
      if (fechaFinEfectiva) setPagoFin(fechaFinEfectiva);
    }
  };

  const pagoInicioEfectivo = esPagoAnual ? pagoInicio : fechaInicio;
  const pagoFinEfectivo = esPagoAnual ? pagoFin : fechaFinEfectiva;

  useEffect(() => {
    if (!esPagoAnualDos) return;
    if (pagoInicioMontoNum == null) {
      setPagoFinMonto("");
      return;
    }
    const finMonto = calcularMontoPagoFinDesdeInicio(
      pagoInicioMontoNum,
      pagoMontoTipo,
      totalUsd
    );
    setPagoFinMonto(finMonto != null ? formatMontoPagoInput(finMonto) : "");
  }, [esPagoAnualDos, pagoInicioMontoNum, pagoMontoTipo, totalUsd]);

  useEffect(() => {
    if (esPagoAnual) return;
    const cuota = calcularMontoMensualArrendamiento(
      totalUsd,
      modalidad,
      fechaInicio,
      fechaFinEfectiva
    );
    setPagoInicioMonto(cuota != null ? formatMontoPagoInput(cuota) : "");
  }, [esPagoAnual, totalUsd, modalidad, fechaInicio, fechaFinEfectiva]);

  useEffect(() => {
    if (!esPagoAnual) return;
    if (fechaInicio) setPagoInicio(fechaInicio);
    if (esPagoAnualDos && fechaFinEfectiva) setPagoFin(fechaFinEfectiva);
  }, [esPagoAnual, esPagoAnualDos, fechaInicio, fechaFinEfectiva]);

  const aplicarFechaFinPorModalidad = (inicio: string, mod: ModalidadArrendamiento) => {
    if (!inicio || mod === "MANUAL") return;
    const meses = mod === "6_MESES" ? 6 : 12;
    setFechaFin(fechaFinArrendamientoPorMeses(inicio, meses) ?? "");
  };

  const handleModalidadChange = (mod: ModalidadArrendamiento) => {
    setModalidad(mod);
    aplicarFechaFinPorModalidad(fechaInicio, mod);
  };

  const handleFechaInicioChange = (value: string) => {
    setFechaInicio(value);
    if (!value) {
      setFechaFin("");
      return;
    }
    aplicarFechaFinPorModalidad(value, modalidad);
  };

  const limpiar = () => {
    setEmpresa("");
    setModalidad("12_MESES");
    setFechaInicio("");
    setFechaFin("");
    setDepartamento("");
    setPadron("");
    setHectareas("");
    setPrecioUsdHa("");
    setNotas("");
    setPagoFrecuencia("ANUAL");
    setPagoInicio("");
    setPagoFin("");
    setPagoInicioMonto("");
    setPagoFinMonto("");
    setPagoMontoTipo("VALOR");
    setPagosAnualesCantidad(2);
    setEditingId(null);
  };

  const loadFormFromRow = (row: VentaArrendamientoRow) => {
    if (normalizeVentaArrendamientoRow(row).venta_realizada) {
      onError("No se puede editar una simulación con operación confirmada");
      return;
    }
    setEditingRealId(null);
    setEmpresa(row.empresa);
    setModalidad(inferirModalidadArrendamiento(row.fecha_inicio, row.fecha_fin));
    setFechaInicio(row.fecha_inicio);
    setFechaFin(row.fecha_fin);
    setDepartamento(row.departamento);
    setPadron(row.padron);
    setHectareas(String(row.hectareas));
    setPrecioUsdHa(String(row.precio_usd_ha));
    setNotas(row.notas ?? "");
    setPagoFrecuencia(row.pago_frecuencia);
    setPagoInicioMonto(String(row.pago_inicio_monto));
    setPagoMontoTipo(row.pago_frecuencia === "MENSUAL" ? "VALOR" : row.pago_inicio_tipo);
    if (row.pago_frecuencia === "MENSUAL") {
      setPagoInicio("");
      setPagoFin("");
      setPagoFinMonto("");
    } else {
      const cantidad = inferirCantidadPagosAnual(
        row.pago_inicio,
        row.pago_fin,
        row.pago_inicio_monto,
        row.pago_fin_monto
      );
      setPagosAnualesCantidad(cantidad);
      setPagoInicio(row.pago_inicio);
      if (cantidad === 2) {
        setPagoFin(row.pago_fin);
        setPagoFinMonto(String(row.pago_fin_monto));
      } else {
        setPagoFin("");
        setPagoFinMonto("");
      }
    }
    setEditingId(row.id);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        sortHistorialArrendamiento(
          (await fetchVentasArrendamientos({
            empresa: filtroEmpresa || undefined,
            departamento: filtroDepartamento || undefined,
            busqueda: busqueda.trim() || undefined,
          })).map(normalizeVentaArrendamientoRow)
        )
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar arrendamientos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtroEmpresa, filtroDepartamento, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filtroEmpresa, filtroDepartamento, busqueda, pageSize]);

  const guardar = async () => {
    if (!puedeGuardar || totalUsd == null) {
      if (motivoNoGuardar) onError(motivoNoGuardar);
      return;
    }
    const fin = fechaFinEfectiva;
    if (!fin) {
      onError("Completá las fechas del arrendamiento");
      return;
    }
    if (fin < fechaInicio) {
      onError("La fecha final debe ser posterior o igual a la fecha de inicio");
      return;
    }
    if (esPagoAnualDos && pagoFin < pagoInicio) {
      onError("El pago final debe ser posterior o igual al pago inicio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        empresa,
        fecha_inicio: fechaInicio,
        fecha_fin: fin,
        departamento,
        padron: padron.trim(),
        hectareas: hasNum!,
        precio_usd_ha: precioNum!,
        total_usd: totalUsd,
        notas: notas.trim() || null,
        pago_frecuencia: pagoFrecuencia,
        pago_inicio: pagoInicioEfectivo,
        pago_fin: esPagoAnual
          ? pagosAnualesCantidad === 1
            ? pagoInicio
            : pagoFin
          : pagoFinEfectivo,
        pago_inicio_monto: pagoInicioMontoNum!,
        pago_inicio_tipo: pagoMontoTipo,
        pago_fin_monto: esPagoAnual
          ? pagosAnualesCantidad === 1
            ? pagoInicioMontoNum!
            : pagoFinMontoNum!
          : pagoInicioMontoNum!,
        pago_fin_tipo: pagoMontoTipo,
      };
      if (editingId != null) {
        await updateVentaArrendamiento(editingId, payload);
        onSuccess?.("Simulación actualizada");
      } else {
        await createVentaArrendamiento(payload);
        onSuccess?.(copy.guardadoOk);
      }
      limpiar();
      setFiltroEmpresa("");
      setFiltroDepartamento("");
      setBusqueda("");
      setPage(1);
      try {
        setRows(await fetchVentasArrendamientos());
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al recargar el historial");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : copy.errorGuardar);
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row: VentaArrendamientoRow) => {
    const ok = await confirmAction({
      title: copy.eliminarTitulo,
      message: `¿Eliminar arrendamiento de ${labelEmpresaArrendamiento(row.empresa)} — padrón ${row.padron} (${formatPeriodoArrendamiento(row.fecha_inicio, row.fecha_fin)})?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(row.id);
    try {
      await deleteVentaArrendamiento(row.id);
      if (editingId === row.id) setEditingId(null);
      if (editingRealId === row.id) setEditingRealId(null);
      onSuccess?.(copy.eliminadoOk);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar registro");
    } finally {
      setDeletingId(null);
    }
  };

  const guardarReal = async (row: VentaArrendamientoRow, payload: VentaArrendamientoRealInput) => {
    setSavingRealId(row.id);
    try {
      const res = await patchVentaArrendamiento(row.id, { valores_reales: payload });
      setEditingRealId(null);
      onSuccess?.(res.message);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al confirmar operación");
    } finally {
      setSavingRealId(null);
    }
  };

  const handleDestacar = async (row: VentaArrendamientoRow) => {
    setPatchingId(row.id);
    try {
      await patchVentaArrendamiento(row.id, { destacada: !(row.destacada ?? false) });
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al destacar");
    } finally {
      setPatchingId(null);
    }
  };

  const quitarReal = async (row: VentaArrendamientoRow) => {
    const ok = await confirmAction({
      title: "Quitar confirmación",
      message: `¿Volver a pendiente la simulación ${formatOperacionArrendamiento(row.id)}? Se borrarán los datos reales.`,
      confirmText: "Quitar confirmación",
      variant: "danger",
    });
    if (!ok) return;
    setPatchingId(row.id);
    try {
      const res = await patchVentaArrendamiento(row.id, { venta_realizada: false });
      if (editingRealId === row.id) setEditingRealId(null);
      onSuccess?.(res.message);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al quitar confirmación");
    } finally {
      setPatchingId(null);
    }
  };

  const historialColSpan = 9;

  const rowsVisibles = useMemo(
    () =>
      esSimulador
        ? rows
        : rows.filter((r) => normalizeVentaArrendamientoRow(r).venta_realizada),
    [rows, esSimulador]
  );

  const totalPages = Math.max(1, Math.ceil(rowsVisibles.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(rowsVisibles, pageSafe, pageSize),
    [rowsVisibles, pageSafe, pageSize]
  );

  const totalUsdListado = useMemo(
    () => rowsVisibles.reduce((acc, r) => acc + totalUsdEfectivoArrendamiento(r), 0),
    [rowsVisibles]
  );

  const totalHasListado = useMemo(
    () => rowsVisibles.reduce((acc, r) => acc + hectareasEfectivasArrendamiento(r), 0),
    [rowsVisibles]
  );

  const periodoSeleccionado = useMemo(
    () => labelPeriodoSeleccionadoArrendamiento(modalidad, fechaInicio, fechaFinEfectiva),
    [modalidad, fechaInicio, fechaFinEfectiva]
  );

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {copy.volver}
      </button>

      {esSimulador && puedeEditar && (
        <form
          ref={formRef}
          className="card form-card ventas-agricultura-card"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
        >
          {editingId != null && (
            <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
              <span>Editando simulación #{editingId}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={limpiar}>
                Cancelar
              </button>
            </div>
          )}

          <div className="form-header">
            <PageModuleHeadRow
              icon={{ source: "hub", id: "ventas_arrendamientos" }}
              title={copy.tituloForm}
              subtitle={copy.descripcionPagina}
            />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="var-empresa">Empresa</label>
              <select
                id="var-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value as EmpresaArrendamiento)}
              >
                <option value="">Seleccionar...</option>
                {empresasOpciones.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="var-departamento">Departamento</label>
              <select
                id="var-departamento"
                value={departamento}
                onChange={(e) =>
                  setDepartamento(e.target.value as DepartamentoArrendamiento)
                }
              >
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS_ARRENDAMIENTO.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="var-padron">Padrón</label>
              <input
                id="var-padron"
                type="text"
                placeholder="Ej: 12345"
                value={padron}
                onChange={(e) => setPadron(e.target.value)}
              />
            </div>

            <div className="ventas-arrendamiento-fechas">
              <div className="ventas-arrendamiento-fechas-body">
                <h3 className="ventas-arrendamiento-fechas-title">Período del arrendamiento</h3>
                <div
                  className="ventas-arrendamiento-modalidad"
                  role="group"
                  aria-label="Modalidad del período"
                >
                  {MODALIDADES_ARRENDAMIENTO.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn${
                        modalidad === item.id ? " is-active" : ""
                      }`}
                      aria-pressed={modalidad === item.id}
                      onClick={() => handleModalidadChange(item.id)}
                    >
                      {item.label.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="ventas-arrendamiento-fechas-grid">
                  <div className="field">
                    <label htmlFor="var-fecha-inicio">Fecha inicio</label>
                    <input
                      id="var-fecha-inicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => handleFechaInicioChange(e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="var-fecha-fin">Fecha final</label>
                    <input
                      id="var-fecha-fin"
                      type="date"
                      readOnly={modalidad !== "MANUAL"}
                      data-sin-mayusculas="true"
                      className={modalidad !== "MANUAL" ? "input-readonly" : undefined}
                      value={fechaFinEfectiva}
                      min={modalidad === "MANUAL" ? fechaInicio || undefined : undefined}
                      onChange={
                        modalidad === "MANUAL"
                          ? (e) => setFechaFin(e.target.value)
                          : undefined
                      }
                      aria-readonly={modalidad !== "MANUAL"}
                      tabIndex={modalidad !== "MANUAL" ? -1 : undefined}
                    />
                  </div>
                </div>
              </div>

              <aside
                className="ventas-arrendamiento-periodo-display"
                role="status"
                aria-live="polite"
                aria-label="Período seleccionado"
              >
                <span className="ventas-arrendamiento-periodo-display-label">
                  Período seleccionado
                </span>
                <strong className="ventas-arrendamiento-periodo-display-value">
                  {periodoSeleccionado ?? "—"}
                </strong>
              </aside>
            </div>

            <div className="ventas-arrendamiento-pagos">
              <div className="ventas-arrendamiento-pagos-body">
                <h3 className="ventas-arrendamiento-pagos-title">Pagos</h3>
                <div
                  className="ventas-arrendamiento-modalidad ventas-arrendamiento-pagos-toolbar"
                  role="group"
                  aria-label="Frecuencia y cantidad de pagos"
                >
                  <div
                    className="ventas-arrendamiento-pagos-toolbar-frecuencia"
                    role="group"
                    aria-label="Frecuencia de pago"
                  >
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn${
                        pagoFrecuencia === "MENSUAL" ? " is-active" : ""
                      }`}
                      aria-pressed={pagoFrecuencia === "MENSUAL"}
                      onClick={() => handlePagoFrecuenciaChange("MENSUAL")}
                    >
                      MENSUAL
                    </button>
                    <button
                      type="button"
                      className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn${
                        pagoFrecuencia === "ANUAL" ? " is-active" : ""
                      }`}
                      aria-pressed={pagoFrecuencia === "ANUAL"}
                      onClick={() => handlePagoFrecuenciaChange("ANUAL")}
                    >
                      ANUAL
                    </button>
                  </div>
                  {CANTIDADES_PAGO_ANUAL.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn${
                          pagosAnualesCantidad === item.id ? " is-active" : ""
                        }${!esPagoAnual ? " ventas-arrendamiento-pago-campo--oculto" : ""}`}
                        aria-pressed={pagosAnualesCantidad === item.id}
                        aria-hidden={!esPagoAnual}
                        disabled={!esPagoAnual}
                        tabIndex={!esPagoAnual ? -1 : undefined}
                        onClick={() => handleCantidadPagosAnualChange(item.id)}
                      >
                        {item.label.toUpperCase()}
                      </button>
                    ))}
                </div>
                <div className="ventas-arrendamiento-pagos-grid">
                <div className="field">
                  <label htmlFor={esPagoAnual ? "var-pago-inicio" : "var-pago-mensual"}>
                    <span className="ventas-arrendamiento-pago-label">
                      {esPagoAnual ? (pagosAnualesCantidad === 1 ? "Pago" : "Pago inicio") : "Pago"}
                    </span>
                  </label>
                  {esPagoAnual ? (
                    <input
                      id="var-pago-inicio"
                      type="date"
                      value={pagoInicio}
                      onChange={(e) => setPagoInicio(e.target.value)}
                    />
                  ) : (
                    <div
                      id="var-pago-mensual"
                      className="ventas-arrendamiento-pago-mensual-display"
                      role="status"
                    >
                      Todos los meses (Principio de mes)
                    </div>
                  )}
                </div>

                <div className="field ventas-arrendamiento-pago-monto">
                  <label htmlFor="var-pago-inicio-monto">
                    <span className="ventas-arrendamiento-pago-label">
                      {esPagoAnual ? "Monto" : "Monto mensual"}
                    </span>
                  </label>
                  <div className="ventas-arrendamiento-pago-monto-group">
                    <input
                      id="var-pago-inicio-monto"
                      type="number"
                      min="0"
                      step="0.01"
                      max={pagoMontoTipo === "PORCENTAJE" ? 100 : undefined}
                      placeholder={pagoMontoTipo === "PORCENTAJE" ? "Ej: 50" : "Ej: 5000"}
                      readOnly={!esPagoAnual}
                      className={!esPagoAnual ? "input-readonly" : undefined}
                      value={pagoInicioMonto}
                      onChange={
                        esPagoAnual ? (e) => setPagoInicioMonto(e.target.value) : undefined
                      }
                      tabIndex={esPagoAnual ? undefined : -1}
                      aria-readonly={!esPagoAnual}
                    />
                    <div className="ventas-arrendamiento-pago-tipo" role="group" aria-label="Tipo de monto pago inicio">
                      {TIPOS_MONTO_PAGO_ARRENDAMIENTO.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn ventas-arrendamiento-pago-tipo-btn${
                            pagoMontoTipo === item.id ? " is-active" : ""
                          }${!esPagoAnual && item.id !== "VALOR" ? " ventas-arrendamiento-pago-campo--oculto" : ""}`}
                          aria-pressed={pagoMontoTipo === item.id}
                          aria-hidden={!esPagoAnual && item.id !== "VALOR"}
                          disabled={!esPagoAnual && item.id !== "VALOR"}
                          tabIndex={!esPagoAnual && item.id !== "VALOR" ? -1 : undefined}
                          onClick={() => setPagoMontoTipo(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={`field${esPagoAnualDos ? "" : " ventas-arrendamiento-pago-campo--oculto"}`}
                  aria-hidden={!esPagoAnualDos}
                >
                  <label htmlFor="var-pago-fin">
                    <span className="ventas-arrendamiento-pago-label">Pago final</span>
                  </label>
                  <input
                    id="var-pago-fin"
                    type="date"
                    value={pagoFin}
                    min={pagoInicio || undefined}
                    disabled={!esPagoAnualDos}
                    tabIndex={esPagoAnualDos ? undefined : -1}
                    onChange={(e) => setPagoFin(e.target.value)}
                  />
                </div>

                <div
                  className={`field ventas-arrendamiento-pago-monto${
                    esPagoAnualDos ? "" : " ventas-arrendamiento-pago-campo--oculto"
                  }`}
                  aria-hidden={!esPagoAnualDos}
                >
                  <label htmlFor="var-pago-fin-monto">
                    <span className="ventas-arrendamiento-pago-label">Monto</span>
                  </label>
                  <div className="ventas-arrendamiento-pago-monto-group">
                    <input
                      id="var-pago-fin-monto"
                      type="number"
                      min="0"
                      step="0.01"
                      max={pagoMontoTipo === "PORCENTAJE" ? 100 : undefined}
                      placeholder={pagoMontoTipo === "PORCENTAJE" ? "Ej: 50" : "Ej: 5000"}
                      value={pagoFinMonto}
                      disabled={!esPagoAnualDos}
                      tabIndex={esPagoAnualDos ? undefined : -1}
                      onChange={(e) => setPagoFinMonto(e.target.value)}
                    />
                    <div className="ventas-arrendamiento-pago-tipo" role="group" aria-label="Tipo de monto pago final">
                      {TIPOS_MONTO_PAGO_ARRENDAMIENTO.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn ventas-arrendamiento-pago-tipo-btn${
                            pagoMontoTipo === item.id ? " is-active" : ""
                          }${!esPagoAnualDos ? " ventas-arrendamiento-pago-campo--oculto" : ""}`}
                          aria-pressed={pagoMontoTipo === item.id}
                          aria-hidden={!esPagoAnualDos}
                          disabled={!esPagoAnualDos}
                          tabIndex={!esPagoAnualDos ? -1 : undefined}
                          onClick={() => setPagoMontoTipo(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              </div>

              <aside
                className={`ventas-arrendamiento-pagos-display${
                  totalPagosUsd != null
                    ? pagosValidos
                      ? " is-match"
                      : " is-mismatch"
                    : ""
                }`}
                role="status"
                aria-live="polite"
                aria-label="Total de pagos"
              >
                <span className="ventas-arrendamiento-pagos-display-label">Total pagos</span>
                <strong className="ventas-arrendamiento-pagos-display-value">
                  {totalPagosUsd != null ? formatUsdArrendamiento(totalPagosUsd) : "—"}
                </strong>
                {pagosMensualHint && (
                  <span className="ventas-arrendamiento-pagos-display-hint">{pagosMensualHint}</span>
                )}
              </aside>
            </div>

            <div className="ventas-arrendamiento-importe">
              <h3 className="ventas-arrendamiento-importe-title">Importe estimado</h3>
              <div className="ventas-arrendamiento-importe-strip">
                <div className="ventas-arrendamiento-importe-inputs">
                  <div className="field ventas-arrendamiento-metric-field">
                    <label htmlFor="var-has">Cantidad hectáreas</label>
                    <input
                      id="var-has"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 250"
                      value={hectareas}
                      onChange={(e) => setHectareas(e.target.value)}
                    />
                  </div>

                  <span className="ventas-arrendamiento-op" aria-hidden="true">
                    ×
                  </span>

                  <div className="field ventas-arrendamiento-metric-field ventas-arrendamiento-metric-field--wide">
                    <label htmlFor="var-precio">Precio por hectárea (USD/ha año)</label>
                    <input
                      id="var-precio"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ej: 180"
                      value={precioUsdHa}
                      onChange={(e) => setPrecioUsdHa(e.target.value)}
                    />
                  </div>
                </div>

                <span className="ventas-arrendamiento-op ventas-arrendamiento-op--eq" aria-hidden="true">
                  =
                </span>

                <div
                  id="var-total-display"
                  className={`ventas-arrendamiento-total-kpi${totalUsd != null ? " is-ready" : ""}`}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label="Total arrendamiento"
                >
                  <div className="ventas-arrendamiento-total-kpi-accent" aria-hidden="true" />
                  <div className="ventas-arrendamiento-total-kpi-body">
                    <span className="ventas-arrendamiento-total-kpi-label">Total arrendamiento</span>
                    <div className="ventas-arrendamiento-total-kpi-value">
                      <span className="ventas-arrendamiento-total-kpi-currency">USD</span>
                      <span className="ventas-arrendamiento-total-kpi-amount">
                        {totalUsd != null ? fmtNum(totalUsd, 2) : "—"}
                      </span>
                    </div>
                    {totalUsd != null && periodoSeleccionado && (
                      <span className="ventas-arrendamiento-total-kpi-hint">
                        {hasNum != null && precioNum != null
                          ? `${fmtNum(hasNum, 0)} ha · ${periodoSeleccionado}`
                          : periodoSeleccionado}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="ventas-arrendamiento-notas field span-3">
              <label htmlFor="var-notas">Notas</label>
              <textarea
                id="var-notas"
                rows={3}
                maxLength={500}
                placeholder="Observaciones, condiciones del arrendamiento, acuerdos…"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>

          <div className="form-actions ventas-agricultura-form-actions">
            <button type="button" className="btn btn-secondary" onClick={limpiar} disabled={saving}>
              Limpiar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!puedeGuardar}
              title={motivoNoGuardar ?? undefined}
            >
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

      <div className={`card ventas-agricultura-listado${esSimulador ? " simulador-venta-historial" : ""}`}>
        {esSimulador ? (
          <header className="sim-historial-head">
            <div>
              <h2>{copy.tituloListado}</h2>
              <p className="muted">{copy.subtituloListado}</p>
            </div>
            {!loading && rowsVisibles.length > 0 && (
              <span className="sim-historial-count">
                {rowsVisibles.length} {copy.unidadConteo} — USD {fmtNum(totalUsdListado, 2)}
              </span>
            )}
          </header>
        ) : (
          <div className="form-header">
            <PageModuleHeadRow
              icon={{ source: "hub", id: "ventas_arrendamientos" }}
              title={copy.tituloPagina}
              subtitle={copy.descripcionPagina}
            />
            <p className="muted">{copy.subtituloListado}</p>
            <p className="muted">
              {loading
                ? "Cargando..."
                : `${rowsVisibles.length} ${copy.unidadConteo} — Total USD: ${fmtNum(totalUsdListado, 2)}`}
            </p>
          </div>
        )}

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="var-f-empresa">Empresa</label>
            <select
              id="var-f-empresa"
              value={filtroEmpresa}
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
            <label htmlFor="var-f-depto">Departamento</label>
            <select
              id="var-f-depto"
              value={filtroDepartamento}
              onChange={(e) =>
                setFiltroDepartamento(e.target.value as "" | DepartamentoArrendamientoId)
              }
            >
              <option value="">Todos</option>
              {DEPARTAMENTOS_ARRENDAMIENTO.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field flex-grow">
            <label htmlFor="var-f-busq">Buscar</label>
            <input
              id="var-f-busq"
              type="search"
              placeholder="Empresa, departamento, padrón…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
        </div>

        {esSimulador && editingRealId != null && editingId == null && (
          <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
            <span>Confirmando operación — completá los datos en la tabla</span>
          </div>
        )}

        <div className={esSimulador ? "sim-historial-table-wrap" : "table-wrap"}>
          <table
            className={
              esSimulador
                ? "sim-historial-table sim-historial-table--arrendamiento"
                : "data-table ventas-agricultura-table"
            }
          >
            {esSimulador && (
              <colgroup>
                <col style={{ width: "13%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
            )}
            <thead>
              <tr>
                <th className={esSimulador ? "sim-historial-op-meta" : undefined}>Operación</th>
                {esSimulador && <th className="sim-historial-tipo-cell">Tipo</th>}
                {!esSimulador && <th>Empresa</th>}
                <th>Período</th>
                <th>Depto.</th>
                <th>Padrón</th>
                <th className="num">Has</th>
                <th className="num">USD/ha</th>
                <th className="num">Total USD</th>
                <th className={esSimulador ? "sim-historial-col-actions" : undefined}>
                  {esSimulador ? "Acciones" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 8} className={esSimulador ? "sim-historial-empty" : "empty-cell"}>
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 8} className={esSimulador ? "sim-historial-empty" : "empty-cell"}>
                    API no conectada
                  </td>
                </tr>
              ) : rowsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 8} className={esSimulador ? "sim-historial-empty" : "empty-cell"}>
                    {copy.sinFilas}
                  </td>
                </tr>
              ) : esSimulador ? (
                rowsPagina.map((r) => (
                  <VentasArrendamientoTablaFila
                    key={r.id}
                    row={r}
                    puedeEditar={puedeEditar}
                    isPatching={patchingId === r.id}
                    isEditing={editingId === r.id}
                    isEditingReal={editingRealId === r.id}
                    isSavingReal={savingRealId === r.id}
                    isDeleting={deletingId === r.id}
                    onEdit={() => loadFormFromRow(r)}
                    onCancelEdit={() => {
                      if (editingId === r.id) limpiar();
                    }}
                    onStartEditReal={() => setEditingRealId(r.id)}
                    onCancelEditReal={() => setEditingRealId(null)}
                    onSaveReal={(payload) => void guardarReal(r, payload)}
                    onUnmarkReal={() => void quitarReal(r)}
                    onDelete={() => void borrar(r)}
                    onDestacar={() => void handleDestacar(r)}
                    onVerHistorial={() =>
                      onError("Historial de auditoría disponible próximamente para arrendamientos")
                    }
                  />
                ))
              ) : (
                rowsPagina.map((row) => {
                  const hasReal = arrendamientoHasVentaReal(row);
                  const fechaIni = hasReal && row.real_fecha_inicio ? row.real_fecha_inicio : row.fecha_inicio;
                  const fechaFin = hasReal && row.real_fecha_fin ? row.real_fecha_fin : row.fecha_fin;
                  const has = hectareasEfectivasArrendamiento(row);
                  const precio = hasReal && row.real_precio_usd_ha != null ? row.real_precio_usd_ha : row.precio_usd_ha;
                  const total = totalUsdEfectivoArrendamiento(row);
                  return (
                    <tr key={row.id}>
                      <td className="sim-historial-op">
                        <span className="sim-historial-op-code">
                          {formatOperacionArrendamiento(row.id)}
                        </span>
                      </td>
                      <td>{labelEmpresaArrendamiento(row.empresa)}</td>
                      <td>{formatPeriodoArrendamiento(fechaIni, fechaFin)}</td>
                      <td>{labelDepartamentoArrendamiento(row.departamento)}</td>
                      <td>{row.padron}</td>
                      <td className="num">{fmtNum(has, 2)}</td>
                      <td className="num">{formatUsdPorHaArrendamiento(precio)}</td>
                      <td className="num">{formatUsdArrendamiento(total)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!esSimulador && !loading && apiOnline && rowsVisibles.length > 0 && (
              <tfoot>
                <tr className="data-table-totals">
                  <td colSpan={5}>
                    <strong>Totales ({rowsVisibles.length})</strong>
                  </td>
                  <td className="num">
                    <strong>{fmtNum(totalHasListado, 2)}</strong>
                  </td>
                  <td />
                  <td className="num">
                    <strong>{formatUsdArrendamiento(totalUsdListado)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {!loading && rowsVisibles.length > 0 && (
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
      </div>
    </div>
  );
}
