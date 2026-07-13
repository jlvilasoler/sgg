import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { VentaAgriculturaRealInput, VentaAgriculturaRow } from "../../types";
import { fmtNum } from "../../utils";
import { fmtDate, fmtDateHora } from "../divisas/divisas-utils";
import {
  IconCancelar,
  IconCerrarVenta,
  IconDestacar,
  IconEditar,
  IconEliminar,
  IconHistorial,
  IconInfo,
} from "../icons/ActionIcons";
import {
  calcUsdPorHa,
  colorCultivoAgricultura,
  formatOperacionAgricultura,
  formatRendimientoAgricultura,
  formatTotalProduccionAgricultura,
  formatZafraAgricultura,
  formatZafraAgriculturaCorto,
  labelCultivoAgricultura,
  labelEmpresaAgricultura,
  OPCIONES_MES_ANIO_AGRICULTURA,
  parseMesAnioAgricultura,
} from "./ventas-agricultura-utils";
import {
  agriculturaHasVentaReal,
  importeCobradoParcialAgricultura,
  importeNetoSimulacionAgricultura,
  importeNetoRealAgricultura,
  importePendienteAgricultura,
  buildAgriculturaRealPayload,
  computeAgriculturaRealTotals,
  deltaClass,
  fmtDeltaPct,
  fmtUsd,
  rowToAgriculturaRealForm,
  type AgriculturaRealFormState,
} from "./ventas-agricultura-real-utils";

interface Props {
  row: VentaAgriculturaRow;
  puedeEditar?: boolean;
  isPatching: boolean;
  isEditing: boolean;
  isEditingReal: boolean;
  isSavingReal: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onDestacar: () => void;
  onStartEditReal: () => void;
  onCancelEditReal: () => void;
  onSaveReal: (payload: VentaAgriculturaRealInput) => void;
  onUnmarkReal: () => void;
  onCobrarSaldo?: () => void;
  onDelete: () => void;
  onVerHistorial: () => void;
}

