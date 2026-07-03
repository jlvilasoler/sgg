import type { ContribucionRuralJurisdiccionConfig } from "../types/contribucion-rural";
import type {
  PrimariaRuralCalendariosStore,
  RegimenPrimariaRuralKey,
} from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";

/** Adapta el calendario DGI Primaria rural al componente compartido de vencimientos. */
export function primariaComoCalendarioConfig(
  store: PrimariaRuralCalendariosStore,
  regimen: RegimenPrimariaRuralKey = "con_explotacion",
): ContribucionRuralJurisdiccionConfig {
  const c = store.calendario;
  const regimenConfig = c.regimens[regimen] ?? c.regimens.con_explotacion;
  const notaExtra = [
    c.fuenteNota,
    regimen === "con_explotacion" ? c.declaracionJuradaNota : "",
    c.boletoNota,
    c.exoneracionNota,
    regimenConfig.detalle,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: "montevideo",
    label: c.titulo,
    intendenciaLabel: `${c.subtitulo} · ${REGIMEN_PRIMARIA_RURAL_LABEL[regimen]}`,
    anio: c.anio,
    fuenteUrl: c.fuenteUrl,
    fuenteNota: notaExtra,
    cuotas: regimenConfig.cuotas,
    primeraCuotaPagoContado: false,
    esPrimariaRural: true,
    declaracionJuradaFecha: regimen === "con_explotacion" ? c.declaracionJuradaFecha : undefined,
    declaracionJuradaNota: regimen === "con_explotacion" ? c.declaracionJuradaNota : undefined,
    boletoNota: c.boletoNota,
    exoneracionNota: c.exoneracionNota,
    fuenteUrlPadrones: c.fuenteUrlPadrones,
    fuenteUrlDj: c.fuenteUrlDj,
    fuenteUrlPago: c.fuenteUrlPago,
    regimenPrimariaLabel: regimenConfig.label,
  };
}
