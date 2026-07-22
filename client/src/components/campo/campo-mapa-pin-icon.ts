import L from "leaflet";
import { CAMPO_MAPA_PIN_PATH } from "./CampoMapaPinMark";

function pinSvgHtml(color: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="${color}"
      stroke="#ffffff"
      stroke-width="1.5"
      stroke-linejoin="round"
      d="${CAMPO_MAPA_PIN_PATH}"
    />
    <circle cx="12" cy="10" r="2.5" fill="#ffffff" fill-opacity="0.92" />
  </svg>`;
}

export function createCampoMapaPinIcon(color: string, selected = false): L.DivIcon {
  const width = selected ? 32 : 28;
  const height = selected ? 40 : 34;

  return L.divIcon({
    className: `campo-mapa-pin-leaflet${selected ? " is-selected" : ""}`,
    html: `<span class="campo-mapa-pin">${pinSvgHtml(color)}</span>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 6],
  });
}
