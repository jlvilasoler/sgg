import type { CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { collectCampoMapaFeatureDevices } from "../campo/campo-mapa-dispositivos-map";
import {
  buildDotacionGanaderaResumen,
  dotacionPromedioPonderada,
  resolvePotreroHectareas,
  type DotacionGanaderaResumen,
} from "./home-stock-potrero-dotacion";
import { totalUgDispositivos } from "./home-stock-potrero-ug";
import {
  contarSexoDispositivos,
  filtrarDispositivosActivosStock,
  type SexoDispositivoCounts,
} from "../stock/stock-ganadera-utils";

export interface PotreroStockResumenHome {
  potreroId: number | null;
  potreroNombre: string;
  total: number;
  totalUg: number;
  hectareas: number | null;
  dotacion: DotacionGanaderaResumen;
}

export interface HomeStockPotreroSnapshot {
  potreros: PotreroStockResumenHome[];
  totales: SexoDispositivoCounts & { total: number; sinPotrero: number };
  potrerosConStock: number;
  potrerosEnMapa: number;
  dotacionPromedio: number | null;
}

const SIN_POTRERO_ID = -1;
const SIN_POTRERO_NOMBRE = "Sin potrero";

function resumenDesdeDispositivos(
  potreroId: number | null,
  potreroNombre: string,
  devices: StockGanaderaDispositivo[],
  hectareas: number | null,
): PotreroStockResumenHome {
  const totalUg = totalUgDispositivos(devices);
  return {
    potreroId,
    potreroNombre,
    total: devices.length,
    totalUg,
    hectareas,
    dotacion: buildDotacionGanaderaResumen(devices, hectareas),
  };
}

export function buildHomeStockPotreroSnapshot(
  potrerosMapa: CampoPotreroMapa[],
  ganadero: StockGanaderaDispositivo[],
): HomeStockPotreroSnapshot {
  const activos = filtrarDispositivosActivosStock(ganadero);
  const asignados = new Set<string>();
  const potreros: PotreroStockResumenHome[] = [];

  for (const potrero of potrerosMapa) {
    const devices = collectCampoMapaFeatureDevices(
      potrero.nombre,
      potrero.metadata,
      activos,
      [],
    )
      .filter((item) => item.kind === "ganadero")
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
    dotacionPromedio: dotacionPromedioPonderada(potreros, SIN_POTRERO_ID),
  };
}

export function potreroStockCardEsSinAsignar(resumen: PotreroStockResumenHome): boolean {
  return resumen.potreroId === SIN_POTRERO_ID;
}
