import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPagoPersonalizado,
  deletePagoPersonalizado,
  updatePagoPersonalizado,
} from "../api";
import type {
  MonedaPagoPersonalizado,
  PagoPersonalizadoCuotaInput,
  PagoPersonalizadoRow,
  TipoPrestamoPago,
} from "../types/pagos-personalizados";
import {
  MONEDAS_PAGO_PERSONALIZADO,
  TIPOS_PRESTAMO_PAGO,
  TIPO_PRESTAMO_PAGO_LABEL,
} from "../types/pagos-personalizados";
import { confirmAction } from "../utils/confirm";
import {
  diasRestantesLabel,
  formatearFechaContribucionRural,
  semaforoVencimientoCuota,
} from "../utils/contribucion-rural-common";
import {
  cuotasFuturasPagosPersonalizados,
  generarCuotasMensuales,
  normalizeFechaPagoIso,
} from "../utils/pagos-personalizados-view";
import VencImpProximosCarousel from "./VencImpProximosCarousel";

interface Props {
  apiOnline: boolean;
  puedeEditar: boolean;
  pagos: PagoPersonalizadoRow[];
  loading: boolean;
  onReload: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  highlightPagoId?: number | null;
}

type FormCuota = {
  nro_cuota: number;
  fecha: string;
  monto: string;
  descripcion: string;
  pagado: boolean;
};

type FormState = {
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes: string;
  moneda: MonedaPagoPersonalizado;
  monto_cuota: string;
  cantidad_cuotas: string;
  fecha_primera: string;
  notas: string;
  cuotas: FormCuota[];
};

const EMPTY_FORM: FormState = {
  entidad: "",
  tipo_prestamo: "PRESTAMO",
  tasa_interes: "",
  moneda: "UYU",
  monto_cuota: "",
  cantidad_cuotas: "12",
  fecha_primera: "",
  notas: "",
  cuotas: [],
};

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function rowToForm(row: PagoPersonalizadoRow): FormState {
  return {
    entidad: row.entidad,
    tipo_prestamo: row.tipo_prestamo,
    tasa_interes: row.tasa_interes != null ? String(row.tasa_interes) : "",
    moneda: row.moneda,
    monto_cuota: row.monto_cuota != null ? String(row.monto_cuota) : "",
    cantidad_cuotas: String(row.cantidad_cuotas || row.cuotas.length || 1),
    fecha_primera: normalizeFechaPagoIso(row.cuotas[0]?.fecha) ?? "",
    notas: row.notas ?? "",
    cuotas: row.cuotas.map((c) => ({
      nro_cuota: c.nro_cuota,
      fecha: normalizeFechaPagoIso(c.fecha) ?? "",
      monto: c.monto != null ? String(c.monto) : "",
      descripcion: c.descripcion ?? "",
      pagado: c.pagado,
    })),
  };
}

function formToInput(form: FormState): {
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes: number | null;
  moneda: MonedaPagoPersonalizado;
  monto_cuota: number | null;
  notas: string | null;
  cuotas: PagoPersonalizadoCuotaInput[];
} {
  const defaultMonto = parseOptionalNumber(form.monto_cuota);
  let cuotasSource: FormCuota[] = form.cuotas;
  if (cuotasSource.length === 0) {
    cuotasSource = generarCuotasMensuales(
      form.fecha_primera,
      Number(form.cantidad_cuotas) || 1,
      defaultMonto,
    ).map((c) => ({
      nro_cuota: c.nro_cuota,
      fecha: c.fecha,
      monto: c.monto != null ? String(c.monto) : "",
      descripcion: "",
      pagado: false,
    }));
  }

  return {
    entidad: form.entidad.trim(),
    tipo_prestamo: form.tipo_prestamo,
    tasa_interes: parseOptionalNumber(form.tasa_interes),
    moneda: form.moneda,
    monto_cuota: defaultMonto,
    notas: form.notas.trim() || null,
    cuotas: cuotasSource.map((c) => ({
      nro_cuota: c.nro_cuota,
      fecha: normalizeFechaPagoIso(c.fecha) ?? "",
      monto: parseOptionalNumber(c.monto) ?? defaultMonto,
      descripcion: c.descripcion.trim() || null,
      pagado: Boolean(c.pagado),
    })),
  };
}

