import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type { PatenteSuciveCalendariosStore } from "../types/patente-sucive";

/** Adapta el calendario SUCIVE al componente compartido de vencimientos. */
export function patenteComoCalendarioConfig(
  store: PatenteSuciveCalendariosStore,
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
    esPatenteSucive: true,
  };
}
