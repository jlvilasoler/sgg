export interface CuotaPatenteSucive {
  cuota: number;
  fecha: string;
}

export interface PatenteSuciveCalendarioConfig {
  anio: number;
  titulo: string;
  subtitulo: string;
  fuenteUrl: string;
  fuenteUrlPago: string;
  fuenteNota: string;
  primeraCuotaPagoContado: boolean;
  cuotas: CuotaPatenteSucive[];
}

export interface PatenteSuciveCalendariosStore {
  updatedAt: string;
  updatedBy: string;
  calendario: PatenteSuciveCalendarioConfig;
}

export function shiftPatenteCuotasToYear(
  cuotas: CuotaPatenteSucive[],
  anio: number,
): CuotaPatenteSucive[] {
  return cuotas.map((item) => {
    const [, month, day] = item.fecha.split("-");
    return { ...item, fecha: `${anio}-${month}-${day}` };
  });
}

export function shiftPatenteCalendarioToYear(
  config: PatenteSuciveCalendarioConfig,
  anio?: number,
): PatenteSuciveCalendarioConfig {
  const target = anio ?? config.anio;
  return {
    ...config,
    anio: target,
    cuotas: shiftPatenteCuotasToYear(config.cuotas, target),
  };
}
