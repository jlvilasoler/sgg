export interface CuotaContribucionRural {
  cuota: number;
  /** ISO local YYYY-MM-DD */
  fecha: string;
}

export type CuotaEstado = "vencida" | "proxima" | "pendiente";

export type SemaforoVencimiento = "rojo" | "amarillo" | "verde";

export const ESTADO_CUOTA_LABEL: Record<CuotaEstado, string> = {
  vencida: "Vencida",
  proxima: "Próxima",
  pendiente: "Pendiente",
};

export const SEMAFORO_VENCIMIENTO_LABEL: Record<SemaforoVencimiento, string> = {
  rojo: "Próximo",
  amarillo: "A preparar",
  verde: "Con tiempo",
};

export function parseFechaLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatearFechaContribucionRural(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? "").trim().slice(0, 10))) {
    return "Sin fecha";
  }
  const d = parseFechaLocal(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function estadoCuota(fechaIso: string, hoy = new Date()): CuotaEstado {
  const venc = parseFechaLocal(fechaIso);
  const ref = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (venc < ref) return "vencida";
  const diffDias = Math.round((venc.getTime() - ref.getTime()) / 86_400_000);
  if (diffDias <= 14) return "proxima";
  return "pendiente";
}

/** Semáforo visual: rojo = próximo, amarillo = tiempo para preparar, verde = lejano o pagado. */
export function semaforoVencimientoCuota(
  fechaIso: string,
  hoy = new Date(),
): { nivel: SemaforoVencimiento; label: string } {
  const venc = parseFechaLocal(fechaIso);
  const ref = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diffDias = Math.round((venc.getTime() - ref.getTime()) / 86_400_000);
  if (diffDias < 0) return { nivel: "verde", label: "Pagado" };
  if (diffDias <= 30) return { nivel: "rojo", label: SEMAFORO_VENCIMIENTO_LABEL.rojo };
  if (diffDias <= 90) return { nivel: "amarillo", label: SEMAFORO_VENCIMIENTO_LABEL.amarillo };
  return { nivel: "verde", label: SEMAFORO_VENCIMIENTO_LABEL.verde };
}

export function diasHastaVencimientoCuota(fechaIso: string, hoy = new Date()): number {
  const ref = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((parseFechaLocal(fechaIso).getTime() - ref.getTime()) / 86_400_000);
}

export function diasRestantesLabel(dias: number): string {
  if (!Number.isFinite(dias)) return "Sin fecha";
  if (dias <= 0) return "Vence hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}
