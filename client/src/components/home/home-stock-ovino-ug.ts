import type { StockOvinaDispositivo } from "../../types";
import {
  categoriasDispositivo,
  type CategoriaFiltroKey,
} from "../stock-ovino/stock-ovina-utils";
import {
  categoriaDotacionOvinaPorId,
  type CategoriaDotacionOvinaId,
  uoPorCategoriaId,
} from "../../utils/dotacion-ovina-ug";

const CATEGORIA_A_DOTACION: Record<
  Exclude<CategoriaFiltroKey, "SIN_SEXO">,
  CategoriaDotacionOvinaId
> = {
  CORDERA: "cordera",
  BORREGA: "borrega",
  OVEJA: "oveja",
  CORDERO: "cordero",
  BORREGO: "borrego",
  CAPON: "capon",
  CARNERO: "carnero",
};

/** Una sola categoría UO por ovino (tabla Configuración SAG · Dotación ovina). */
export function categoriaDotacionOvinaIdDispositivo(
  d: StockOvinaDispositivo,
): CategoriaDotacionOvinaId {
  const cats = [...categoriasDispositivo(d)];
  if (cats.length === 0 || cats.includes("SIN_SEXO")) return "sin_clasificar";

  // Adulto macho sin castrado definido: promedio capón/carnero → usar capón (1 UO).
  if (cats.includes("CAPON") && cats.includes("CARNERO")) {
    return "capon";
  }

  for (const key of cats) {
    if (key === "SIN_SEXO") continue;
    const mapped = CATEGORIA_A_DOTACION[key];
    if (mapped) return mapped;
  }

  return "sin_clasificar";
}

export function uoDispositivoOvino(d: StockOvinaDispositivo): number {
  return uoPorCategoriaId(categoriaDotacionOvinaIdDispositivo(d));
}

export function totalUoDispositivos(
  devices: ReadonlyArray<StockOvinaDispositivo>,
): number {
  let total = 0;
  for (const device of devices) {
    total += uoDispositivoOvino(device);
  }
  return Math.round(total * 1000) / 1000;
}

export function resumenUoPorCategoria(
  devices: ReadonlyArray<StockOvinaDispositivo>,
): { id: CategoriaDotacionOvinaId; cabezas: number; uo: number }[] {
  const counts = new Map<CategoriaDotacionOvinaId, number>();
  for (const device of devices) {
    const id = categoriaDotacionOvinaIdDispositivo(device);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, cabezas]) => ({
      id,
      cabezas,
      uo: Math.round(cabezas * uoPorCategoriaId(id) * 1000) / 1000,
    }))
    .sort((a, b) => b.uo - a.uo || b.cabezas - a.cabezas);
}

export function labelCategoriaDotacionOvina(id: CategoriaDotacionOvinaId): string {
  return categoriaDotacionOvinaPorId(id).categoria;
}