export default function VentasAgriculturaTablaFila({
  row,
  puedeEditar = true,
  isPatching,
  isEditing,
  isEditingReal,
  isSavingReal,
  isDeleting,
  onEdit,
  onCancelEdit,
  onDestacar,
  onStartEditReal,
  onCancelEditReal,
  onSaveReal,
  onUnmarkReal,
  onCobrarSaldo,
  onDelete,
  onVerHistorial,
}: Props) {
  const hasReal = agriculturaHasVentaReal(row);
  const showSimRow = !hasReal;
  const esFraccionado = row.forma_pago_agricultura === "FRACCIONADO";
  const cobroCuota1 = esFraccionado && row.pago_ingreso_cobrado === true;
  const cobroCuota2 = esFraccionado && row.pago_saldo_cobrado === true;
  const pendienteUsd = cobroCuota1 && !cobroCuota2 ? importePendienteAgricultura(row) : null;
  const cobradoParcialUsd = cobroCuota1 ? importeCobradoParcialAgricultura(row) : null;
  const rowSpan = showSimRow ? 2 : 1;
  const cultivoColor = colorCultivoAgricultura(row.cultivo);
  const cultivoLabel = labelCultivoAgricultura(row.cultivo);
  const opCode = formatOperacionAgricultura(row.id);

  const [form, setForm] = useState<AgriculturaRealFormState>(() =>
    rowToAgriculturaRealForm(row, hasReal)
  );

  useEffect(() => {
    if (isEditingReal) {
      setForm(rowToAgriculturaRealForm(row, hasReal));
    }
  }, [isEditingReal, row, hasReal]);

  const totals = useMemo(
    () =>
      computeAgriculturaRealTotals(form, {
        impuestos: row.costo_impuestos_usd,
        flete: row.costo_flete_usd,
      }),
    [form, row.costo_impuestos_usd, row.costo_flete_usd],
  );
  const canSave = totals.importeNetoUsd != null && !isSavingReal;

  const simNetUsd = importeNetoSimulacionAgricultura(row);
  const simUsdHa = calcUsdPorHa(simNetUsd, row.hectareas);
  const realNetUsd = importeNetoRealAgricultura(row);
  const realUsdHa =
    hasReal && row.real_hectareas != null && realNetUsd != null
      ? calcUsdPorHa(realNetUsd, row.real_hectareas)
      : null;
  const editNetUsd = totals.importeNetoUsd;
  const editUsdHa =
    editNetUsd != null && totals.hectareas != null
      ? calcUsdPorHa(editNetUsd, totals.hectareas)
      : null;

  const costImp = row.costo_impuestos_usd;
  const costFlete = row.costo_flete_usd;

  const groupClass = [
    "sim-historial-op",
    (row.destacada ?? false) ? "is-destacada" : "",
    hasReal && !isEditingReal ? "has-real" : "pending-real",
    isEditing ? "is-editing" : "",
    isEditingReal ? "is-editing-real" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleSave = () => {
    const payload = buildAgriculturaRealPayload(form, parseMesAnioAgricultura, {
      impuestos: row.costo_impuestos_usd,
      flete: row.costo_flete_usd,
    });
    if (payload) onSaveReal(payload);
  };

  const tipoBadge = (kind: "sim" | "real", pending = false) => (
    <span
      className={`sim-historial-tipo sim-historial-tipo--${kind}${pending ? " sim-historial-tipo--pending" : ""}${isEditingReal && kind === "real" ? " sim-historial-tipo--editing" : ""}`}
    >
      <span className="sim-historial-tipo-dot" aria-hidden />
      {kind === "sim" ? "Simulación" : "Venta"}
    </span>
  );

  const simMetric = (value: string, highlight = false) => (
    <td
      className={`num sim-historial-metric sim-historial-metric--sim${highlight ? " sim-historial-metric--hero" : ""}${isEditingReal ? " is-muted" : ""}`}
    >
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const costMetric = (value: number, muted = false) => (
    <td
      className={`num sim-historial-metric sim-historial-metric--cost${muted ? " is-muted" : ""}`}
    >
      <span className="sim-historial-metric-val">{value > 0 ? fmtUsd(value) : "—"}</span>
    </td>
  );

  const idleCell = (className = "") => (
    <td className={`num sim-historial-metric sim-historial-metric--idle${className ? ` ${className}` : ""}`}>
      <span className="sim-historial-metric-val">—</span>
    </td>
  );

  const idleCostCell = (muted = false) => (
    <td
      className={`num sim-historial-metric sim-historial-metric--idle sim-historial-metric--cost${muted ? " is-muted" : ""}`}
    >
      <span className="sim-historial-metric-val">—</span>
    </td>
  );

  const realMetric = (value: string) => (
    <td className="num sim-historial-metric sim-historial-metric--real">
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const simNota = row.real_notas?.trim() || "";
  const hasNota = simNota.length > 0;
  const creadoDt = fmtDateHora(row.creado_en);

  const destacarBtn = puedeEditar && !isEditingReal ? (
    <button
      type="button"
      className={`sim-historial-op-destacar${row.destacada ?? false ? " is-active" : ""}`}
      onClick={onDestacar}
      disabled={isPatching || isDeleting}
      title={row.destacada ?? false ? "Quitar destacado" : "Destacar operación"}
      aria-pressed={row.destacada ?? false}
      aria-label={row.destacada ?? false ? "Quitar destacado" : "Destacar operación"}
    >
      <IconDestacar size={14} />
    </button>
  ) : row.destacada ?? false ? (
    <span
      className="sim-historial-op-destacar sim-historial-op-destacar--readonly is-active"
      aria-label="Destacada"
    >
      <IconDestacar size={14} />
    </span>
  ) : null;

  const opMetaCell = (
    <td className="sim-historial-op-meta" rowSpan={rowSpan}>
      <div className="sim-historial-op-meta-inner">
        <div className="sim-historial-op-meta-head">
          <div className="sim-historial-op-code-row">
            <span className="sim-historial-op-code">{opCode}</span>
            {hasNota && (
              <span className="sim-historial-op-nota-tip" tabIndex={0} aria-label="Ver notas">
                <IconInfo size={13} className="sim-historial-op-nota-icon" />
                <span className="sim-historial-op-nota-bubble" role="tooltip">
                  {simNota}
                </span>
              </span>
            )}
          </div>
          {destacarBtn}
        </div>
        <span className="sim-historial-op-empresa">{labelEmpresaAgricultura(row.empresa)}</span>
        <span className="sim-historial-op-date">
          {creadoDt ? (
            <>
              <span className="sim-historial-op-date-dia">{creadoDt.fecha}</span>
              <span className="sim-historial-op-date-hora">{creadoDt.hora}</span>
            </>
          ) : (
            fmtDate(row.creado_en)
          )}
        </span>
        {hasReal && !isEditingReal && (
          <span className="sim-historial-op-chip sim-historial-op-chip--sold">Vendida</span>
        )}
        {!hasReal && (
          <span className="sim-historial-op-chip sim-historial-op-chip--pending">Pendiente</span>
        )}
        {cobroCuota1 && !cobroCuota2 && (
          <span
            className="sim-historial-op-chip sim-historial-op-chip--partial"
            title={
              cobradoParcialUsd != null && pendienteUsd != null
                ? `Cuota 1 cobrada: ${fmtUsd(cobradoParcialUsd)} · Cuota 2 por cobrar: ${fmtUsd(pendienteUsd)}`
                : "Cuota 1 (40%) cobrada · cuota 2 pendiente"
            }
          >
            40% cobr.
          </span>
        )}
        {cobroCuota1 && cobroCuota2 && (
          <span className="sim-historial-op-chip sim-historial-op-chip--sold" title="Cuotas 1 y 2 cobradas">
            100% cobr.
          </span>
        )}
      </div>
    </td>
  );

  const cultivoRowSpan = showSimRow && !isEditingReal ? 2 : 1;

  const cultivoPill = (
    <span
      className="sim-historial-cat-pill"
      style={{ "--sim-cat-color": cultivoColor } as CSSProperties}
    >
      <span className="sim-historial-cat-dot" aria-hidden />
      {cultivoLabel}
    </span>
  );

  const cultivoZafraMesIni =
    hasReal && !isEditingReal ? (row.real_mes_inicio ?? row.mes_inicio) : row.mes_inicio;
  const cultivoZafraAnioIni =
    hasReal && !isEditingReal ? (row.real_anio_inicio ?? row.anio_inicio) : row.anio_inicio;
  const cultivoZafraMesFin =
    hasReal && !isEditingReal ? (row.real_mes_fin ?? row.mes_fin) : row.mes_fin;
  const cultivoZafraAnioFin =
    hasReal && !isEditingReal ? (row.real_anio_fin ?? row.anio_fin) : row.anio_fin;

  const cultivoZafraText = formatZafraAgriculturaCorto(
    cultivoZafraMesIni,
    cultivoZafraAnioIni,
    cultivoZafraMesFin,
    cultivoZafraAnioFin
  );
  const cultivoZafraTitle = formatZafraAgricultura(
    cultivoZafraMesIni,
    cultivoZafraAnioIni,
    cultivoZafraMesFin,
    cultivoZafraAnioFin
  );

  const cultivoCell = (
    <div className="sim-historial-cat-wrap">
      {cultivoPill}
      <span className="sim-historial-cat-zafra" title={cultivoZafraTitle}>
        {cultivoZafraText}
      </span>
    </div>
  );

  const cultivoEditCell = (
    <td className="sim-historial-cat-cell sim-historial-inline-cell">
      <div className="sim-historial-cat-wrap">
        {cultivoPill}
        <div className="sim-historial-inline-field sim-historial-inline-field--zafra sim-historial-tipo-zafra">
          <select
            className="sim-historial-inline-select"
            value={form.zafraInicio}
            onChange={(e) => setForm((f) => ({ ...f, zafraInicio: e.target.value }))}
            aria-label="Zafra inicio real"
          >
            {OPCIONES_MES_ANIO_AGRICULTURA.map((opt) => (
              <option key={`ini-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="sim-historial-inline-select"
            value={form.zafraFin}
            onChange={(e) => setForm((f) => ({ ...f, zafraFin: e.target.value }))}
            aria-label="Zafra fin real"
          >
            {OPCIONES_MES_ANIO_AGRICULTURA.map((opt) => (
              <option key={`fin-${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </td>
  );

  const catCellTd = (
    <td className="sim-historial-cat-cell" rowSpan={cultivoRowSpan}>
      {cultivoCell}
    </td>
  );

  const inlineInput = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    step = "0.01"
  ) => (
    <input
      type="number"
      min="0"
      step={step}
      className="sim-historial-inline-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  );

  const actions = isEditingReal ? (
    <div className="sim-historial-action-grid sim-historial-action-grid--edit">
      <button
        type="button"
        className="btn btn-primary btn-sm sim-historial-action-grid-span"
        disabled={!canSave}
        onClick={handleSave}
      >
        {isSavingReal ? "Guardando…" : "Guardar venta"}
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm sim-historial-action-grid-span"
        disabled={isSavingReal}
        onClick={onCancelEditReal}
      >
        Cancelar
      </button>
    </div>
  ) : (
    <div className="sim-historial-action-grid">
      {puedeEditar ? (
        <>
          <button
            type="button"
            className={`sim-historial-action sim-historial-action--edit${isEditing ? " is-active sim-historial-action--cancel-edit" : ""}${hasReal ? " is-active sim-historial-action--edit-locked" : ""}`}
            onClick={isEditing ? onCancelEdit : onEdit}
            disabled={isEditingReal || isDeleting || hasReal}
            title={
              hasReal
                ? "Simulación bloqueada — venta cerrada"
                : isEditing
                  ? "Cancelar edición de simulación"
                  : "Editar simulación"
            }
            aria-pressed={isEditing}
          >
            <span className="sim-historial-action-icon" aria-hidden>
              {isEditing ? <IconCancelar size={15} /> : <IconEditar size={15} />}
            </span>
            <span className="sim-historial-action-label">
              {isEditing ? "Cancelar" : "Simulación"}
            </span>
          </button>
          <button
            type="button"
            className={`sim-historial-action sim-historial-action--sold${hasReal ? " is-active" : " sim-historial-action--close-sale"}`}
            onClick={onStartEditReal}
            disabled={isPatching || isDeleting || hasReal}
            title={hasReal ? "Venta cerrada" : "Cerrar venta"}
            aria-pressed={hasReal}
          >
            <span className="sim-historial-action-icon sim-historial-action-icon--sold-check" aria-hidden>
              <IconCerrarVenta size={16} />
            </span>
            <span className="sim-historial-action-label">
              {hasReal ? "Venta cerrada" : "Cerrar venta"}
            </span>
          </button>
          {hasReal ? (
            <button
              type="button"
              className="sim-historial-action sim-historial-action--unmark"
              onClick={onUnmarkReal}
              disabled={isPatching || isDeleting || isEditingReal}
              title="Volver a pendiente (quita datos reales)"
            >
              <span className="sim-historial-action-icon" aria-hidden>
                <IconCancelar size={15} />
              </span>
              <span className="sim-historial-action-label">Quitar real</span>
            </button>
          ) : null}
          {hasReal && cobroCuota1 && !cobroCuota2 && onCobrarSaldo ? (
            <button
              type="button"
              className="sim-historial-action sim-historial-action--sold"
              onClick={onCobrarSaldo}
              disabled={isPatching || isDeleting || isEditingReal}
              title={
                pendienteUsd != null
                  ? `Registrar cobro de cuota 2 (${fmtUsd(pendienteUsd)})`
                  : "Registrar cobro de cuota 2 (60%)"
              }
            >
              <span className="sim-historial-action-icon sim-historial-action-icon--sold-check" aria-hidden>
                <IconCerrarVenta size={16} />
              </span>
              <span className="sim-historial-action-label">Cobrar cuota 2</span>
            </button>
          ) : null}
          {hasReal ? (
            <button
              type="button"
              className="sim-historial-action sim-historial-action--delete"
              onClick={onDelete}
              disabled={isPatching || isDeleting}
              title="Eliminar venta"
            >
              <span className="sim-historial-action-icon sim-historial-action-icon--text" aria-hidden>
                ×
              </span>
              <span className="sim-historial-action-label">Eliminar</span>
            </button>
          ) : (
            <button
              type="button"
              className="sim-historial-action sim-historial-action--delete"
              onClick={onDelete}
              disabled={isPatching || isDeleting}
              title="Eliminar simulación"
            >
              <span className="sim-historial-action-icon" aria-hidden>
                <IconEliminar size={15} />
              </span>
              <span className="sim-historial-action-label">{isDeleting ? "…" : "Eliminar"}</span>
            </button>
          )}
          <button
            type="button"
            className="sim-historial-action sim-historial-action--history"
            onClick={onVerHistorial}
            disabled={isDeleting || isEditingReal}
            title="Ver historial de cambios"
          >
            <span className="sim-historial-action-icon" aria-hidden>
              <IconHistorial size={15} />
            </span>
            <span className="sim-historial-action-label">Historial</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          className="sim-historial-action sim-historial-action--history"
          onClick={onVerHistorial}
          disabled={isDeleting}
          title="Ver historial de cambios"
        >
          <span className="sim-historial-action-icon" aria-hidden>
            <IconHistorial size={15} />
          </span>
          <span className="sim-historial-action-label">Historial</span>
        </button>
      )}
    </div>
  );

  const actionsCell = (
    <td className="sim-historial-col-actions" rowSpan={rowSpan}>
      {actions}
    </td>
  );

  const realTipoCell = (
    <td className="sim-historial-tipo-cell">
      {tipoBadge("real", !hasReal && !isEditingReal)}
      {!isEditingReal && hasReal && row.venta_realizada_en && (
        <span className="sim-historial-fecha-sub">Cierre {fmtDate(row.venta_realizada_en)}</span>
      )}
      {!isEditingReal && !hasReal && puedeEditar && (
        <button type="button" className="sim-historial-registrar-btn" onClick={onStartEditReal}>
          Cargar datos
        </button>
      )}
    </td>
  );

  const realDataCells = isEditingReal ? (
    <>
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <div className="sim-historial-inline-field">
          {inlineInput(form.hectareas, (v) => setForm((f) => ({ ...f, hectareas: v })), "Hectáreas reales")}
        </div>
      </td>
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <div className="sim-historial-inline-field">
          {inlineInput(
            form.rendimiento,
            (v) => setForm((f) => ({ ...f, rendimiento: v })),
            "Rendimiento real (kg/ha)"
          )}
        </div>
      </td>
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <div className="sim-historial-inline-field">
          {inlineInput(
            form.precio,
            (v) => setForm((f) => ({ ...f, precio: v })),
            "Precio USD/ton real"
          )}
        </div>
      </td>
      <td className="num sim-historial-metric sim-historial-metric--real">
        <span className="sim-historial-metric-val">
          {totals.totalTon != null ? formatTotalProduccionAgricultura(totals.totalTon) : "—"}
        </span>
      </td>
      {costMetric(costImp, true)}
      {costMetric(costFlete, true)}
      <td className="num sim-historial-metric sim-historial-metric--real sim-historial-metric--hero sim-historial-inline-cell">
        <span className="sim-historial-real-edit-result">
          <strong className={editNetUsd == null ? "sim-historial-inline-idle" : ""}>
            {editNetUsd != null ? fmtUsd(editNetUsd) : "—"}
          </strong>
          {editNetUsd != null && (
            <span className={`sim-historial-delta ${deltaClass(simNetUsd, editNetUsd)}`}>
              {fmtDeltaPct(simNetUsd, editNetUsd)}
            </span>
          )}
        </span>
      </td>
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <span className="sim-historial-metric-val">
          {editUsdHa != null ? fmtUsd(editUsdHa) : "—"}
        </span>
      </td>
    </>
  ) : hasReal ? (
    <>
      {realMetric(fmtNum(row.real_hectareas!, 2))}
      {realMetric(formatRendimientoAgricultura(row.real_rendimiento_ton_ha!))}
      {realMetric(fmtNum(row.real_precio_usd_ton!, 2))}
      {realMetric(formatTotalProduccionAgricultura(row.real_total_ton!))}
      {costMetric(costImp)}
      {costMetric(costFlete)}
      <td className="num sim-historial-metric sim-historial-metric--real sim-historial-metric--hero">
        <span className="sim-historial-metric-total">
          <strong>{fmtUsd(realNetUsd!)}</strong>
          <span className={`sim-historial-delta ${deltaClass(simNetUsd, realNetUsd!)}`}>
            {fmtDeltaPct(simNetUsd, realNetUsd!)}
          </span>
        </span>
      </td>
      {realMetric(realUsdHa != null ? fmtUsd(realUsdHa) : "—")}
    </>
  ) : (
    <>
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCostCell(true)}
      {idleCostCell(true)}
      {idleCell("sim-historial-total-idle")}
      {idleCell()}
    </>
  );

  const realRowClass = [
    "sim-historial-row",
    "sim-historial-row--real",
    groupClass,
    !showSimRow ? "sim-historial-row--solo-real" : "",
    hasReal && !isEditingReal ? "" : "sim-historial-row--pending",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Fragment>
      {showSimRow && (
        <tr className={`sim-historial-row sim-historial-row--sim ${groupClass}`.trim()}>
          {opMetaCell}
          <td className="sim-historial-tipo-cell">
            {tipoBadge("sim")}
            {cobroCuota1 && !cobroCuota2 && (
              <span className="sim-historial-fecha-sub sim-historial-cobro-parcial">
                40% cobrado · saldo {pendienteUsd != null ? fmtUsd(pendienteUsd) : "—"}
              </span>
            )}
          </td>
          {catCellTd}
          {simMetric(fmtNum(row.hectareas, 2))}
          {simMetric(formatRendimientoAgricultura(row.rendimiento_ton_ha))}
          {simMetric(fmtNum(row.precio_usd_ton, 2))}
          {simMetric(formatTotalProduccionAgricultura(row.total_ton))}
          {costMetric(costImp)}
          {costMetric(costFlete)}
          {simMetric(fmtUsd(simNetUsd), true)}
          {simMetric(simUsdHa != null ? fmtUsd(simUsdHa) : "—")}
          {actionsCell}
        </tr>
      )}
      <tr className={realRowClass}>
        {!showSimRow && opMetaCell}
        {realTipoCell}
        {!showSimRow && !isEditingReal && catCellTd}
        {showSimRow && isEditingReal && cultivoEditCell}
        {realDataCells}
        {!showSimRow && actionsCell}
      </tr>
    </Fragment>
  );
}
