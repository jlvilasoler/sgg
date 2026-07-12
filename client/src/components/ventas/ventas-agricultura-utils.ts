import type { Empresa } from "../../types";
import { fmtNum } from "../../utils";
import { empresasSelectOptions } from "../../utils/empresas-catalogo";

/** @deprecated Prefer nombres del catálogo venta-sub-rubros (grupo Venta agricultura). */
export const CULTIVOS_AGRICULTURA = [
  { id: "Trigo", label: "Trigo", color: "#d97706" },
  { id: "Soja", label: "Soja", color: "#65a30d" },
  { id: "Maíz", label: "Maíz", color: "#ca8a04" },
  { id: "Colza", label: "Colza", color: "#eab308" },
] as const;

export type CultivoAgriculturaId = string;

export type EmpresaAgricultura = Empresa | "";

export { empresasSelectOptions };

export const MESES_AGRICULTURA = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
] as const;

export const ANIOS_AGRICULTURA = Array.from({ length: 2040 - 2025 + 1 }, (_, i) => 2025 + i);

export type MesAgricultura = (typeof MESES_AGRICULTURA)[number]["value"] | "";

export function parsePositiveDecimal(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseNonNegativeDecimal(value: string): number {
  const trimmed = value.replace(",", ".").trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function formatOperacionAgricultura(id: number): string {
  return `VA${String(Math.max(1, Math.floor(id))).padStart(3, "0")}`;
}

export function calcUsdPorHa(importeUsd: number, hectareas: number): number | null {
  if (!Number.isFinite(importeUsd) || !Number.isFinite(hectareas) || hectareas <= 0) return null;
  return importeUsd / hectareas;
}

export function calcularTotalProduccionAgricultura(
  hectareas: number | null,
  rendimiento: number | null
): number | null {
  if (hectareas == null || rendimiento == null) return null;
  return hectareas * rendimiento;
}

export function calcularImporteAgricultura(
  totalProduccion: number | null,
  precio: number | null
): number | null {
  if (totalProduccion == null || precio == null) return null;
  return (totalProduccion * precio) / 1000;
}

/** 40% al ingresar (precio del momento) + 60% al finalizar (precio de venta). */
export const FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO = 0.4;
export const FORMA_PAGO_AGRICULTURA_FRACCION_SALDO = 0.6;

export type FormaPagoAgricultura = "FRACCIONADO" | "AL_FINAL";

export const FORMAS_PAGO_AGRICULTURA: ReadonlyArray<{
  id: FormaPagoAgricultura;
  label: string;
  hint: string;
}> = [
  {
    id: "FRACCIONADO",
    label: "Fraccionado",
    hint: "40% al ingresar y 60% al finalizar",
  },
  {
    id: "AL_FINAL",
    label: "Al final",
    hint: "100% del cobro al cerrar la venta",
  },
];

export function normalizeFormaPagoAgricultura(value: unknown): FormaPagoAgricultura {
  return value === "AL_FINAL" ? "AL_FINAL" : "FRACCIONADO";
}

export function labelFormaPagoAgricultura(forma: FormaPagoAgricultura): string {
  return FORMAS_PAGO_AGRICULTURA.find((f) => f.id === forma)?.label ?? "Fraccionado";
}

export interface PagosAgriculturaCalculados {
  tonTotal: number | null;
  pago1Ton: number | null;
  pago2Ton: number | null;
  pago1Usd: number | null;
  pago2Usd: number | null;
  importeBruto: number | null;
}

export function calcularPagosAgricultura(
  totalProduccionKg: number | null,
  precioIngresoUsdTon: number | null,
  precioVentaUsdTon: number | null,
  formaPago: FormaPagoAgricultura = "FRACCIONADO"
): PagosAgriculturaCalculados {
  if (totalProduccionKg == null || precioVentaUsdTon == null) {
    return {
      tonTotal: null,
      pago1Ton: null,
      pago2Ton: null,
      pago1Usd: null,
      pago2Usd: null,
      importeBruto: null,
    };
  }

  const tonTotal = totalProduccionKg / 1000;

  if (formaPago === "AL_FINAL") {
    const pago2Usd = tonTotal * precioVentaUsdTon;
    return {
      tonTotal,
      pago1Ton: 0,
      pago2Ton: tonTotal,
      pago1Usd: 0,
      pago2Usd,
      importeBruto: pago2Usd,
    };
  }

  if (precioIngresoUsdTon == null) {
    return {
      tonTotal: null,
      pago1Ton: null,
      pago2Ton: null,
      pago1Usd: null,
      pago2Usd: null,
      importeBruto: null,
    };
  }

  const pago1Ton = tonTotal * FORMA_PAGO_AGRICULTURA_FRACCION_INGRESO;
  const pago2Ton = tonTotal * FORMA_PAGO_AGRICULTURA_FRACCION_SALDO;
  const pago1Usd = pago1Ton * precioIngresoUsdTon;
  const pago2Usd = pago2Ton * precioVentaUsdTon;
  return {
    tonTotal,
    pago1Ton,
    pago2Ton,
    pago1Usd,
    pago2Usd,
    importeBruto: pago1Usd + pago2Usd,
  };
}

export function calcularImporteBrutoAgricultura(
  totalProduccionKg: number | null,
  precioIngresoUsdTon: number | null,
  precioVentaUsdTon: number | null,
  formaPago: FormaPagoAgricultura = "FRACCIONADO"
): number | null {
  return calcularPagosAgricultura(
    totalProduccionKg,
    precioIngresoUsdTon,
    precioVentaUsdTon,
    formaPago
  ).importeBruto;
}

export function formatTonAgricultura(value: number): string {
  return `${fmtNum(value, 1)} ton`;
}

export function calcularImporteNetoAgricultura(
  importeBruto: number | null,
  impuestos: number,
  flete: number
): number | null {
  if (importeBruto == null) return null;
  return Math.max(0, importeBruto - impuestos - flete);
}

/** Desglose neto de pagos 1 y 2 (costos prorrateados al bruto de cada tramo). */
export function pagosNetosAgriculturaDesdePagos(
  pagos: PagosAgriculturaCalculados,
  impuestos: number,
  flete: number,
): { pago1Neto: number; pago2Neto: number; totalNeto: number } {
  const bruto = pagos.importeBruto ?? 0;
  const p1b = pagos.pago1Usd ?? 0;
  const p2b = pagos.pago2Usd ?? 0;
  const costos = impuestos + flete;
  const costP1 = bruto > 0 ? (costos * p1b) / bruto : 0;
  const costP2 = bruto > 0 ? (costos * p2b) / bruto : 0;
  const pago1Neto = Math.max(0, Math.round((p1b - costP1) * 100) / 100);
  const pago2Neto = Math.max(0, Math.round((p2b - costP2) * 100) / 100);
  return {
    pago1Neto,
    pago2Neto,
    totalNeto: Math.round((pago1Neto + pago2Neto) * 100) / 100,
  };
}

export function pagosNetosSimulacionAgricultura(row: {
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  precio_ingreso_usd_ton: number;
  forma_pago_agricultura: FormaPagoAgricultura;
  costo_impuestos_usd: number;
  costo_flete_usd: number;
}): { pago1Neto: number; pago2Neto: number; totalNeto: number } {
  const totalKg = calcularTotalProduccionAgricultura(row.hectareas, row.rendimiento_ton_ha);
  const pagos = calcularPagosAgricultura(
    totalKg,
    row.precio_ingreso_usd_ton,
    row.precio_usd_ton,
    row.forma_pago_agricultura,
  );
  return pagosNetosAgriculturaDesdePagos(
    pagos,
    row.costo_impuestos_usd,
    row.costo_flete_usd,
  );
}

/** Total producción en toneladas: ej. 20,0 ton (valor interno en kg). */
export function formatTotalProduccionAgricultura(value: number): string {
  const tons = value / 1000;
  return `${fmtNum(tons, 1)} ton`;
}

export function formatRendimientoAgricultura(value: number): string {
  const text = Number.isInteger(value)
    ? fmtNum(value, 0)
    : fmtNum(value, 2);
  return `${text} kg/ha`;
}

export function labelEmpresaAgricultura(empresa: string): string {
  return empresa;
}

export function colorCultivoAgricultura(cultivo: string): string {
  const key = cultivo.trim().toLowerCase();
  const found = CULTIVOS_AGRICULTURA.find(
    (c) =>
      c.id.toLowerCase() === key ||
      c.label.toLowerCase() === key ||
      c.id.toUpperCase() === cultivo.trim().toUpperCase()
  );
  return found?.color ?? "#848e9c";
}

export function labelCultivoAgricultura(cultivo: string): string {
  const key = cultivo.trim();
  const found = CULTIVOS_AGRICULTURA.find(
    (c) =>
      c.id === key ||
      c.label === key ||
      c.id.toUpperCase() === key.toUpperCase()
  );
  return found?.label ?? key;
}

export function labelMesAgricultura(mes: number): string {
  return MESES_AGRICULTURA.find((m) => m.value === mes)?.label ?? String(mes);
}

export function formatPeriodoAgricultura(mes: number, anio: number): string {
  return `${labelMesAgricultura(mes)} ${anio}`;
}

export function encodeMesAnioAgricultura(anio: number, mes: number): string {
  return `${anio}-${mes}`;
}

export function parseMesAnioAgricultura(
  value: string
): { mes: number; anio: number } | null {
  const parts = value.trim().split("-");
  if (parts.length !== 2) return null;
  const anio = Number(parts[0]);
  const mes = Number(parts[1]);
  if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) return null;
  return { mes, anio };
}

export const OPCIONES_MES_ANIO_AGRICULTURA = ANIOS_AGRICULTURA.flatMap((anio) =>
  MESES_AGRICULTURA.map((m) => ({
    value: encodeMesAnioAgricultura(anio, m.value),
    label: formatPeriodoAgricultura(m.value, anio),
    mes: m.value,
    anio,
  }))
);

export function formatZafraAgricultura(
  mesInicio: number,
  anioInicio: number,
  mesFin: number,
  anioFin: number
): string {
  const ini = formatPeriodoAgricultura(mesInicio, anioInicio);
  const fin = formatPeriodoAgricultura(mesFin, anioFin);
  if (mesInicio === mesFin && anioInicio === anioFin) return ini;
  return `${ini} — ${fin}`;
}

/** Formato breve para celdas de tabla (ej. "Feb–Mar '26"). */
export function formatPeriodoAgriculturaCorto(mes: number, anio: number): string {
  const mesCorto = labelMesAgricultura(mes).slice(0, 3);
  return `${mesCorto} '${String(anio).slice(-2)}`;
}

export function formatZafraAgriculturaCorto(
  mesInicio: number,
  anioInicio: number,
  mesFin: number,
  anioFin: number
): string {
  if (mesInicio === mesFin && anioInicio === anioFin) {
    return formatPeriodoAgriculturaCorto(mesInicio, anioInicio);
  }
  if (anioInicio === anioFin) {
    const ini = labelMesAgricultura(mesInicio).slice(0, 3);
    const fin = labelMesAgricultura(mesFin).slice(0, 3);
    return `${ini}–${fin} '${String(anioFin).slice(-2)}`;
  }
  return `${formatPeriodoAgriculturaCorto(mesInicio, anioInicio)} – ${formatPeriodoAgriculturaCorto(mesFin, anioFin)}`;
}

export type VentasAgriculturaModo = "ingresos" | "simulador";

export const VENTAS_AGRICULTURA_COPY: Record<
  VentasAgriculturaModo,
  {
    volver: string;
    tituloForm: string;
    tituloListado: string;
    guardar: string;
    guardando: string;
    guardadoOk: string;
    errorGuardar: string;
    eliminarTitulo: string;
    eliminadoOk: string;
    sinFilas: string;
    unidadConteo: string;
  }
> = {
  ingresos: {
    volver: "Volver a Ingresos por ventas",
    tituloForm: "Ingresar Ventas Agricolas",
    tituloListado: "Ventas agrícolas cerradas",
    guardar: "Registrar",
    guardando: "Guardando…",
    guardadoOk: "Venta agricultura registrada",
    errorGuardar: "Error al registrar venta agricultura",
    eliminarTitulo: "Eliminar registro",
    eliminadoOk: "Registro eliminado",
    sinFilas: "Sin ventas cerradas desde el simulador con esos filtros",
    unidadConteo: "venta(s)",
  },
  simulador: {
    volver: "Volver al simulador de ventas",
    tituloForm: "Simulación de ventas agrícolas",
    tituloListado: "Simulaciones guardadas",
    guardar: "Guardar simulación",
    guardando: "Guardando…",
    guardadoOk: "Simulación guardada",
    errorGuardar: "Error al guardar simulación",
    eliminarTitulo: "Eliminar simulación",
    eliminadoOk: "Simulación eliminada",
    sinFilas: "Sin simulaciones con esos filtros",
    unidadConteo: "simulación(es)",
  },
};
