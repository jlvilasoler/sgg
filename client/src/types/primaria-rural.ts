export interface CuotaPrimariaRural {
  cuota: number;
  fecha: string;
}

export type RegimenPrimariaRuralKey = "con_explotacion" | "sin_explotacion";

export type RegimenPrimariaRural = RegimenPrimariaRuralKey;

export interface RegimenPrimariaRuralConfig {
  label: string;
  detalle: string;
  cuotas: CuotaPrimariaRural[];
}

export interface PrimariaRuralCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPadrones: string;
  fuenteUrlDj: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  declaracionJuradaFecha: string;
  declaracionJuradaNota: string;
  boletoNota: string;
  exoneracionNota: string;
  regimens: Record<RegimenPrimariaRuralKey, RegimenPrimariaRuralConfig>;
}

export interface PrimariaRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: PrimariaRuralCalendarioConfig;
}

export const REGIMEN_PRIMARIA_RURAL_LABEL: Record<RegimenPrimariaRuralKey, string> = {
  con_explotacion: "Con explotación agropecuaria",
  sin_explotacion: "Sin explotación agropecuaria",
};

export function shiftPrimariaCuotasToYear(
  cuotas: CuotaPrimariaRural[],
  anio: number,
): CuotaPrimariaRural[] {
  return cuotas.map((item) => {
    const [, month, day] = item.fecha.split("-");
    return { ...item, fecha: `${anio}-${month}-${day}` };
  });
}

export function shiftPrimariaCalendarioToYear(
  config: PrimariaRuralCalendarioConfig,
  anio?: number,
): PrimariaRuralCalendarioConfig {
  const target = anio ?? config.anio;
  return {
    ...config,
    anio: target,
    declaracionJuradaFecha: `${target}-04-30`,
    regimens: {
      con_explotacion: {
        ...config.regimens.con_explotacion,
        cuotas: shiftPrimariaCuotasToYear(config.regimens.con_explotacion.cuotas, target),
      },
      sin_explotacion: {
        ...config.regimens.sin_explotacion,
        cuotas: shiftPrimariaCuotasToYear(config.regimens.sin_explotacion.cuotas, target),
      },
    },
  };
}
