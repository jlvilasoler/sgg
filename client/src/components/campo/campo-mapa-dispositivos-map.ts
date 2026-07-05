import L from "leaflet";
import type { CampoMapaElemento, CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { etiquetaCaravana, normalizarPotrero } from "../stock/stock-ganadera-utils";
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
}

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

function collectAssignedDevices(
  featureNombre: string,
  metadataRaw: string | undefined | null,
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
): { clave: string; label: string; kind: "ganadero" | "equino" }[] {
  const meta = parseCampoMapaDispositivosMetadata(metadataRaw);
  const seen = new Set<string>();
  const result: { clave: string; label: string; kind: "ganadero" | "equino" }[] = [];

  const push = (clave: string, label: string, kind: "ganadero" | "equino") => {
    const key = `${kind}:${clave}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ clave, label, kind });
  };

  for (const clave of meta.dispositivos_ganadero) {
    const d = ganadero.find((item) => item.clave === clave);
    if (d) push(clave, deviceLabel(d), "ganadero");
  }
  for (const clave of meta.dispositivos_equino) {
    const d = equino.find((item) => item.clave === clave);
    if (d) push(clave, deviceLabel(d), "equino");
  }

  const nombreNorm = normalizeNombre(featureNombre);
  if (nombreNorm) {
    for (const d of ganadero) {
      if (normalizeNombre(d.potrero) === nombreNorm) {
        push(d.clave, deviceLabel(d), "ganadero");
      }
    }
    for (const d of equino) {
      if (normalizeNombre(d.potrero) === nombreNorm) {
        push(d.clave, deviceLabel(d), "equino");
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
): CampoMapaDispositivoMarker[] {
  const devices = collectAssignedDevices(featureNombre, metadataRaw, ganadero, equino);
  if (devices.length === 0) return [];

  const positions = distributePointsInPolygon(ring, devices.length);
  return devices.map((device, index) => {
    const pos = positions[index] ?? positions[0];
    return {
      id: `${featureKey}:${device.kind}:${device.clave}`,
      lat: pos.lat,
      lng: pos.lng,
      label: device.label,
      potreroNombre: featureNombre,
      kind: device.kind,
    };
  });
}

export function buildCampoMapaDispositivoMarkers(
  potreros: CampoPotreroMapa[],
  elementos: CampoMapaElemento[],
  ganadero: StockGanaderaDispositivo[],
  equino: StockGanaderaDispositivo[],
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
        ),
      );
    } catch {
      /* noop */
    }
  }

  return markers;
}

export function renderCampoMapaDispositivoMarkers(
  map: L.Map,
  markers: CampoMapaDispositivoMarker[],
): L.LayerGroup {
  const group = L.layerGroup();
  for (const marker of markers) {
    L.circleMarker([marker.lat, marker.lng], {
      radius: 5,
      color: "#ffffff",
      weight: 1.5,
      fillColor: "#dc2626",
      fillOpacity: 0.95,
    })
      .bindTooltip(marker.label, {
        direction: "top",
        opacity: 0.95,
        className: "campo-mapa-dispositivo-marker-tooltip",
      })
      .bindPopup(
        `<strong>${marker.label}</strong><br/><span style="font-size:0.75rem;color:#64748b">${marker.potreroNombre} · ${marker.kind === "ganadero" ? "Ganadero" : "Equino"}</span>`,
      )
      .addTo(group);
  }
  group.addTo(map);
  return group;
}
