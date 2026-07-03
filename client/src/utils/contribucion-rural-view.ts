import type {
  ContribucionRuralJurisdiccionConfig,
  ContribucionRuralJurisdiccionId,
} from "../types/contribucion-rural";
import { CONTRIBUCION_RURAL_JURISDICCION_ORDER } from "../types/contribucion-rural";
import {
  estadoCuota,
  formatearFechaContribucionRural,
  parseFechaLocal,
} from "./contribucion-rural-common";

export const VENC_IMP_FAVORITOS_STORAGE_KEY = "scg:venc-imp-jurisdicciones";

export type PlanCuotasKey = "4" | "6" | "12";

export const PLAN_CUOTAS_ORDER: PlanCuotasKey[] = ["12", "6", "4"];

export function planesDisponibles(
  config: ContribucionRuralJurisdiccionConfig,
): PlanCuotasKey[] {
  if (!config.planes) return [];
  return PLAN_CUOTAS_ORDER.filter((key) => config.planes?.[key]);
}

export function planPorDefecto(config: ContribucionRuralJurisdiccionConfig): PlanCuotasKey {
  const planes = planesDisponibles(config);
  if (planes.includes("4")) return "4";
  if (planes.includes("6")) return "6";
  return planes[0] ?? "12";
}

export function labelCuotasFijas(config: ContribucionRuralJurisdiccionConfig): string {
  const n = config.cuotas?.length ?? 0;
  return `${n} cuota${n === 1 ? "" : "s"} fija${n === 1 ? "" : "s"}`;
}

export function departamentoTienePlanesElegibles(
  config: ContribucionRuralJurisdiccionConfig,
): boolean {
  return planesDisponibles(config).length > 1;
}

export function normalizarPlanesCuotasPorJurisdiccion(
  ids: ContribucionRuralJurisdiccionId[],
  store: Record<ContribucionRuralJurisdiccionId, ContribucionRuralJurisdiccionConfig>,
  actual: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasKey>> = {},
): Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasKey>> {
  const out: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasKey>> = {};
  for (const id of ids) {
    const config = store[id];
    if (!config) continue;
    const disponibles = planesDisponibles(config);
    if (disponibles.length === 0) continue;
    const prev = actual[id];
    out[id] = prev && disponibles.includes(prev) ? prev : planPorDefecto(config);
  }
  return out;
}

export function planCuotasGuardado(
  config: ContribucionRuralJurisdiccionConfig,
  planes?: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasKey>>,
): PlanCuotasKey | undefined {
  if (config.esPatenteSucive || config.esBpsCajaRural || config.esPrimariaRural) return undefined;
  const disponibles = planesDisponibles(config);
  if (disponibles.length === 0) return undefined;
  const elegido = planes?.[config.id];
  if (elegido && disponibles.includes(elegido)) return elegido;
  return planPorDefecto(config);
}

export interface ModalidadPagoInfo {
  id: string;
  label: string;
  detalle?: string;
}

export function modalidadesPago(config: ContribucionRuralJurisdiccionConfig): ModalidadPagoInfo[] {
  const items: ModalidadPagoInfo[] = [];

  if (config.planes) {
    for (const key of planesDisponibles(config)) {
      const plan = config.planes[key];
      items.push({
        id: `plan-${key}`,
        label: plan.label,
        detalle: `${plan.cuotas.length} vencimientos`,
      });
    }
  } else if (config.cuotas?.length) {
    items.push({
      id: "cuotas-fijas",
      label: `${config.cuotas.length} cuotas fijas`,
    });
  }

  if (config.primeraCuotaPagoContado) {
    items.push({ id: "contado-1", label: "Pago contado en 1ª cuota" });
  }

  const nota = config.fuenteNota.toLowerCase();
  if (nota.includes("pago contado") && !config.primeraCuotaPagoContado) {
    items.push({ id: "contado-nota", label: "Pago contado anual" });
  }
  if (nota.includes("12 cuotas") || nota.includes("plan de 12")) {
    if (!items.some((i) => i.label.includes("12"))) {
      items.push({ id: "plan-12-nota", label: "Plan 12 cuotas" });
    }
  }

  return items;
}

export interface ProximoVencimientoInfo {
  cuota: number;
  fecha: string;
  fechaLabel: string;
  estado: ReturnType<typeof estadoCuota>;
  planLabel?: string;
}

