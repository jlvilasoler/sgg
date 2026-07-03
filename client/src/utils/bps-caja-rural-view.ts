import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { BpsCajaRuralCalendariosStore } from "../types/bps-caja-rural";

/** Adapta el calendario BPS Caja rural al componente compartido de vencimientos. */
export function bpsComoCalendarioConfig(
  store: BpsCajaRuralCalendariosStore,
): ContribucionRuralJurisdiccionConfig {
  const c = store.calendario;
  return {
    id: "montevideo",
    label: c.titulo,
    intendenciaLabel: c.subtitulo,
    anio: c.anio,
    fuenteUrl: c.fuenteUrl,
    fuenteNota: c.fuenteNota,
    cuotas: c.cuotas,
    primeraCuotaPagoContado: c.primeraCuotaPagoContado,
    esBpsCajaRural: true,
  };
}
