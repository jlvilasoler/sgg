import L from "leaflet";
import type { CampoMapaElemento, CampoPotreroMapa } from "../../types";
import {
  geoJsonToPaths,
  geoJsonToPoint,
  parseMetadata,
  pathsToLeafletLatLngs,
  type MapLatLng,
} from "./campo-mapa-geo";

import type { CampoMapaBorderWeight } from "./campo-mapa-border-weight";
import { DEFAULT_CAMPO_MAPA_BORDER_WEIGHT, strokeWeightForSelection } from "./campo-mapa-border-weight";
import { createCampoMapaPinIcon } from "./campo-mapa-pin-icon";
import { createCampoMapaNotaBubbleIcon } from "./campo-mapa-nota-bubble";
import {
  createCampoMapaObjetoLeafletIcon,
  getCampoMapaObjetoDef,
  parseCampoMapaObjetoTipo,
} from "./campo-mapa-objetos";
import { isCampoMapaAreaContorno, parseCampoMapaLineaEstilo } from "./campo-mapa-metadata";
import { dashArrayForLineStyle } from "./campo-mapa-line-style";

export type MapLayerHandle = L.Layer;

function attachFeatureNameLabel(layer: L.Layer, nombre: string, selected: boolean): void {
  const text = nombre.trim();
  if (!text) return;
  layer.bindTooltip(text, {
    permanent: true,
    direction: "center",
    className: `campo-mapa-feature-name-tooltip${selected ? " is-selected" : ""}`,
    opacity: 1,
    interactive: false,
  });
}

function popupHtml(nombre: string, notas: string, extra?: string): string {
  const note = notas.trim()
    ? `<p style="margin:0.35rem 0 0;font-size:0.78rem;color:#475569">${notas}</p>`
    : "";
  const meta = extra
    ? `<p style="margin:0.25rem 0 0;font-size:0.72rem;color:#64748b">${extra}</p>`
    : "";
  return `<strong>${nombre}</strong>${meta}${note}`;
}

export function renderPotreroLayer(
  map: L.Map,
  item: CampoPotreroMapa,
  selected: boolean,
  onSelect: () => void,
  options?: { showName?: boolean; borderWeight?: CampoMapaBorderWeight },
): L.Polygon | null {
  let paths: MapLatLng[] = [];
  try {
    paths = geoJsonToPaths(item.geojson);
  } catch {
    return null;
  }
  const baseWeight = options?.borderWeight ?? DEFAULT_CAMPO_MAPA_BORDER_WEIGHT;
  const polygon = L.polygon(pathsToLeafletLatLngs(paths), {
    color: item.color,
    weight: strokeWeightForSelection(baseWeight, selected),
    opacity: 0.95,
    fillColor: item.color,
    fillOpacity: selected ? 0.38 : 0.24,
  }).addTo(map);
  polygon.bindPopup(
    popupHtml(
      item.nombre,
      item.notas,
      item.hectareas != null ? `${item.hectareas} ha` : undefined,
    ),
  );
  if (options?.showName !== false) {
    attachFeatureNameLabel(polygon, item.nombre, selected);
  }
  polygon.on("click", onSelect);
  return polygon;
}

