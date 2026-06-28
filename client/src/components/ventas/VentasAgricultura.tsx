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
  CULTIVOS_AGRICULTURA,
  empresasSelectOptions,
  MESES_AGRICULTURA,
  calcularImporteAgricultura,
  calcularTotalProduccionAgricultura,
  calcUsdPorHa,
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
  VENTAS_AGRICULTURA_COPY,
  type CultivoAgriculturaId,
  type EmpresaAgricultura,
  type MesAgricultura,
  type VentasAgriculturaModo,
} from "./ventas-agricultura-utils";
import VentasAgriculturaTablaFila from "./VentasAgriculturaTablaFila";
import {
  importeEfectivoAgricultura,
  normalizeVentaAgriculturaRow,
  tonEfectivaAgricultura,
} from "./ventas-agricultura-real-utils";
import { canWriteSimuladorVentaGanado, canWriteIngresosVentas } from "../../utils/auth-permissions";

interface Props {
  catalogos: Catalogos;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  modo?: VentasAgriculturaModo;
  user?: AuthUser | null;
}

export default function VentasAgricultura({
  catalogos,
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  modo = "ingresos",
  user = null,
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
  const formRef = useRef<HTMLFormElement>(null);
  const [empresa, setEmpresa] = useState<EmpresaAgricultura>("");
  const [zafraInicio, setZafraInicio] = useState("");
  const [zafraFin, setZafraFin] = useState("");
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
  const [editingRealId, setEditingRealId] = useState<number | null>(null);

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
    zafraInicio !== "" &&
    zafraFin !== "" &&
    hasNum != null &&
    rendimientoNum != null &&
    precioNum != null;

  const limpiar = () => {
    setEmpresa("");
    setZafraInicio("");
    setZafraFin("");
    setHectareas("");
    setCultivo("SOJA");
    setRendimiento("");
    setPrecio("");
    setEditingId(null);
  };

  const loadFormFromRow = (row: VentaAgriculturaRow) => {
    setEmpresa(row.empresa);
    setZafraInicio(encodeMesAnioAgricultura(row.anio_inicio, row.mes_inicio));
    setZafraFin(encodeMesAnioAgricultura(row.anio_fin, row.mes_fin));
    setCultivo(row.cultivo);
    setHectareas(String(row.hectareas));
    setRendimiento(String(row.rendimiento_ton_ha));
    setPrecio(String(row.precio_usd_ton));
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
    setSaving(true);
    try {
      const payload = {
        empresa,
        mes_inicio: ini.mes,
        mes_fin: fin.mes,
        anio_inicio: ini.anio,
        anio_fin: fin.anio,
        cultivo,
        hectareas: hasNum!,
        rendimiento_ton_ha: rendimientoNum!,
        precio_usd_ton: precioNum!,
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

  const historialColSpan = 10;

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
      (acc, r) => ({
        has: acc.has + (r.real_hectareas ?? r.hectareas),
        ton: acc.ton + tonEfectivaAgricultura(r),
        usd: acc.usd + importeEfectivoAgricultura(r),
      }),
      { has: 0, ton: 0, usd: 0 }
    );
    return {
      ...base,
      usdHa: calcUsdPorHa(base.usd, base.has),
    };
  }, [rowsVisibles]);

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
        <div className="form-header">
          <h2>{copy.tituloForm}</h2>
          <p className="muted">
            Simulá la producción y el ingreso por cultivo. Total: <strong>Has × Rendimiento (kg/ha)</strong>.
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

      <div className={`card ventas-agricultura-listado${esSimulador ? " simulador-venta-historial" : ""}`}>
        {esSimulador ? (
          <header className="sim-historial-head">
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
        ) : (
          <div className="form-header">
            <h2>{copy.tituloListado}</h2>
            <p className="muted">
              Ingresos registrados al cerrar ventas en el simulador de ventas agrícolas.
            </p>
            <p className="muted">
              {loading
                ? "Cargando..."
                : `${rowsVisibles.length} ${copy.unidadConteo} — Total USD: ${fmtNum(totales.usd, 2)}`}
            </p>
          </div>
        )}

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="va-f-empresa">Empresa</label>
            <select
              id="va-f-empresa"
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
            <label htmlFor="va-f-mes">Mes en zafra</label>
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

        <div className={esSimulador ? "sim-historial-table-wrap" : "table-wrap"}>
          <table
            className={
              esSimulador
                ? "sim-historial-table sim-historial-table--agricultura"
                : "data-table ventas-agricultura-table"
            }
          >
            {esSimulador && (
              <colgroup>
                <col style={{ width: "11.5%" }} />
                <col style={{ width: "8.5%" }} />
                <col style={{ width: "10.5%" }} />
                <col style={{ width: "7%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "7.5%" }} />
                <col style={{ width: "12.5%" }} />
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
                <th className="num" title="Total USD">
                  USD
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
                  <td colSpan={esSimulador ? historialColSpan : 9} className={esSimulador ? "sim-historial-empty" : "empty"}>
                    Cargando...
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 9} className={esSimulador ? "sim-historial-empty" : "empty"}>
                    API no conectada
                  </td>
                </tr>
              ) : rowsVisibles.length === 0 ? (
                <tr>
                  <td colSpan={esSimulador ? historialColSpan : 9} className={esSimulador ? "sim-historial-empty" : "empty"}>
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
      </div>
    </div>
  );
}