export function proximoVencimiento(
  config: ContribucionRuralJurisdiccionConfig,
  planActivo?: PlanCuotasKey,
): ProximoVencimientoInfo | null {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const candidatos: ProximoVencimientoInfo[] = [];

  const pushCuotas = (cuotas: { cuota: number; fecha: string }[], planLabel?: string) => {
    for (const item of cuotas) {
      const est = estadoCuota(item.fecha, hoy);
      candidatos.push({
        cuota: item.cuota,
        fecha: item.fecha,
        fechaLabel: formatearFechaContribucionRural(item.fecha),
        estado: est,
        planLabel,
      });
    }
  };

  if (config.planes) {
    const keys = planActivo ? [planActivo] : planesDisponibles(config);
    for (const key of keys) {
      const plan = config.planes[key];
      if (plan) pushCuotas(plan.cuotas, plan.label);
    }
  } else if (config.cuotas) {
    pushCuotas(config.cuotas);
  }

  return (
    candidatos
      .filter((c) => parseFechaLocal(c.fecha) >= hoy)
      .sort((a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime())[0] ??
    null
  );
}

export type ModalidadPagoUsuario = "contado" | "cuotas";

export const MODALIDAD_PAGO_LABEL: Record<ModalidadPagoUsuario, string> = {
  contado: "Pago contado",
  cuotas: "Pago en cuotas",
};

export interface VistaCalendarioUsuario {
  cuotas: { cuota: number; fecha: string }[];
  tituloPlan: string;
  esPagoContado: boolean;
  notaModalidad?: string;
  planKey?: PlanCuotasKey;
  planesVisibles: PlanCuotasKey[];
}

function notaContado(config: ContribucionRuralJurisdiccionConfig): string | undefined {
  const nota = config.fuenteNota.trim();
  if (!nota) return undefined;
  const lower = nota.toLowerCase();
  if (lower.includes("pago contado") || lower.includes("contado")) {
    return nota;
  }
  return undefined;
}

export function vistaCalendarioParaUsuario(
  config: ContribucionRuralJurisdiccionConfig,
  modalidad: ModalidadPagoUsuario,
  planActivo?: PlanCuotasKey,
): VistaCalendarioUsuario {
  if (config.esBpsCajaRural) {
    return {
      cuotas: config.cuotas ?? [],
      tituloPlan: `${config.cuotas?.length ?? 0} cuatrimestres`,
      esPagoContado: false,
      planesVisibles: [],
    };
  }

  if (config.esPrimariaRural) {
    return {
      cuotas: config.cuotas ?? [],
      tituloPlan: config.regimenPrimariaLabel ?? `${config.cuotas?.length ?? 0} cuotas`,
      esPagoContado: false,
      planesVisibles: [],
    };
  }

  const planes = planesDisponibles(config);

  if (modalidad === "contado") {
    if (config.primeraCuotaPagoContado && config.cuotas?.length) {
      return {
        cuotas: [config.cuotas[0]],
        tituloPlan: "Pago contado anual",
        esPagoContado: true,
        notaModalidad: notaContado(config),
        planesVisibles: [],
      };
    }
    if (config.planes) {
      const key = planes.includes("4") ? "4" : planes[0];
      const plan = key ? config.planes[key] : null;
      if (plan?.cuotas.length) {
        return {
          cuotas: [plan.cuotas[0]],
          tituloPlan: "Pago contado anual",
          esPagoContado: true,
          notaModalidad: notaContado(config),
          planKey: key,
          planesVisibles: [],
        };
      }
    }
    if (config.cuotas?.length) {
      return {
        cuotas: [config.cuotas[0]],
        tituloPlan: "Pago contado",
        esPagoContado: true,
        notaModalidad: notaContado(config),
        planesVisibles: [],
      };
    }
    return {
      cuotas: [],
      tituloPlan: "Pago contado",
      esPagoContado: true,
      notaModalidad: notaContado(config),
      planesVisibles: [],
    };
  }

  if (config.planes && planes.length) {
    const key =
      planActivo && planes.includes(planActivo) ? planActivo : planPorDefecto(config);
    const plan = config.planes[key];
    return {
      cuotas: plan.cuotas,
      tituloPlan: plan.label,
      esPagoContado: false,
      planKey: key,
      planesVisibles: planes,
    };
  }

  return {
    cuotas: config.cuotas ?? [],
    tituloPlan: `${config.cuotas?.length ?? 0} cuotas fijas`,
    esPagoContado: false,
    planesVisibles: [],
  };
}

export function proximoVencimientoParaUsuario(
  config: ContribucionRuralJurisdiccionConfig,
  modalidad: ModalidadPagoUsuario,
  planActivo?: PlanCuotasKey,
): ProximoVencimientoInfo | null {
  const vista = vistaCalendarioParaUsuario(config, modalidad, planActivo);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const candidatos = vista.cuotas.map((item) => ({
    cuota: item.cuota,
    fecha: item.fecha,
    fechaLabel: formatearFechaContribucionRural(item.fecha),
    estado: estadoCuota(item.fecha, hoy),
    planLabel: vista.tituloPlan,
  }));
  return (
    candidatos
      .filter((c) => parseFechaLocal(c.fecha) >= hoy)
      .sort((a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime())[0] ??
    null
  );
}

export type HorizonteVencImpRural = "todos" | "14d" | "1m";

export interface CuotaFuturaCuentaRural {
  configId: ContribucionRuralJurisdiccionId;
  configLabel: string;
  cuota: number;
  fecha: string;
  fechaLabel: string;
  planLabel: string;
  diasRestantes: number;
}

export function diasHastaVencimientoCuota(fechaIso: string, hoy = new Date()): number {
  const ref = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((parseFechaLocal(fechaIso).getTime() - ref.getTime()) / 86_400_000);
}

export function cuotasFuturasCuentaRural(
  configs: ContribucionRuralJurisdiccionConfig[],
  modalidad: ModalidadPagoUsuario,
  planForConfig: (config: ContribucionRuralJurisdiccionConfig) => PlanCuotasKey | undefined,
  hoy = new Date(),
): CuotaFuturaCuentaRural[] {
  const ref = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const out: CuotaFuturaCuentaRural[] = [];
  for (const config of configs) {
    const vista = vistaCalendarioParaUsuario(config, modalidad, planForConfig(config));
    for (const item of vista.cuotas) {
      const venc = parseFechaLocal(item.fecha);
      if (venc < ref) continue;
      out.push({
        configId: config.id,
        configLabel: config.label,
        cuota: item.cuota,
        fecha: item.fecha,
        fechaLabel: formatearFechaContribucionRural(item.fecha),
        planLabel: vista.tituloPlan,
        diasRestantes: diasHastaVencimientoCuota(item.fecha, hoy),
      });
    }
  }
  return out.sort((a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime());
}

export function filtrarCuotasPorHorizonte(
  cuotas: CuotaFuturaCuentaRural[],
  horizonte: HorizonteVencImpRural,
): CuotaFuturaCuentaRural[] {
  if (horizonte === "todos") return cuotas;
  const maxDias = horizonte === "14d" ? 14 : 30;
  return cuotas.filter((c) => c.diasRestantes <= maxDias);
}

export function departamentosConCuotasEnHorizonte(
  configs: ContribucionRuralJurisdiccionConfig[],
  cuotasFiltradas: CuotaFuturaCuentaRural[],
  horizonte: HorizonteVencImpRural,
): ContribucionRuralJurisdiccionConfig[] {
  if (horizonte === "todos") return configs;
  const ids = new Set(cuotasFiltradas.map((c) => c.configId));
  return configs.filter((c) => ids.has(c.id));
}

export function loadFavoritosJurisdicciones(): ContribucionRuralJurisdiccionId[] | null {
  try {
    const raw = localStorage.getItem(VENC_IMP_FAVORITOS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = new Set(CONTRIBUCION_RURAL_JURISDICCION_ORDER);
    const ids = parsed.filter(
      (id): id is ContribucionRuralJurisdiccionId =>
        typeof id === "string" && valid.has(id as ContribucionRuralJurisdiccionId),
    );
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export function saveFavoritosJurisdicciones(ids: ContribucionRuralJurisdiccionId[]): void {
  localStorage.setItem(VENC_IMP_FAVORITOS_STORAGE_KEY, JSON.stringify(ids));
}

export function clearFavoritosJurisdicciones(): void {
  localStorage.removeItem(VENC_IMP_FAVORITOS_STORAGE_KEY);
}

export function normalizarBusquedaJurisdiccion(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function jurisdiccionCoincideBusqueda(
  config: ContribucionRuralJurisdiccionConfig,
  busqueda: string,
): boolean {
  const q = normalizarBusquedaJurisdiccion(busqueda);
  if (!q) return true;
  const haystack = normalizarBusquedaJurisdiccion(
    `${config.label} ${config.intendenciaLabel} ${config.id}`,
  );
  return haystack.includes(q);
}
