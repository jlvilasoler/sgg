export type ContribucionRuralJurisdiccionId =
  | "artigas"
  | "rivera"
  | "rionegro"
  | "florida"
  | "flores"
  | "colonia"
  | "soriano"
  | "sanjose"
  | "montevideo"
  | "canelones"
  | "maldonado"
  | "rocha"
  | "lavalleja"
  | "durazno"
  | "cerrolargo"
  | "tacuarembo"
  | "paysandu"
  | "salto"
  | "treintaytres";

export interface CuotaContribucionRural {
  cuota: number;
  fecha: string;
}

export interface ContribucionRuralPlanConfig {
  label: string;
  cuotas: CuotaContribucionRural[];
}

export interface ContribucionRuralJurisdiccionConfig {
  id: ContribucionRuralJurisdiccionId;
  label: string;
  intendenciaLabel: string;
  anio: number;
  fuenteUrl: string;
  fuenteNota: string;
  cuotas?: CuotaContribucionRural[];
  planes?: Record<"4" | "6" | "12", ContribucionRuralPlanConfig>;
  primeraCuotaPagoContado?: boolean;
  /** Calendario nacional SUCIVE (no es contribución rural departamental). */
  esPatenteSucive?: boolean;
  /** Calendario nacional BPS Caja rural (no es contribución rural departamental). */
  esBpsCajaRural?: boolean;
  /** Calendario nacional DGI Primaria rural (adaptador UI). */
  esPrimariaRural?: boolean;
  declaracionJuradaFecha?: string;
  declaracionJuradaNota?: string;
  boletoNota?: string;
  exoneracionNota?: string;
  fuenteUrlPadrones?: string;
  fuenteUrlDj?: string;
  fuenteUrlPago?: string;
  regimenPrimariaLabel?: string;
}

export interface ContribucionRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  jurisdicciones: Record<ContribucionRuralJurisdiccionId, ContribucionRuralJurisdiccionConfig>;
}

export const CONTRIBUCION_RURAL_JURISDICCION_ORDER: ContribucionRuralJurisdiccionId[] = [
  "artigas",
  "rivera",
  "rionegro",
  "florida",
  "flores",
  "colonia",
  "soriano",
  "sanjose",
  "montevideo",
  "canelones",
  "maldonado",
  "rocha",
  "lavalleja",
  "durazno",
  "cerrolargo",
  "tacuarembo",
  "paysandu",
  "salto",
  "treintaytres",
];

export function shiftCuotasToYear(cuotas: CuotaContribucionRural[], anio: number): CuotaContribucionRural[] {
  return cuotas.map((item) => {
    const [, month, day] = item.fecha.split("-");
    return { ...item, fecha: `${anio}-${month}-${day}` };
  });
}

export function shiftJurisdiccionDatesToYear(
  config: ContribucionRuralJurisdiccionConfig,
  anio: number,
): ContribucionRuralJurisdiccionConfig {
  const next = { ...config, anio };
  if (next.cuotas) {
    next.cuotas = shiftCuotasToYear(next.cuotas, anio);
  }
  if (next.planes) {
    next.planes = Object.fromEntries(
      Object.entries(next.planes).map(([key, plan]) => [
        key,
        { ...plan, cuotas: shiftCuotasToYear(plan.cuotas, anio) },
      ]),
    ) as ContribucionRuralJurisdiccionConfig["planes"];
  }
  return next;
}

export type ModalidadPagoVencImp = "contado" | "cuotas";

export type PlanCuotasJurisdiccionKey = "4" | "6" | "12";

export interface UserVencimientosImpuestosPrefs {
  cuenta_id: number;
  jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
  modalidad_pago: ModalidadPagoVencImp;
  modalidad_pago_patente: ModalidadPagoVencImp;
  planes_cuotas_por_jurisdiccion: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
  seguir_patente_sucive: boolean;
  seguir_bps_caja_rural: boolean;
  seguir_primaria_rural: boolean;
  regimen_primaria_rural: import("./primaria-rural").RegimenPrimariaRural;
  onboarding_completado: boolean;
  actualizado_por_user_id?: number | null;
  actualizado_en: string;
}

export interface UserVencimientosImpuestosPrefsInput {
  jurisdiccion_ids: ContribucionRuralJurisdiccionId[];
  modalidad_pago: ModalidadPagoVencImp;
  modalidad_pago_patente?: ModalidadPagoVencImp;
  planes_cuotas_por_jurisdiccion?: Partial<Record<ContribucionRuralJurisdiccionId, PlanCuotasJurisdiccionKey>>;
  seguir_patente_sucive?: boolean;
  seguir_bps_caja_rural?: boolean;
  seguir_primaria_rural?: boolean;
  regimen_primaria_rural?: import("./primaria-rural").RegimenPrimariaRural;
  onboarding_completado?: boolean;
}
