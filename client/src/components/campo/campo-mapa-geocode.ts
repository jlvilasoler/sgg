export interface CampoMapaLugarResult {
  id: string;
  label: string;
  subtitle: string;
  lat: number;
  lng: number;
  /** [minLon, minLat, maxLon, maxLat] según Photon */
  extent?: [number, number, number, number];
  /** Zoom sugerido cuando no hay extent (provincias, ciudades, etc.) */
  zoom?: number;
}

/** Uruguay y este de Argentina (región operativa típica en campo). */
const CONO_SUR_BBOX = "-73.5,-55.5,-53.0,-30.0";

function zoomForFeature(props: Record<string, string | undefined>): number {
  const osmValue = props.osm_value ?? "";
  const type = props.type ?? "";
  if (osmValue === "country" || type === "country") return 6;
  if (osmValue === "state" || type === "state") return 8;
  if (osmValue === "county" || type === "county") return 10;
  if (osmValue === "city" || type === "city" || osmValue === "town") return 13;
  if (osmValue === "village" || osmValue === "hamlet" || osmValue === "suburb") return 14;
  if (osmValue === "farm" || osmValue === "isolated_dwelling") return 16;
  return 14;
}

function isValidExtent(extent: [number, number, number, number]): boolean {
  const [minLon, minLat, maxLon, maxLat] = extent;
  if (
    !Number.isFinite(minLon) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLon) ||
    !Number.isFinite(maxLat)
  ) {
    return false;
  }
  if (minLon >= maxLon || minLat >= maxLat) return false;
  return maxLon - minLon >= 0.00005 && maxLat - minLat >= 0.00005;
}

function extentSpans(extent: [number, number, number, number]): {
  lngSpan: number;
  latSpan: number;
} {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return { lngSpan: maxLon - minLon, latSpan: maxLat - minLat };
}

/** Bounds Leaflet [[sur, oeste], [norte, este]] para encuadrar el lugar en el mapa. */
export function lugarBounds(lugar: CampoMapaLugarResult): [[number, number], [number, number]] {
  if (lugar.extent && isValidExtent(lugar.extent)) {
    const [minLon, minLat, maxLon, maxLat] = lugar.extent;
    return [
      [minLat, minLon],
      [maxLat, maxLon],
    ];
  }

  const zoom = lugarZoomCercano(lugar);
  const latRad = (lugar.lat * Math.PI) / 180;
  const scale = 360 / 2 ** (zoom + 1);
  const lngSpan = scale / Math.max(Math.cos(latRad), 0.2);
  const latSpan = scale * 0.72;

  return [
    [lugar.lat - latSpan / 2, lugar.lng - lngSpan / 2],
    [lugar.lat + latSpan / 2, lugar.lng + lngSpan / 2],
  ];
}

export function lugarMaxZoom(lugar: CampoMapaLugarResult): number {
  return lugarZoomCercano(lugar);
}

/** Zoom directo al buscar un lugar: más cerca para pueblos, estancias y direcciones. */
export function lugarZoomCercano(lugar: CampoMapaLugarResult): number {
  const base = lugar.zoom ?? 14;
  if (base <= 8) return base + 1;
  if (base <= 10) return base + 1;
  return Math.min(base + 2, 17);
}

/** Solo encuadrar bounds cuando el extent es chico (edificio, predio, manzana). */
export function lugarUsaBoundsAjustados(lugar: CampoMapaLugarResult): boolean {
  if (!lugar.extent || !isValidExtent(lugar.extent)) return false;
  const { lngSpan, latSpan } = extentSpans(lugar.extent);
  return lngSpan <= 0.06 && latSpan <= 0.06;
}

function buildSubtitle(props: Record<string, string | undefined>): string {
  const parts = [props.city, props.state, props.country].filter(Boolean);
  return parts.join(" · ");
}

function featureLabel(props: Record<string, string | undefined>): string {
  return String(props.name ?? props.city ?? props.state ?? props.country ?? "").trim();
}

export async function buscarLugaresEnMapa(query: string): Promise<CampoMapaLugarResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("bbox", CONO_SUR_BBOX);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error("No se pudo buscar el lugar en el mapa.");
  }

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: Record<string, string | undefined> & {
        name?: string;
        extent?: [number, number, number, number];
      };
    }>;
  };

  const items: CampoMapaLugarResult[] = [];
  for (const feature of data.features ?? []) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const props = feature.properties ?? {};
    const name = featureLabel(props);
    if (!name) continue;
    const [lng, lat] = coords;
    items.push({
      id: `${lng.toFixed(5)}:${lat.toFixed(5)}:${name}`,
      label: name,
      subtitle: buildSubtitle(props),
      lat,
      lng,
      extent: props.extent,
      zoom: zoomForFeature(props),
    });
  }

  if (items.length > 0) return items;

  // Segunda pasada sin bbox para regiones fuera del rectángulo inicial.
  const globalUrl = new URL("https://photon.komoot.io/api/");
  globalUrl.searchParams.set("q", q);
  globalUrl.searchParams.set("limit", "6");

  const globalRes = await fetch(globalUrl.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!globalRes.ok) return [];

  const globalData = (await globalRes.json()) as typeof data;
  for (const feature of globalData.features ?? []) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const props = feature.properties ?? {};
    const name = featureLabel(props);
    if (!name) continue;
    const [lng, lat] = coords;
    items.push({
      id: `g-${lng.toFixed(5)}:${lat.toFixed(5)}:${name}`,
      label: name,
      subtitle: buildSubtitle(props),
      lat,
      lng,
      extent: props.extent,
      zoom: zoomForFeature(props),
    });
  }

  return items;
}
