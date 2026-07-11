import type { VentaAgriculturaRealInput, VentaAgriculturaRow } from "../../types";
import {
  calcularImporteAgricultura,
  calcularTotalProduccionAgricultura,
  encodeMesAnioAgricultura,
  parsePositiveDecimal,
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

export function normalizeVentaAgriculturaRow(row: VentaAgriculturaRow): VentaAgriculturaRow {
  return {
    ...row,
    costo_impuestos_usd: Number(row.costo_impuestos_usd ?? 0),
    costo_flete_usd: Number(row.costo_flete_usd ?? 0),
    venta_realizada: toBool(row.venta_realizada),
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

export function importeEfectivoAgricultura(row: VentaAgriculturaRow): number {
  if (agriculturaHasVentaReal(row) && row.real_importe_usd != null) {
    return row.real_importe_usd;
  }
  return row.importe_usd;
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

export function computeAgriculturaRealTotals(form: AgriculturaRealFormState): {
  hectareas: number | null;
  rendimiento: number | null;
  precio: number | null;
  totalTon: number | null;
  importeUsd: number | null;
} {
  const hectareas = parsePositiveDecimal(form.hectareas);
  const rendimiento = parsePositiveDecimal(form.rendimiento);
  const precio = parsePositiveDecimal(form.precio);
  const totalTon = calcularTotalProduccionAgricultura(hectareas, rendimiento);
  const importeUsd = calcularImporteAgricultura(totalTon, precio);
  return { hectareas, rendimiento, precio, totalTon, importeUsd };
}

export function buildAgriculturaRealPayload(
  form: AgriculturaRealFormState,
  parseMesAnio: (v: string) => { mes: number; anio: number } | null
): VentaAgriculturaRealInput | null {
  const ini = parseMesAnio(form.zafraInicio);
  const fin = parseMesAnio(form.zafraFin);
  const { hectareas, rendimiento, precio, totalTon, importeUsd } =
    computeAgriculturaRealTotals(form);
  if (!ini || !fin || hectareas == null || rendimiento == null || precio == null) return null;
  if (totalTon == null || importeUsd == null) return null;
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
    importe_usd: importeUsd,
    notas: form.notas.trim() || null,
  };
}
