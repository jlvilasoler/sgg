import { Fragment, useEffect, useMemo, useState } from "react";
import type { VentaArrendamientoRealInput, VentaArrendamientoRow } from "../../types";
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
  formatOperacionArrendamiento,
  formatPeriodoArrendamiento,
  formatUsdArrendamiento,
  formatUsdPorHaArrendamiento,
  labelDepartamentoArrendamiento,
  labelEmpresaArrendamiento,
} from "./ventas-arrendamientos-utils";
import {
  arrendamientoHasVentaReal,
  buildArrendamientoRealPayload,
  computeArrendamientoRealTotals,
  deltaClass,
  fmtDeltaPct,
  fmtUsd,
  rowToArrendamientoRealForm,
  type ArrendamientoRealFormState,
} from "./ventas-arrendamientos-real-utils";

interface Props {
  row: VentaArrendamientoRow;
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
  onSaveReal: (payload: VentaArrendamientoRealInput) => void;
  onUnmarkReal: () => void;
  onDelete: () => void;
  onVerHistorial: () => void;
}

export default function VentasArrendamientoTablaFila({
  row,
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
  onDelete,
  onVerHistorial,
}: Props) {
  const hasReal = arrendamientoHasVentaReal(row);
  const showSimRow = !hasReal;
  const rowSpan = showSimRow ? 2 : 1;
  const opCode = formatOperacionArrendamiento(row.id);

  const [form, setForm] = useState<ArrendamientoRealFormState>(() =>
    rowToArrendamientoRealForm(row, hasReal)
  );

  useEffect(() => {
    if (isEditingReal) {
      setForm(rowToArrendamientoRealForm(row, hasReal));
    }
  }, [isEditingReal, row, hasReal]);

  const totals = useMemo(() => computeArrendamientoRealTotals(form), [form]);
  const canSave = totals.totalUsd != null && !isSavingReal;

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
    const payload = buildArrendamientoRealPayload(row, form);
    if (payload) onSaveReal(payload);
  };

  const tipoBadge = (kind: "sim" | "real", pending = false) => (
    <span
      className={`sim-historial-tipo sim-historial-tipo--${kind}${pending ? " sim-historial-tipo--pending" : ""}${isEditingReal && kind === "real" ? " sim-historial-tipo--editing" : ""}`}
    >
      <span className="sim-historial-tipo-dot" aria-hidden />
      {kind === "sim" ? "Simulación" : "Real"}
    </span>
  );

  const simMetric = (value: string, highlight = false) => (
    <td
      className={`num sim-historial-metric sim-historial-metric--sim${highlight ? " sim-historial-metric--hero" : ""}${isEditingReal ? " is-muted" : ""}`}
    >
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const idleCell = (className = "") => (
    <td className={`num sim-historial-metric sim-historial-metric--idle${className ? ` ${className}` : ""}`}>
      <span className="sim-historial-metric-val">—</span>
    </td>
  );

  const realMetric = (value: string, highlight = false) => (
    <td
      className={`num sim-historial-metric sim-historial-metric--real${highlight ? " sim-historial-metric--hero" : ""}`}
    >
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const inlineInput = (
    value: string,
    onChange: (v: string) => void,
    label: string,
    type: "text" | "date" | "number" = "text",
    step?: string
  ) => (
    <input
      type={type}
      min={type === "number" ? "0" : undefined}
      step={step}
      className="sim-historial-inline-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    />
  );

  const notaText = (row.real_notas?.trim() || row.notas?.trim() || "");
  const hasNota = notaText.length > 0;
  const creadoDt = fmtDateHora(row.creado_en);

  const destacarBtn = !isEditingReal ? (
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
                  {notaText}
                </span>
              </span>
            )}
          </div>
          {destacarBtn}
        </div>
        <span className="sim-historial-op-empresa">{labelEmpresaArrendamiento(row.empresa)}</span>
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
          <span className="sim-historial-op-chip sim-historial-op-chip--sold">Confirmada</span>
        )}
      </div>
    </td>
  );

  const actions = isEditingReal ? (
    <div className="sim-historial-action-grid sim-historial-action-grid--edit">
      <button
        type="button"
        className="btn btn-primary btn-sm sim-historial-action-grid-span"
        disabled={!canSave}
        onClick={handleSave}
      >
        {isSavingReal ? "Guardando…" : "Guardar operación"}
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
      <button
        type="button"
        className={`sim-historial-action sim-historial-action--edit${isEditing ? " is-active sim-historial-action--cancel-edit" : ""}${hasReal ? " is-active sim-historial-action--edit-locked" : ""}`}
        onClick={isEditing ? onCancelEdit : onEdit}
        disabled={isEditingReal || isDeleting || hasReal}
        title={
          hasReal
            ? "Simulación bloqueada — operación confirmada"
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
        title={hasReal ? "Operación confirmada" : "Confirmar operación"}
        aria-pressed={hasReal}
      >
        <span className="sim-historial-action-icon sim-historial-action-icon--sold-check" aria-hidden>
          <IconCerrarVenta size={16} />
        </span>
        <span className="sim-historial-action-label">
          {hasReal ? "Confirmada" : "Confirmar"}
        </span>
      </button>
      {hasReal ? (
        <button
          type="button"
          className="sim-historial-action sim-historial-action--unmark"
          onClick={onUnmarkReal}
          disabled={isPatching || isDeleting}
          title="Quitar confirmación"
        >
          <span className="sim-historial-action-icon sim-historial-action-icon--text" aria-hidden>
            ×
          </span>
          <span className="sim-historial-action-label">Quitar</span>
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
        <span className="sim-historial-fecha-sub">
          Confirmación {fmtDate(row.venta_realizada_en)}
        </span>
      )}
      {!isEditingReal && !hasReal && (
        <button type="button" className="sim-historial-registrar-btn" onClick={onStartEditReal}>
          Cargar datos
        </button>
      )}
    </td>
  );

  const periodoCell = (inicio: string, fin: string, muted = false) => (
    <td className={`sim-historial-periodo${muted ? " is-muted" : ""}`}>
      {formatPeriodoArrendamiento(inicio, fin)}
    </td>
  );

  const deptoCell = (muted = false) => (
    <td className={muted ? "is-muted" : undefined}>
      {labelDepartamentoArrendamiento(row.departamento)}
    </td>
  );

  const padronCell = (muted = false) => (
    <td className={muted ? "is-muted" : undefined}>{row.padron}</td>
  );

  const realDataCells = isEditingReal ? (
    <>
      <td className="sim-historial-inline-cell">
        <div className="sim-historial-inline-field sim-historial-inline-field--stack">
          {inlineInput(form.fechaInicio, (v) => setForm((f) => ({ ...f, fechaInicio: v })), "Inicio real", "date")}
          {inlineInput(form.fechaFin, (v) => setForm((f) => ({ ...f, fechaFin: v })), "Fin real", "date")}
        </div>
      </td>
      {deptoCell()}
      {padronCell()}
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <div className="sim-historial-inline-field">
          {inlineInput(form.hectareas, (v) => setForm((f) => ({ ...f, hectareas: v })), "Hectáreas reales", "number", "0.01")}
        </div>
      </td>
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <div className="sim-historial-inline-field">
          {inlineInput(
            form.precioUsdHa,
            (v) => setForm((f) => ({ ...f, precioUsdHa: v })),
            "Precio USD/ha real",
            "number",
            "0.01"
          )}
        </div>
      </td>
      <td className="num sim-historial-metric sim-historial-metric--real sim-historial-metric--hero sim-historial-inline-cell">
        <span className="sim-historial-real-edit-result">
          <strong className={totals.totalUsd == null ? "sim-historial-inline-idle" : ""}>
            {totals.totalUsd != null ? fmtUsd(totals.totalUsd) : "—"}
          </strong>
          {totals.totalUsd != null && (
            <span className={`sim-historial-delta ${deltaClass(row.total_usd, totals.totalUsd)}`}>
              {fmtDeltaPct(row.total_usd, totals.totalUsd)}
            </span>
          )}
        </span>
      </td>
    </>
  ) : hasReal ? (
    <>
      {periodoCell(row.real_fecha_inicio!, row.real_fecha_fin!)}
      {deptoCell()}
      {padronCell()}
      {realMetric(fmtNum(row.real_hectareas!, 2))}
      {realMetric(formatUsdPorHaArrendamiento(row.real_precio_usd_ha!))}
      <td className="num sim-historial-metric sim-historial-metric--real sim-historial-metric--hero">
        <span className="sim-historial-metric-total">
          <strong>{formatUsdArrendamiento(row.real_total_usd!)}</strong>
          <span className={`sim-historial-delta ${deltaClass(row.total_usd, row.real_total_usd!)}`}>
            {fmtDeltaPct(row.total_usd, row.real_total_usd!)}
          </span>
        </span>
      </td>
    </>
  ) : (
    <>
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCell("sim-historial-total-idle")}
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
          <td className="sim-historial-tipo-cell">{tipoBadge("sim")}</td>
          {periodoCell(row.fecha_inicio, row.fecha_fin, isEditingReal)}
          {deptoCell(isEditingReal)}
          {padronCell(isEditingReal)}
          {simMetric(fmtNum(row.hectareas, 2))}
          {simMetric(formatUsdPorHaArrendamiento(row.precio_usd_ha))}
          {simMetric(formatUsdArrendamiento(row.total_usd), true)}
          {actionsCell}
        </tr>
      )}
      <tr className={realRowClass}>
        {!showSimRow && opMetaCell}
        {realTipoCell}
        {realDataCells}
        {!showSimRow && actionsCell}
      </tr>
    </Fragment>
  );
}
