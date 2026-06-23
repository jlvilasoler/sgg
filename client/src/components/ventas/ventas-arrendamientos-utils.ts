import type { Empresa } from "../../types";
import { fmtNum } from "../../utils";

export const DEPARTAMENTOS_ARRENDAMIENTO = [
  { id: "RIVERA", label: "Rivera" },
  { id: "RIO_NEGRO", label: "Río Negro" },
] as const;

export type DepartamentoArrendamientoId = (typeof DEPARTAMENTOS_ARRENDAMIENTO)[number]["id"];
export type DepartamentoArrendamiento = DepartamentoArrendamientoId | "";

export const EMPRESAS_ARRENDAMIENTO: { value: Empresa; label: string }[] = [
  { value: "GANADERA GUAVIYU", label: "Ganadera Guaviyú" },
  { value: "GANADERA CHIVILCOY", label: "Ganadera Chivilcoy" },
];

export type EmpresaArrendamiento = Empresa | "";

export function parsePositiveDecimal(value: string): number | null {
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function calcularTotalArrendamiento(
  hectareas: number | null,
  precioUsdHa: number | null,
  fechaInicio: string,
  fechaFin: string,
  modalidad: ModalidadArrendamiento = "12_MESES"
): number | null {
  const frac = fraccionArrendamiento(modalidad, fechaInicio, fechaFin);
  if (hectareas == null || precioUsdHa == null || frac == null) return null;
  return hectareas * precioUsdHa * frac;
}

export function formatOperacionArrendamiento(id: number): string {
  return `VAR${String(Math.max(1, Math.floor(id))).padStart(3, "0")}`;
}

export function labelEmpresaArrendamiento(empresa: string): string {
  return EMPRESAS_ARRENDAMIENTO.find((e) => e.value === empresa)?.label ?? empresa;
}

export function labelDepartamentoArrendamiento(departamento: string): string {
  return DEPARTAMENTOS_ARRENDAMIENTO.find((d) => d.id === departamento)?.label ?? departamento;
}

export function normalizeIsoDateArrendamiento(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(trimmed.includes("T") ? trimmed : `${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatFechaArrendamiento(iso: string): string {
  if (!iso) return "—";
  const normalized = normalizeIsoDateArrendamiento(iso);
  if (!normalized) return "—";
  const [, y, m, d] =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized) ?? [];
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/** Fecha final sumando meses al inicio (mismo día cuando es posible). */
export function fechaFinArrendamientoPorMeses(
  fechaInicio: string,
  meses: number
): string | null {
  const trimmed = fechaInicio.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  date.setMonth(date.getMonth() + meses);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** @deprecated Usar fechaFinArrendamientoPorMeses(inicio, 12) */
export function fechaFinArrendamientoAnual(fechaInicio: string): string | null {
  return fechaFinArrendamientoPorMeses(fechaInicio, 12);
}

export type ModalidadArrendamiento = "MANUAL" | "6_MESES" | "12_MESES";

export const MODALIDADES_ARRENDAMIENTO = [
  { id: "MANUAL" as const, label: "Manual" },
  { id: "6_MESES" as const, label: "6 meses" },
  { id: "12_MESES" as const, label: "12 meses" },
];

export type FrecuenciaPagoArrendamiento = "MENSUAL" | "ANUAL";

export const FRECUENCIAS_PAGO_ARRENDAMIENTO = [
  { id: "MENSUAL" as const, label: "Mensual" },
  { id: "ANUAL" as const, label: "Anual" },
];

export type CantidadPagosAnual = 1 | 2;

export const CANTIDADES_PAGO_ANUAL = [
  { id: 1 as const, label: "1 pago" },
  { id: 2 as const, label: "2 pagos" },
] as const;

export function inferirCantidadPagosAnual(
  pagoInicio: string,
  pagoFin: string,
  montoInicio: number,
  montoFin: number
): CantidadPagosAnual {
  if (pagoInicio === pagoFin && montoInicio === montoFin) return 1;
  return 2;
}

export function labelFrecuenciaPagoArrendamiento(frecuencia: FrecuenciaPagoArrendamiento): string {
  return FRECUENCIAS_PAGO_ARRENDAMIENTO.find((f) => f.id === frecuencia)?.label ?? frecuencia;
}

export type TipoMontoPagoArrendamiento = "VALOR" | "PORCENTAJE";

export const TIPOS_MONTO_PAGO_ARRENDAMIENTO = [
  { id: "VALOR" as const, label: "USD" },
  { id: "PORCENTAJE" as const, label: "%" },
] as const;

export function parseMontoPagoArrendamiento(
  value: string,
  tipo: TipoMontoPagoArrendamiento
): number | null {
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  if (tipo === "PORCENTAJE" && n > 100) return null;
  return n;
}

export function calcularTotalPagosArrendamiento(
  inicioMonto: number | null,
  finMonto: number | null,
  tipo: TipoMontoPagoArrendamiento,
  totalArrendamiento: number | null,
  frecuencia: FrecuenciaPagoArrendamiento = "ANUAL",
  modalidad: ModalidadArrendamiento = "12_MESES",
  fechaInicio: string = "",
  fechaFin: string = "",
  cantidadPagosAnual: CantidadPagosAnual = 2
): number | null {
  if (inicioMonto == null) return null;
  if (frecuencia === "MENSUAL") {
    const meses = mesesArrendamiento(modalidad, fechaInicio, fechaFin);
    if (meses == null || meses <= 0) return null;
    const cuotaMensualUsd =
      tipo === "VALOR"
        ? inicioMonto
        : totalArrendamiento != null
          ? (totalArrendamiento * inicioMonto) / 100
          : null;
    if (cuotaMensualUsd == null) return null;
    return Math.round(cuotaMensualUsd * meses * 100) / 100;
  }
  if (cantidadPagosAnual === 1) {
    if (tipo === "VALOR") return inicioMonto;
    if (totalArrendamiento == null) return null;
    return (totalArrendamiento * inicioMonto) / 100;
  }
  if (finMonto == null) return null;
  if (tipo === "VALOR") return inicioMonto + finMonto;
  if (totalArrendamiento == null) return null;
  return (totalArrendamiento * (inicioMonto + finMonto)) / 100;
}

export function pagosCoincidenConArrendamiento(
  totalPagos: number | null,
  totalArrendamiento: number | null
): boolean {
  if (totalPagos == null || totalArrendamiento == null) return false;
  return Math.abs(totalPagos - totalArrendamiento) <= 0.02;
}

export function calcularMontoMensualArrendamiento(
  totalArrendamiento: number | null,
  modalidad: ModalidadArrendamiento,
  fechaInicio: string,
  fechaFin: string
): number | null {
  if (totalArrendamiento == null) return null;
  const meses = mesesArrendamiento(modalidad, fechaInicio, fechaFin);
  if (meses == null || meses <= 0) return null;
  return Math.round((totalArrendamiento / meses) * 100) / 100;
}

/** Segundo pago anual = total − primer pago (USD) o 100% − primer % */
export function calcularMontoPagoFinDesdeInicio(
  inicioMonto: number,
  tipo: TipoMontoPagoArrendamiento,
  totalArrendamiento: number | null
): number | null {
  if (tipo === "VALOR") {
    if (totalArrendamiento == null) return null;
    const diff = totalArrendamiento - inicioMonto;
    return diff > 0 ? Math.round(diff * 100) / 100 : null;
  }
  const diff = 100 - inicioMonto;
  return diff > 0 ? Math.round(diff * 100) / 100 : null;
}

export function formatMontoPagoInput(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2);
}

export function fraccionAnualArrendamiento(
  fechaInicio: string,
  fechaFin: string
): number | null {
  const days = diasPeriodoArrendamiento(fechaInicio, fechaFin);
  if (days == null) return null;
  return days / 365;
}

/** Fracción del año según fechas; si faltan, infiere por modalidad 6/12 meses. */
export function fraccionArrendamiento(
  modalidad: ModalidadArrendamiento,
  fechaInicio: string,
  fechaFin: string
): number | null {
  const desdeFechas = fraccionAnualArrendamiento(fechaInicio, fechaFin);
  if (desdeFechas != null) return desdeFechas;
  if (modalidad === "12_MESES") return 1;
  if (modalidad === "6_MESES") return 0.5;
  return null;
}

export function diasPeriodoArrendamiento(
  fechaInicio: string,
  fechaFin: string
): number | null {
  const ini = normalizeIsoDateArrendamiento(fechaInicio);
  const fin = normalizeIsoDateArrendamiento(fechaFin);
  if (!ini || !fin || fin < ini) return null;
  const start = new Date(`${ini}T12:00:00`);
  const end = new Date(`${fin}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return null;
  return days;
}

export function formatDiasPeriodoArrendamiento(days: number): string {
  const rounded = Math.round(days);
  return rounded === 1 ? "1 día" : `${fmtNum(rounded, 0)} días`;
}

export function inferirModalidadArrendamiento(
  fechaInicio: string,
  fechaFin: string
): ModalidadArrendamiento {
  const inicio = normalizeIsoDateArrendamiento(fechaInicio);
  const fin = normalizeIsoDateArrendamiento(fechaFin);
  if (!inicio || !fin) return "MANUAL";
  const fin12 = fechaFinArrendamientoPorMeses(inicio, 12);
  if (fin12 && fin === fin12) return "12_MESES";
  const fin6 = fechaFinArrendamientoPorMeses(inicio, 6);
  if (fin6 && fin === fin6) return "6_MESES";
  return "MANUAL";
}

export function labelModalidadArrendamiento(modalidad: ModalidadArrendamiento): string {
  return MODALIDADES_ARRENDAMIENTO.find((m) => m.id === modalidad)?.label ?? modalidad;
}

export function describeCalculoArrendamiento(
  modalidad: ModalidadArrendamiento,
  fechaInicio: string,
  fechaFin: string
): string {
  if (modalidad === "6_MESES") return "6 meses (½ año)";
  if (modalidad === "12_MESES") return "12 meses (1 año)";
  const dias = diasPeriodoArrendamiento(fechaInicio, fechaFin);
  if (dias == null) return "Período manual";
  const frac = dias / 365;
  return `${formatDiasPeriodoArrendamiento(dias)} (${fmtNum(frac * 100, 1)} % del año)`;
}

/** Meses del arrendamiento (misma base que el total: fechas o modalidad 6/12). */
export function mesesArrendamiento(
  modalidad: ModalidadArrendamiento,
  fechaInicio: string,
  fechaFin: string
): number | null {
  const desdeFechas = mesesPeriodoArrendamiento(fechaInicio, fechaFin);
  if (desdeFechas != null) return desdeFechas;
  if (modalidad === "12_MESES") return 12;
  if (modalidad === "6_MESES") return 6;
  return null;
}

export function cuotaMensualPagoUsd(
  monto: number,
  tipo: TipoMontoPagoArrendamiento,
  totalArrendamiento: number | null
): number | null {
  if (tipo === "VALOR") return monto;
  if (totalArrendamiento == null) return null;
  return (totalArrendamiento * monto) / 100;
}

export function describeTotalPagosMensual(
  monto: number,
  meses: number,
  tipo: TipoMontoPagoArrendamiento,
  totalArrendamiento: number | null
): string | null {
  const cuota = cuotaMensualPagoUsd(monto, tipo, totalArrendamiento);
  if (cuota == null) return null;
  const mesesLabel = formatMesesPeriodoArrendamiento(meses);
  if (tipo === "VALOR") {
    return `${mesesLabel} × ${formatUsdArrendamiento(cuota)}`;
  }
  return `${mesesLabel} × ${fmtNum(monto, 1)} %`;
}

/** Meses del período, alineado al prorrateo días/365 × 12. */
export function mesesPeriodoArrendamiento(
  fechaInicio: string,
  fechaFin: string
): number | null {
  const frac = fraccionAnualArrendamiento(fechaInicio, fechaFin);
  if (frac == null) return null;
  return frac * 12;
}

export function formatMesesPeriodoArrendamiento(meses: number): string {
  const rounded = Math.round(meses);
  if (Math.abs(meses - rounded) < 0.05) {
    return rounded === 1 ? "1 mes" : `${rounded} meses`;
  }
  return `${fmtNum(meses, 1)} meses`;
}

export function labelPeriodoSeleccionadoArrendamiento(
  modalidad: ModalidadArrendamiento,
  fechaInicio: string,
  fechaFin: string
): string | null {
  if (modalidad === "6_MESES") return "6 meses";
  if (modalidad === "12_MESES") return "12 meses";
  const dias = diasPeriodoArrendamiento(fechaInicio, fechaFin);
  if (dias == null) return null;
  return formatDiasPeriodoArrendamiento(dias);
}

export function formatPeriodoArrendamiento(fechaInicio: string, fechaFin: string): string {
  const inicio = normalizeIsoDateArrendamiento(fechaInicio);
  const fin = normalizeIsoDateArrendamiento(fechaFin);
  if (!inicio) return "—";
  const ini = formatFechaArrendamiento(inicio);
  if (!fin || inicio === fin) return ini;
  const finLabel = formatFechaArrendamiento(fin);
  const modalidad = inferirModalidadArrendamiento(inicio, fin);
  const etiqueta = labelPeriodoSeleccionadoArrendamiento(modalidad, inicio, fin);
  if (modalidad === "12_MESES" || modalidad === "6_MESES") {
    return `${etiqueta} · ${ini} – ${finLabel}`;
  }
  return `${ini} – ${finLabel}`;
}

export function formatUsdArrendamiento(value: number): string {
  return `USD ${fmtNum(value, 2)}`;
}

export function formatUsdPorHaArrendamiento(value: number): string {
  return `USD ${fmtNum(value, 2)}/ha`;
}

export type VentasArrendamientosModo = "ingresos" | "simulador";

export const VENTAS_ARRENDAMIENTOS_COPY: Record<
  VentasArrendamientosModo,
  {
    volver: string;
    tituloForm: string;
    tituloPagina: string;
    descripcionPagina: string;
    subtituloListado: string;
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
    tituloForm: "Ingresar arrendamiento",
    tituloPagina: "Ingresos por arrendamientos y medianería",
    descripcionPagina:
      "Registro de ingresos por arrendamiento de campos, medianería y acuerdos de uso.",
    subtituloListado: "Totales de simulaciones guardadas en el simulador de arrendamiento.",
    tituloListado: "Arrendamientos registrados",
    guardar: "Registrar",
    guardando: "Guardando…",
    guardadoOk: "Arrendamiento registrado",
    errorGuardar: "Error al registrar arrendamiento",
    eliminarTitulo: "Eliminar registro",
    eliminadoOk: "Registro eliminado",
    sinFilas: "Sin arrendamientos guardados en el simulador con esos filtros",
    unidadConteo: "registro(s)",
  },
  simulador: {
    volver: "Volver al simulador de ventas",
    tituloForm: "Simulación de arrendamiento",
    tituloPagina: "Simulación de arrendamiento",
    descripcionPagina:
      "Simulá el ingreso por arrendamiento. El precio por hectárea es anual; el total se prorratea según el período.",
    subtituloListado: "Historial de simulaciones de arrendamiento guardadas",
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
