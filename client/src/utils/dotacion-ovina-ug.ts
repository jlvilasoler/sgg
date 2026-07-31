export type GrupoUnidadOvina = "Hembra" | "Macho" | "Común";

export type CategoriaDotacionOvinaId =
  | "cordera"
  | "borrega"
  | "oveja"
  | "cordero"
  | "borrego"
  | "capon"
  | "carnero"
  | "sin_clasificar";

export interface CategoriaUnidadOvina {
  id: CategoriaDotacionOvinaId;
  categoria: string;
  grupo: GrupoUnidadOvina;
  uo: number;
  detalle?: string;
}

/**
 * Equivalencias de referencia SAG para dotación ovina (UO por cabeza).
 * Categorías = mismo cronograma de evolución del stock ovino (sexo + edad).
 * 1 UO = oveja / capón adulto de referencia.
 */
export const CATEGORIAS_UNIDAD_OVINA: readonly CategoriaUnidadOvina[] = [
  {
    id: "cordera",
    categoria: "Cordera",
    grupo: "Hembra",
    uo: 0.4,
    detalle: "0 a 12 meses",
  },
  {
    id: "borrega",
    categoria: "Borrega",
    grupo: "Hembra",
    uo: 0.7,
    detalle: "12 a 36 meses",
  },
  {
    id: "oveja",
    categoria: "Oveja",
    grupo: "Hembra",
    uo: 1,
    detalle: "36 meses o más · adulta",
  },
  {
    id: "cordero",
    categoria: "Cordero",
    grupo: "Macho",
    uo: 0.4,
    detalle: "0 a 12 meses",
  },
  {
    id: "borrego",
    categoria: "Borrego",
    grupo: "Macho",
    uo: 0.7,
    detalle: "12 a 36 meses",
  },
  {
    id: "capon",
    categoria: "Capón",
    grupo: "Macho",
    uo: 1,
    detalle: "36 meses o más · castrado",
  },
  {
    id: "carnero",
    categoria: "Carnero",
    grupo: "Macho",
    uo: 1.15,
    detalle: "36 meses o más · entero / reproductor",
  },
] as const;

const UO_POR_CATEGORIA = new Map(
  CATEGORIAS_UNIDAD_OVINA.map((row) => [row.id, row.uo] as const),
);

const CATEGORIA_POR_ID = new Map(
  CATEGORIAS_UNIDAD_OVINA.map((row) => [row.id, row] as const),
);

const SIN_CLASIFICAR: CategoriaUnidadOvina = {
  id: "sin_clasificar",
  categoria: "Sin clasificar",
  grupo: "Común",
  uo: 0,
  detalle: "Sin sexo o edad · no aporta UO",
};

export function formatUnidadOvina(uo: number): string {
  const fractionDigits =
    Number.isInteger(uo) ? 0 : Number.isInteger(uo * 100) ? 2 : 3;
  return `${uo.toLocaleString("es-UY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} UO`;
}

export function uoPorCategoriaId(id: CategoriaDotacionOvinaId): number {
  if (id === "sin_clasificar") return SIN_CLASIFICAR.uo;
  return UO_POR_CATEGORIA.get(id) ?? 1;
}

export function categoriaDotacionOvinaPorId(
  id: CategoriaDotacionOvinaId,
): CategoriaUnidadOvina {
  return CATEGORIA_POR_ID.get(id) ?? SIN_CLASIFICAR;
}
