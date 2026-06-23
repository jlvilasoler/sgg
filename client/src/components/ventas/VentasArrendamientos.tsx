import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createVentaArrendamiento,
  deleteVentaArrendamiento,
  fetchVentasArrendamientos,
  updateVentaArrendamiento,
} from "../../api";
import type { VentaArrendamientoRow } from "../../types";
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
  EMPRESAS_ARRENDAMIENTO,
  fechaFinArrendamientoPorMeses,
  formatFechaArrendamiento,
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
  FRECUENCIAS_PAGO_ARRENDAMIENTO,
  TIPOS_MONTO_PAGO_ARRENDAMIENTO,
  parseMontoPagoArrendamiento,
  parsePositiveDecimal,
  VENTAS_ARRENDAMIENTOS_COPY,
  type DepartamentoArrendamiento,
  type DepartamentoArrendamientoId,
  type EmpresaArrendamiento,
  type ModalidadArrendamiento,
  type FrecuenciaPagoArrendamiento,
  type TipoMontoPagoArrendamiento,
  type VentasArrendamientosModo,
} from "./ventas-arrendamientos-utils";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  modo?: VentasArrendamientosModo;
}

export default function VentasArrendamientos({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  modo = "simulador",
}: Props) {
  const copy = VENTAS_ARRENDAMIENTOS_COPY[modo];
  const esSimulador = modo === "simulador";
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
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<VentaArrendamientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState<"" | DepartamentoArrendamientoId>("");
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
        fechaFinEfectiva
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
    (!esPagoAnual || (pagoFin !== "" && pagoFinMontoNum != null));

  const handlePagoFrecuenciaChange = (frecuencia: FrecuenciaPagoArrendamiento) => {
    setPagoFrecuencia(frecuencia);
    if (frecuencia === "MENSUAL") {
      setPagoInicio("");
      setPagoFin("");
      setPagoFinMonto("");
      setPagoMontoTipo("VALOR");
    }
  };

  const pagoInicioEfectivo = esPagoAnual ? pagoInicio : fechaInicio;
  const pagoFinEfectivo = esPagoAnual ? pagoFin : fechaFinEfectiva;

  useEffect(() => {
    if (!esPagoAnual) return;
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
  }, [esPagoAnual, pagoInicioMontoNum, pagoMontoTipo, totalUsd]);

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
    setEditingId(null);
  };

  const loadFormFromRow = (row: VentaArrendamientoRow) => {
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
      setPagoInicio(row.pago_inicio);
      setPagoFin(row.pago_fin);
      setPagoFinMonto(String(row.pago_fin_monto));
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
        await fetchVentasArrendamientos({
          empresa: filtroEmpresa || undefined,
          departamento: filtroDepartamento || undefined,
          busqueda: busqueda.trim() || undefined,
        })
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
    if (!puedeGuardar || totalUsd == null) return;
    const fin = fechaFinEfectiva;
    if (!fin) {
      onError("Completá las fechas del arrendamiento");
      return;
    }
    if (fin < fechaInicio) {
      onError("La fecha final debe ser posterior o igual a la fecha de inicio");
      return;
    }
    if (esPagoAnual && pagoFin < pagoInicio) {
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
        pago_fin: esPagoAnual ? pagoFin : pagoFinEfectivo,
        pago_inicio_monto: pagoInicioMontoNum!,
        pago_inicio_tipo: pagoMontoTipo,
        pago_fin_monto: esPagoAnual ? pagoFinMontoNum! : pagoInicioMontoNum!,
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
      await load();
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
      onSuccess?.(copy.eliminadoOk);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar registro");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const totalUsdListado = useMemo(
    () => rows.reduce((acc, r) => acc + r.total_usd, 0),
    [rows]
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

      {esSimulador && (
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
            <h2>{copy.tituloForm}</h2>
            <p className="muted">
              Simulá el ingreso por arrendamiento. El precio por hectárea es anual; el total se
              prorratea según la modalidad elegida:{" "}
              <strong>Has × Precio/ha × período</strong>.
            </p>
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
                {EMPRESAS_ARRENDAMIENTO.map((item) => (
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
                  className="ventas-arrendamiento-modalidad"
                  role="group"
                  aria-label="Frecuencia de pago"
                >
                  {FRECUENCIAS_PAGO_ARRENDAMIENTO.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn${
                        pagoFrecuencia === item.id ? " is-active" : ""
                      }`}
                      aria-pressed={pagoFrecuencia === item.id}
                      onClick={() => handlePagoFrecuenciaChange(item.id)}
                    >
                      {item.label.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="ventas-arrendamiento-pagos-grid">
                <div className="field">
                  <label htmlFor={esPagoAnual ? "var-pago-inicio" : "var-pago-mensual"}>
                    <span className="ventas-arrendamiento-pago-label">
                      {esPagoAnual ? "Pago inicio" : "Pago"}
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
                      {TIPOS_MONTO_PAGO_ARRENDAMIENTO.filter(
                        (item) => esPagoAnual || item.id === "VALOR"
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn ventas-arrendamiento-pago-tipo-btn${
                            pagoMontoTipo === item.id ? " is-active" : ""
                          }`}
                          aria-pressed={pagoMontoTipo === item.id}
                          onClick={() => setPagoMontoTipo(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  className={`field${esPagoAnual ? "" : " ventas-arrendamiento-pago-campo--oculto"}`}
                  aria-hidden={!esPagoAnual}
                >
                  <label htmlFor="var-pago-fin">
                    <span className="ventas-arrendamiento-pago-label">Pago final</span>
                  </label>
                  <input
                    id="var-pago-fin"
                    type="date"
                    value={pagoFin}
                    min={pagoInicio || undefined}
                    disabled={!esPagoAnual}
                    tabIndex={esPagoAnual ? undefined : -1}
                    onChange={(e) => setPagoFin(e.target.value)}
                  />
                </div>

                <div
                  className={`field ventas-arrendamiento-pago-monto${
                    esPagoAnual ? "" : " ventas-arrendamiento-pago-campo--oculto"
                  }`}
                  aria-hidden={!esPagoAnual}
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
                      disabled={!esPagoAnual}
                      tabIndex={esPagoAnual ? undefined : -1}
                      onChange={(e) => setPagoFinMonto(e.target.value)}
                    />
                    <div className="ventas-arrendamiento-pago-tipo" role="group" aria-label="Tipo de monto pago final">
                      {TIPOS_MONTO_PAGO_ARRENDAMIENTO.filter(
                        (item) => esPagoAnual || item.id === "VALOR"
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`btn btn-secondary btn-sm ventas-arrendamiento-modalidad-btn ventas-arrendamiento-pago-tipo-btn${
                            pagoMontoTipo === item.id ? " is-active" : ""
                          }`}
                          aria-pressed={pagoMontoTipo === item.id}
                          disabled={!esPagoAnual}
                          tabIndex={esPagoAnual ? undefined : -1}
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

      <div className={`card ventas-agricultura-listado${esSimulador ? " simulador-venta-historial" : ""}`}>
        {esSimulador ? (
          <header className="sim-historial-head">
            <div>
              <h2>{copy.tituloListado}</h2>
              <p className="muted">Historial de simulaciones de arrendamiento guardadas</p>
            </div>
            {!loading && rows.length > 0 && (
              <span className="sim-historial-count">
                {rows.length} {copy.unidadConteo} — USD {fmtNum(totalUsdListado, 2)}
              </span>
            )}
          </header>
        ) : (
          <div className="form-header">
            <h2>{copy.tituloListado}</h2>
            <p className="muted">
              {loading
                ? "Cargando..."
                : `${rows.length} ${copy.unidadConteo} — Total USD: ${fmtNum(totalUsdListado, 2)}`}
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
              {EMPRESAS_ARRENDAMIENTO.map((item) => (
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

        <div className={esSimulador ? "sim-historial-table-wrap" : "table-wrap"}>
          <table
            className={
              esSimulador
                ? "sim-historial-table sim-historial-table--arrendamiento"
                : "data-table ventas-agricultura-table"
            }
          >
            <thead>
              <tr>
                <th>Operación</th>
                <th>Empresa</th>
                <th>Período</th>
                <th>Depto.</th>
                <th>Padrón</th>
                <th className="num">Has</th>
                <th className="num">USD/ha</th>
                <th className="num">Total USD</th>
                {esSimulador && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={esSimulador ? 9 : 8} className="empty-cell">
                    Cargando…
                  </td>
                </tr>
              ) : rowsPagina.length === 0 ? (
                <tr>
                  <td colSpan={esSimulador ? 9 : 8} className="empty-cell">
                    {copy.sinFilas}
                  </td>
                </tr>
              ) : (
                rowsPagina.map((row) => (
                  <tr key={row.id}>
                    <td className="sim-historial-op">
                      <span className="sim-historial-op-code">
                        {formatOperacionArrendamiento(row.id)}
                      </span>
                    </td>
                    <td>{labelEmpresaArrendamiento(row.empresa)}</td>
                    <td>
                      {formatFechaArrendamiento(row.fecha_inicio)}
                      {row.fecha_fin !== row.fecha_inicio && (
                        <> — {formatFechaArrendamiento(row.fecha_fin)}</>
                      )}
                    </td>
                    <td>{labelDepartamentoArrendamiento(row.departamento)}</td>
                    <td>{row.padron}</td>
                    <td className="num">{fmtNum(row.hectareas, 2)}</td>
                    <td className="num">{formatUsdPorHaArrendamiento(row.precio_usd_ha)}</td>
                    <td className="num">{formatUsdArrendamiento(row.total_usd)}</td>
                    {esSimulador && (
                      <td className="sim-historial-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => loadFormFromRow(row)}
                          disabled={deletingId === row.id}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-danger-text"
                          onClick={() => void borrar(row)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? "…" : "Borrar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
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
