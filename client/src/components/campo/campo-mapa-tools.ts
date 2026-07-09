import type { CampoMapaElementoTipo } from "../../types";

export type CampoMapaTool =
  | "navegar"
  | "marcador"
  | "nota"
  | "objeto"
  | "linea"
  | "area"
  | "dibujar"
  | "contorno"
  | "medir_distancia"
  | "medir_area"
  | "clip";

export interface CampoMapaToolDef {
  id: CampoMapaTool;
  label: string;
  hint: string;
  group: "navegar" | "dibujar" | "medir" | "guardar";
}

export const CAMPO_MAPA_TOOLS: CampoMapaToolDef[] = [
  {
    id: "navegar",
    label: "Mover",
    hint: "Desplazá y hacé zoom en el mapa.",
    group: "navegar",
  },
  {
    id: "marcador",
    label: "Marcador",
    hint: "Hacé clic en el mapa para colocar un punto.",
    group: "dibujar",
  },
  {
    id: "nota",
    label: "Nota",
    hint: "Hacé clic en el mapa y escribí una nota en un globo.",
    group: "dibujar",
  },
  {
    id: "objeto",
    label: "Objetos",
    hint: "Elegí un objeto de campo y ubicálo en el mapa.",
    group: "dibujar",
  },
  {
    id: "dibujar",
    label: "Dibujar",
    hint: "Marcá puntos para dibujar líneas o polígonos; al finalizar elegís cómo guardarlo.",
    group: "dibujar",
  },
  {
    id: "contorno",
    label: "Contorno",
    hint: "Marcá puntos unidos por líneas rectas y finalizá; el área queda vacía (sin relleno).",
    group: "dibujar",
  },
  {
    id: "medir_distancia",
    label: "Medir distancia",
    hint: "Medí distancias entre puntos.",
    group: "medir",
  },
  {
    id: "medir_area",
    label: "Medir área",
    hint: "Medí la superficie de un polígono.",
    group: "medir",
  },
  {
    id: "clip",
    label: "Clip de vista",
    hint: "Guardá la vista actual del mapa como acceso rápido.",
    group: "guardar",
  },
];

export function toolUsesSketch(tool: CampoMapaTool): boolean {
  return ["dibujar", "contorno", "medir_distancia", "medir_area"].includes(tool);
}

export function toolSketchIsPolygon(tool: CampoMapaTool): boolean {
  return tool === "medir_area" || tool === "contorno";
}

/** Vista previa del trazo: polígono cerrado o línea abierta según vértices. */
export function sketchShowsAsPolygon(tool: CampoMapaTool, vertexCount: number): boolean {
  if (tool === "dibujar") return vertexCount >= 3;
  if (tool === "contorno") return vertexCount >= 3;
  return toolSketchIsPolygon(tool);
}

export function toolSketchIsPoint(tool: CampoMapaTool): boolean {
  return tool === "marcador" || tool === "nota";
}

export function toolToElementoTipo(tool: CampoMapaTool): CampoMapaElementoTipo | null {
  switch (tool) {
    case "marcador":
      return "marcador";
    case "nota":
      return "nota";
    case "linea":
      return "linea";
    case "area":
    case "contorno":
      return "area";
    case "medir_distancia":
      return "medicion_distancia";
    case "medir_area":
      return "medicion_area";
    case "clip":
      return "clip";
    default:
      return null;
  }
}

export const ELEMENTO_TIPO_LABELS: Record<CampoMapaElementoTipo, string> = {
  marcador: "Marcador",
  nota: "Nota",
  linea: "Línea",
  area: "Área",
  clip: "Clip",
  medicion_distancia: "Medición dist.",
  medicion_area: "Medición área",
};

export function getToolDef(tool: CampoMapaTool): CampoMapaToolDef {
  return CAMPO_MAPA_TOOLS.find((t) => t.id === tool) ?? CAMPO_MAPA_TOOLS[0];
}
