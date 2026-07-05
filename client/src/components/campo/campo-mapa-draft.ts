import type { CampoMapaTool } from "./campo-mapa-tools";
import { toolSketchIsPolygon } from "./campo-mapa-tools";
import type { MapLatLng } from "./campo-mapa-geo";

export type DraftSaveTarget = "potrero" | "marcador" | "area" | "linea";
export type DraftGeometry = "polygon" | "line" | "point";

export function draftGeometryFromDraft(draft: {
  sourceTool: CampoMapaTool;
  paths?: MapLatLng[];
  point?: MapLatLng;
}): DraftGeometry {
  if (draft.point) return "point";
  if (draft.paths && draft.paths.length >= 3 && toolSketchIsPolygon(draft.sourceTool)) {
    return "polygon";
  }
  if (draft.paths && draft.paths.length >= 2) return "line";
  return "point";
}

export function availableSaveTargets(geometry: DraftGeometry): DraftSaveTarget[] {
  switch (geometry) {
    case "polygon":
      return ["potrero", "area", "marcador"];
    case "line":
      return ["linea", "marcador"];
    default:
      return ["marcador"];
  }
}

export function defaultSaveTarget(
  geometry: DraftGeometry,
  sourceTool: CampoMapaTool,
): DraftSaveTarget {
  if (geometry === "polygon") {
    return sourceTool === "area" ? "potrero" : "potrero";
  }
  if (geometry === "line") return "linea";
  return "marcador";
}

export function saveTargetLabel(target: DraftSaveTarget): string {
  switch (target) {
    case "potrero":
      return "Potrero";
    case "marcador":
      return "Marcador";
    case "area":
      return "Área";
    case "linea":
      return "Línea";
  }
}

export function draftTitle(target: DraftSaveTarget): string {
  switch (target) {
    case "potrero":
      return "Nuevo potrero";
    case "marcador":
      return "Nuevo marcador";
    case "area":
      return "Nueva área";
    case "linea":
      return "Nueva línea";
  }
}

export function draftSaveButton(target: DraftSaveTarget, isMeasurement?: boolean): string {
  if (isMeasurement) return "Guardar medición";
  switch (target) {
    case "potrero":
      return "Guardar potrero";
    case "marcador":
      return "Guardar marcador";
    case "area":
      return "Guardar área";
    case "linea":
      return "Guardar línea";
    default:
      return "Guardar";
  }
}

export function draftNombrePlaceholder(target: DraftSaveTarget): string {
  switch (target) {
    case "potrero":
      return "Nombre del potrero";
    case "marcador":
      return "Nombre del marcador";
    case "area":
      return "Nombre del área";
    case "linea":
      return "Nombre de la línea";
  }
}

export function saveTargetHint(target: DraftSaveTarget): string {
  switch (target) {
    case "potrero":
      return "Quedará en potreros del mapa y en el catálogo de stock.";
    case "marcador":
      return "Se guarda como punto de referencia en elementos.";
    case "area":
      return "Polígono genérico en elementos del mapa.";
    case "linea":
      return "Se guarda como línea en elementos del mapa.";
  }
}

export function centroidOfPaths(paths: MapLatLng[]): MapLatLng {
  const lat = paths.reduce((sum, p) => sum + p.lat, 0) / paths.length;
  const lng = paths.reduce((sum, p) => sum + p.lng, 0) / paths.length;
  return { lat, lng };
}

export function markerPointFromDraft(draft: {
  paths?: MapLatLng[];
  point?: MapLatLng;
}): MapLatLng | null {
  if (draft.point) return draft.point;
  if (draft.paths && draft.paths.length > 0) return centroidOfPaths(draft.paths);
  return null;
}
