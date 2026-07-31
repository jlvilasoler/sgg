import type { CampoPotreroMapa, StockOvinaDispositivo } from "../../types";
import { collectCampoMapaFeatureDevices } from "../campo/campo-mapa-dispositivos-map";
import { formatHectareas } from "../campo/campo-mapa-geo";
import { formatUnidadOvina } from "../../utils/dotacion-ovina-ug";
import {
  clasificarDotacion,
  resolvePotreroHectareas,
  type DotacionNivel,
} from "./home-stock-potrero-dotacion";
import { totalUoDispositivos } from "./home-stock-ovino-ug";
import {
  contarSexoDispositivos,
  filtrarDispositivosActivosStock,
  type SexoDispositivoCounts,
} from "../stock-ovino/stock-ovina-utils";

/** Referencia: 1 UO/ha = 100 % de ocupación en el panel home. */
export const OVINO_HA_CAPACIDAD_REFERENCIA = 1;

export interface DotacionOvinaResumen {
  /** UO/ha (coeficientes de Configuración SAG · Dotación ovina). */
  uoPorHa: number | null;
  /** @deprecated alias de uoPorHa para compatibilidad */
  cabPorHa: number | null;
  total: number;
  totalUo: number;
  hectareas: number | null;
  nivel: DotacionNivel;
  etiqueta: string;
  consejo: string;
  tooltip: string;
}

export interface PotreroStockOvinoResumenHome {
  potreroId: number | null;
  potreroNombre: string;
  total: number;
  totalUo: number;
  hectareas: number | null;
  dotacion: DotacionOvinaResumen;
}

export interface HomeStockOvinoPotreroSnapshot {
  potreros: PotreroStockOvinoResumenHome[];
  totales: SexoDispositivoCounts & { total: number; sinPotrero: number };
  potrerosConStock: number;
  potrerosEnMapa: number;
  densidadPromedio: number | null;
}

const SIN_POTRERO_ID = -1;
const SIN_POTRERO_NOMBRE = "Sin potrero";

function calcularUoPorHa(totalUo: number, hectareas: number | null): number | null {
  if (totalUo <= 0 || hectareas == null || !Number.isFinite(hectareas) || hectareas <= 0) {
    return null;
  }
  return Math.round((totalUo / hectareas) * 100) / 100;
}

function formatUoHa(valor: number): string {
  const digits = valor >= 10 ? 1 : 2;
  return `${valor.toLocaleString("es-UY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} UO/ha`;
}

export function buildDotacionOvinaResumen(
  devices: ReadonlyArray<StockOvinaDispositivo>,
  hectareas: number | null,
): DotacionOvinaResumen {
  const total = devices.length;
  const totalUo = totalUoDispositivos(devices);
  const uoPorHa = calcularUoPorHa(totalUo, hectareas);

  if (uoPorHa == null) {
    return {
      uoPorHa: null,
      cabPorHa: null,
      total,
      totalUo,
      hectareas,
      nivel: "sin-dato",
      etiqueta: hectareas == null || hectareas <= 0 ? "Sin área" : "Sin stock",
      consejo:
        hectareas == null || hectareas <= 0
          ? "Definí la superficie del potrero en el mapa."
          : "No hay ovinos activos en este potrero.",
      tooltip:
        hectareas == null || hectareas <= 0
          ? "Sin hectáreas del mapa para calcular densidad."
          : "Sin ovinos activos en este potrero.",
    };
  }

  const clasificacion = clasificarDotacion(uoPorHa);
  const haLabel = hectareas != null ? formatHectareas(hectareas) : "—";
  return {
    uoPorHa,
    cabPorHa: uoPorHa,
    total,
    totalUo,
    hectareas,
    ...clasificacion,
    tooltip: `${formatUnidadOvina(totalUo)} (${total} ovino${total === 1 ? "" : "s"}) ÷ ${haLabel} = ${formatUoHa(uoPorHa)}. Referencia ${OVINO_HA_CAPACIDAD_REFERENCIA} UO/ha = 100%.`,
  };
}

function resumenDesdeDispositivos(
  potreroId: number | null,
  potreroNombre: string,
  devices: StockOvinaDispositivo[],
  hectareas: number | null,
): PotreroStockOvinoResumenHome {
  const dotacion = buildDotacionOvinaResumen(devices, hectareas);
  return {
    potreroId,
    potreroNombre,
    total: devices.length,
    totalUo: dotacion.totalUo,
    hectareas,
    dotacion,
  };
}

