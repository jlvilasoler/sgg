import L from "leaflet";
import type { MapLatLng } from "./campo-mapa-geo";

export type VertexHandleOptions = {
  color: string;
  selectedIndex: number | null;
  onMove: (index: number, point: MapLatLng) => void;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
};

function bindDraggable(
  map: L.Map,
  marker: L.CircleMarker,
  index: number,
  onMove: (index: number, point: MapLatLng) => void,
): void {
  let dragging = false;

  marker.on("mousedown", (event) => {
    if (event.originalEvent.button !== 0) return;
    L.DomEvent.stopPropagation(event);
    dragging = true;
    map.dragging.disable();

    const onMouseMove = (moveEvent: L.LeafletMouseEvent) => {
      if (!dragging) return;
      marker.setLatLng(moveEvent.latlng);
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      map.dragging.enable();
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      const { lat, lng } = marker.getLatLng();
      onMove(index, { lat, lng });
    };

    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);
  });
}

/** Marcadores de vértices: arrastrar para mover, clic para seleccionar, doble clic para eliminar. */
export function mountVertexHandles(
  map: L.Map,
  vertices: MapLatLng[],
  options: VertexHandleOptions,
): () => void {
  const markers: L.CircleMarker[] = [];

  vertices.forEach((point, index) => {
    const selected = options.selectedIndex === index;
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: selected ? 7 : 5,
      color: selected ? "#fbbf24" : "#ffffff",
      weight: selected ? 3 : 2,
      fillColor: selected ? "#fbbf24" : options.color,
      fillOpacity: 1,
    }).addTo(map);

    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      options.onSelect(index);
    });

    marker.on("dblclick", (event) => {
      L.DomEvent.stopPropagation(event);
      options.onRemove(index);
    });

    bindDraggable(map, marker, index, options.onMove);
    markers.push(marker);
  });

  return () => {
    for (const marker of markers) marker.remove();
  };
}
