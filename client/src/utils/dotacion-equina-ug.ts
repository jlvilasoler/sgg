export type GrupoUnidadEquina = "Hembra" | "Macho" | "Común";

export type CategoriaDotacionEquinaId =
  | "potranca"
  | "potra"
  | "yegua"
  | "potrillo"
  | "potro"
  | "caballo"
  | "padrillo"
  | "sin_clasificar";

export interface CategoriaUnidadEquina {
  id: CategoriaDotacionEquinaId;
  categoria: string;
  grupo: GrupoUnidadEquina;
  ue: number;
  detalle?: string;
}

/**
 * Equivalencias de referencia SAG para dotación equina (UE por cabeza).
 * Categorías = mismo cronograma de evolución del stock equino (sexo + edad).
 * 1 UE = yegua / caballo adulto de referencia.
 */
export const CATEGORIAS_UNIDAD_EQUINA: readonly CategoriaUnidadEquina[] = [
  {
    id: "potranca",
    categoria: "Potranca",
    grupo: "Hembra",
    ue: 0.4,
    detalle: "0 a 12 meses",
  },
  {
    id: "potra",
    categoria: "Potra",
    grupo: "Hembra",
    ue: 0.7,
    detalle: "12 a 36 meses",
  },
  {
    id: "yegua",
    categoria: "Yegua",
    grupo: "Hembra",
    ue: 1,
    detalle: "36 meses o más · adulta",
  },
  {
    id: "potrillo",
    categoria: "Potrillo",
    grupo: "Macho",
    ue: 0.4,
    detalle: "0 a 12 meses",
  },
  {
    id: "potro",
    categoria: "Potro",
    grupo: "Macho",
    ue: 0.75,
    detalle: "12 a 36 meses",
  },
  {
    id: "caballo",
    categoria: "Caballo",
    grupo: "Macho",
    ue: 1,
    detalle: "36 meses o más · castrado",
  },
  {
    id: "padrillo",
    categoria: "Padrillo",
    grupo: "Macho",
    ue: 1.15,
    detalle: "36 meses o más · entero / reproductor",
  },
] as const;

const UE_POR_CATEGORIA = new Map(
  CATEGORIAS_UNIDAD_EQUINA.map((row) => [row.id, row.ue] as const),
);

const CATEGORIA_POR_ID = new Map(
  CATEGORIAS_UNIDAD_EQUINA.map((row) => [row.id, row] as const),
);

const SIN_CLASIFICAR: CategoriaUnidadEquina = {
  id: "sin_clasificar",
  categoria: "Sin clasificar",
  grupo: "Común",
  ue: 1,
  detalle: "Sin sexo o edad · se asume 1 UE",
};

export function formatUnidadEquina(ue: number): string {
  const fractionDigits =
    Number.isInteger(ue) ? 0 : Number.isInteger(ue * 100) ? 2 : 3;
  return `${ue.toLocaleString("es-UY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} UE`;
}

export function uePorCategoriaId(id: CategoriaDotacionEquinaId): number {
  return UE_POR_CATEGORIA.get(id) ?? 1;
}

export function categoriaDotacionEquinaPorId(
  id: CategoriaDotacionEquinaId,
): CategoriaUnidadEquina {
  return CATEGORIA_POR_ID.get(id) ?? SIN_CLASIFICAR;
}