function densidadPromedioPonderada(
  potreros: PotreroStockOvinoResumenHome[],
): number | null {
  let sumUo = 0;
  let sumHa = 0;
  for (const p of potreros) {
    if (p.potreroId === SIN_POTRERO_ID) continue;
    if (p.hectareas == null || p.hectareas <= 0 || p.totalUo <= 0) continue;
    sumUo += p.totalUo;
    sumHa += p.hectareas;
  }
  if (sumHa <= 0 || sumUo <= 0) return null;
  return Math.round((sumUo / sumHa) * 100) / 100;
}

export function buildHomeStockOvinoPotreroSnapshot(
  potrerosMapa: CampoPotreroMapa[],
  ovino: StockOvinaDispositivo[],
): HomeStockOvinoPotreroSnapshot {
  const activos = filtrarDispositivosActivosStock(ovino);
  const asignados = new Set<string>();
  const potreros: PotreroStockOvinoResumenHome[] = [];

  for (const potrero of potrerosMapa) {
    const devices = collectCampoMapaFeatureDevices(
      potrero.nombre,
      potrero.metadata,
      [],
      [],
      activos,
    )
      .filter((item) => item.kind === "ovino")
      .map((item) => item.device as StockOvinaDispositivo);

    for (const d of devices) asignados.add(d.clave);

    if (devices.length > 0) {
      const hectareas = resolvePotreroHectareas(potrero);
      potreros.push(
        resumenDesdeDispositivos(potrero.id, potrero.nombre, devices, hectareas),
      );
    }
  }

  const sinPotreroDevices = activos.filter((d) => !asignados.has(d.clave));
  if (sinPotreroDevices.length > 0) {
    potreros.push(
      resumenDesdeDispositivos(
        SIN_POTRERO_ID,
        SIN_POTRERO_NOMBRE,
        sinPotreroDevices,
        null,
      ),
    );
  }

  potreros.sort(
    (a, b) =>
      b.total - a.total ||
      a.potreroNombre.localeCompare(b.potreroNombre, "es", { sensitivity: "base" }),
  );

  const sexo = contarSexoDispositivos(activos);

  return {
    potreros,
    totales: {
      ...sexo,
      total: activos.length,
      sinPotrero: sinPotreroDevices.length,
    },
    potrerosConStock: potreros.filter((p) => p.potreroId !== SIN_POTRERO_ID).length,
    potrerosEnMapa: potrerosMapa.length,
    densidadPromedio: densidadPromedioPonderada(potreros),
  };
}

export function potreroStockOvinoEsSinAsignar(
  resumen: PotreroStockOvinoResumenHome,
): boolean {
  return resumen.potreroId === SIN_POTRERO_ID;
}

export function formatAreaCeldaOvino(dotacion: DotacionOvinaResumen): string | null {
  if (dotacion.hectareas == null || dotacion.hectareas <= 0) return null;
  return formatHectareas(dotacion.hectareas);
}

export function formatDotacionCeldaOvino(dotacion: DotacionOvinaResumen): {
  principal: string;
  secundario: string | null;
} {
  if (dotacion.uoPorHa == null) {
    return { principal: dotacion.etiqueta, secundario: null };
  }
  return {
    principal: formatUoHa(dotacion.uoPorHa),
    secundario:
      dotacion.hectareas != null
        ? `${formatHectareas(dotacion.hectareas)} · ${dotacion.etiqueta}`
        : dotacion.etiqueta,
  };
}

export function formatOcupacionCeldaOvino(dotacion: DotacionOvinaResumen): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (dotacion.uoPorHa == null || dotacion.hectareas == null) return null;
  const pct = Math.round((dotacion.uoPorHa / OVINO_HA_CAPACIDAD_REFERENCIA) * 100);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: dotacion.nivel,
    tooltip: dotacion.tooltip,
  };
}

export function formatDensidadPromedioOvino(uoHa: number | null): {
  principal: string;
  etiqueta: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (uoHa == null) return null;
  const clasificacion = clasificarDotacion(uoHa);
  return {
    principal: formatUoHa(uoHa),
    etiqueta: clasificacion.etiqueta,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado en potreros con superficie: ${formatUoHa(uoHa)}.`,
  };
}

export function formatOcupacionPromedioOvino(uoHa: number | null): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (uoHa == null) return null;
  const pct = Math.round((uoHa / OVINO_HA_CAPACIDAD_REFERENCIA) * 100);
  const clasificacion = clasificarDotacion(uoHa);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado: ${pct}% de ocupación (UO ÷ ha del mapa, referencia 1 UO/ha = 100%).`,
  };
}
