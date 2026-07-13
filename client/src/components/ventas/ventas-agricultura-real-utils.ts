import type { VentaAgriculturaRealInput, VentaAgriculturaRow } from "../../types";
import {
  calcularImporteAgricultura,
  calcularImporteBrutoAgricultura,
  calcularImporteNetoAgricultura,
  calcularTotalProduccionAgricultura,
  encodeMesAnioAgricultura,
  pagosNetosSimulacionAgricultura,
  parsePositiveDecimal,
  type FormaPagoAgricultura,
} from "./ventas-agricultura-utils";
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
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? s : d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeVentaAgriculturaRow(row: VentaAgriculturaRow): VentaAgriculturaRow {
  return {
    ...row,
    costo_impuestos_usd: Number(row.costo_impuestos_usd ?? 0),
    costo_flete_usd: Number(row.costo_flete_usd ?? 0),
    precio_ingreso_usd_ton: Number(row.precio_ingreso_usd_ton ?? row.precio_usd_ton ?? 0),
    forma_pago_agricultura:
      row.forma_pago_agricultura === "AL_FINAL" ? "AL_FINAL" : "FRACCIONADO",
    pago_ingreso_cobrado: toBool(row.pago_ingreso_cobrado),
    pago_ingreso_cobrado_en: toIsoTimestampClient(row.pago_ingreso_cobrado_en),
    pago_saldo_cobrado: toBool(row.pago_saldo_cobrado),
    pago_saldo_cobrado_en: toIsoTimestampClient(row.pago_saldo_cobrado_en),
    venta_realizada: toBool(row.venta_realizada),
    venta_realizada_en: toIsoTimestampClient(row.venta_realizada_en),
    destacada: toBool(row.destacada),
    real_importe_usd:
      row.real_importe_usd != null && Number.isFinite(Number(row.real_importe_usd))
        ? Number(row.real_importe_usd)
        : null,
  };
}

export function agriculturaHasVentaReal(row: VentaAgriculturaRow): boolean {
  const n = normalizeVentaAgriculturaRow(row);
  return n.venta_realizada && n.real_importe_usd != null;
}

function importeBrutoFromMetrics(
  hectareas: number,
  rendimiento: number,
  precioVenta: number,
  precioIngreso: number,
  formaPago: FormaPagoAgricultura,
): number {
  const totalKg = calcularTotalProduccionAgricultura(hectareas, rendimiento);
  return (
    calcularImporteBrutoAgricultura(totalKg, precioIngreso, precioVenta, formaPago) ?? 0
  );
}

/** Importe bruto (antes de impuestos y flete) según datos reales o simulados. */
export function importeBrutoEfectivoAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  if (
    agriculturaHasVentaReal(row) &&
    n.real_hectareas != null &&
    n.real_rendimiento_ton_ha != null &&
    n.real_precio_usd_ton != null
  ) {
    return importeBrutoFromMetrics(
      n.real_hectareas,
      n.real_rendimiento_ton_ha,
      n.real_precio_usd_ton,
      n.precio_ingreso_usd_ton,
      n.forma_pago_agricultura,
    );
  }
  return importeBrutoFromMetrics(
    n.hectareas,
    n.rendimiento_ton_ha,
    n.precio_usd_ton,
    n.precio_ingreso_usd_ton,
    n.forma_pago_agricultura,
  );
}

/** Importe neto de la simulación (siempre con datos simulados). */
export function importeNetoSimulacionAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  return pagosNetosSimulacionAgricultura(n).totalNeto;
}

/** Pago 1 (40%) neto de la simulación. */
export function importePago1NetoAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  return pagosNetosSimulacionAgricultura(n).pago1Neto;
}

/** Pago 2 (60%) neto pendiente de la simulación. */
export function importePago2NetoAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  return pagosNetosSimulacionAgricultura(n).pago2Neto;
}

