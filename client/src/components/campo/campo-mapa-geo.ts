export type MapLatLng = { lat: number; lng: number };

export function geoJsonToPaths(geojson: string): MapLatLng[] {
  const parsed = JSON.parse(geojson) as {
    type?: string;
    coordinates?: [number, number][][] | [number, number][];
  };
  if (parsed.type === "Polygon") {
    const ring = (parsed.coordinates as [number, number][][])[0] ?? [];
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }
  if (parsed.type === "LineString") {
    const line = (parsed.coordinates as [number, number][]) ?? [];
    return line.map(([lng, lat]) => ({ lat, lng }));
  }
  if (parsed.type === "Point") {
    const coords = parsed.coordinates as [number, number] | undefined;
    if (!coords || coords.length < 2) return [];
    const [lng, lat] = coords;
    return [{ lat, lng }];
  }
  return [];
}

export function geoJsonToPoint(geojson: string): MapLatLng | null {
  const paths = geoJsonToPaths(geojson);
  return paths[0] ?? null;
}

/** Anillo abierto para edición (sin repetir el primer punto al cerrar). */
export function openRingFromGeoJson(geojson: string): MapLatLng[] {
  const paths = geoJsonToPaths(geojson);
  if (paths.length < 2) return paths;
  const first = paths[0];
  const last = paths[paths.length - 1];
  if (
    Math.abs(first.lat - last.lat) < 1e-9 &&
    Math.abs(first.lng - last.lng) < 1e-9
  ) {
    return paths.slice(0, -1);
  }
  return paths;
}

export function pathsToGeoJson(paths: MapLatLng[]): string {
  const ring = paths.map((p) => [p.lng, p.lat] as [number, number]);
  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
  }
  return JSON.stringify({ type: "Polygon", coordinates: [ring] });
}

export function pathsToLineGeoJson(paths: MapLatLng[]): string {
  return JSON.stringify({
    type: "LineString",
    coordinates: paths.map((p) => [p.lng, p.lat]),
  });
}

export function pointToGeoJson(point: MapLatLng): string {
  return JSON.stringify({ type: "Point", coordinates: [point.lng, point.lat] });
}

export function computeHectareas(paths: MapLatLng[]): number | null {
  if (paths.length < 3) return null;
  const R = 6378137;
  let total = 0;
  for (let i = 0; i < paths.length; i += 1) {
    const p1 = paths[i];
    const p2 = paths[(i + 1) % paths.length];
    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    const lng1 = (p1.lng * Math.PI) / 180;
    const lng2 = (p2.lng * Math.PI) / 180;
    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const m2 = Math.abs((total * R * R) / 2);
  if (!Number.isFinite(m2) || m2 <= 0) return null;
  return Math.round((m2 / 10_000) * 100) / 100;
}

function haversineMeters(a: MapLatLng, b: MapLatLng): number {
  const R = 6378137;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function computeDistanceMeters(paths: MapLatLng[]): number | null {
  if (paths.length < 2) return null;
  let total = 0;
  for (let i = 1; i < paths.length; i += 1) {
    total += haversineMeters(paths[i - 1], paths[i]);
  }
  return Math.round(total * 10) / 10;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatHectareas(ha: number): string {
  return `${ha.toLocaleString("es-UY", { maximumFractionDigits: 2 })} ha`;
}

export function pathsToLeafletLatLngs(paths: MapLatLng[]): [number, number][] {
  return paths.map((p) => [p.lat, p.lng]);
}

export function centroidOfPaths(paths: MapLatLng[]): MapLatLng {
  const lat = paths.reduce((sum, p) => sum + p.lat, 0) / paths.length;
  const lng = paths.reduce((sum, p) => sum + p.lng, 0) / paths.length;
  return { lat, lng };
}

export function parseMetadata<T extends Record<string, unknown>>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
