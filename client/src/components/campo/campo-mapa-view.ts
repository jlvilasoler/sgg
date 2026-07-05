import L from "leaflet";
import type { CampoMapaElemento, CampoPotreroMapa } from "../../types";
import { geoJsonToPaths, geoJsonToPoint, parseMetadata } from "./campo-mapa-geo";
import { flyToElemento } from "./campo-mapa-render";

export const CAMPO_MAPA_DEFAULT_CENTER: [number, number] = [-32.85, -56.02];
export const CAMPO_MAPA_DEFAULT_ZOOM = 12;

const PREDIO_NAME_RE = /predio|estancia|chacra|campo/i;

function isPredioName(nombre: string): boolean {
  return PREDIO_NAME_RE.test(nombre.trim());
}

function extendBoundsFromGeojson(bounds: L.LatLngBounds, geojson: string): boolean {
  let added = false;
  try {
    for (const point of geoJsonToPaths(geojson)) {
      bounds.extend([point.lat, point.lng]);
      added = true;
    }
  } catch {
    /* omitir geometría inválida */
  }
  return added;
}

/** Marcador, clip o nota que representa la ubicación principal del predio. */
export function findPredioPrincipalElemento(
  elementos: CampoMapaElemento[],
): CampoMapaElemento | null {
  const named = elementos.find(
    (e) =>
      (e.tipo === "clip" || e.tipo === "marcador" || e.tipo === "nota") &&
      isPredioName(e.nombre),
  );
  if (named) return named;

  const clip = elementos.find((e) => e.tipo === "clip");
  if (clip) return clip;

  return elementos.find((e) => e.tipo === "marcador") ?? null;
}

export function fitMapToCampoData(
  map: L.Map,
  potreros: CampoPotreroMapa[],
  elementos: CampoMapaElemento[],
  options?: { padding?: [number, number]; maxZoom?: number },
): boolean {
  const bounds = L.latLngBounds([]);
  let hasPoint = false;
  for (const item of potreros) {
    if (extendBoundsFromGeojson(bounds, item.geojson)) hasPoint = true;
  }
  for (const item of elementos) {
    if (extendBoundsFromGeojson(bounds, item.geojson)) hasPoint = true;
  }
  if (!hasPoint) return false;
  map.fitBounds(bounds, {
    padding: options?.padding ?? [48, 48],
    maxZoom: options?.maxZoom ?? 17,
  });
  return true;
}

function focusElementoInstant(map: L.Map, item: CampoMapaElemento): boolean {
  if (item.tipo === "clip") {
    const point = geoJsonToPoint(item.geojson);
    const meta = parseMetadata<{ zoom?: number }>(item.metadata);
    if (!point) return false;
    map.setView([point.lat, point.lng], meta.zoom ?? 15);
    return true;
  }

  const point = geoJsonToPoint(item.geojson);
  if (point && (item.tipo === "marcador" || item.tipo === "nota")) {
    map.setView([point.lat, point.lng], 16);
    return true;
  }

  try {
    const paths = geoJsonToPaths(item.geojson);
    if (paths.length > 0) {
      const bounds = L.latLngBounds(paths.map((p) => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
      return true;
    }
  } catch {
    /* noop */
  }
  return false;
}

export function applyCampoMapaInitialView(
  map: L.Map,
  potreros: CampoPotreroMapa[],
  elementos: CampoMapaElemento[],
  options?: { animate?: boolean },
): void {
  const predio = findPredioPrincipalElemento(elementos);
  if (predio) {
    if (options?.animate === false) {
      if (focusElementoInstant(map, predio)) return;
    } else {
      flyToElemento(map, predio);
      return;
    }
  }

  if (fitMapToCampoData(map, potreros, elementos)) return;
  map.setView(CAMPO_MAPA_DEFAULT_CENTER, CAMPO_MAPA_DEFAULT_ZOOM);
}

export function cuentaTieneGeometriaEnMapa(
  potreros: CampoPotreroMapa[],
  elementos: CampoMapaElemento[],
): boolean {
  return potreros.length > 0 || elementos.length > 0;
}