/** Pagos netos según datos reales (si hay venta cerrada) o simulación. */
export function pagosNetosEfectivosAgricultura(row: VentaAgriculturaRow): {
  pago1Neto: number;
  pago2Neto: number;
  totalNeto: number;
} {
  const n = normalizeVentaAgriculturaRow(row);
  if (
    agriculturaHasVentaReal(row) &&
    n.real_hectareas != null &&
    n.real_rendimiento_ton_ha != null &&
    n.real_precio_usd_ton != null
  ) {
    const totalKg = calcularTotalProduccionAgricultura(
      n.real_hectareas,
      n.real_rendimiento_ton_ha,
    );
    const bruto =
      calcularImporteBrutoAgricultura(
        totalKg,
        n.precio_ingreso_usd_ton,
        n.real_precio_usd_ton,
        n.forma_pago_agricultura,
      ) ?? 0;
    const totalNeto =
      calcularImporteNetoAgricultura(bruto, n.costo_impuestos_usd, n.costo_flete_usd) ??
      n.real_importe_usd ??
      0;
    if (n.forma_pago_agricultura !== "FRACCIONADO") {
      return { pago1Neto: totalNeto, pago2Neto: 0, totalNeto };
    }
    const sim = pagosNetosSimulacionAgricultura({
      ...n,
      hectareas: n.real_hectareas,
      rendimiento_ton_ha: n.real_rendimiento_ton_ha,
      precio_usd_ton: n.real_precio_usd_ton,
    });
    return sim;
  }
  return pagosNetosSimulacionAgricultura(n);
}

/** Monto aún por cobrar (cuota 1 y/o cuota 2), aunque la venta ya esté cerrada. */
export function importePendienteAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  if (n.forma_pago_agricultura !== "FRACCIONADO") {
    return n.venta_realizada ? 0 : importeNetoSimulacionAgricultura(row);
  }
  const { pago1Neto, pago2Neto } = pagosNetosEfectivosAgricultura(row);
  if (n.pago_saldo_cobrado) return 0;
  if (n.pago_ingreso_cobrado) return pago2Neto;
  return pago1Neto + pago2Neto;
}

/** Monto ya cobrado de cuota 1 (40%) si aplica. */
export function importeCobradoParcialAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  if (n.forma_pago_agricultura !== "FRACCIONADO" || !n.pago_ingreso_cobrado) return 0;
  return pagosNetosEfectivosAgricultura(row).pago1Neto;
}

/** Monto cobrado de cuota 2 (60%) si aplica. */
export function importeCobradoSaldoAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  if (n.forma_pago_agricultura !== "FRACCIONADO" || !n.pago_saldo_cobrado) return 0;
  return pagosNetosEfectivosAgricultura(row).pago2Neto;
}

/** Total cobrado a la fecha (cuotas pagadas o venta AL_FINAL cerrada). */
export function importeCobradoAgricultura(row: VentaAgriculturaRow): number {
  const n = normalizeVentaAgriculturaRow(row);
  if (n.forma_pago_agricultura !== "FRACCIONADO") {
    return n.venta_realizada ? (importeNetoRealAgricultura(row) ?? importeEfectivoAgricultura(row)) : 0;
  }
  return (
    importeCobradoParcialAgricultura(row) + importeCobradoSaldoAgricultura(row)
  );
}

/** Importe neto de la venta cerrada (datos reales − costos de la simulación). */
export function importeNetoRealAgricultura(row: VentaAgriculturaRow): number | null {
  if (!agriculturaHasVentaReal(row)) return null;
  const n = normalizeVentaAgriculturaRow(row);
  if (
    n.real_hectareas == null ||
    n.real_rendimiento_ton_ha == null ||
    n.real_precio_usd_ton == null
  ) {
    return n.real_importe_usd;
  }
  const bruto = importeBrutoFromMetrics(
    n.real_hectareas,
    n.real_rendimiento_ton_ha,
    n.real_precio_usd_ton,
    n.precio_ingreso_usd_ton,
    n.forma_pago_agricultura,
  );
  return (
    calcularImporteNetoAgricultura(bruto, n.costo_impuestos_usd, n.costo_flete_usd) ??
    n.real_importe_usd
  );
}