export default function VencImpPagosPersonalizadosPanel({
  apiOnline,
  puedeEditar,
  pagos,
  loading,
  onReload,
  onError,
  onSuccess,
  highlightPagoId,
}: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const formWrapRef = useRef<HTMLDivElement>(null);

  const futuras = useMemo(() => cuotasFuturasPagosPersonalizados(pagos), [pagos]);
  const formOpen = showForm && puedeEditar;

  useEffect(() => {
    if (!formOpen) return;
    const el = formWrapRef.current;
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
    return () => window.clearTimeout(t);
  }, [formOpen, editingId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (row: PagoPersonalizadoRow) => {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setShowForm(true);
  };

  const generateSchedule = () => {
    const n = Number(form.cantidad_cuotas);
    if (!form.fecha_primera || !Number.isFinite(n) || n < 1) {
      onError("Indicá fecha de la primera cuota y cantidad de cuotas.");
      return;
    }
    const monto = parseOptionalNumber(form.monto_cuota);
    const generated = generarCuotasMensuales(form.fecha_primera, n, monto);
    if (generated.length === 0) {
      onError("No se pudieron generar las cuotas. Revisá la fecha.");
      return;
    }
    setForm((f) => ({
      ...f,
      cuotas: generated.map((c) => ({
        nro_cuota: c.nro_cuota,
        fecha: c.fecha,
        monto: c.monto != null ? String(c.monto) : "",
        descripcion: "",
        pagado: false,
      })),
    }));
  };

  const updateCuota = (idx: number, patch: Partial<FormCuota>) => {
    setForm((f) => ({
      ...f,
      cuotas: f.cuotas.map((x, i) => (i === idx ? { ...x, ...patch } : x)),
    }));
  };

  const addCuotaRow = () => {
    setForm((f) => {
      const nextNro =
        f.cuotas.reduce((max, c) => Math.max(max, c.nro_cuota), 0) + 1;
      return {
        ...f,
        cantidad_cuotas: String(f.cuotas.length + 1),
        cuotas: [
          ...f.cuotas,
          {
            nro_cuota: nextNro,
            fecha: f.fecha_primera || "",
            monto: f.monto_cuota,
            descripcion: "",
            pagado: false,
          },
        ],
      };
    });
  };

  const removeCuotaRow = (idx: number) => {
    setForm((f) => {
      const cuotas = f.cuotas
        .filter((_, i) => i !== idx)
        .map((c, i) => ({ ...c, nro_cuota: i + 1 }));
      return {
        ...f,
        cantidad_cuotas: String(Math.max(cuotas.length, 1)),
        cuotas,
      };
    });
  };

  const handleSave = async () => {
    if (!apiOnline || !puedeEditar) return;
    setSaving(true);
    try {
      const payload = formToInput(form);
      if (!payload.entidad) {
        onError("Indicá el nombre del contenido (ej. BROU).");
        return;
      }
      if (payload.cuotas.length === 0) {
        onError("Generá o cargá al menos una cuota con fecha.");
        return;
      }
      const sinFecha = payload.cuotas.find((c) => !normalizeFechaPagoIso(c.fecha));
      if (sinFecha) {
        onError(`La cuota #${sinFecha.nro_cuota} necesita una fecha de vencimiento.`);
        return;
      }
      if (editingId != null) {
        await updatePagoPersonalizado(editingId, payload);
        onSuccess?.("Pago personalizado actualizado");
      } else {
        await createPagoPersonalizado(payload);
        onSuccess?.("Pago personalizado creado");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: PagoPersonalizadoRow) => {
    const ok = await confirmAction({
      title: "Eliminar pago personalizado",
      message: `¿Eliminar «${row.entidad}» y todas sus cuotas?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      await deletePagoPersonalizado(row.id);
      onSuccess?.("Pago eliminado");
      if (editingId === row.id) {
        setShowForm(false);
        setEditingId(null);
      }
      await onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div
      className={`venc-imp-hub-panel sg-hub-panel venc-imp-personalizado-panel${formOpen ? " is-form-open" : ""}`}
    >
      <div className="venc-imp-user-banner venc-imp-personalizado-banner" aria-label="Pagos personalizados">
        <div className="venc-imp-brand-row">
          <img
            src="/icon-venc-pago-personalizado.svg"
            alt=""
            className="venc-imp-brand-icon-img"
            aria-hidden
          />
          <div>
            <p className="venc-imp-onboard-kicker">Pagos de la cuenta</p>
            <p className="venc-imp-user-banner-text">
              <strong>Personalizado</strong>
            </p>
            <p className="venc-imp-user-banner-deptos">
              Préstamos y otros vencimientos con fechas propias · {pagos.length}{" "}
              {pagos.length === 1 ? "registro" : "registros"}
            </p>
          </div>
        </div>
        {puedeEditar && (
          <div className="venc-imp-personalizado-banner-actions">
            {formOpen ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} disabled={saving}>
                Cerrar formulario
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} disabled={!apiOnline}>
                Nuevo pago
              </button>
            )}
          </div>
        )}
      </div>

      {formOpen && (
        <div
          ref={formWrapRef}
          className="venc-imp-personalizado-form-wrap"
          role="region"
          aria-labelledby="pp-form-title"
        >
          <div className="venc-imp-personalizado-form-top">
            <div className="venc-imp-personalizado-form-head">
              <h3 id="pp-form-title" className="venc-imp-personalizado-form-title">
                {editingId != null ? "Editar pago personalizado" : "Nuevo pago personalizado"}
              </h3>
              <div className="venc-imp-personalizado-form-head-actions">
                <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={closeForm}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saving || !apiOnline}
                  onClick={() => void handleSave()}
                >
                  {saving ? "Guardando…" : editingId != null ? "Guardar cambios" : "Crear pago"}
                </button>
              </div>
            </div>

            <div className="venc-imp-personalizado-form-grid">
              <label className="venc-imp-personalizado-form-nombre">
                Nombre del contenido
                <input
                  type="text"
                  value={form.entidad}
                  onChange={(e) => setForm((f) => ({ ...f, entidad: e.target.value }))}
                  placeholder="Ej. BROU"
                  maxLength={120}
                  autoFocus={editingId == null}
                />
              </label>
              <label>
                Tipo
                <select
                  value={form.tipo_prestamo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo_prestamo: e.target.value as TipoPrestamoPago }))
                  }
                >
                  {TIPOS_PRESTAMO_PAGO.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_PRESTAMO_PAGO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Moneda
                <select
                  value={form.moneda}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, moneda: e.target.value as MonedaPagoPersonalizado }))
                  }
                >
                  {MONEDAS_PAGO_PERSONALIZADO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tasa (% anual)
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.tasa_interes}
                  onChange={(e) => setForm((f) => ({ ...f, tasa_interes: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Importe base
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.monto_cuota}
                  onChange={(e) => setForm((f) => ({ ...f, monto_cuota: e.target.value }))}
                  placeholder="Al generar"
                />
              </label>
              <label>
                Cantidad cuotas
                <input
                  type="number"
                  min={1}
                  max={360}
                  value={form.cantidad_cuotas}
                  onChange={(e) => setForm((f) => ({ ...f, cantidad_cuotas: e.target.value }))}
                />
              </label>
              <label>
                Fecha 1ª cuota
                <input
                  type="date"
                  value={form.fecha_primera}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_primera: e.target.value }))}
                />
              </label>
              <label className="venc-imp-personalizado-form-notas">
                Notas
                <input
                  type="text"
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  maxLength={2000}
                  placeholder="Opcional"
                />
              </label>
            </div>

            <div className="venc-imp-personalizado-form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={generateSchedule}>
                Generar cuotas mensuales
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addCuotaRow}>
                Agregar cuota
              </button>
              <span className="muted venc-imp-personalizado-form-hint">
                {form.cuotas.length} {form.cuotas.length === 1 ? "cuota" : "cuotas"} · completá importe, fecha y
                descripción
              </span>
            </div>
          </div>

          <div className="venc-imp-personalizado-table-wrap">
            <table className="venc-imp-personalizado-table">
              <colgroup>
                <col className="venc-imp-personalizado-col-nro" />
                <col className="venc-imp-personalizado-col-importe" />
                <col className="venc-imp-personalizado-col-fecha" />
                <col className="venc-imp-personalizado-col-desc" />
                <col className="venc-imp-personalizado-col-pagada" />
                <col className="venc-imp-personalizado-col-accion" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Cuota</th>
                  <th scope="col">Importe</th>
                  <th scope="col">Vencimiento</th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Pagada</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.cuotas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="venc-imp-personalizado-table-empty">
                      Sin cuotas aún. Usá «Generar cuotas mensuales» o «Agregar cuota».
                    </td>
                  </tr>
                ) : (
                  form.cuotas.map((c, idx) => (
                    <tr key={`cuota-${idx}-${c.nro_cuota}`}>
                      <td className="venc-imp-personalizado-table-nro">
                        <span aria-hidden>#{c.nro_cuota}</span>
                        <span className="sr-only">Cuota {c.nro_cuota}</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={c.monto}
                          placeholder={form.monto_cuota || "0"}
                          aria-label={`Importe cuota ${c.nro_cuota}`}
                          onChange={(e) => updateCuota(idx, { monto: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={c.fecha}
                          aria-label={`Fecha vencimiento cuota ${c.nro_cuota}`}
                          onChange={(e) => updateCuota(idx, { fecha: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={c.descripcion}
                          maxLength={200}
                          placeholder="Opcional"
                          aria-label={`Descripción cuota ${c.nro_cuota}`}
                          onChange={(e) => updateCuota(idx, { descripcion: e.target.value })}
                        />
                      </td>
                      <td className="venc-imp-personalizado-table-pagada">
                        <label className="venc-imp-personalizado-pagado">
                          <input
                            type="checkbox"
                            checked={c.pagado}
                            aria-label={`Cuota ${c.nro_cuota} pagada`}
                            onChange={(e) => updateCuota(idx, { pagado: e.target.checked })}
                          />
                        </label>
                      </td>
                      <td className="venc-imp-personalizado-table-accion">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeCuotaRow(idx)}
                          aria-label={`Quitar cuota ${c.nro_cuota}`}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!formOpen && (
        <section className="venc-imp-personalizado-list" aria-label="Listado de pagos">
          <header className="venc-imp-personalizado-list-head">
            <div>
              <p className="venc-imp-personalizado-list-kicker">Gestión</p>
              <h3 className="venc-imp-personalizado-list-title">Registros de la cuenta</h3>
              <p className="venc-imp-personalizado-list-sub muted">
                Cada préstamo u otro pago cargado · editalos o marcá cuotas pagadas
              </p>
            </div>
            <span className="venc-imp-personalizado-list-count">{pagos.length}</span>
          </header>
          {pagos.length === 0 ? (
            <p className="venc-imp-personalizado-list-empty muted">
              Sin pagos personalizados cargados.
              {puedeEditar ? " Usá «Nuevo pago» para crear el primero." : ""}
            </p>
          ) : (
            <div className="venc-imp-personalizado-registros-wrap">
              <table className="venc-imp-personalizado-registros-table">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Importe</th>
                    <th scope="col">Cuotas</th>
                    <th scope="col">Próx. vencimiento</th>
                    <th scope="col">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((row) => {
                    const pendientes = row.cuotas.filter((c) => !c.pagado).length;
                    const highlighted = highlightPagoId === row.id;
                    const proxima = row.cuotas
                      .filter((c) => !c.pagado)
                      .map((c) => ({
                        ...c,
                        fechaIso: normalizeFechaPagoIso(c.fecha),
                      }))
                      .filter((c) => c.fechaIso)
                      .sort((a, b) => String(a.fechaIso).localeCompare(String(b.fechaIso)))[0];
                    const importeLabel =
                      row.monto_cuota != null
                        ? `${row.moneda} ${new Intl.NumberFormat("es-UY", {
                            maximumFractionDigits: 2,
                          }).format(row.monto_cuota)}`
                        : "—";
                    return (
                      <tr
                        key={row.id}
                        className={highlighted ? "is-highlight" : undefined}
                      >
                        <td>
                          <button
                            type="button"
                            className="venc-imp-personalizado-registros-nombre"
                            onClick={() => openEdit(row)}
                          >
                            {row.entidad}
                          </button>
                          {row.notas ? (
                            <p className="venc-imp-personalizado-registros-notas muted">{row.notas}</p>
                          ) : null}
                        </td>
                        <td>{TIPO_PRESTAMO_PAGO_LABEL[row.tipo_prestamo]}</td>
                        <td>{importeLabel}</td>
                        <td>
                          {row.cuotas.length}
                          <span className="muted"> · {pendientes} pend.</span>
                        </td>
                        <td>
                          {proxima?.fechaIso
                            ? formatearFechaContribucionRural(proxima.fechaIso)
                            : "—"}
                        </td>
                        <td className="venc-imp-personalizado-registros-acciones">
                          {puedeEditar && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEdit(row)}
                                disabled={busyId === row.id}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => void handleDelete(row)}
                                disabled={busyId === row.id}
                              >
                                Eliminar
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!formOpen && (
        <section
          className="venc-imp-section venc-imp-proximos-section venc-imp-personalizado-calendario"
          aria-label="Próximos pagos personalizados"
        >
          <div className="venc-imp-proximos-head-box">
            <p className="venc-imp-section-kicker">Calendario</p>
            <div className="venc-imp-proximos-head-row">
              <div className="venc-imp-proximos-head-main">
                <h2 className="venc-imp-section-title">Próximos vencimientos</h2>
                <p className="venc-imp-section-sub">
                  Cuotas no pagadas · del más cercano al más lejano
                </p>
              </div>
              <span className="venc-imp-section-count">{futuras.length}</span>
            </div>
          </div>
          <div className="venc-imp-proximos-carousel-box">
            {loading && futuras.length === 0 ? (
              <p className="muted venc-imp-personalizado-calendario-status">Cargando…</p>
            ) : (
              <VencImpProximosCarousel
                ariaLabel="Próximos pagos personalizados"
                itemCount={futuras.length}
                emptyMessage={
                  puedeEditar
                    ? "Todavía no hay cuotas pendientes. Creá un préstamo u otro pago con sus fechas."
                    : "Todavía no hay cuotas pendientes."
                }
              >
                {futuras.map((item) => {
                  const semaforo = semaforoVencimientoCuota(item.fecha);
                  return (
                    <button
                      type="button"
                      key={`pp-${item.pagoId}-${item.cuota}-${item.fecha}`}
                      className={`venc-imp-proximo-card venc-imp-proximo-card--pro venc-imp-proximo-card--${semaforo.nivel}`}
                      role="listitem"
                      onClick={() => {
                        const row = pagos.find((p) => p.id === item.pagoId);
                        if (row) openEdit(row);
                      }}
                    >
                      <span className="venc-imp-proximo-accent" aria-hidden />
                      <div className="venc-imp-proximo-top">
                        <img
                          src="/icon-venc-pago-personalizado.svg"
                          alt=""
                          className="venc-imp-proximo-escudo venc-imp-proximo-escudo--personalizado"
                          loading="lazy"
                        />
                        <div className="venc-imp-proximo-meta">
                          <p className="venc-imp-proximo-impuesto">{item.tipoLabel}</p>
                          <p className="venc-imp-proximo-depto">{item.entidad}</p>
                          <p className="venc-imp-proximo-plazo">{diasRestantesLabel(item.diasRestantes)}</p>
                        </div>
                      </div>
                      <p className="venc-imp-proximo-cuota">
                        Cuota {item.cuota}ª de {item.totalCuotas}
                        {item.montoLabel ? ` · ${item.montoLabel}` : ""}
                      </p>
                      {item.descripcion ? (
                        <p className="venc-imp-proximo-plazo">{item.descripcion}</p>
                      ) : null}
                      <p className="venc-imp-proximo-fecha">{item.fechaLabel}</p>
                      <span className={`venc-imp-semaforo-badge venc-imp-semaforo-badge--${semaforo.nivel}`}>
                        <span className={`venc-imp-semaforo-dot venc-imp-semaforo-dot--${semaforo.nivel}`} aria-hidden />
                        {semaforo.label}
                      </span>
                    </button>
                  );
                })}
              </VencImpProximosCarousel>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
