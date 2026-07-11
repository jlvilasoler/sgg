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

export function calcularImporteNetoAgricultura(
  importeBruto: number | null,
  impuestos: number,
  flete: number
): number | null {
  if (importeBruto == null) return null;
  return Math.max(0, importeBruto - impuestos - flete);
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
