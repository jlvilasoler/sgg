export type GrupoUnidadGanadera = "Común" | "Hembra" | "Macho";

export type CategoriaDotacionId =
  | "ternero"
  | "vaquillona_1_2"
  | "vaquillona_mas_2"
  | "vaca_36"
  | "novillo_1_2"
  | "novillo_mas_2"
  | "toro_1_2"
  | "toro_mas_2"
  | "sin_clasificar";

export interface CategoriaUnidadGanadera {
  id: CategoriaDotacionId;
  categoria: string;
  grupo: GrupoUnidadGanadera;
  ug: number;
  detalle?: string;
}

/** Equivalencias de referencia SAG para dotación ganadera (UG por cabeza). */
export const CATEGORIAS_UNIDAD_GANADERA: readonly CategoriaUnidadGanadera[] = [
  {
    id: "ternero",
    categoria: "Terneros y terneras",
    grupo: "Común",
    ug: 0.5,
    detalle: "Hasta el destete / primer año",
  },
  {
    id: "vaquillona_1_2",
    categoria: "Vaquillona 1 a 2 años",
    grupo: "Hembra",
    ug: 0.65,
    detalle: "12 a 24 meses",
  },
  {
    id: "vaquillona_mas_2",
    categoria: "Vaquillonas de +2 años",
    grupo: "Hembra",
    ug: 0.8,
    detalle: "Más de 24 meses, sin servicio",
  },
  {
    id: "vaca_36",
    categoria: "Vacas +36 meses",
    grupo: "Hembra",
    ug: 1,
    detalle: "Vaca adulta en producción",
  },
  {
    id: "novillo_1_2",
    categoria: "Novillo 1 a 2 años",
    grupo: "Macho",
    ug: 0.65,
    detalle: "12 a 24 meses",
  },
  {
    id: "novillo_mas_2",
    categoria: "Novillos +2 años",
    grupo: "Macho",
    ug: 1,
    detalle: "Más de 24 meses",
  },
  {
    id: "toro_1_2",
    categoria: "Toro 1–2 años",
    grupo: "Macho",
    ug: 0.8,
    detalle: "12 a 24 meses",
  },
  {
    id: "toro_mas_2",
    categoria: "Toro +2 años",
    grupo: "Macho",
    ug: 1.2,
    detalle: "Reproductor adulto",
  },
] as const;

const UG_POR_CATEGORIA = new Map(
  CATEGORIAS_UNIDAD_GANADERA.map((row) => [row.id, row.ug] as const),
);

const CATEGORIA_POR_ID = new Map(
  CATEGORIAS_UNIDAD_GANADERA.map((row) => [row.id, row] as const),
);

const SIN_CLASIFICAR: CategoriaUnidadGanadera = {
  id: "sin_clasificar",
  categoria: "Sin clasificar",
  grupo: "Común",
  ug: 1,
  detalle: "Sin sexo o edad · se asume 1 UG",
};

export function formatUnidadGanadera(ug: number): string {
  const fractionDigits =
    Number.isInteger(ug) ? 0 : Number.isInteger(ug * 100) ? 2 : 3;
  return `${ug.toLocaleString("es-UY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} UG`;
}

export function ugPorCategoriaId(id: CategoriaDotacionId): number {
  return UG_POR_CATEGORIA.get(id) ?? 1;
}

export function categoriaDotacionPorId(id: CategoriaDotacionId): CategoriaUnidadGanadera {
  return CATEGORIA_POR_ID.get(id) ?? SIN_CLASIFICAR;
}
