import type { CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { formatUnidadGanadera, ugPorCategoriaId } from "../../utils/dotacion-ganadera-ug";
import { computeHectareas, formatHectareas, geoJsonToPaths } from "../campo/campo-mapa-geo";
import {
  labelCategoriaDotacion,
  resumenUgPorCategoria,
  totalUgDispositivos,
} from "./home-stock-potrero-ug";

export type DotacionNivel =
  | "sin-dato"
  | "subutilizado"
  | "cria"
  | "recria"
  | "alta"
  | "critica";

export interface DotacionGanaderaResumen {
  ugPorHa: number | null;
  totalUg: number;
  hectareas: number | null;
  nivel: DotacionNivel;
  etiqueta: string;
  consejo: string;
  tooltip: string;
}

/** Superficie del potrero: guardada al dibujar o recalculada desde el polígono del mapa. */
export function resolvePotreroHectareas(potrero: CampoPotreroMapa): number | null {
  if (
    potrero.hectareas != null &&
    Number.isFinite(potrero.hectareas) &&
    potrero.hectareas > 0
  ) {
    return potrero.hectareas;
  }
  try {
    return computeHectareas(geoJsonToPaths(potrero.geojson));
  } catch {
    return null;
  }
}

/** 1 UG/ha equivale al 100 % de ocupación de referencia (vaca adulta por hectárea). */
export const UG_HA_CAPACIDAD_REFERENCIA = 1;

export function calcularOcupacionPotreroPct(
  totalUg: number,
  hectareas: number | null,
): number | null {
  const ugPorHa = calcularDotacionUgPorHa(totalUg, hectareas);
  if (ugPorHa == null) return null;
  return Math.round((ugPorHa / UG_HA_CAPACIDAD_REFERENCIA) * 100);
}

export function calcularDotacionUgPorHa(
  totalUg: number,
  hectareas: number | null,
): number | null {
  if (
    totalUg <= 0 ||
    hectareas == null ||
    !Number.isFinite(hectareas) ||
    hectareas <= 0
  ) {
    return null;
  }
  return Math.round((totalUg / hectareas) * 100) / 100;
}

function formatUgHa(valor: number): string {
  const digits = valor >= 10 ? 1 : 2;
  return `${valor.toLocaleString("es-UY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} UG/ha`;
}

/** Umbrales en UG/ha (equivalente vaca de referencia por hectárea). */
export function clasificarDotacion(ugHa: number): Pick<
  DotacionGanaderaResumen,
  "nivel" | "etiqueta" | "consejo"
> {
  if (ugHa < 0.4) {
    return {
      nivel: "subutilizado",
      etiqueta: "Subutilizado",
      consejo: "Carga animal por debajo del uso típico en pastoreo.",
    };
  }
  if (ugHa < 0.8) {
    return {
      nivel: "cria",
      etiqueta: "Cría",
      consejo: "Carga compatible con cría y recría liviana.",
    };
  }
  if (ugHa < 1.2) {
    return {
      nivel: "recria",
      etiqueta: "Recría",
      consejo: "Carga habitual de recría o engorde pastoril.",
    };
  }
  if (ugHa < 1.8) {
    return {
      nivel: "alta",
      etiqueta: "Alta",
      consejo: "Carga alta: verificar oferta forrajera y rotación.",
    };
  }
  return {
    nivel: "critica",
    etiqueta: "Muy alta",
    consejo: "Riesgo de sobrepastoreo. Revisar reservas y plan de rotación.",
  };
}

function buildTooltipDotacion(
  devices: ReadonlyArray<StockGanaderaDispositivo>,
  totalUg: number,
  hectareas: number | null,
  ugPorHa: number,
): string {
  const haLabel =
    hectareas != null && hectareas > 0 ? formatHectareas(hectareas) : "—";
  const partes = resumenUgPorCategoria(devices)
    .slice(0, 4)
    .map(
      (row) =>
        `${row.cabezas} ${labelCategoriaDotacion(row.id)} (${formatUnidadGanadera(ugPorCategoriaId(row.id))})`,
    );
  const detalleCategorias =
    partes.length > 0 ? ` · ${partes.join(" · ")}` : "";
  const clasificacion = clasificarDotacion(ugPorHa);
  return `${formatUnidadGanadera(totalUg)} en ${devices.length} animales${detalleCategorias} ÷ ${haLabel} = ${formatUgHa(ugPorHa)} · ${clasificacion.etiqueta}: ${clasificacion.consejo}`;
}

export function buildDotacionGanaderaResumen(
  devices: ReadonlyArray<StockGanaderaDispositivo>,
  hectareas: number | null,
): DotacionGanaderaResumen {
  const totalUg = totalUgDispositivos(devices);
  const ugPorHa = calcularDotacionUgPorHa(totalUg, hectareas);

  if (ugPorHa == null) {
    const sinArea = devices.length > 0 && (hectareas == null || hectareas <= 0);
    return {
      ugPorHa: null,
      totalUg,
      hectareas: hectareas && hectareas > 0 ? hectareas : null,
      nivel: "sin-dato",
      etiqueta: sinArea ? "Sin área" : "—",
      consejo: sinArea
        ? "Dibujá o guardá el perímetro del potrero en el mapa para calcular la dotación."
        : "Sin animales o sin superficie válida.",
      tooltip: sinArea
        ? "Falta la superficie (ha) del potrero en el mapa."
        : "No se puede calcular la dotación.",
    };
  }

  const clasificacion = clasificarDotacion(ugPorHa);

  return {
    ugPorHa,
    totalUg,
    hectareas,
    ...clasificacion,
    tooltip: buildTooltipDotacion(devices, totalUg, hectareas, ugPorHa),
  };
}

export function dotacionPromedioPonderada(
  filas: ReadonlyArray<{
    totalUg: number;
    hectareas: number | null;
    potreroId: number | null;
  }>,
  sinPotreroId: number,
): number | null {
  let totalUg = 0;
  let hectareas = 0;

  for (const fila of filas) {
    if (fila.potreroId === sinPotreroId) continue;
    if (fila.hectareas == null || fila.hectareas <= 0) continue;
    totalUg += fila.totalUg;
    hectareas += fila.hectareas;
  }

  return calcularDotacionUgPorHa(totalUg, hectareas);
}

export function formatDotacionPromedio(ugHa: number | null): {
  principal: string;
  secundario: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (ugHa == null) return null;
  const clasificacion = clasificarDotacion(ugHa);
  return {
    principal: formatUgHa(ugHa),
    secundario: `Prom. ponderada · ${clasificacion.etiqueta}`,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado en potreros con superficie: ${formatUgHa(ugHa)} según UG por categoría (Configuración SAG).`,
  };
}

export function formatDotacionCelda(dotacion: DotacionGanaderaResumen): {
  principal: string;
  secundario: string | null;
} {
  if (dotacion.ugPorHa == null) {
    return {
      principal: dotacion.etiqueta,
      secundario: null,
    };
  }

  return {
    principal: formatUgHa(dotacion.ugPorHa),
    secundario:
      dotacion.hectareas != null
        ? `${formatHectareas(dotacion.hectareas)} · ${dotacion.etiqueta}`
        : dotacion.etiqueta,
  };
}

export function formatOcupacionCelda(dotacion: DotacionGanaderaResumen): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  const pct = calcularOcupacionPotreroPct(dotacion.totalUg, dotacion.hectareas);
  if (pct == null || dotacion.hectareas == null) return null;

  const haLabel = formatHectareas(dotacion.hectareas);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: dotacion.nivel,
    tooltip: `Ocupación del potrero: ${formatUnidadGanadera(dotacion.totalUg)} ÷ ${haLabel} = ${pct}% (referencia ${UG_HA_CAPACIDAD_REFERENCIA} UG/ha = 100%). Superficie del mapa satelital.`,
  };
}

export function formatOcupacionPromedio(ugHa: number | null): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (ugHa == null) return null;
  const pct = Math.round((ugHa / UG_HA_CAPACIDAD_REFERENCIA) * 100);
  const clasificacion = clasificarDotacion(ugHa);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado en potreros con superficie: ${pct}% de ocupación (UG ÷ ha del mapa, referencia 1 UG/ha = 100%).`,
  };
}
