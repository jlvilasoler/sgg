import type { VentaArrendamientoRealInput, VentaArrendamientoRow } from "../../types";
import {
  calcularTotalArrendamiento,
  normalizeIsoDateArrendamiento,
  parsePositiveDecimal,
} from "./ventas-arrendamientos-utils";
import {
  deltaClass,
  fmtDeltaPct,
  fmtUsd,
} from "../simulador-venta/simulador-venta-real-utils";

export { deltaClass, fmtDeltaPct, fmtUsd };

function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "t";
  }
  return Boolean(value);
}

export function normalizeVentaArrendamientoRow(row: VentaArrendamientoRow): VentaArrendamientoRow {
  return {
    ...row,
    fecha_inicio: normalizeIsoDateArrendamiento(row.fecha_inicio),
    fecha_fin: normalizeIsoDateArrendamiento(row.fecha_fin),
    pago_inicio: normalizeIsoDateArrendamiento(row.pago_inicio),
    pago_fin: normalizeIsoDateArrendamiento(row.pago_fin),
    venta_realizada: toBool(row.venta_realizada),
    destacada: toBool(row.destacada),
    real_fecha_inicio:
      row.real_fecha_inicio != null
        ? normalizeIsoDateArrendamiento(row.real_fecha_inicio)
        : null,
    real_fecha_fin:
      row.real_fecha_fin != null ? normalizeIsoDateArrendamiento(row.real_fecha_fin) : null,
    real_pago_inicio:
      row.real_pago_inicio != null
        ? normalizeIsoDateArrendamiento(row.real_pago_inicio)
        : null,
    real_pago_fin:
      row.real_pago_fin != null ? normalizeIsoDateArrendamiento(row.real_pago_fin) : null,
    real_total_usd:
      row.real_total_usd != null && Number.isFinite(Number(row.real_total_usd))
        ? Number(row.real_total_usd)
        : null,
  };
}

export function arrendamientoHasVentaReal(row: VentaArrendamientoRow): boolean {
  const n = normalizeVentaArrendamientoRow(row);
  return n.venta_realizada && n.real_total_usd != null;
}

export function totalUsdEfectivoArrendamiento(row: VentaArrendamientoRow): number {
  if (arrendamientoHasVentaReal(row) && row.real_total_usd != null) {
    return row.real_total_usd;
  }
  return row.total_usd;
}

export function hectareasEfectivasArrendamiento(row: VentaArrendamientoRow): number {
  if (arrendamientoHasVentaReal(row) && row.real_hectareas != null) {
    return row.real_hectareas;
  }
  return row.hectareas;
}

export interface ArrendamientoRealFormState {
  fechaInicio: string;
  fechaFin: string;
  hectareas: string;
  precioUsdHa: string;
  notas: string;
}

export function rowToArrendamientoRealForm(
  row: VentaArrendamientoRow,
  useReal: boolean
): ArrendamientoRealFormState {
  const src = useReal && row.real_total_usd != null;
  return {
    fechaInicio: src
      ? normalizeIsoDateArrendamiento(row.real_fecha_inicio ?? row.fecha_inicio)
      : normalizeIsoDateArrendamiento(row.fecha_inicio),
    fechaFin: src
      ? normalizeIsoDateArrendamiento(row.real_fecha_fin ?? row.fecha_fin)
      : normalizeIsoDateArrendamiento(row.fecha_fin),
    hectareas: String(src ? (row.real_hectareas ?? row.hectareas) : row.hectareas),
    precioUsdHa: String(
      src ? (row.real_precio_usd_ha ?? row.precio_usd_ha) : row.precio_usd_ha
    ),
    notas: src ? (row.real_notas ?? "") : "",
  };
}

export function computeArrendamientoRealTotals(form: ArrendamientoRealFormState): {
  hectareas: number | null;
  precioUsdHa: number | null;
  totalUsd: number | null;
} {
  const hectareas = parsePositiveDecimal(form.hectareas);
  const precioUsdHa = parsePositiveDecimal(form.precioUsdHa);
  const fechaInicio = normalizeIsoDateArrendamiento(form.fechaInicio);
  const fechaFin = normalizeIsoDateArrendamiento(form.fechaFin);
  const totalUsd = calcularTotalArrendamiento(
    hectareas,
    precioUsdHa,
    fechaInicio,
    fechaFin,
    "MANUAL"
  );
  return { hectareas, precioUsdHa, totalUsd };
}

export function buildArrendamientoRealPayload(
  row: VentaArrendamientoRow,
  form: ArrendamientoRealFormState
): VentaArrendamientoRealInput | null {
  const fechaInicio = normalizeIsoDateArrendamiento(form.fechaInicio);
  const fechaFin = normalizeIsoDateArrendamiento(form.fechaFin);
  if (!fechaInicio || !fechaFin || fechaFin < fechaInicio) return null;

  const { hectareas, precioUsdHa, totalUsd } = computeArrendamientoRealTotals(form);
  if (hectareas == null || precioUsdHa == null || totalUsd == null) return null;

  const useRealPago = row.real_total_usd != null;
  const pagoFrecuencia = useRealPago
    ? (row.real_pago_frecuencia ?? row.pago_frecuencia)
    : row.pago_frecuencia;
  const pagoInicio = normalizeIsoDateArrendamiento(
    useRealPago ? (row.real_pago_inicio ?? row.pago_inicio) : row.pago_inicio
  );
  const pagoFin = normalizeIsoDateArrendamiento(
    useRealPago ? (row.real_pago_fin ?? row.pago_fin) : row.pago_fin
  );

  return {
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    hectareas,
    precio_usd_ha: precioUsdHa,
    total_usd: totalUsd,
    notas: form.notas.trim() || null,
    pago_frecuencia: pagoFrecuencia,
    pago_inicio: pagoInicio || fechaInicio,
    pago_fin: pagoFin || fechaFin,
    pago_inicio_monto: useRealPago
      ? (row.real_pago_inicio_monto ?? row.pago_inicio_monto)
      : row.pago_inicio_monto,
    pago_inicio_tipo: useRealPago
      ? (row.real_pago_inicio_tipo ?? row.pago_inicio_tipo)
      : row.pago_inicio_tipo,
    pago_fin_monto: useRealPago
      ? (row.real_pago_fin_monto ?? row.pago_fin_monto)
      : row.pago_fin_monto,
    pago_fin_tipo: useRealPago
      ? (row.real_pago_fin_tipo ?? row.pago_fin_tipo)
      : row.pago_fin_tipo,
  };
}

export function sortHistorialArrendamiento(
  rows: VentaArrendamientoRow[]
): VentaArrendamientoRow[] {
  return [...rows].sort((a, b) => {
    const na = normalizeVentaArrendamientoRow(a);
    const nb = normalizeVentaArrendamientoRow(b);
    if (na.destacada !== nb.destacada) return na.destacada ? -1 : 1;
    const aReal = arrendamientoHasVentaReal(na);
    const bReal = arrendamientoHasVentaReal(nb);
    if (aReal !== bReal) return aReal ? 1 : -1;
    return new Date(nb.creado_en).getTime() - new Date(na.creado_en).getTime();
  });
}
