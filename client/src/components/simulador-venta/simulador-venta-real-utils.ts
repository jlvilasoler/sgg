import type { SimuladorVentaGanadoRow, SimuladorVentaRealInput } from "../../types";

function toBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "t";
  }
  return Boolean(value);
}

function toNumOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeSimuladorRow(row: SimuladorVentaGanadoRow): SimuladorVentaGanadoRow {
  const ventaRealizada = toBool(row.venta_realizada);
  const realTotalUsd = toNumOrNull(row.real_total_usd);

  return {
    ...row,
    id: Number(row.id),
    precio_usd_kg: Number(row.precio_usd_kg),
    precio_ref_anio: toNumOrNull(row.precio_ref_anio),
    precio_ref_semana: toNumOrNull(row.precio_ref_semana),
    cantidad_animales: toNumOrNull(row.cantidad_animales),
    kg_promedio: toNumOrNull(row.kg_promedio),
    kg_total: Number(row.kg_total),
    total_usd: Number(row.total_usd),
    total_usd_por_cabeza: toNumOrNull(row.total_usd_por_cabeza),
    destacada: toBool(row.destacada),
    venta_realizada: ventaRealizada,
    venta_realizada_en: row.venta_realizada_en,
    real_precio_usd_kg: toNumOrNull(row.real_precio_usd_kg),
    real_cantidad_animales: toNumOrNull(row.real_cantidad_animales),
    real_kg_promedio: toNumOrNull(row.real_kg_promedio),
    real_kg_total: toNumOrNull(row.real_kg_total),
    real_total_usd: realTotalUsd,
    real_total_usd_por_cabeza: toNumOrNull(row.real_total_usd_por_cabeza),
    real_notas: row.real_notas,
    usuario_id: row.usuario_id != null ? Number(row.usuario_id) : null,
    dispositivos_count: Number(row.dispositivos_count ?? 0),
  };
}

export function simuladorHasVentaReal(row: SimuladorVentaGanadoRow): boolean {
  const normalized = normalizeSimuladorRow(row);
  return normalized.venta_realizada && normalized.real_total_usd != null;
}

export function parsePositive(value: string): number | null {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function fmtUsd(value: number): string {
  return value.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDeltaPct(sim: number, real: number): string {
  if (sim === 0) return "—";
  const pct = ((real - sim) / sim) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toLocaleString("es-UY", { maximumFractionDigits: 1 })}%`;
}

export function deltaClass(sim: number, real: number): string {
  const d = real - sim;
  if (Math.abs(d) < 0.005) return "sim-historial-delta--neutral";
  return d > 0 ? "sim-historial-delta--up" : "sim-historial-delta--down";
}

export interface RealFormState {
  precioUsdKg: string;
  cantidadAnimales: string;
  kgPromedio: string;
  kgTotalDirecto: string;
}

export function rowToRealForm(row: SimuladorVentaGanadoRow, useReal: boolean): RealFormState {
  const src = useReal && row.real_total_usd != null;
  return {
    precioUsdKg: String(src ? row.real_precio_usd_kg : row.precio_usd_kg),
    cantidadAnimales:
      row.modo_kg === "CABEZAS"
        ? String(
            src
              ? (row.real_cantidad_animales ?? row.cantidad_animales ?? "")
              : (row.cantidad_animales ?? "")
          )
        : "",
    kgPromedio:
      row.modo_kg === "CABEZAS"
        ? String(
            src ? (row.real_kg_promedio ?? row.kg_promedio ?? "") : (row.kg_promedio ?? "")
          )
        : "",
    kgTotalDirecto:
      row.modo_kg === "TOTAL"
        ? String(src ? (row.real_kg_total ?? row.kg_total) : row.kg_total)
        : "",
  };
}

export function computeRealTotals(
  row: SimuladorVentaGanadoRow,
  form: RealFormState
): {
  kgTotal: number | null;
  precioNum: number | null;
  totalUsd: number | null;
  totalPorCabeza: number | null;
  cabezasNum: number | null;
} {
  const precioNum = parsePositive(form.precioUsdKg);
  const cabezasNum = parsePositive(form.cantidadAnimales);
  const kgProm = parsePositive(form.kgPromedio);

  let kgTotal: number | null = null;
  if (row.modo_kg === "TOTAL") {
    kgTotal = parsePositive(form.kgTotalDirecto);
  } else if (cabezasNum != null && kgProm != null) {
    kgTotal = cabezasNum * kgProm;
  }

  const totalUsd = precioNum != null && kgTotal != null ? precioNum * kgTotal : null;
  const totalPorCabeza =
    totalUsd != null && row.modo_kg === "CABEZAS" && cabezasNum != null
      ? totalUsd / cabezasNum
      : null;

  return { kgTotal, precioNum, totalUsd, totalPorCabeza, cabezasNum };
}

export function buildRealPayload(
  row: SimuladorVentaGanadoRow,
  form: RealFormState
): SimuladorVentaRealInput | null {
  const { kgTotal, precioNum, totalUsd, totalPorCabeza, cabezasNum } = computeRealTotals(row, form);
  if (precioNum == null || kgTotal == null || totalUsd == null) return null;

  return {
    precio_usd_kg: precioNum,
    cantidad_animales: row.modo_kg === "CABEZAS" ? cabezasNum : null,
    kg_promedio: row.modo_kg === "CABEZAS" ? parsePositive(form.kgPromedio) : null,
    kg_total: kgTotal,
    total_usd: totalUsd,
    total_usd_por_cabeza: totalPorCabeza,
    notas: null,
  };
}
