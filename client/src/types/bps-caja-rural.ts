export interface CuotaBpsCajaRural {
  cuota: number;
  fecha: string;
}

export interface BpsCajaRuralCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  primeraCuotaPagoContado: boolean;
  cuotas: CuotaBpsCajaRural[];
}

export interface BpsCajaRuralCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: BpsCajaRuralCalendarioConfig;
}

export function shiftBpsCuotasToYear(
  cuotas: CuotaBpsCajaRural[],
  anio: number,
): CuotaBpsCajaRural[] {
  return cuotas.map((item) => {
    const [, month, day] = item.fecha.split("-");
    return { ...item, fecha: `${anio}-${month}-${day}` };
  });
}

export function shiftBpsCalendarioToYear(
  config: BpsCajaRuralCalendarioConfig,
  anio?: number,
): BpsCajaRuralCalendarioConfig {
  const target = anio ?? config.anio;
  return {
    ...config,
    anio: target,
    cuotas: shiftBpsCuotasToYear(config.cuotas, target),
  };
}