export function renderElementoLayer(
  map: L.Map,
  item: CampoMapaElemento,
  selected: boolean,
  onSelect: () => void,
  options?: { showName?: boolean; borderWeight?: CampoMapaBorderWeight },
): MapLayerHandle | null {
  const meta = parseMetadata<{ zoom?: number; distancia_m?: number; area_ha?: number }>(
    item.metadata,
  );
  const baseWeight = options?.borderWeight ?? DEFAULT_CAMPO_MAPA_BORDER_WEIGHT;
  const extra =
    item.tipo === "medicion_distancia" && meta.distancia_m != null
      ? `${meta.distancia_m} m`
      : item.tipo === "medicion_area" && meta.area_ha != null
        ? `${meta.area_ha} ha`
        : item.tipo === "clip" && meta.zoom != null
          ? `Zoom ${meta.zoom}`
          : undefined;

  if (item.tipo === "marcador") {
    const point = geoJsonToPoint(item.geojson);
    if (!point) return null;
    const objetoTipo = parseCampoMapaObjetoTipo(item.metadata);
    if (objetoTipo) {
      const def = getCampoMapaObjetoDef(objetoTipo);
      const marker = L.marker([point.lat, point.lng], {
        icon: createCampoMapaObjetoLeafletIcon(
          objetoTipo,
          item.color || def.color,
          item.nombre,
          selected,
        ),
        zIndexOffset: selected ? 420 : 220,
      }).addTo(map);
      marker.bindPopup(popupHtml(item.nombre, item.notas, def.label));
      marker.on("click", onSelect);
      return marker;
    }
    const marker = L.marker([point.lat, point.lng], {
      icon: createCampoMapaPinIcon(item.color, selected),
      zIndexOffset: selected ? 400 : 200,
    }).addTo(map);
    marker.bindPopup(popupHtml(item.nombre, item.notas, extra));
    marker.on("click", onSelect);
    return marker;
  }

  if (item.tipo === "nota") {
    const point = geoJsonToPoint(item.geojson);
    if (!point) return null;
    const marker = L.marker([point.lat, point.lng], {
      icon: createCampoMapaNotaBubbleIcon(item.color, item.nombre, item.notas, selected),
      zIndexOffset: selected ? 400 : 200,
    }).addTo(map);
    marker.on("click", onSelect);
    return marker;
  }

  if (item.tipo === "clip") {
    const point = geoJsonToPoint(item.geojson);
    if (!point) return null;
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: item.tipo === "clip" ? 7 : 8,
      color: "#ffffff",
      weight: selected ? 3 : 2,
      fillColor: item.color,
      fillOpacity: 1,
    }).addTo(map);
    marker.bindPopup(popupHtml(item.nombre, item.notas, extra));
    marker.on("click", onSelect);
    return marker;
  }

  if (item.tipo === "linea" || item.tipo === "medicion_distancia") {
    let paths: MapLatLng[] = [];
    try {
      paths = geoJsonToPaths(item.geojson);
    } catch {
      return null;
    }
    const objetoTipo = parseCampoMapaObjetoTipo(item.metadata);
    const lineColor =
      objetoTipo != null ? item.color || getCampoMapaObjetoDef(objetoTipo).color : item.color;
    const line = L.polyline(pathsToLeafletLatLngs(paths), {
      color: lineColor,
      weight: strokeWeightForSelection(baseWeight, selected) + (objetoTipo === "camino" ? 2 : 1),
      opacity: 0.95,
      dashArray:
        item.tipo === "medicion_distancia"
          ? "8 6"
          : objetoTipo === "camino"
            ? "10 8"
            : undefined,
    }).addTo(map);
    line.bindPopup(
      popupHtml(
        item.nombre,
        item.notas,
        objetoTipo ? getCampoMapaObjetoDef(objetoTipo).label : extra,
      ),
    );
    line.on("click", onSelect);
    return line;
  }

  let paths: MapLatLng[] = [];
  try {
    paths = geoJsonToPaths(item.geojson);
  } catch {
    return null;
  }
  const isContorno = item.tipo === "area" && isCampoMapaAreaContorno(item.metadata);
  const lineaEstilo = isContorno ? parseCampoMapaLineaEstilo(item.metadata) : null;
  const polygon = L.polygon(pathsToLeafletLatLngs(paths), {
    color: item.color,
    weight: strokeWeightForSelection(baseWeight, selected) + (isContorno ? 1 : 0),
    opacity: 0.95,
    fillColor: item.color,
    fillOpacity: isContorno ? 0 : selected ? 0.32 : 0.2,
    fill: !isContorno,
    dashArray:
      item.tipo === "medicion_area"
        ? "6 5"
        : isContorno
          ? dashArrayForLineStyle(lineaEstilo ?? "solida")
          : undefined,
  }).addTo(map);
  polygon.bindPopup(
    popupHtml(item.nombre, item.notas, isContorno ? "Contorno" : extra),
  );
  if (options?.showName !== false && item.tipo === "area") {
    attachFeatureNameLabel(polygon, item.nombre, selected);
  }
  polygon.on("click", onSelect);
  return polygon;
}

export function flyToElemento(map: L.Map, item: CampoMapaElemento): void {
  if (item.tipo === "clip") {
    const point = geoJsonToPoint(item.geojson);
    const meta = parseMetadata<{ zoom?: number }>(item.metadata);
    if (point) {
      map.flyTo([point.lat, point.lng], meta.zoom ?? 14, { duration: 0.8 });
    }
    return;
  }
  const point = geoJsonToPoint(item.geojson);
  if (point && (item.tipo === "marcador" || item.tipo === "nota")) {
    map.flyTo([point.lat, point.lng], 16, { duration: 0.8 });
    return;
  }
  try {
    const paths = geoJsonToPaths(item.geojson);
    if (paths.length > 0) {
      map.fitBounds(L.latLngBounds(pathsToLeafletLatLngs(paths)), {
        padding: [64, 64],
        maxZoom: 17,
      });
    }
  } catch {
    /* noop */
  }
}
