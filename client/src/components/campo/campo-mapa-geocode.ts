export interface CampoMapaLugarResult {
  id: string;
  label: string;
  subtitle: string;
  lat: number;
  lng: number;
  /** [minLon, maxLon, minLat, maxLat] cuando está disponible */
  extent?: [number, number, number, number];
}

const UY_BBOX = "-58.5,-35.5,-53.0,-30.0";

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
  url.searchParams.set("countrycode", "uy");
  url.searchParams.set("bbox", UY_BBOX);

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
    });
  }

  return items;
}
