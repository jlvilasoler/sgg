import type { SegmentoPreciosGanado } from "../../types";
import {
  CATEGORIA_GANADO_GORDO_LABELS,
  CATEGORIA_GANADO_REPOSICION_LABELS,
  PRECIO_GANADO_GORDO_UNIDAD_LABEL,
  PRECIO_GANADO_REPOSICION_UNIDAD_LABEL,
} from "../../types";

export interface PreciosGanadoSegmentoConfig {
  id: SegmentoPreciosGanado;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  categorias: readonly string[];
  labels: Record<string, string>;
  chartColors: Record<string, string>;
  unidadLabel: string;
  icon: "gordo" | "reposicion";
}

export const PRECIOS_GANADO_SEGMENTOS: PreciosGanadoSegmentoConfig[] = [
  {
    id: "GORDO",
    titulo: "Ganado gordo",
    subtitulo: "Novillo · Vaca · Vaquillona",
    descripcion: "Promedios semanales en dólares por kilo en cuarta balanza.",
    categorias: ["NOVILLO", "VACA", "VAQUILLONA"],
    labels: CATEGORIA_GANADO_GORDO_LABELS,
    chartColors: {
      NOVILLO: "#f0b90b",
      VACA: "#2ebd85",
      VAQUILLONA: "#5b8def",
    },
    unidadLabel: PRECIO_GANADO_GORDO_UNIDAD_LABEL,
    icon: "gordo",
  },
  {
    id: "REPOSICION",
    titulo: "Reposición",
    subtitulo: "Ternero · Ternera · Vaca invernada",
    descripcion: "Promedios semanales en dólares por kilo en pie.",
    categorias: ["TERNERO", "TERNERA", "VACA_INVERNADA"],
    labels: CATEGORIA_GANADO_REPOSICION_LABELS,
    chartColors: {
      TERNERO: "#f0b90b",
      TERNERA: "#2ebd85",
      VACA_INVERNADA: "#8b5cf6",
    },
    unidadLabel: PRECIO_GANADO_REPOSICION_UNIDAD_LABEL,
    icon: "reposicion",
  },
];

export const PRECIOS_GANADO_SEGMENTO_MAP = Object.fromEntries(
  PRECIOS_GANADO_SEGMENTOS.map((s) => [s.id, s])
) as Record<SegmentoPreciosGanado, PreciosGanadoSegmentoConfig>;
