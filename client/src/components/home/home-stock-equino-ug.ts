import type { StockEquinaDispositivo } from "../../types";
import {
  categoriasDispositivo,
  type CategoriaFiltroKey,
} from "../stock-equino/stock-equina-utils";
import {
  categoriaDotacionEquinaPorId,
  type CategoriaDotacionEquinaId,
  uePorCategoriaId,
} from "../../utils/dotacion-equina-ug";

const CATEGORIA_A_DOTACION: Record<
  Exclude<CategoriaFiltroKey, "SIN_SEXO">,
  CategoriaDotacionEquinaId
> = {
  POTRANCA: "potranca",
  POTRA: "potra",
  YEGUA: "yegua",
  POTRILLO: "potrillo",
  POTRO: "potro",
  CABALLO: "caballo",
  PADRILLO: "padrillo",
};

/** Una sola categoría UE por equino (tabla Configuración SAG · Dotación equina). */
export function categoriaDotacionEquinaIdDispositivo(
  d: StockEquinaDispositivo,
): CategoriaDotacionEquinaId {
  const cats = [...categoriasDispositivo(d)];
  if (cats.length === 0 || cats.includes("SIN_SEXO")) return "sin_clasificar";

  // Adulto macho sin castrado definido: promedio caballo/padrillo → usar caballo (1 UE).
  if (cats.includes("CABALLO") && cats.includes("PADRILLO")) {
    return "caballo";
  }

  for (const key of cats) {
    if (key === "SIN_SEXO") continue;
    const mapped = CATEGORIA_A_DOTACION[key];
    if (mapped) return mapped;
  }

  return "sin_clasificar";
}

export function ueDispositivoEquino(d: StockEquinaDispositivo): number {
  return uePorCategoriaId(categoriaDotacionEquinaIdDispositivo(d));
}

export function totalUeDispositivos(
  devices: ReadonlyArray<StockEquinaDispositivo>,
): number {
  let total = 0;
  for (const device of devices) {
    total += ueDispositivoEquino(device);
  }
  return Math.round(total * 1000) / 1000;
}

export function resumenUePorCategoria(
  devices: ReadonlyArray<StockEquinaDispositivo>,
): { id: CategoriaDotacionEquinaId; cabezas: number; ue: number }[] {
  const counts = new Map<CategoriaDotacionEquinaId, number>();
  for (const device of devices) {
    const id = categoriaDotacionEquinaIdDispositivo(device);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, cabezas]) => ({
      id,
      cabezas,
      ue: Math.round(cabezas * uePorCategoriaId(id) * 1000) / 1000,
    }))
    .sort((a, b) => b.ue - a.ue || b.cabezas - a.cabezas);
}

export function labelCategoriaDotacionEquina(id: CategoriaDotacionEquinaId): string {
  return categoriaDotacionEquinaPorId(id).categoria;
}
