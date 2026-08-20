import type {
  ContribucionRuralJurisdiccionConfig,
  ContribucionRuralJurisdiccionId,
} from "../types/contribucion-rural";
import type {
  PrimariaRuralCalendariosStore,
  RegimenPrimariaRuralKey,
} from "../types/primaria-rural";
import { REGIMEN_PRIMARIA_RURAL_LABEL } from "../types/primaria-rural";

export function normalizarRegimenPrimariaPorJurisdiccion(
  ids: ContribucionRuralJurisdiccionId[],
  actual: Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> = {},
  fallback: RegimenPrimariaRuralKey = "con_explotacion",
): Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> {
  const out: Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> = {};
  for (const id of ids) {
    const prev = actual[id];
    out[id] = prev === "con_explotacion" || prev === "sin_explotacion" ? prev : fallback;
  }
  return out;
}

export function regimenPrimariaDeJurisdiccion(
  id: ContribucionRuralJurisdiccionId,
  map: Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> | undefined,
  fallback: RegimenPrimariaRuralKey = "con_explotacion",
): RegimenPrimariaRuralKey {
  const prev = map?.[id];
  return prev === "con_explotacion" || prev === "sin_explotacion" ? prev : fallback;
}

export function regimenPrimariaGlobalDesdeMap(
  ids: ContribucionRuralJurisdiccionId[],
  map: Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> | undefined,
  fallback: RegimenPrimariaRuralKey = "con_explotacion",
): RegimenPrimariaRuralKey {
  if (ids.length === 0) return fallback;
  if (ids.some((id) => regimenPrimariaDeJurisdiccion(id, map, fallback) === "con_explotacion")) {
    return "con_explotacion";
  }
  return "sin_explotacion";
}

export function tienePrimariaConExplotacion(
  ids: ContribucionRuralJurisdiccionId[],
  map: Partial<Record<ContribucionRuralJurisdiccionId, RegimenPrimariaRuralKey>> | undefined,
  fallback: RegimenPrimariaRuralKey = "con_explotacion",
): boolean {
  if (ids.length === 0) return fallback === "con_explotacion";
  return ids.some((id) => regimenPrimariaDeJurisdiccion(id, map, fallback) === "con_explotacion");
}

/** Adapta el calendario DGI Primaria rural al componente compartido de vencimientos. */
export function primariaComoCalendarioConfig(
  store: PrimariaRuralCalendariosStore,
  regimen: RegimenPrimariaRuralKey = "con_explotacion",
  opts?: {
    jurisdiccionId?: ContribucionRuralJurisdiccionId;
    jurisdiccionLabel?: string;
  },
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

  const deptoLabel = opts?.jurisdiccionLabel?.trim();
  const titulo = deptoLabel ? `${c.titulo} · ${deptoLabel}` : c.titulo;

  return {
    id: opts?.jurisdiccionId ?? "montevideo",
    label: titulo,
    intendenciaLabel: deptoLabel
      ? `${deptoLabel} · ${REGIMEN_PRIMARIA_RURAL_LABEL[regimen]}`
      : `${c.subtitulo} · ${REGIMEN_PRIMARIA_RURAL_LABEL[regimen]}`,
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
