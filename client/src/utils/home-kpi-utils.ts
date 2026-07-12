import type {
  EstadoResultadosVentasDetalle,
  SimuladorVentaGanadoRow,
  VentaAgriculturaRow,
  VentaArrendamientoRow,
} from "../types";
import { normalizeSimuladorRow } from "../components/simulador-venta/simulador-venta-real-utils";
import {
  importeCobradoParcialAgricultura,
  importeEfectivoAgricultura,
  importeNetoRealAgricultura,
  importePendienteAgricultura,
  normalizeVentaAgriculturaRow,
} from "../components/ventas/ventas-agricultura-real-utils";
import {
  normalizeVentaArrendamientoRow,
  totalUsdEfectivoArrendamiento,
} from "../components/ventas/ventas-arrendamientos-real-utils";
import type { EstadoResultados } from "../types";

/** Venta cerrada dentro del rango del ejercicio (fechas ISO YYYY-MM-DD). */
export function ventaCerradaEnEjercicio(
  ventaRealizadaEn: string | null | undefined,
  desde: string,
  hasta: string,
): boolean {
  if (!ventaRealizadaEn) return false;
  const fecha = ventaRealizadaEn.slice(0, 10);
  return fecha >= desde && fecha <= hasta;
}

/** Ventas realizadas (cobradas) en el ejercicio — arrendamientos. */
export function resumenArrendamientosCobradosEjercicio(
  rows: VentaArrendamientoRow[],
  desde: string,
  hasta: string,
): { contratos: number; usd: number } {
  const cobrados = rows.filter((r) => {
    const n = normalizeVentaArrendamientoRow(r);
    return (
      n.venta_realizada &&
      ventaCerradaEnEjercicio(n.venta_realizada_en, desde, hasta)
    );
  });
  const usd = cobrados.reduce((s, r) => s + totalUsdEfectivoArrendamiento(r), 0);
  return { contratos: cobrados.length, usd };
}

/** Ventas realizadas (cobradas) en el ejercicio — agricultura (importe neto). */
export function resumenAgriculturaCobradasEjercicio(
  rows: VentaAgriculturaRow[],
  desde: string,
  hasta: string,
): { ventas: number; usd: number } {
  const cobradas = rows.filter((r) => {
    const n = normalizeVentaAgriculturaRow(r);
    return (
      n.venta_realizada &&
      ventaCerradaEnEjercicio(n.venta_realizada_en, desde, hasta)
    );
  });
  let usd = 0;
  for (const r of cobradas) {
    usd += importeNetoRealAgricultura(r) ?? importeEfectivoAgricultura(r);
  }
  for (const r of rows) {
    const n = normalizeVentaAgriculturaRow(r);
    if (n.venta_realizada) continue;
    if (!n.pago_ingreso_cobrado) continue;
    if (!ventaCerradaEnEjercicio(n.pago_ingreso_cobrado_en, desde, hasta)) continue;
    usd += importeCobradoParcialAgricultura(r);
  }
  const ventasCount =
    cobradas.length +
    rows.filter((r) => {
      const n = normalizeVentaAgriculturaRow(r);
      return (
        !n.venta_realizada &&
        n.pago_ingreso_cobrado &&
        ventaCerradaEnEjercicio(n.pago_ingreso_cobrado_en, desde, hasta)
      );
    }).length;
  return { ventas: ventasCount, usd: Math.round(usd * 100) / 100 };
}

/** Cabezas asociadas a una simulación (pendiente o cerrada). */
export function animalesSimulacionGanado(row: SimuladorVentaGanadoRow): number {
  const r = normalizeSimuladorRow(row);
  if (
    r.venta_realizada &&
    r.real_cantidad_animales != null &&
    r.real_cantidad_animales > 0
  ) {
    return Math.round(r.real_cantidad_animales);
  }
  if (r.dispositivos_count > 0) return r.dispositivos_count;
  return Math.round(r.cantidad_animales ?? 0);
}

/** Ventas realizadas (cobradas) en el ejercicio — ganado. */
export function resumenGanadoCobradoEjercicio(
  rows: SimuladorVentaGanadoRow[],
  desde: string,
  hasta: string,
): { operaciones: number; animales: number; usd: number } {
  const cobrados = rows.filter((r) => {
    const n = normalizeSimuladorRow(r);
    return (
      n.venta_realizada &&
      n.real_total_usd != null &&
      ventaCerradaEnEjercicio(n.venta_realizada_en, desde, hasta)
    );
  });
  let usd = 0;
  let animales = 0;
  for (const raw of cobrados) {
    const n = normalizeSimuladorRow(raw);
    usd += Number(n.real_total_usd) || 0;
    animales += animalesSimulacionGanado(raw);
  }
  return { operaciones: cobrados.length, animales, usd };
}

