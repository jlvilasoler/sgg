import L from "leaflet";

const MAP_DETAILS_STORAGE_KEY = "campo-mapa-show-details";

export function loadCampoMapaShowDetails(): boolean {
  try {
    const raw = localStorage.getItem(MAP_DETAILS_STORAGE_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function saveCampoMapaShowDetails(show: boolean): void {
  try {
    localStorage.setItem(MAP_DETAILS_STORAGE_KEY, show ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const CAMPO_MAPA_DETAILS_ATTRIBUTION = "Detalles &copy; Esri";

export const CAMPO_MAPA_DETAILS_TOGGLE_LABEL = {
  show: "Mostrar detalles del mapa (calles, ciudades, ríos…)",
  hide: "Ocultar detalles del mapa (calles, ciudades, ríos…)",
} as const;

export function createCampoMapaBasemapLayers(): {
  satellite: L.TileLayer;
  details: L.LayerGroup;
} {
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    },
  );

  const referenceOverlay = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Reference_Overlay/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      opacity: 0.72,
      attribution: CAMPO_MAPA_DETAILS_ATTRIBUTION,
    },
  );

  const transportation = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      opacity: 0.84,
      attribution: CAMPO_MAPA_DETAILS_ATTRIBUTION,
    },
  );

  const boundariesAndPlaces = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      opacity: 0.9,
      attribution: CAMPO_MAPA_DETAILS_ATTRIBUTION,
    },
  );

  const details = L.layerGroup([referenceOverlay, transportation, boundariesAndPlaces]);
  return { satellite, details };
}
