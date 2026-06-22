import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import {

  fetchSimulacionesVentaGanado,

  fetchSimuladorPreciosReferencia,

  patchSimulacionVentaGanado,

  deleteSimulacionVentaGanado,

  saveSimulacionVentaGanado,

  updateSimulacionVentaGanado,

} from "../../api";

import type {

  AuthUser,

  SimuladorModoKg,

  SimuladorPreciosReferencia,

  SimuladorVentaGanadoRow,

  SimuladorVentaRealInput,

} from "../../types";

import { fmtDate, fmtNum } from "../divisas/divisas-utils";

import SimuladorHistorialRowGroup from "./SimuladorHistorialRowGroup";
import SimuladorVentaAuditoriaPanel from "./SimuladorVentaAuditoriaModal";
import SimuladorVentaCaravanasPanel from "./SimuladorVentaCaravanasModal";
import SimuladorVentaDispositivosVerPanel from "./SimuladorVentaDispositivosVerModal";
import { confirmAction } from "../../utils/confirm";
import { canWriteSimuladorVentaGanado } from "../../utils/auth-permissions";
import { normalizeSimuladorRow, simuladorHasVentaReal } from "./simulador-venta-real-utils";

import type { SimuladorVentaTipoConfig } from "./simulador-venta-config";
import { operacionPrefixForTipo } from "./simulador-venta-config";



interface Props {

  config: SimuladorVentaTipoConfig;

  user: AuthUser;

  apiOnline: boolean;

  onError: (msg: string) => void;

  onSuccess: (msg: string) => void;

}



function parsePositive(value: string): number | null {

  const n = Number(value.replace(",", "."));

  if (!Number.isFinite(n) || n <= 0) return null;

  return n;

}



function fmtUsd(value: number): string {

  return value.toLocaleString("es-UY", {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  });

}



function sortHistorial(rows: SimuladorVentaGanadoRow[]): SimuladorVentaGanadoRow[] {

  return [...rows].sort((a, b) => {

    if (a.destacada !== b.destacada) return a.destacada ? -1 : 1;

    const aReal = simuladorHasVentaReal(a);
    const bReal = simuladorHasVentaReal(b);
    if (aReal !== bReal) return aReal ? 1 : -1;

    return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime();

  });

}



function replaceHistorialRow(

  rows: SimuladorVentaGanadoRow[],

  updated: SimuladorVentaGanadoRow

): SimuladorVentaGanadoRow[] {

  const normalized = normalizeSimuladorRow(updated);
  const id = Number(normalized.id);

  return sortHistorial(rows.map((r) => (Number(r.id) === id ? normalized : r)));

}