/** Detalle de ventas cobradas en el ejercicio a partir de filas de módulos. */
export function ventasDetalleCobradasEjercicio(
  arrendRows: VentaArrendamientoRow[] | null,
  agricRows: VentaAgriculturaRow[] | null,
  simRows: SimuladorVentaGanadoRow[] | null,
  desde: string,
  hasta: string,
): EstadoResultadosVentasDetalle {
  const arrend = arrendRows
    ? resumenArrendamientosCobradosEjercicio(arrendRows, desde, hasta)
    : { contratos: 0, usd: 0 };
  const agric = agricRows
    ? resumenAgriculturaCobradasEjercicio(agricRows, desde, hasta)
    : { ventas: 0, usd: 0 };
  const ganado = simRows
    ? resumenGanadoCobradoEjercicio(simRows, desde, hasta)
    : { operaciones: 0, usd: 0 };
  return {
    arrendamientos: Math.round(arrend.usd * 100) / 100,
    agricultura: Math.round(agric.usd * 100) / 100,
    ganado: Math.round(ganado.usd * 100) / 100,
  };
}

/** Prioriza detalle calculado desde módulos; si no hay filas, usa estado de resultados. */
export function mergeVentasDetalleEjercicio(
  erDetalle: EstadoResultadosVentasDetalle | undefined,
  desdeFilas: EstadoResultadosVentasDetalle | null,
): EstadoResultadosVentasDetalle {
  if (desdeFilas) return desdeFilas;
  return erDetalle ?? { ganado: 0, agricultura: 0, arrendamientos: 0 };
}

function formatUsdCompact(n: number): string {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Gastos totales del estado de resultados (costos + administrativos + comerciales). */
export function totalGastosEstadoResultados(er: Pick<
  EstadoResultados,
  "costos_produccion" | "gastos_administrativos" | "gastos_comerciales"
>): number {
  return (
    Number(er.costos_produccion) +
    Number(er.gastos_administrativos) +
    Number(er.gastos_comerciales)
  );
}

/** Margen neto sobre ventas (%). */
export function margenNetoPct(ventas: number, utilidad: number): number {
  if (ventas <= 0.5) return 0;
  return Math.round((utilidad / ventas) * 100);
}

/** Costo por cabeza: gastos del ejercicio ÷ stock activo. */
export function costoCabezaEjercicio(gastosEjercicio: number, activos: number): number {
  if (activos <= 0 || gastosEjercicio <= 0) return 0;
  return Math.round((gastosEjercicio / activos) * 100) / 100;
}

/** Pie de KPI: desglose ganado + agricultura + arrendamientos (ventas realizadas). */
export function hintVentasEjercicio(
  detalle: EstadoResultadosVentasDetalle,
  ejercicioLabel: string,
): string {
  const partes: string[] = [];
  if (detalle.ganado > 0.5) partes.push(`Ganado ${formatUsdCompact(detalle.ganado)}`);
  if (detalle.agricultura > 0.5) partes.push(`Agric. ${formatUsdCompact(detalle.agricultura)}`);
  if (detalle.arrendamientos > 0.5) {
    partes.push(`Arrend. ${formatUsdCompact(detalle.arrendamientos)}`);
  }
  if (partes.length === 0) return `${ejercicioLabel} · sin ventas realizadas`;
  return `${ejercicioLabel} · ${partes.join(" + ")}`;
}

/** Simulaciones de venta de ganado aún no cerradas (misma regla que el simulador). */
export function resumenGanadoPorVender(rows: SimuladorVentaGanadoRow[]): {
  operaciones: number;
  animales: number;
  usd: number;
} {
  const pendientes = rows.filter((r) => !normalizeSimuladorRow(r).venta_realizada);
  let animales = 0;
  let usd = 0;
  for (const raw of pendientes) {
    animales += animalesSimulacionGanado(raw);
    usd += Number(normalizeSimuladorRow(raw).total_usd) || 0;
  }
  return { operaciones: pendientes.length, animales, usd };
}

/** Operaciones de venta abiertas creadas en el ejercicio vigente. */
export function resumenGanadoPorVenderEjercicio(
  rows: SimuladorVentaGanadoRow[],
  desdeEjercicio: string,
): { operaciones: number; usd: number } {
  const pendientes = rows.filter((r) => {
    const n = normalizeSimuladorRow(r);
    if (n.venta_realizada) return false;
    const cre = (n.creado_en ?? "").slice(0, 10);
    return cre >= desdeEjercicio;
  });
  let usd = 0;
  for (const raw of pendientes) {
    usd += Number(normalizeSimuladorRow(raw).total_usd) || 0;
  }
  return { operaciones: pendientes.length, usd };
}

/** Contratos de arrendamiento pendientes de cobro. */
export function resumenArrendamientosPorRecibir(rows: VentaArrendamientoRow[]): {
  contratos: number;
  usd: number;
} {
  const pendientes = rows.filter((r) => !normalizeVentaArrendamientoRow(r).venta_realizada);
  const usd = pendientes.reduce((s, r) => s + totalUsdEfectivoArrendamiento(r), 0);
  return { contratos: pendientes.length, usd };
}

/** Ventas agrícolas pendientes de cobro. */
export function resumenAgriculturaPorRecibir(rows: VentaAgriculturaRow[]): {
  ventas: number;
  usd: number;
} {
  const pendientes = rows.filter((r) => !normalizeVentaAgriculturaRow(r).venta_realizada);
  const usd = pendientes.reduce((s, r) => s + importePendienteAgricultura(r), 0);
  return { ventas: pendientes.length, usd };
}
