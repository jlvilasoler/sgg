import type { StockGanaderaDispositivo } from "../../types";
import {
  edadMesesDispositivo,
  etapaHembraDesdeMeses,
  etapaMachoDesdeMeses,
  mesesReferenciaTimeline,
} from "../stock/stock-ganadera-utils";
import {
  categoriaDotacionPorId,
  type CategoriaDotacionId,
  ugPorCategoriaId,
} from "../../utils/dotacion-ganadera-ug";

function dispositivoEsToro(d: Pick<StockGanaderaDispositivo, "grupo" | "grupo_libre" | "observaciones">): boolean {
  const haystack = [d.grupo, d.grupo_libre, d.observaciones]
    .join(" ")
    .toLowerCase();
  return /\btoro\b/.test(haystack) || /\breproductor\b/.test(haystack);
}

/** Una sola categoría UG por dispositivo (tabla Configuración SAG). */
export function categoriaDotacionIdDispositivo(
  d: StockGanaderaDispositivo,
): CategoriaDotacionId {
  if (!d.sexo) return "sin_clasificar";

  const edadMeses = edadMesesDispositivo(d);
  if (edadMeses === null) return "sin_clasificar";

  const meses = mesesReferenciaTimeline(
    d.estado,
    edadMeses,
    d.nacimiento_mes,
    d.nacimiento_anio,
    d.baja_mes,
    d.baja_anio,
  );
  if (meses === null) return "sin_clasificar";

  if (d.sexo === "HEMBRA") {
    const etapa = etapaHembraDesdeMeses(meses);
    const map = {
      TERNERA: "ternero",
      VAQUILLONA: "vaquillona_1_2",
      VAQUILLONA_MAS_2: "vaquillona_mas_2",
      VACA: "vaca_36",
    } as const satisfies Record<string, CategoriaDotacionId>;
    return map[etapa.id];
  }

  if (d.sexo === "MACHO") {
    const etapa = etapaMachoDesdeMeses(meses);
    if (etapa.id === "TERNERO") return "ternero";
    const esToro = dispositivoEsToro(d);
    if (etapa.id === "JOVEN_1_2") return esToro ? "toro_1_2" : "novillo_1_2";
    return esToro ? "toro_mas_2" : "novillo_mas_2";
  }

  return "sin_clasificar";
}

export function ugDispositivoGanadero(d: StockGanaderaDispositivo): number {
  return ugPorCategoriaId(categoriaDotacionIdDispositivo(d));
}

export function totalUgDispositivos(
  devices: ReadonlyArray<StockGanaderaDispositivo>,
): number {
  let total = 0;
  for (const device of devices) {
    total += ugDispositivoGanadero(device);
  }
  return Math.round(total * 1000) / 1000;
}

export function resumenUgPorCategoria(
  devices: ReadonlyArray<StockGanaderaDispositivo>,
): { id: CategoriaDotacionId; cabezas: number; ug: number }[] {
  const counts = new Map<CategoriaDotacionId, number>();
  for (const device of devices) {
    const id = categoriaDotacionIdDispositivo(device);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, cabezas]) => ({
      id,
      cabezas,
      ug: Math.round(cabezas * ugPorCategoriaId(id) * 1000) / 1000,
    }))
    .sort((a, b) => b.ug - a.ug || b.cabezas - a.cabezas);
}

export function labelCategoriaDotacion(id: CategoriaDotacionId): string {
  return categoriaDotacionPorId(id).categoria;
}
