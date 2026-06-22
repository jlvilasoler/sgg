import type { SimuladorVentaTipo } from "../../types";
import {
  CATEGORIA_GANADO_GORDO_LABELS,
  CATEGORIA_GANADO_REPOSICION_LABELS,
  PRECIO_GANADO_GORDO_UNIDAD_LABEL,
  PRECIO_GANADO_REPOSICION_UNIDAD_LABEL,
} from "../../types";

export interface SimuladorVentaTipoConfig {
  id: SimuladorVentaTipo;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  unidadLabel: string;
  categorias: readonly string[];
  labels: Record<string, string>;
  chartColors: Record<string, string>;
  icon: "pie" | "balanza";
}

export const SIMULADOR_VENTA_TIPOS: SimuladorVentaTipoConfig[] = [
  {
    id: "EN_PIE",
    titulo: "Venta en pie",
    subtitulo: "Ternero · Ternera · Vaca invernada",
    descripcion: "Simulá ingresos por kg en pie con el último precio de reposición (ACG).",
    unidadLabel: PRECIO_GANADO_REPOSICION_UNIDAD_LABEL,
    categorias: ["TERNERO", "TERNERA", "VACA_INVERNADA"],
    labels: CATEGORIA_GANADO_REPOSICION_LABELS,
    chartColors: {
      TERNERO: "#f0b90b",
      TERNERA: "#2ebd85",
      VACA_INVERNADA: "#8b5cf6",
    },
    icon: "pie",
  },
  {
    id: "CUARTA_BALANZA",
    titulo: "Venta en cuarta balanza",
    subtitulo: "Novillo · Vaca · Vaquillona",
    descripcion:
      "Simulá ingresos a frigorífico: precio gordo × kg × rendimiento estimado (ACG).",
    unidadLabel: PRECIO_GANADO_GORDO_UNIDAD_LABEL,
    categorias: ["NOVILLO", "VACA", "VAQUILLONA"],
    labels: CATEGORIA_GANADO_GORDO_LABELS,
    chartColors: {
      NOVILLO: "#f0b90b",
      VACA: "#2ebd85",
      VAQUILLONA: "#5b8def",
    },
    icon: "balanza",
  },
];

export const SIMULADOR_VENTA_TIPO_MAP = Object.fromEntries(
  SIMULADOR_VENTA_TIPOS.map((t) => [t.id, t])
) as Record<SimuladorVentaTipo, SimuladorVentaTipoConfig>;

export function operacionPrefixForTipo(tipo: SimuladorVentaTipo): "VP" | "VC" {
  return tipo === "EN_PIE" ? "VP" : "VC";
}

/** Mapeo categoría simulador → claves de filtro del stock (evolución por edad/sexo). */
export const SIMULADOR_CATEGORIA_A_FILTRO: Record<string, readonly string[]> = {
  TERNERO: ["TERNERO"],
  TERNERA: ["TERNERA"],
  VACA_INVERNADA: ["VACA"],
  NOVILLO: ["NOVILLO_1_2", "NOVILLO_MAS_2"],
  VACA: ["VACA"],
  VAQUILLONA: ["VAQUILLONA_1_2", "VAQUILLONA_MAS_2"],
};

export function simuladorCategoriaAFiltroKeys(categoria: string): Set<string> {
  const keys = SIMULADOR_CATEGORIA_A_FILTRO[categoria];
  return keys?.length ? new Set(keys) : new Set();
}
