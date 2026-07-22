import type { CampoPotreroMapa, StockEquinaDispositivo } from "../../types";
import { collectCampoMapaFeatureDevices } from "../campo/campo-mapa-dispositivos-map";
import { formatHectareas } from "../campo/campo-mapa-geo";
import { formatUnidadEquina } from "../../utils/dotacion-equina-ug";
import {
  clasificarDotacion,
  resolvePotreroHectareas,
  type DotacionNivel,
} from "./home-stock-potrero-dotacion";
import { totalUeDispositivos } from "./home-stock-equino-ug";
import {
  contarSexoDispositivos,
  filtrarDispositivosActivosStock,
  type SexoDispositivoCounts,
} from "../stock-equino/stock-equina-utils";

/** Referencia: 1 UE/ha = 100 % de ocupación en el panel home. */
export const EQUINO_HA_CAPACIDAD_REFERENCIA = 1;

export interface DotacionEquinaResumen {
  /** UE/ha (coeficientes de Configuración SAG · Dotación equina). */
  uePorHa: number | null;
  /** @deprecated alias de uePorHa para compatibilidad */
  cabPorHa: number | null;
  total: number;
  totalUe: number;
  hectareas: number | null;
  nivel: DotacionNivel;
  etiqueta: string;
  consejo: string;
  tooltip: string;
}

export interface PotreroStockEquinoResumenHome {
  potreroId: number | null;
  potreroNombre: string;
  total: number;
  totalUe: number;
  hectareas: number | null;
  dotacion: DotacionEquinaResumen;
}

export interface HomeStockEquinoPotreroSnapshot {
  potreros: PotreroStockEquinoResumenHome[];
  totales: SexoDispositivoCounts & { total: number; sinPotrero: number };
  potrerosConStock: number;
  potrerosEnMapa: number;
  densidadPromedio: number | null;
}

const SIN_POTRERO_ID = -1;
const SIN_POTRERO_NOMBRE = "Sin potrero";

function calcularUePorHa(totalUe: number, hectareas: number | null): number | null {
  if (totalUe <= 0 || hectareas == null || !Number.isFinite(hectareas) || hectareas <= 0) {
    return null;
  }
  return Math.round((totalUe / hectareas) * 100) / 100;
}

function formatUeHa(valor: number): string {
  const digits = valor >= 10 ? 1 : 2;
  return `${valor.toLocaleString("es-UY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} UE/ha`;
}

export function buildDotacionEquinaResumen(
  devices: ReadonlyArray<StockEquinaDispositivo>,
  hectareas: number | null,
): DotacionEquinaResumen {
  const total = devices.length;
  const totalUe = totalUeDispositivos(devices);
  const uePorHa = calcularUePorHa(totalUe, hectareas);

  if (uePorHa == null) {
    return {
      uePorHa: null,
      cabPorHa: null,
      total,
      totalUe,
      hectareas,
      nivel: "sin-dato",
      etiqueta: hectareas == null || hectareas <= 0 ? "Sin área" : "Sin stock",
      consejo:
        hectareas == null || hectareas <= 0
          ? "Definí la superficie del potrero en el mapa."
          : "No hay equinos activos en este potrero.",
      tooltip:
        hectareas == null || hectareas <= 0
          ? "Sin hectáreas del mapa para calcular densidad."
          : "Sin equinos activos en este potrero.",
    };
  }

  const clasificacion = clasificarDotacion(uePorHa);
  const haLabel = hectareas != null ? formatHectareas(hectareas) : "—";
  return {
    uePorHa,
    cabPorHa: uePorHa,
    total,
    totalUe,
    hectareas,
    ...clasificacion,
    tooltip: `${formatUnidadEquina(totalUe)} (${total} equino${total === 1 ? "" : "s"}) ÷ ${haLabel} = ${formatUeHa(uePorHa)}. Referencia ${EQUINO_HA_CAPACIDAD_REFERENCIA} UE/ha = 100%.`,
  };
}

