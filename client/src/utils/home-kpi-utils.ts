import type {
  EstadoResultadosVentasDetalle,
  SimuladorVentaGanadoRow,
  VentaAgriculturaRow,
  VentaArrendamientoRow,
} from "../types";
import { normalizeSimuladorRow } from "../components/simulador-venta/simulador-venta-real-utils";
import {
  importeCobradoParcialAgricultura,
  importeCobradoSaldoAgricultura,
  importeEfectivoAgricultura,
  importeNetoRealAgricultura,
  importePendienteAgricultura,
  normalizeVentaAgriculturaRow,
} from "../components/ventas/ventas-agricultura-real-utils";
import {
  esPagoAnualFraccionadoArrendamiento,
  importeCobradoFinArrendamiento,
  importeCobradoInicioArrendamiento,
  importePendienteArrendamiento,
  normalizeVentaArrendamientoRow,
  totalUsdEfectivoArrendamiento,
} from "../components/ventas/ventas-arrendamientos-real-utils";
import type { EstadoResultados } from "../types";

/**
 * Normaliza cualquier timestamp (ISO, Date o texto de JS) a YYYY-MM-DD
 * para comparar contra el rango del ejercicio.
 */
export function toFechaIsoDia(value: string | null | undefined): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Cobro / cierre dentro del rango del ejercicio (fechas ISO YYYY-MM-DD). */
export function ventaCerradaEnEjercicio(
  ventaRealizadaEn: string | null | undefined,
  desde: string,
  hasta: string,
): boolean {
  const fecha = toFechaIsoDia(ventaRealizadaEn);
  if (!fecha) return false;
  return fecha >= desde && fecha <= hasta;
}

/** Ventas realizadas (cobradas) en el ejercicio — arrendamientos (por cuota). */
export function resumenArrendamientosCobradosEjercicio(
  rows: VentaArrendamientoRow[],
  desde: string,
  hasta: string,
): { contratos: number; usd: number } {
  let usd = 0;
  const idsConCobro = new Set<number>();

  for (const r of rows) {
    const n = normalizeVentaArrendamientoRow(r);

    if (!esPagoAnualFraccionadoArrendamiento(n)) {
      if (
        n.venta_realizada &&
        ventaCerradaEnEjercicio(n.venta_realizada_en, desde, hasta)
      ) {
        usd += totalUsdEfectivoArrendamiento(r);
        idsConCobro.add(n.id);
      }
      continue;
    }

    if (
      n.pago_inicio_cobrado &&
      ventaCerradaEnEjercicio(n.pago_inicio_cobrado_en, desde, hasta)
    ) {
      usd += importeCobradoInicioArrendamiento(r);
      idsConCobro.add(n.id);
    }
    if (
      n.pago_fin_cobrado &&
      ventaCerradaEnEjercicio(n.pago_fin_cobrado_en, desde, hasta)
    ) {
      usd += importeCobradoFinArrendamiento(r);
      idsConCobro.add(n.id);
    }
  }

  return { contratos: idsConCobro.size, usd: Math.round(usd * 100) / 100 };
}

/** Ventas realizadas (cobradas) en el ejercicio — agricultura (importe neto por cuota). */
export function resumenAgriculturaCobradasEjercicio(
  rows: VentaAgriculturaRow[],
  desde: string,
  hasta: string,
): { ventas: number; usd: number } {
  let usd = 0;
  const idsConCobro = new Set<number>();

  for (const r of rows) {
    const n = normalizeVentaAgriculturaRow(r);

    if (n.forma_pago_agricultura !== "FRACCIONADO") {
      if (
        n.venta_realizada &&
        ventaCerradaEnEjercicio(n.venta_realizada_en, desde, hasta)
      ) {
        usd += importeNetoRealAgricultura(r) ?? importeEfectivoAgricultura(r);
        idsConCobro.add(n.id);
      }
      continue;
    }

    if (
      n.pago_ingreso_cobrado &&
      ventaCerradaEnEjercicio(n.pago_ingreso_cobrado_en, desde, hasta)
    ) {
      usd += importeCobradoParcialAgricultura(r);
      idsConCobro.add(n.id);
    }
    if (
      n.pago_saldo_cobrado &&
      ventaCerradaEnEjercicio(n.pago_saldo_cobrado_en, desde, hasta)
    ) {
      usd += importeCobradoSaldoAgricultura(r);
      idsConCobro.add(n.id);
    }
  }

  return { ventas: idsConCobro.size, usd: Math.round(usd * 100) / 100 };
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

/** Prioriza el mayor valor por rubro entre módulos y estado de resultados (red de seguridad). */
export function mergeVentasDetalleEjercicio(
  erDetalle: EstadoResultadosVentasDetalle | undefined,
  desdeFilas: EstadoResultadosVentasDetalle | null,
): EstadoResultadosVentasDetalle {
  const er = erDetalle ?? { ganado: 0, agricultura: 0, arrendamientos: 0 };
  if (!desdeFilas) return er;
  return {
    ganado: Math.max(Number(desdeFilas.ganado) || 0, Number(er.ganado) || 0),
    // Filas de módulos calculan cuota 1/2 exactas; ER es respaldo aproximado.
    agricultura: (() => {
      const fromRows = Number(desdeFilas.agricultura) || 0;
      if (fromRows > 0.005) return fromRows;
      return Number(er.agricultura) || 0;
    })(),
    arrendamientos: (() => {
      const fromRows = Number(desdeFilas.arrendamientos) || 0;
      if (fromRows > 0.005) return fromRows;
      return Number(er.arrendamientos) || 0;
    })(),
  };
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
  if (partes.length === 0) return `${ejercicioLabel} · sin cobros en el ejercicio`;
  return `${ejercicioLabel} · cobrado: ${partes.join(" + ")}`;
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

/** Contratos de arrendamiento pendientes de cobro (incluye cerrados con pago final pendiente). */
export function resumenArrendamientosPorRecibir(rows: VentaArrendamientoRow[]): {
  contratos: number;
  usd: number;
} {
  const pendientes = rows.filter((r) => importePendienteArrendamiento(r) > 0.005);
  const usd = pendientes.reduce((s, r) => s + importePendienteArrendamiento(r), 0);
  return { contratos: pendientes.length, usd };
}

/** Ventas agrícolas con saldo por cobrar (incluye cerradas con cuota 2 pendiente). */
export function resumenAgriculturaPorRecibir(rows: VentaAgriculturaRow[]): {
  ventas: number;
  usd: number;
} {
  const pendientes = rows.filter((r) => importePendienteAgricultura(r) > 0.005);
  const usd = pendientes.reduce((s, r) => s + importePendienteAgricultura(r), 0);
  return { ventas: pendientes.length, usd };
}
