import L from "leaflet";
import type { EmpresaOperativaStock } from "../../api";
import type { CampoMapaElemento, CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { etiquetaCaravana, normalizarPotrero } from "../stock/stock-ganadera-utils";
import { hexColorCaravana, normalizarColorCaravana } from "../stock/stock-dispositivo-color";
import { colorEmpresaOperativa, fmtEmpresaOperativa } from "../stock/stock-empresa-utils";
import {
  centroidOfPaths,
  openRingFromGeoJson,
  type MapLatLng,
} from "./campo-mapa-geo";
import { parseCampoMapaDispositivosMetadata } from "./campo-mapa-metadata";

export interface CampoMapaDispositivoMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  potreroNombre: string;
  kind: "ganadero" | "equino";
  fillColor: string;
  empresaNombre: string;
}

const DEFAULT_MARKER_COLOR = "#94a3b8";
const EQUINO_MARKER_STROKE = "#ffffff";

function darkenHexColor(hex: string, factor = 0.72): string {
  const cleaned = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return hex;
  const r = Math.round(parseInt(cleaned.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(cleaned.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(cleaned.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function deviceMarkerFillColor(
  d: StockGanaderaDispositivo,
  empresas: EmpresaOperativaStock[],
): string {
  const colorId = normalizarColorCaravana(
    d.color_caravana || colorEmpresaOperativa(d.empresa, empresas),
  );
  return hexColorCaravana(colorId) ?? DEFAULT_MARKER_COLOR;
}

/** Equinos: borde blanco. Ganaderos: sin blanco (borde oscurecido del mismo color). */
function dispositivoCircleMarkerOptions(
  fillColor: string,
  radius: number,
  kind: "ganadero" | "equino",
): L.CircleMarkerOptions {
  if (kind === "equino") {
    return {
      radius,
      color: EQUINO_MARKER_STROKE,
      weight: 2,
      opacity: 1,
      fillColor,
      fillOpacity: 0.95,
    };
  }
  return {
    radius,
    color: darkenHexColor(fillColor),
    weight: 1,
    opacity: 1,
    fillColor,
    fillOpacity: 0.95,
  };
}

type AssignedDevice = {
  clave: string;
  label: string;
  kind: "ganadero" | "equino";
  device: StockGanaderaDispositivo;
};

function normalizeNombre(value: string): string {
  return normalizarPotrero(value).toLowerCase();
}

function pointInPolygon(point: MapLatLng, ring: MapLatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distributePointsInPolygon(ring: MapLatLng[], count: number): MapLatLng[] {
  if (count <= 0) return [];
  if (count === 1) return [centroidOfPaths(ring)];

  const centroid = centroidOfPaths(ring);
  const minLat = Math.min(...ring.map((p) => p.lat));
  const maxLat = Math.max(...ring.map((p) => p.lat));
  const minLng = Math.min(...ring.map((p) => p.lng));
  const maxLng = Math.max(...ring.map((p) => p.lng));
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const golden = Math.PI * (3 - Math.sqrt(5));

  const points: MapLatLng[] = [];
  let attempt = 0;
  const maxAttempts = Math.max(count * 48, 64);

  while (points.length < count && attempt < maxAttempts) {
    const t = (attempt + 1) / maxAttempts;
    const angle = points.length * golden + attempt * 0.37;
    const radius = Math.sqrt(t) * 0.44;
    const candidate = {
      lat: centroid.lat + radius * latSpan * Math.cos(angle),
      lng: centroid.lng + radius * lngSpan * Math.sin(angle),
    };
    if (pointInPolygon(candidate, ring)) {
      points.push(candidate);
    }
    attempt += 1;
  }

  while (points.length < count) {
    points.push(centroid);
  }

  return points.slice(0, count);
}

function deviceLabel(d: StockGanaderaDispositivo): string {
  return etiquetaCaravana(d);
}

export function collectCampoMapaFeatureDevices(
  featureNombre: string,
  metadataRaw: string | undefined | null,
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
): AssignedDevice[] {
  const meta = parseCampoMapaDispositivosMetadata(metadataRaw);
  const seen = new Set<string>();
  const result: AssignedDevice[] = [];

  const push = (device: StockGanaderaDispositivo, kind: "ganadero" | "equino") => {
    const key = `${kind}:${device.clave}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      clave: device.clave,
      label: deviceLabel(device),
      kind,
      device,
    });
  };

  for (const clave of meta.dispositivos_ganadero) {
    const d = ganadero.find((item) => item.clave === clave);
    if (d) push(d, "ganadero");
  }
  for (const clave of meta.dispositivos_equino) {
    const d = equino.find((item) => item.clave === clave);
    if (d) push(d, "equino");
  }

  const nombreNorm = normalizeNombre(featureNombre);
  if (nombreNorm) {
    for (const d of ganadero) {
      if (normalizeNombre(d.potrero) === nombreNorm) {
        push(d, "ganadero");
      }
    }
    for (const d of equino) {
      if (normalizeNombre(d.potrero) === nombreNorm) {
        push(d, "equino");
      }
    }
  }

  return result;
}

function markersForPolygonFeature(
  featureKey: string,
  featureNombre: string,
  ring: MapLatLng[],
  metadataRaw: string | undefined | null,
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[],
): CampoMapaDispositivoMarker[] {
  const devices = collectCampoMapaFeatureDevices(featureNombre, metadataRaw, ganadero, equino);
  if (devices.length === 0) return [];

  const positions = distributePointsInPolygon(ring, devices.length);
  return devices.map((device, index) => {
    const pos = positions[index] ?? positions[0];
    const empresaNombre = fmtEmpresaOperativa(device.device.empresa, empresas);
    return {
      id: `${featureKey}:${device.kind}:${device.clave}`,
      lat: pos.lat,
      lng: pos.lng,
      label: device.label,
      potreroNombre: featureNombre,
      kind: device.kind,
      fillColor: deviceMarkerFillColor(device.device, empresas),
      empresaNombre: empresaNombre === "—" ? "" : empresaNombre,
    };
  });
}

export function buildCampoMapaDispositivoMarkers(
  potreros: CampoPotreroMapa[],
  elementos: CampoMapaElemento[],
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
  empresas: EmpresaOperativaStock[] = [],
): CampoMapaDispositivoMarker[] {
  const markers: CampoMapaDispositivoMarker[] = [];

  for (const potrero of potreros) {
    try {
      const ring = openRingFromGeoJson(potrero.geojson);
      if (ring.length < 3) continue;
      markers.push(
        ...markersForPolygonFeature(
          `potrero-${potrero.id}`,
          potrero.nombre,
          ring,
          potrero.metadata,
          ganadero,
          equino,
          empresas,
        ),
      );
    } catch {
      /* noop */
    }
  }

  for (const elemento of elementos) {
    if (elemento.tipo !== "area") continue;
    try {
      const ring = openRingFromGeoJson(elemento.geojson);
      if (ring.length < 3) continue;
      markers.push(
        ...markersForPolygonFeature(
          `elemento-${elemento.id}`,
          elemento.nombre,
          ring,
          elemento.metadata,
          ganadero,
          equino,
          empresas,
        ),
      );
    } catch {
      /* noop */
    }
  }

  return markers;
}

export function filterDispositivoMarkersInBounds(
  markers: CampoMapaDispositivoMarker[],
  bounds: L.LatLngBounds,
): CampoMapaDispositivoMarker[] {
  return markers.filter((marker) => bounds.contains([marker.lat, marker.lng]));
}

export function renderCampoMapaDispositivoMarkersPreview(
  map: L.Map,
  markers: CampoMapaDispositivoMarker[],
): L.LayerGroup {
  const group = L.layerGroup();

  for (const marker of markers) {
    L.circleMarker(
      [marker.lat, marker.lng],
      dispositivoCircleMarkerOptions(marker.fillColor, 5, marker.kind),
    ).addTo(group);
  }

  group.addTo(map);
  return group;
}

function dispositivoMarkerCardHtml(
  marker: CampoMapaDispositivoMarker,
  expanded: boolean,
): string {
  const kindLabel = marker.kind === "ganadero" ? "Ganadero" : "Equino";
  const meta = [marker.empresaNombre, marker.potreroNombre, kindLabel]
    .filter(Boolean)
    .join(" · ");

  if (!expanded || !meta) {
    return `<div class="campo-mapa-dispositivo-marker-card campo-mapa-dispositivo-marker-card--compact">${marker.label}</div>`;
  }

  return `<div class="campo-mapa-dispositivo-marker-card">
    <strong class="campo-mapa-dispositivo-marker-card-title">${marker.label}</strong>
    <span class="campo-mapa-dispositivo-marker-card-meta">${meta}</span>
  </div>`;
}

const DISPOSITIVO_MARKER_POPUP_OPTS: L.PopupOptions = {
  className: "campo-mapa-dispositivo-marker-popup",
  closeButton: true,
  maxWidth: 300,
  autoPan: false,
  offset: [0, -2],
};

export function renderCampoMapaDispositivoMarkers(
  map: L.Map,
  markers: CampoMapaDispositivoMarker[],
): L.LayerGroup {
  const group = L.layerGroup();
  let pinnedMarkerId: string | null = null;
  let hoverMarkerId: string | null = null;
  const sharedPopup = L.popup(DISPOSITIVO_MARKER_POPUP_OPTS);

  const closeActiveCard = () => {
    hoverMarkerId = null;
    map.closePopup();
  };

  const closePinnedPopup = () => {
    pinnedMarkerId = null;
    closeActiveCard();
  };

  const onPopupClose = () => {
    pinnedMarkerId = null;
    hoverMarkerId = null;
  };

  const showCard = (marker: CampoMapaDispositivoMarker, expanded: boolean, pin: boolean) => {
    closeActiveCard();
    if (pin) {
      pinnedMarkerId = marker.id;
      hoverMarkerId = null;
    } else {
      hoverMarkerId = marker.id;
    }

    sharedPopup.options.closeButton = expanded;
    sharedPopup.options.autoClose = !pin;
    sharedPopup
      .setLatLng([marker.lat, marker.lng])
      .setContent(dispositivoMarkerCardHtml(marker, expanded))
      .openOn(map);
  };

  map.on("click", closePinnedPopup);
  map.on("popupclose", onPopupClose);

  for (const marker of markers) {
    const circle = L.circleMarker(
      [marker.lat, marker.lng],
      dispositivoCircleMarkerOptions(marker.fillColor, 6, marker.kind),
    );

    circle.on("mouseover", () => {
      if (pinnedMarkerId != null) return;
      if (hoverMarkerId === marker.id && sharedPopup.isOpen()) return;
      showCard(marker, false, false);
    });

    circle.on("mouseout", () => {
      if (pinnedMarkerId != null) return;
      if (hoverMarkerId !== marker.id) return;
      closeActiveCard();
    });

    circle.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (pinnedMarkerId === marker.id) {
        closePinnedPopup();
        return;
      }
      pinnedMarkerId = marker.id;
      showCard(marker, true, true);
    });

    circle.addTo(group);
  }

  group.on("remove", () => {
    map.off("click", closePinnedPopup);
    map.off("popupclose", onPopupClose);
    closePinnedPopup();
  });

  group.addTo(map);
  return group;
}
