import type { Empresa } from "../../types";

export const CULTIVOS_AGRICULTURA = [
  { id: "TRIGO", label: "Trigo" },
  { id: "SOJA", label: "Soja" },
  { id: "MAIZ", label: "Maíz" },
  { id: "COLZA", label: "Colza" },
] as const;

export type CultivoAgriculturaId = (typeof CULTIVOS_AGRICULTURA)[number]["id"];

export const EMPRESAS_AGRICULTURA: { value: Empresa; label: string }[] = [
  { value: "GANADERA GUAVIYU", label: "Ganadera Guaviyú" },
  { value: "GANADERA CHIVILCOY", label: "Ganadera Chivicoy" },
];

export type EmpresaAgricultura = Empresa | "";

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

/** Total producción: ej. 63,700 ton */
export function formatTotalProduccionAgricultura(value: number): string {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("en-US")} ton`;
}

export function formatRendimientoAgricultura(value: number): string {
  const text = Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${text} ton/ha`;
}

export function labelEmpresaAgricultura(empresa: string): string {
  return EMPRESAS_AGRICULTURA.find((e) => e.value === empresa)?.label ?? empresa;
}

export function labelCultivoAgricultura(cultivo: string): string {
  return CULTIVOS_AGRICULTURA.find((c) => c.id === cultivo)?.label ?? cultivo;
}

export function labelMesAgricultura(mes: number): string {
  return MESES_AGRICULTURA.find((m) => m.value === mes)?.label ?? String(mes);
}

export function formatPeriodoAgricultura(mes: number, anio: number): string {
  return `${labelMesAgricultura(mes)} ${anio}`;
}
