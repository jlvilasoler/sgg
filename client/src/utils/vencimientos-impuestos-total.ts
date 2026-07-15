import type { ContribucionRuralJurisdiccionId } from "../types/contribucion-rural";
import type { UserVencimientosImpuestosPrefs } from "../types/contribucion-rural";
import { parseFechaLocal } from "./contribucion-rural-common";
import { escudoDepartamentoSrc } from "./escudos-departamentos";

export type VencImpTipoCuota = "rural" | "patente" | "bps" | "primaria" | "personalizado";

export type TipoImpuestoVenc = "total" | VencImpTipoCuota;

export interface VencImpCuotaConsolidada {
  key: string;
  tipo: VencImpTipoCuota;
  fecha: string;
  fechaLabel: string;
  diasRestantes: number;
  titulo: string;
  impuestoLabel: string;
  cuotaLabel: string;
  escudoSrc: string;
  escudoClassName?: string;
  configId?: ContribucionRuralJurisdiccionId;
  pagoPersonalizadoId?: number;
}

interface CuotaRuralItem {
  configId: ContribucionRuralJurisdiccionId;
  configLabel: string;
  cuota: number;
  fecha: string;
  fechaLabel: string;
  planLabel: string;
  diasRestantes: number;
}

interface CuotaNacionalItem {
  cuota: number;
  fecha: string;
  fechaLabel: string;
  planLabel: string;
  diasRestantes: number;
}

export function contarImpuestosVencHabilitados(
  prefs: UserVencimientosImpuestosPrefs | null | undefined,
  ruralActivo: boolean,
): number {
  if (!prefs?.onboarding_completado) return 0;
  let count = 0;
  if (ruralActivo) count += 1;
  if (prefs.seguir_patente_sucive !== false) count += 1;
  if (prefs.seguir_bps_caja_rural) count += 1;
  if (prefs.seguir_primaria_rural !== false) count += 1;
  return count;
}

export function tipoImpuestoInicialDesdePrefs(
  prefs: UserVencimientosImpuestosPrefs | null | undefined,
): TipoImpuestoVenc {
  if (!prefs?.onboarding_completado) return "rural";
  const rural = prefs.jurisdiccion_ids.length > 0;
  const patente = prefs.seguir_patente_sucive !== false;
  const bps = prefs.seguir_bps_caja_rural;
  const primaria = prefs.seguir_primaria_rural !== false;
  const habilitados = [rural, patente, bps, primaria].filter(Boolean).length;
  if (habilitados >= 2) return "total";
  if (rural) return "rural";
  if (patente) return "patente";
  if (bps) return "bps";
  if (primaria) return "primaria";
  return "rural";
}

export function consolidarCuotasVencimientos(input: {
  rural: CuotaRuralItem[];
  modalidadRural: "contado" | "cuotas";
  patente: CuotaNacionalItem[];
  modalidadPatente: "contado" | "cuotas";
  bps: CuotaNacionalItem[];
  primaria: CuotaNacionalItem[];
  personalizados?: Array<{
    pagoId: number;
    entidad: string;
    tipoLabel: string;
    cuota: number;
    totalCuotas: number;
    fecha: string;
    fechaLabel: string;
    diasRestantes: number;
    montoLabel: string | null;
    descripcion?: string | null;
  }>;
}): VencImpCuotaConsolidada[] {
  const out: VencImpCuotaConsolidada[] = [];

  for (const item of input.rural) {
    out.push({
      key: `rural-${item.configId}-${item.cuota}-${item.fecha}`,
      tipo: "rural",
      fecha: item.fecha,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      titulo: item.configLabel,
      impuestoLabel: "Contribución rural",
      cuotaLabel:
        input.modalidadRural === "contado"
          ? "Pago contado anual"
          : `Cuota ${item.cuota}ª · ${item.planLabel}`,
      escudoSrc: escudoDepartamentoSrc(item.configId),
      configId: item.configId,
    });
  }

  for (const item of input.patente) {
    out.push({
      key: `patente-${item.cuota}-${item.fecha}`,
      tipo: "patente",
      fecha: item.fecha,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      titulo: "Patente SUCIVE",
      impuestoLabel: "Patente SUCIVE",
      cuotaLabel:
        input.modalidadPatente === "contado"
          ? "Pago contado anual"
          : `Cuota ${item.cuota}ª · ${item.planLabel}`,
      escudoSrc: "/logo-sucive.svg",
      escudoClassName: "venc-imp-proximo-escudo--patente",
    });
  }

  for (const item of input.bps) {
    out.push({
      key: `bps-${item.cuota}-${item.fecha}`,
      tipo: "bps",
      fecha: item.fecha,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      titulo: "BPS Caja rural",
      impuestoLabel: "BPS Caja rural",
      cuotaLabel: `Cuatrimestre ${item.cuota}º · ${item.planLabel}`,
      escudoSrc: "/logo-bps-compact.svg",
      escudoClassName: "venc-imp-proximo-escudo--bps",
    });
  }

  for (const item of input.primaria) {
    out.push({
      key: `primaria-${item.cuota}-${item.fecha}`,
      tipo: "primaria",
      fecha: item.fecha,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      titulo: "Primaria rural",
      impuestoLabel: "Primaria (DGI)",
      cuotaLabel: `Cuota ${item.cuota}ª · ${item.planLabel}`,
      escudoSrc: "/logo-dgi-compact.svg",
      escudoClassName: "venc-imp-proximo-escudo--dgi",
    });
  }

  for (const item of input.personalizados ?? []) {
    const montoBit = item.montoLabel ? ` · ${item.montoLabel}` : "";
    const descBit = item.descripcion ? ` · ${item.descripcion}` : "";
    out.push({
      key: `personalizado-${item.pagoId}-${item.cuota}-${item.fecha}`,
      tipo: "personalizado",
      fecha: item.fecha,
      fechaLabel: item.fechaLabel,
      diasRestantes: item.diasRestantes,
      titulo: item.entidad,
      impuestoLabel: "Personalizado",
      cuotaLabel: `Cuota ${item.cuota}ª de ${item.totalCuotas} · ${item.tipoLabel}${montoBit}${descBit}`,
      escudoSrc: "/icon-venc-pago-personalizado.svg",
      escudoClassName: "venc-imp-proximo-escudo--personalizado",
      pagoPersonalizadoId: item.pagoId,
    });
  }

  return out.sort(
    (a, b) => parseFechaLocal(a.fecha).getTime() - parseFechaLocal(b.fecha).getTime(),
  );
}
