import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AuthUser, SimuladorVentaGanadoRow, SimuladorVentaRealInput } from "../../types";
import { fmtDate, fmtDateHora, fmtNum } from "../divisas/divisas-utils";
import {
  IconCancelar,
  IconCerrarVenta,
  IconDestacar,
  IconEditar,
  IconEliminar,
  IconHistorial,
  IconInfo,
  IconVer,
} from "../icons/ActionIcons";
import type { SimuladorVentaTipoConfig } from "./simulador-venta-config";
import { canWriteSimuladorVentaGanado } from "../../utils/auth-permissions";
import {
  buildRealPayload,
  computeRealTotals,
  deltaClass,
  fmtDeltaPct,
  fmtUsd,
  rowToRealForm,
  simuladorHasVentaReal,
  type RealFormState,
} from "./simulador-venta-real-utils";

interface Props {
  row: SimuladorVentaGanadoRow;
  config: SimuladorVentaTipoConfig;
  user: AuthUser;
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
  onSaveReal: (payload: SimuladorVentaRealInput) => void;
  onUnmarkReal: () => void;
  onDelete: () => void;
  onVerHistorial: () => void;
  onCaravanas: () => void;
  onVerDispositivos: () => void;
}

export default function SimuladorHistorialRowGroup({
  row,
  config,
  user,
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
  onCaravanas,
  onVerDispositivos,
}: Props) {
  const catColor = config.chartColors[row.categoria] ?? "#848e9c";
  const catLabel = config.labels[row.categoria] ?? row.categoria;
  const hasReal = simuladorHasVentaReal(row);
  const showSimRow = !hasReal;
  const rowSpan = showSimRow ? 2 : 1;

  const [form, setForm] = useState<RealFormState>(() => rowToRealForm(row, hasReal));

  useEffect(() => {
    if (isEditingReal) {
      setForm(rowToRealForm(row, hasReal));
    }
  }, [isEditingReal, row, hasReal]);

  const totals = useMemo(() => computeRealTotals(row, form), [row, form]);
  const canSave = totals.totalUsd != null && !isSavingReal;

  const groupClass = [
    "sim-historial-op",
    row.destacada ? "is-destacada" : "",
    hasReal ? "has-real" : "pending-real",
    isEditing ? "is-editing" : "",
    isEditingReal ? "is-editing-real" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isCabezas = row.modo_kg === "CABEZAS";

  const formatCabezas = (value: number | null | undefined) =>
    value != null ? fmtNum(value, 0) : "—";

  const simCabezas = isCabezas ? formatCabezas(row.cantidad_animales) : "—";
  const cabVentaObjetivo =
    row.real_cantidad_animales != null ? Math.round(row.real_cantidad_animales) : null;
  const dispCount = row.dispositivos_count ?? 0;

  const cabezasCell = (
    value: string,
    variant: "sim" | "real" | "idle",
    extraClass = ""
  ) => {
    const showDispInfo =
      variant === "real" &&
      isCabezas &&
      hasReal &&
      !isEditingReal &&
      cabVentaObjetivo != null;
    return (
      <td
        className={`num sim-historial-metric sim-historial-metric--${variant}${extraClass ? ` ${extraClass}` : ""}${isEditingReal && variant === "sim" ? " is-muted" : ""}`}
      >
        <span className={`sim-historial-cab-cell${showDispInfo ? " sim-historial-cab-cell--with-eye" : ""}`}>
          <span className="sim-historial-metric-val">{value}</span>
          {showDispInfo && (
            <span className="sim-historial-cab-disp">
              <button
                type="button"
                className="sim-historial-cab-ver-btn"
                onClick={onVerDispositivos}
                title={`Ver dispositivos vinculados (${dispCount} de ${cabVentaObjetivo})`}
                aria-label={`Ver ${dispCount} dispositivo(s) de ${cabVentaObjetivo}`}
              >
                <IconVer size={14} />
              </button>
              <span className="sim-historial-cab-disp-ratio num">
                {fmtNum(dispCount, 0)}/{fmtNum(cabVentaObjetivo, 0)}
              </span>
            </span>
          )}
        </span>
      </td>
    );
  };

  const handleSave = () => {
    const payload = buildRealPayload(row, form);
    if (payload) onSaveReal(payload);
  };

  const destacarBtn =
    canWriteSimuladorVentaGanado(user) && !isEditingReal ? (
      <button
        type="button"
        className={`sim-historial-op-destacar${row.destacada ? " is-active" : ""}`}
        onClick={onDestacar}
        disabled={isPatching || isDeleting}
        title={row.destacada ? "Quitar destacado" : "Destacar operación"}
        aria-pressed={row.destacada}
        aria-label={row.destacada ? "Quitar destacado" : "Destacar operación"}
      >
        <IconDestacar size={14} />
      </button>
    ) : row.destacada ? (
      <span className="sim-historial-op-destacar sim-historial-op-destacar--readonly is-active" aria-label="Destacada">
        <IconDestacar size={14} />
      </span>
    ) : null;

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
      {canWriteSimuladorVentaGanado(user) ? (
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
            <span
              className="sim-historial-action-icon sim-historial-action-icon--sold-check"
              aria-hidden
            >
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
        <>
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
        </>
      )}
    </div>
  );

  const catCell = (
    <div className="sim-historial-cat-wrap">
      <span
        className="sim-historial-cat-pill"
        style={{ "--sim-cat-color": catColor } as CSSProperties}
      >
        <span className="sim-historial-cat-dot" aria-hidden />
        {catLabel}
      </span>
      {hasReal && !isEditingReal && (
        <button
          type="button"
          className="sim-historial-caravanas-btn"
          onClick={onCaravanas}
          title="Vincular dispositivos de la venta"
        >
          + Dispositivos
        </button>
      )}
    </div>
  );

  const tipoBadge = (kind: "sim" | "real", pending = false) => (
    <span
      className={`sim-historial-tipo sim-historial-tipo--${kind}${pending ? " sim-historial-tipo--pending" : ""}${isEditingReal && kind === "real" ? " sim-historial-tipo--editing" : ""}`}
    >
      <span className="sim-historial-tipo-dot" aria-hidden />
      {kind === "sim" ? "Simulación" : "Venta"}
    </span>
  );

  const simMetric = (value: string, highlight = false) => (
    <td className={`num sim-historial-metric sim-historial-metric--sim${highlight ? " sim-historial-metric--hero" : ""}${isEditingReal ? " is-muted" : ""}`}>
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const idleCell = (className = "") => (
    <td className={`num sim-historial-metric sim-historial-metric--idle${className ? ` ${className}` : ""}`}>
      <span className="sim-historial-metric-val">—</span>
    </td>
  );

  const realMetric = (value: string, highlight = false) => (
    <td className={`num sim-historial-metric sim-historial-metric--real${highlight ? " sim-historial-metric--hero" : ""}`}>
      <span className="sim-historial-metric-val">{value}</span>
    </td>
  );

  const realEditPanel = (
    <td colSpan={4} className="sim-historial-real-edit-panel">
      <div className="sim-historial-real-edit-form">
        <div className="sim-historial-real-edit-field">
          <span className="sim-historial-real-edit-label">{isCabezas ? "Kg prom." : "Kg"}</span>
          {row.modo_kg === "CABEZAS" ? (
            <div className="sim-historial-real-edit-kg">
              <input
                type="number"
                min="0"
                step="0.1"
                className="sim-historial-inline-input"
                value={form.kgPromedio}
                onChange={(e) => setForm((f) => ({ ...f, kgPromedio: e.target.value }))}
                aria-label="Kg promedio real"
              />
              {totals.kgTotal != null && (
                <span className="sim-historial-real-edit-eq">= {fmtNum(totals.kgTotal, 1)} kg</span>
              )}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              step="0.1"
              className="sim-historial-inline-input sim-historial-inline-input--wide"
              value={form.kgTotalDirecto}
              onChange={(e) => setForm((f) => ({ ...f, kgTotalDirecto: e.target.value }))}
              aria-label="Kg total embarcados"
            />
          )}
        </div>

        <div className="sim-historial-real-edit-field">
          <span className="sim-historial-real-edit-label">USD/kg</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="sim-historial-inline-input sim-historial-inline-input--wide"
            value={form.precioUsdKg}
            onChange={(e) => setForm((f) => ({ ...f, precioUsdKg: e.target.value }))}
            aria-label="Precio USD/kg real"
          />
        </div>

        <div className="sim-historial-real-edit-field sim-historial-real-edit-field--result">
          <span className="sim-historial-real-edit-label">Total USD</span>
          <span className="sim-historial-real-edit-result">
            <strong className={totals.totalUsd == null ? "sim-historial-inline-idle" : ""}>
              {totals.totalUsd != null ? fmtUsd(totals.totalUsd) : "—"}
            </strong>
            {totals.totalUsd != null && (
              <span
                className={`sim-historial-delta ${deltaClass(row.total_usd, totals.totalUsd)}`}
              >
                {fmtDeltaPct(row.total_usd, totals.totalUsd)}
              </span>
            )}
          </span>
        </div>

        <div className="sim-historial-real-edit-field sim-historial-real-edit-field--result">
          <span className="sim-historial-real-edit-label">USD/cab.</span>
          <span className="sim-historial-real-edit-result">
            {totals.totalPorCabeza != null ? fmtUsd(totals.totalPorCabeza) : "—"}
          </span>
        </div>
      </div>
    </td>
  );

  const realCabezasCell = isEditingReal ? (
    isCabezas ? (
      <td className="num sim-historial-metric sim-historial-inline-cell">
        <input
          type="number"
          min="1"
          step="1"
          className="sim-historial-inline-input sim-historial-inline-input--cab"
          value={form.cantidadAnimales}
          onChange={(e) => setForm((f) => ({ ...f, cantidadAnimales: e.target.value }))}
          aria-label="Cabezas embarcadas"
        />
      </td>
    ) : (
      idleCell()
    )
  ) : hasReal ? (
    cabezasCell(isCabezas ? formatCabezas(row.real_cantidad_animales) : "—", "real")
  ) : (
    idleCell()
  );

  const realDataCells = isEditingReal ? (
    <>
      {realCabezasCell}
      {realEditPanel}
    </>
  ) : hasReal ? (
    <>
      {realCabezasCell}
      {realMetric(fmtNum(row.real_kg_total!, 1))}
      {realMetric(fmtNum(row.real_precio_usd_kg!, 2))}
      <td className="num sim-historial-metric sim-historial-metric--real sim-historial-metric--hero">
        <span className="sim-historial-metric-total">
          <strong>{fmtUsd(row.real_total_usd!)}</strong>
          <span className={`sim-historial-delta ${deltaClass(row.total_usd, row.real_total_usd!)}`}>
            {fmtDeltaPct(row.total_usd, row.real_total_usd!)}
          </span>
        </span>
      </td>
      {realMetric(
        row.real_total_usd_por_cabeza != null ? fmtUsd(row.real_total_usd_por_cabeza) : "—"
      )}
    </>
  ) : (
    <>
      {idleCell()}
      {idleCell()}
      {idleCell()}
      {idleCell("sim-historial-total-idle")}
      {idleCell()}
    </>
  );

  const simNota = row.notas?.trim() || "";
  const realNota = row.real_notas?.trim() || "";
  const hasNota = simNota.length > 0 || realNota.length > 0;
  const creadoDt = fmtDateHora(row.creado_en);

  const opMetaCell = (
    <td className="sim-historial-op-meta" rowSpan={rowSpan}>
      <div className="sim-historial-op-meta-inner">
        <div className="sim-historial-op-meta-head">
          <div className="sim-historial-op-code-row">
            <span className="sim-historial-op-code">{row.numero_operacion || "—"}</span>
            {hasNota && (
              <span className="sim-historial-op-nota-tip" tabIndex={0} aria-label="Ver notas de la operación">
                <IconInfo size={13} className="sim-historial-op-nota-icon" />
                <span className="sim-historial-op-nota-bubble" role="tooltip">
                  {simNota && realNota ? (
                    <>
                      <span className="sim-historial-op-nota-part">
                        <strong>Simulación</strong>
                        {simNota}
                      </span>
                      <span className="sim-historial-op-nota-part">
                        <strong>Venta</strong>
                        {realNota}
                      </span>
                    </>
                  ) : (
                    simNota || realNota
                  )}
                </span>
              </span>
            )}
          </div>
          {destacarBtn}
        </div>
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
        {hasReal && (
          <span className="sim-historial-op-chip sim-historial-op-chip--sold">Vendida</span>
        )}
        {!hasReal && !isEditingReal && (
          <span className="sim-historial-op-chip sim-historial-op-chip--pending">Pendiente</span>
        )}
      </div>
    </td>
  );

  const catCellTd = (
    <td className="sim-historial-cat-cell" rowSpan={rowSpan}>
      {catCell}
    </td>
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
        <span className="sim-historial-fecha-sub">Embarque {fmtDate(row.venta_realizada_en)}</span>
      )}
      {!isEditingReal && !hasReal && canWriteSimuladorVentaGanado(user) && (
        <button type="button" className="sim-historial-registrar-btn" onClick={onStartEditReal}>
          Cargar datos
        </button>
      )}
    </td>
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
          {catCellTd}
          {cabezasCell(simCabezas, "sim")}
          {simMetric(fmtNum(row.kg_total, 1))}
          {simMetric(fmtNum(row.precio_usd_kg, 2))}
          {simMetric(fmtUsd(row.total_usd), true)}
          {simMetric(row.total_usd_por_cabeza != null ? fmtUsd(row.total_usd_por_cabeza) : "—")}
          {actionsCell}
        </tr>
      )}
      <tr className={realRowClass}>
        {!showSimRow && opMetaCell}
        {realTipoCell}
        {!showSimRow && catCellTd}
        {realDataCells}
        {!showSimRow && actionsCell}
      </tr>
    </Fragment>
  );
}