/** Monto efectivo para listados, totales y KPIs (siempre neto). */
export function importeEfectivoAgricultura(row: VentaAgriculturaRow): number {
  return importeNetoRealAgricultura(row) ?? importeNetoSimulacionAgricultura(row);
}

export function tonEfectivaAgricultura(row: VentaAgriculturaRow): number {
  if (agriculturaHasVentaReal(row) && row.real_total_ton != null) {
    return row.real_total_ton;
  }
  return row.total_ton;
}

export interface AgriculturaRealFormState {
  zafraInicio: string;
  zafraFin: string;
  hectareas: string;
  rendimiento: string;
  precio: string;
  notas: string;
}

export function rowToAgriculturaRealForm(
  row: VentaAgriculturaRow,
  useReal: boolean
): AgriculturaRealFormState {
  const src = useReal && row.real_importe_usd != null;
  return {
    zafraInicio: encodeMesAnioAgricultura(
      src ? (row.real_anio_inicio ?? row.anio_inicio) : row.anio_inicio,
      src ? (row.real_mes_inicio ?? row.mes_inicio) : row.mes_inicio
    ),
    zafraFin: encodeMesAnioAgricultura(
      src ? (row.real_anio_fin ?? row.anio_fin) : row.anio_fin,
      src ? (row.real_mes_fin ?? row.mes_fin) : row.mes_fin
    ),
    hectareas: String(src ? (row.real_hectareas ?? row.hectareas) : row.hectareas),
    rendimiento: String(
      src ? (row.real_rendimiento_ton_ha ?? row.rendimiento_ton_ha) : row.rendimiento_ton_ha
    ),
    precio: String(src ? (row.real_precio_usd_ton ?? row.precio_usd_ton) : row.precio_usd_ton),
    notas: src ? (row.real_notas ?? "") : "",
  };
}

export function computeAgriculturaRealTotals(
  form: AgriculturaRealFormState,
  costos?: { impuestos: number; flete: number },
): {
  hectareas: number | null;
  rendimiento: number | null;
  precio: number | null;
  totalTon: number | null;
  importeBrutoUsd: number | null;
  importeNetoUsd: number | null;
} {
  const hectareas = parsePositiveDecimal(form.hectareas);
  const rendimiento = parsePositiveDecimal(form.rendimiento);
  const precio = parsePositiveDecimal(form.precio);
  const totalTon = calcularTotalProduccionAgricultura(hectareas, rendimiento);
  const importeBrutoUsd = calcularImporteAgricultura(totalTon, precio);
  const importeNetoUsd = calcularImporteNetoAgricultura(
    importeBrutoUsd,
    costos?.impuestos ?? 0,
    costos?.flete ?? 0,
  );
  return {
    hectareas,
    rendimiento,
    precio,
    totalTon,
    importeBrutoUsd,
    importeNetoUsd,
  };
}

export function buildAgriculturaRealPayload(
  form: AgriculturaRealFormState,
  parseMesAnio: (v: string) => { mes: number; anio: number } | null,
  costos?: { impuestos: number; flete: number },
): VentaAgriculturaRealInput | null {
  const ini = parseMesAnio(form.zafraInicio);
  const fin = parseMesAnio(form.zafraFin);
  const { hectareas, rendimiento, precio, totalTon, importeNetoUsd } =
    computeAgriculturaRealTotals(form, costos);
  if (!ini || !fin || hectareas == null || rendimiento == null || precio == null) return null;
  if (totalTon == null || importeNetoUsd == null) return null;
  if (fin.anio * 12 + fin.mes < ini.anio * 12 + ini.mes) return null;

  return {
    mes_inicio: ini.mes,
    mes_fin: fin.mes,
    anio_inicio: ini.anio,
    anio_fin: fin.anio,
    hectareas,
    rendimiento_ton_ha: rendimiento,
    precio_usd_ton: precio,
    total_ton: totalTon,
    importe_usd: importeNetoUsd,
    notas: form.notas.trim() || null,
  };
}