function resumenDesdeDispositivos(
  potreroId: number | null,
  potreroNombre: string,
  devices: StockEquinaDispositivo[],
  hectareas: number | null,
): PotreroStockEquinoResumenHome {
  const dotacion = buildDotacionEquinaResumen(devices, hectareas);
  return {
    potreroId,
    potreroNombre,
    total: devices.length,
    totalUe: dotacion.totalUe,
    hectareas,
    dotacion,
  };
}

function densidadPromedioPonderada(
  potreros: PotreroStockEquinoResumenHome[],
): number | null {
  let sumUe = 0;
  let sumHa = 0;
  for (const p of potreros) {
    if (p.potreroId === SIN_POTRERO_ID) continue;
    if (p.hectareas == null || p.hectareas <= 0 || p.totalUe <= 0) continue;
    sumUe += p.totalUe;
    sumHa += p.hectareas;
  }
  if (sumHa <= 0 || sumUe <= 0) return null;
  return Math.round((sumUe / sumHa) * 100) / 100;
}

export function buildHomeStockEquinoPotreroSnapshot(
  potrerosMapa: CampoPotreroMapa[],
  equino: StockEquinaDispositivo[],
): HomeStockEquinoPotreroSnapshot {
  const activos = filtrarDispositivosActivosStock(equino);
  const asignados = new Set<string>();
  const potreros: PotreroStockEquinoResumenHome[] = [];

  for (const potrero of potrerosMapa) {
    const devices = collectCampoMapaFeatureDevices(
      potrero.nombre,
      potrero.metadata,
      [],
      activos,
    )
      .filter((item) => item.kind === "equino")
      .map((item) => item.device);

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

export function potreroStockEquinoEsSinAsignar(
  resumen: PotreroStockEquinoResumenHome,
): boolean {
  return resumen.potreroId === SIN_POTRERO_ID;
}

export function formatAreaCeldaEquino(dotacion: DotacionEquinaResumen): string | null {
  if (dotacion.hectareas == null || dotacion.hectareas <= 0) return null;
  return formatHectareas(dotacion.hectareas);
}

export function formatDotacionCeldaEquino(dotacion: DotacionEquinaResumen): {
  principal: string;
  secundario: string | null;
} {
  if (dotacion.uePorHa == null) {
    return { principal: dotacion.etiqueta, secundario: null };
  }
  return {
    principal: formatUeHa(dotacion.uePorHa),
    secundario:
      dotacion.hectareas != null
        ? `${formatHectareas(dotacion.hectareas)} · ${dotacion.etiqueta}`
        : dotacion.etiqueta,
  };
}

export function formatOcupacionCeldaEquino(dotacion: DotacionEquinaResumen): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (dotacion.uePorHa == null || dotacion.hectareas == null) return null;
  const pct = Math.round((dotacion.uePorHa / EQUINO_HA_CAPACIDAD_REFERENCIA) * 100);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: dotacion.nivel,
    tooltip: dotacion.tooltip,
  };
}

export function formatDensidadPromedioEquino(ueHa: number | null): {
  principal: string;
  etiqueta: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (ueHa == null) return null;
  const clasificacion = clasificarDotacion(ueHa);
  return {
    principal: formatUeHa(ueHa),
    etiqueta: clasificacion.etiqueta,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado en potreros con superficie: ${formatUeHa(ueHa)}.`,
  };
}

export function formatOcupacionPromedioEquino(ueHa: number | null): {
  principal: string;
  nivel: DotacionNivel;
  tooltip: string;
} | null {
  if (ueHa == null) return null;
  const pct = Math.round((ueHa / EQUINO_HA_CAPACIDAD_REFERENCIA) * 100);
  const clasificacion = clasificarDotacion(ueHa);
  return {
    principal: `${pct.toLocaleString("es-UY")}%`,
    nivel: clasificacion.nivel,
    tooltip: `Promedio ponderado: ${pct}% de ocupación (UE ÷ ha del mapa, referencia 1 UE/ha = 100%).`,
  };
}
