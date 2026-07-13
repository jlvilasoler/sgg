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

function toIsoTimestampClient(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
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
    pago_inicio_cobrado: toBool(row.pago_inicio_cobrado),
    pago_inicio_cobrado_en: toIsoTimestampClient(row.pago_inicio_cobrado_en),
    pago_fin_cobrado: toBool(row.pago_fin_cobrado),
    pago_fin_cobrado_en: toIsoTimestampClient(row.pago_fin_cobrado_en),
    venta_realizada_en: toIsoTimestampClient(row.venta_realizada_en),
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

/** ANUAL con dos fechas de pago distintas (pago inicial + pago final). */
export function esPagoAnualFraccionadoArrendamiento(row: VentaArrendamientoRow): boolean {
  const n = normalizeVentaArrendamientoRow(row);
  const freq = n.real_pago_frecuencia ?? n.pago_frecuencia;
  if (freq !== "ANUAL") return false;
  const ini = n.real_pago_inicio ?? n.pago_inicio;
  const fin = n.real_pago_fin ?? n.pago_fin;
  return Boolean(ini && fin && ini !== fin);
}

export function montosPagoUsdArrendamiento(row: VentaArrendamientoRow): {
  inicio: number;
  fin: number;
} {
  const n = normalizeVentaArrendamientoRow(row);
  const total = totalUsdEfectivoArrendamiento(n);
  if (!esPagoAnualFraccionadoArrendamiento(n)) {
    return { inicio: total, fin: 0 };
  }
  const tipo = n.real_pago_inicio_tipo ?? n.pago_inicio_tipo;
  const mIni = n.real_pago_inicio_monto ?? n.pago_inicio_monto;
  const mFin = n.real_pago_fin_monto ?? n.pago_fin_monto;
  if (tipo === "PORCENTAJE") {
    return {
      inicio: Math.round(((total * mIni) / 100) * 100) / 100,
      fin: Math.round(((total * mFin) / 100) * 100) / 100,
    };
  }
  return {
    inicio: Math.round(Number(mIni) * 100) / 100,
    fin: Math.round(Number(mFin) * 100) / 100,
  };
}

/** Monto aún por cobrar (incluye cerrados con pago final pendiente). */
export function importePendienteArrendamiento(row: VentaArrendamientoRow): number {
  const n = normalizeVentaArrendamientoRow(row);
  const { inicio, fin } = montosPagoUsdArrendamiento(n);
  if (!esPagoAnualFraccionadoArrendamiento(n)) {
    return n.venta_realizada ? 0 : totalUsdEfectivoArrendamiento(n);
  }
  if (n.pago_fin_cobrado) return 0;
  if (n.pago_inicio_cobrado) return fin;
  return Math.round((inicio + fin) * 100) / 100;
}

export function importeCobradoInicioArrendamiento(row: VentaArrendamientoRow): number {
  const n = normalizeVentaArrendamientoRow(row);
  if (!n.pago_inicio_cobrado) return 0;
  return montosPagoUsdArrendamiento(n).inicio;
}

export function importeCobradoFinArrendamiento(row: VentaArrendamientoRow): number {
  const n = normalizeVentaArrendamientoRow(row);
  if (!n.pago_fin_cobrado) return 0;
  if (!esPagoAnualFraccionadoArrendamiento(n)) return 0;
  return montosPagoUsdArrendamiento(n).fin;
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