export default function SimuladorVentaPanel({

  config,

  user,

  apiOnline,

  onError,

  onSuccess,

}: Props) {

  const calcRef = useRef<HTMLElement>(null);

  const [referencia, setReferencia] = useState<SimuladorPreciosReferencia | null>(null);

  const [historial, setHistorial] = useState<SimuladorVentaGanadoRow[]>([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [patchingId, setPatchingId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [editingRealId, setEditingRealId] = useState<number | null>(null);

  const [savingRealId, setSavingRealId] = useState<number | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [auditRow, setAuditRow] = useState<SimuladorVentaGanadoRow | null>(null);
  const [caravanasRow, setCaravanasRow] = useState<SimuladorVentaGanadoRow | null>(null);
  const [verDispositivosRow, setVerDispositivosRow] = useState<SimuladorVentaGanadoRow | null>(null);



  const [categoria, setCategoria] = useState<string>(config.categorias[0]!);

  const [modoKg, setModoKg] = useState<SimuladorModoKg>("CABEZAS");

  const [precioUsdKg, setPrecioUsdKg] = useState("");

  const [precioManual, setPrecioManual] = useState(false);

  const [kgTotalDirecto, setKgTotalDirecto] = useState("");

  const [cantidadAnimales, setCantidadAnimales] = useState("");

  const [kgPromedio, setKgPromedio] = useState("");

  const [notas, setNotas] = useState("");



  const load = useCallback(async () => {

    if (!apiOnline) {

      setReferencia(null);

      setHistorial([]);

      setLoading(false);

      return;

    }

    setLoading(true);

    try {

      const [ref, rows] = await Promise.all([

        fetchSimuladorPreciosReferencia(config.id),

        fetchSimulacionesVentaGanado({ tipo: config.id, limit: 50 }),

      ]);

      setReferencia(ref);

      setHistorial(sortHistorial(rows.map(normalizeSimuladorRow)));

    } catch (e) {

      onError(e instanceof Error ? e.message : "Error al cargar simulador");

    } finally {

      setLoading(false);

    }

  }, [apiOnline, config.id, onError]);



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    setCategoria(config.categorias[0]!);

    setPrecioManual(false);

    setKgTotalDirecto("");

    setCantidadAnimales("");

    setKgPromedio("");

    setNotas("");

    setEditingId(null);

    setEditingRealId(null);

  }, [config.id, config.categorias]);



  useEffect(() => {

    if (precioManual || !referencia) return;

    const valor = referencia.precios[categoria as keyof typeof referencia.precios];

    if (valor != null) {

      setPrecioUsdKg(String(valor));

    }

  }, [categoria, referencia, precioManual]);



  const kgTotal = useMemo(() => {

    if (modoKg === "TOTAL") {

      return parsePositive(kgTotalDirecto);

    }

    const cab = parsePositive(cantidadAnimales);

    const kg = parsePositive(kgPromedio);

    if (cab == null || kg == null) return null;

    return cab * kg;

  }, [modoKg, kgTotalDirecto, cantidadAnimales, kgPromedio]);



  const precioNum = parsePositive(precioUsdKg);

  const totalUsd = useMemo(() => {

    if (precioNum == null || kgTotal == null) return null;

    return precioNum * kgTotal;

  }, [precioNum, kgTotal]);



  const cabezasNum = parsePositive(cantidadAnimales);

  const totalPorCabeza = useMemo(() => {

    if (totalUsd == null || modoKg !== "CABEZAS" || cabezasNum == null) return null;

    return totalUsd / cabezasNum;

  }, [totalUsd, modoKg, cabezasNum]);



  const precioRefSemana = referencia?.ultima;

  const editingRow =
    editingId != null ? historial.find((row) => row.id === editingId) ?? null : null;

  const numeroOperacionLabel = editingRow?.numero_operacion
    ? editingRow.numero_operacion
    : referencia?.siguiente_numero_operacion ?? `${operacionPrefixForTipo(config.id)}---`;



  const buildPayload = () => ({

    tipo: config.id,

    categoria,

    modo_kg: modoKg,

    precio_usd_kg: precioNum!,

    precio_ref_anio: precioRefSemana?.anio ?? null,

    precio_ref_semana: precioRefSemana?.semana ?? null,

    precio_ref_fecha_hasta: precioRefSemana?.fecha_hasta ?? null,

    cantidad_animales: modoKg === "CABEZAS" ? cabezasNum : null,

    kg_promedio: modoKg === "CABEZAS" ? parsePositive(kgPromedio) : null,

    kg_total: kgTotal!,

    total_usd: totalUsd!,

    total_usd_por_cabeza: totalPorCabeza,

    notas: notas.trim() || null,

  });



  const handleGuardar = async () => {

    if (!apiOnline) {

      onError("Conectá la API para guardar");

      return;

    }

    if (!canWriteSimuladorVentaGanado(user)) {

      onError("Tu rol solo permite consultar, no guardar simulaciones");

      return;

    }

    if (precioNum == null) {

      onError("Ingresá un precio USD/kg válido");

      return;

    }

    if (kgTotal == null) {

      onError(modoKg === "TOTAL" ? "Ingresá kg total válidos" : "Completá cabezas y kg promedio");

      return;

    }

    if (totalUsd == null) {

      onError("No se pudo calcular el total");

      return;

    }



    setSaving(true);

    try {

      const payload = buildPayload();

      if (editingId != null) {

        const res = await updateSimulacionVentaGanado(editingId, payload);

        setHistorial((prev) => replaceHistorialRow(prev, res.data));

        setEditingId(null);

        setNotas("");

        onSuccess(res.message);

      } else {

        const res = await saveSimulacionVentaGanado(payload);

        setHistorial((prev) => sortHistorial([res.data, ...prev]));

        setNotas("");

        try {
          const ref = await fetchSimuladorPreciosReferencia(config.id);
          setReferencia(ref);
        } catch {
          /* preview del siguiente número se actualiza en el próximo load */
        }

        onSuccess(res.message);

      }

    } catch (e) {

      onError(e instanceof Error ? e.message : "Error al guardar");

    } finally {

      setSaving(false);

    }

  };



  const loadFormFromRow = (row: SimuladorVentaGanadoRow) => {

    setCategoria(row.categoria);

    setModoKg(row.modo_kg);

    setPrecioUsdKg(String(row.precio_usd_kg));

    setPrecioManual(true);

    if (row.modo_kg === "CABEZAS") {

      setCantidadAnimales(row.cantidad_animales != null ? String(row.cantidad_animales) : "");

      setKgPromedio(row.kg_promedio != null ? String(row.kg_promedio) : "");

      setKgTotalDirecto("");

    } else {

      setKgTotalDirecto(String(row.kg_total));

      setCantidadAnimales("");

      setKgPromedio("");

    }

    setNotas(row.notas ?? "");

    setEditingId(row.id);

    calcRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  };



  const cancelEdit = () => {

    setEditingId(null);

    setNotas("");

    setKgTotalDirecto("");

    setCantidadAnimales("");

    setKgPromedio("");

    setPrecioManual(false);

  };



  const handleDestacar = async (row: SimuladorVentaGanadoRow) => {

    if (!canWriteSimuladorVentaGanado(user)) {

      onError("Tu rol solo permite consultar");

      return;

    }

    setPatchingId(row.id);

    try {

      const res = await patchSimulacionVentaGanado(row.id, { destacada: !row.destacada });

      setHistorial((prev) => replaceHistorialRow(prev, res.data));

      onSuccess(row.destacada ? "Destacado quitado" : "Simulación destacada");

    } catch (e) {

      onError(e instanceof Error ? e.message : "Error al destacar");

    } finally {

      setPatchingId(null);

    }

  };



  const startEditReal = (row: SimuladorVentaGanadoRow) => {
    if (!canWriteSimuladorVentaGanado(user)) {
      onError("Tu rol solo permite consultar");
      return;
    }
    setEditingRealId(row.id);
  };

  const handleSaveReal = async (row: SimuladorVentaGanadoRow, payload: SimuladorVentaRealInput) => {
    if (!canWriteSimuladorVentaGanado(user)) return;

    setSavingRealId(row.id);
    try {
      const hadReal = simuladorHasVentaReal(row);
      const res = await patchSimulacionVentaGanado(row.id, { valores_reales: payload });
      setHistorial((prev) => replaceHistorialRow(prev, res.data));
      setEditingRealId(null);
      onSuccess(
        hadReal ? "Valores reales actualizados" : "Venta realizada registrada con valores del embarque"
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar venta real");
    } finally {
      setSavingRealId(null);
    }
  };

  const handleUnmarkReal = async (row: SimuladorVentaGanadoRow) => {
    if (!canWriteSimuladorVentaGanado(user)) return;

    const ok = await confirmAction({
      title: "Eliminar venta",
      message:
        "¿Eliminar la venta? Se borrarán los valores reales del embarque y la operación volverá a pendiente (la simulación se mantiene).",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    setPatchingId(row.id);
    try {
      const res = await patchSimulacionVentaGanado(row.id, { venta_realizada: false });
      const updated = normalizeSimuladorRow({
        ...res.data,
        venta_realizada: false,
        venta_realizada_en: null,
        real_precio_usd_kg: null,
        real_cantidad_animales: null,
        real_kg_promedio: null,
        real_kg_total: null,
        real_total_usd: null,
        real_total_usd_por_cabeza: null,
        real_notas: null,
        dispositivos_count: 0,
      });
      setHistorial((prev) => replaceHistorialRow(prev, updated));
      if (editingRealId === row.id) setEditingRealId(null);
      onSuccess(res.message || "Venta cerrada anulada — la operación volvió a pendiente");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al quitar marca");
    } finally {
      setPatchingId(null);
    }
  };



  const handleDelete = async (row: SimuladorVentaGanadoRow) => {
    if (!canWriteSimuladorVentaGanado(user)) return;
    if (row.real_total_usd != null) {
      onError("No se puede eliminar una operación con venta real registrada");
      return;
    }

    const ok = await confirmAction({
      title: "Eliminar simulación",
      message: `¿Eliminar la simulación ${row.numero_operacion || `#${row.id}`}? No se puede deshacer.`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;

    setDeletingId(row.id);
    try {
      const res = await deleteSimulacionVentaGanado(row.id);
      setHistorial((prev) => prev.filter((r) => r.id !== row.id));
      if (editingId === row.id) setEditingId(null);
      if (editingRealId === row.id) setEditingRealId(null);
      try {
        const ref = await fetchSimuladorPreciosReferencia(config.id);
        setReferencia(ref);
      } catch {
        /* ignore */
      }
      onSuccess(res.message);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const usarPrecioReferencia = () => {

    const valor = referencia?.precios[categoria as keyof typeof referencia.precios];

    if (valor != null) {

      setPrecioUsdKg(String(valor));

      setPrecioManual(false);

    }

  };



  if (auditRow) {
    return (
      <SimuladorVentaAuditoriaPanel
        simulacionId={auditRow.id}
        numeroOperacion={auditRow.numero_operacion}
        config={config}
        apiOnline={apiOnline}
        onVolver={() => setAuditRow(null)}
        onError={onError}
      />
    );
  }

  if (caravanasRow) {
    return (
      <SimuladorVentaCaravanasPanel
        row={caravanasRow}
        config={config}
        user={user}
        apiOnline={apiOnline}
        onVolver={() => setCaravanasRow(null)}
        onError={onError}
        onSuccess={onSuccess}
        onDispositivosSaved={(count) => {
          setHistorial((prev) =>
            replaceHistorialRow(
              prev,
              normalizeSimuladorRow({ ...caravanasRow, dispositivos_count: count })
            )
          );
          setCaravanasRow((current) =>
            current ? { ...current, dispositivos_count: count } : null
          );
        }}
      />
    );
  }

  if (verDispositivosRow) {
    return (
      <SimuladorVentaDispositivosVerPanel
        row={verDispositivosRow}
        config={config}
        apiOnline={apiOnline}
        onVolver={() => setVerDispositivosRow(null)}
        onError={onError}
      />
    );
  }

  return (

    <div className="subseccion-panel simulador-venta-panel">

      <div className="simulador-venta-layout">

        <section ref={calcRef} className="card simulador-venta-calc">

          <div className="sim-calc-toolbar">

            <header className="sim-calc-head">

              <h2>{config.titulo}</h2>

              {precioRefSemana && (

                <span className="simulador-venta-ref-badge">

                  Ref. S.{precioRefSemana.semana}

                  <span className="simulador-venta-ref-badge-date">

                    {fmtDate(precioRefSemana.fecha_hasta)}

                  </span>

                </span>

              )}

            </header>



            <div className="simulador-venta-categorias" role="group" aria-label="Categoría">

              {config.categorias.map((cat) => (

                <button

                  key={cat}

                  type="button"

                  className={`simulador-venta-cat-btn${categoria === cat ? " is-active" : ""}`}

                  style={

                    {

                      "--sim-cat-color": config.chartColors[cat] ?? "#848e9c",

                    } as CSSProperties

                  }

                  onClick={() => setCategoria(cat)}

                  aria-pressed={categoria === cat}

                >

                  <span className="simulador-venta-cat-dot" aria-hidden />

                  {config.labels[cat]}

                </button>

              ))}

            </div>

          </div>



          {editingId != null && (

            <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">

              <span>Editando #{editingId}</span>

              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>

                Cancelar

              </button>

            </div>

          )}



          <div className="simulador-venta-resultado sim-resultado-compact" aria-live="polite">

            <div className="sim-resultado-kpis">

              <div className="sim-kpi">

                <span className="simulador-venta-resultado-label">Kg totales</span>

                <strong

                  className={`simulador-venta-resultado-val${kgTotal == null ? " simulador-venta-resultado-val--idle" : ""}`}

                >

                  {kgTotal != null ? fmtNum(kgTotal, 1) : "—"}

                </strong>

              </div>

              <div className="sim-kpi sim-kpi--hero">

                <span className="simulador-venta-resultado-label">Total estimado</span>

                <strong

                  className={`simulador-venta-resultado-total${totalUsd == null ? " simulador-venta-resultado-total--idle" : ""}`}

                >

                  {totalUsd != null ? `USD ${fmtUsd(totalUsd)}` : "—"}

                </strong>

              </div>

              <div className="sim-kpi">

                <span className="simulador-venta-resultado-label">USD/cab.</span>

                <strong

                  className={`simulador-venta-resultado-val${totalPorCabeza == null ? " simulador-venta-resultado-val--idle" : ""}`}

                >

                  {totalPorCabeza != null ? fmtUsd(totalPorCabeza) : "—"}

                </strong>

              </div>

            </div>

            <p className="simulador-venta-formula muted">

              {precioNum != null && kgTotal != null

                ? `${fmtNum(precioNum, 2)} USD/kg × ${fmtNum(kgTotal, 1)} kg`

                : "— USD/kg × — kg"}

            </p>

          </div>



          <div className="sim-calc-form">

            <div className="field sim-calc-field-compact sim-calc-field-operacion">
              <label htmlFor="sim-numero-operacion">N° operación de venta</label>
              <input
                id="sim-numero-operacion"
                type="text"
                readOnly
                value={numeroOperacionLabel}
                className="sim-numero-operacion-input"
                aria-describedby="sim-numero-operacion-hint"
              />
              <span id="sim-numero-operacion-hint" className="sim-numero-operacion-hint muted">
                {editingRow
                  ? "Número asignado al guardar la simulación"
                  : "Se asigna automáticamente al guardar (correlativo único)"}
              </span>
            </div>

            <div className="field sim-calc-field-compact">

              <label htmlFor="sim-precio">USD/kg</label>

              <div className="simulador-venta-precio-row">

                <input

                  id="sim-precio"

                  type="number"

                  min="0"

                  step="0.01"

                  inputMode="decimal"

                  value={precioUsdKg}

                  onChange={(e) => {

                    setPrecioUsdKg(e.target.value);

                    setPrecioManual(true);

                  }}

                  placeholder="0.00"

                />

                <button

                  type="button"

                  className="btn btn-secondary btn-sm"

                  onClick={usarPrecioReferencia}

                  disabled={!referencia?.precios[categoria as keyof typeof referencia.precios]}

                  title="Usar último precio ACG"

                >

                  ACG

                </button>

              </div>

            </div>



            <div className="simulador-venta-modo" role="tablist" aria-label="Modo de kilos">

              <button

                type="button"

                role="tab"

                aria-selected={modoKg === "CABEZAS"}

                className={`simulador-venta-modo-btn${modoKg === "CABEZAS" ? " is-active" : ""}`}

                onClick={() => setModoKg("CABEZAS")}

              >

                Cabezas

              </button>

              <button

                type="button"

                role="tab"

                aria-selected={modoKg === "TOTAL"}

                className={`simulador-venta-modo-btn${modoKg === "TOTAL" ? " is-active" : ""}`}

                onClick={() => setModoKg("TOTAL")}

              >

                Kg total

              </button>

            </div>



            {modoKg === "CABEZAS" ? (

              <>

                <div className="field sim-calc-field-compact">

                  <label htmlFor="sim-cabezas">Cabezas</label>

                  <input

                    id="sim-cabezas"

                    type="number"

                    min="1"

                    step="1"

                    inputMode="numeric"

                    value={cantidadAnimales}

                    onChange={(e) => setCantidadAnimales(e.target.value)}

                    placeholder="50"

                  />

                </div>

                <div className="field sim-calc-field-compact">

                  <label htmlFor="sim-kg-prom">Kg prom.</label>

                  <input

                    id="sim-kg-prom"

                    type="number"

                    min="0"

                    step="0.1"

                    inputMode="decimal"

                    value={kgPromedio}

                    onChange={(e) => setKgPromedio(e.target.value)}

                    placeholder="220"

                  />

                </div>

              </>

            ) : (

              <div className="field sim-calc-field-compact sim-calc-field-kg-total">

                <label htmlFor="sim-kg-total">Kg total</label>

                <input

                  id="sim-kg-total"

                  type="number"

                  min="0"

                  step="0.1"

                  inputMode="decimal"

                  value={kgTotalDirecto}

                  onChange={(e) => setKgTotalDirecto(e.target.value)}

                  placeholder="11000"

                />

              </div>

            )}



            <div className="field sim-calc-notas">

              <label htmlFor="sim-notas">Notas</label>

              <input

                id="sim-notas"

                type="text"

                maxLength={500}

                value={notas}

                onChange={(e) => setNotas(e.target.value)}

                placeholder="Lote, potrero, comprador..."

              />

            </div>



            <div className="sim-calc-actions">

              <button

                type="button"

                className="btn btn-primary"

                disabled={saving || loading || !apiOnline || totalUsd == null || !canWriteSimuladorVentaGanado(user)}

                onClick={() => void handleGuardar()}

              >

                {saving

                  ? "Guardando…"

                  : editingId != null

                    ? "Actualizar"

                    : "Guardar simulación"}

              </button>

            </div>

          </div>

        </section>



        <section className="card simulador-venta-historial">

          <header className="sim-historial-head">

            <div>

              <h2>Simulaciones guardadas</h2>

              <p className="muted">Historial de cálculos de {config.titulo.toLowerCase()}</p>

            </div>

            {!loading && historial.length > 0 && (

              <span className="sim-historial-count">{historial.length} registros</span>

            )}

          </header>



          <div className="sim-historial-table-wrap">

            <table className="sim-historial-table">

              <thead>

                <tr>

                  <th>Operación</th>

                  <th>Tipo</th>

                  <th>Categoría</th>

                  <th className="num">Cab.</th>

                  <th className="num">Kg</th>

                  <th className="num">USD/kg</th>

                  <th className="num">Total USD</th>

                  <th className="num">USD/cab.</th>

                  <th className="sim-historial-col-actions">Acciones</th>

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  <tr>

                    <td colSpan={9} className="sim-historial-empty">

                      Cargando…

                    </td>

                  </tr>

                ) : !apiOnline ? (

                  <tr>

                    <td colSpan={9} className="sim-historial-empty">

                      API no conectada

                    </td>

                  </tr>

                ) : historial.length === 0 ? (

                  <tr>

                    <td colSpan={9} className="sim-historial-empty">

                      Sin simulaciones guardadas. Calculá y usá «Guardar simulación».

                    </td>

                  </tr>

                ) : (

                  historial.map((row) => (
                    <SimuladorHistorialRowGroup
                      key={row.id}
                      row={row}
                      config={config}
                      user={user}
                      isPatching={patchingId === row.id}
                      isEditing={editingId === row.id}
                      isEditingReal={editingRealId === row.id}
                      isSavingReal={savingRealId === row.id}
                      isDeleting={deletingId === row.id}
                      onEdit={() => loadFormFromRow(row)}
                      onCancelEdit={cancelEdit}
                      onDestacar={() => void handleDestacar(row)}
                      onStartEditReal={() => startEditReal(row)}
                      onCancelEditReal={() => setEditingRealId(null)}
                      onSaveReal={(payload) => void handleSaveReal(row, payload)}
                      onUnmarkReal={() => void handleUnmarkReal(row)}
                      onDelete={() => void handleDelete(row)}
                      onVerHistorial={() => setAuditRow(row)}
                      onCaravanas={() => setCaravanasRow(row)}
                      onVerDispositivos={() => setVerDispositivosRow(row)}
                    />
                  ))

                )}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </div>

  );

}

