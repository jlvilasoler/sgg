import L from "leaflet";
import { createElement, forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import {
  Cylinder,
  DoorOpen,
  Droplets,
  Milestone,
  Route,
  Waves,
} from "lucide-react";

/** Bomba de agua de campo (no surtidor de combustible). */
const BombaAguaIcon = forwardRef<SVGSVGElement, LucideProps>(function BombaAguaIcon(
  { color = "currentColor", size = 24, strokeWidth = 2, className, ...props },
  ref,
) {
  return createElement(
    "svg",
    {
      ref,
      xmlns: "http://www.w3.org/2000/svg",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className,
      "aria-hidden": true,
      ...props,
    },
    createElement("rect", { x: 7, y: 9, width: 8, height: 10, rx: 1.5 }),
    createElement("path", { d: "M9 9V7.5a2 2 0 0 1 4 0V9" }),
    createElement("path", { d: "M11 5.5h5.5" }),
    createElement("path", { d: "M16.5 5.5v2.2" }),
    createElement("path", { d: "M15 13h3.5a1.5 1.5 0 0 1 0 3H15" }),
    createElement("path", {
      d: "M19.2 18.2c0 1-.8 1.8-1.7 1.8s-1.7-.8-1.7-1.8c0-1.1 1.7-2.6 1.7-2.6s1.7 1.5 1.7 2.6Z",
    }),
  );
});
BombaAguaIcon.displayName = "BombaAguaIcon";

export const CAMPO_MAPA_OBJETO_TIPOS = [
  "molino_agua",
  "bomba_agua",
  "bebedero",
  "tanque_australiano",
  "camino",
  "portera",
  "puente",
] as const;

export type CampoMapaObjetoTipo = (typeof CAMPO_MAPA_OBJETO_TIPOS)[number];

export type CampoMapaObjetoGeometria = "point" | "line";

export interface CampoMapaObjetoDef {
  id: CampoMapaObjetoTipo;
  label: string;
  shortLabel: string;
  hint: string;
  color: string;
  geometry: CampoMapaObjetoGeometria;
  icon: LucideIcon;
}

export const CAMPO_MAPA_OBJETOS: CampoMapaObjetoDef[] = [
  {
    id: "molino_agua",
    label: "Molino de agua",
    shortLabel: "Molino",
    hint: "Hacé clic para ubicar el molino.",
    color: "#0ea5e9",
    geometry: "point",
    icon: Waves,
  },
  {
    id: "bomba_agua",
    label: "Bomba de agua",
    shortLabel: "Bomba",
    hint: "Hacé clic para ubicar la bomba.",
    color: "#2563eb",
    geometry: "point",
    icon: BombaAguaIcon as LucideIcon,
  },
  {
    id: "bebedero",
    label: "Bebedero",
    shortLabel: "Bebedero",
    hint: "Hacé clic para ubicar el bebedero.",
    color: "#06b6d4",
    geometry: "point",
    icon: Droplets,
  },
  {
    id: "tanque_australiano",
    label: "Tanque australiano",
    shortLabel: "Tanque",
    hint: "Hacé clic para ubicar el tanque australiano.",
    color: "#64748b",
    geometry: "point",
    icon: Cylinder,
  },
  {
    id: "camino",
    label: "Camino",
    shortLabel: "Camino",
    hint: "Marcá el recorrido del camino y finalizá.",
    color: "#a16207",
    geometry: "line",
    icon: Route,
  },
  {
    id: "portera",
    label: "Portera",
    shortLabel: "Portera",
    hint: "Hacé clic para ubicar la portera.",
    color: "#b45309",
    geometry: "point",
    icon: DoorOpen,
  },
  {
    id: "puente",
    label: "Puente",
    shortLabel: "Puente",
    hint: "Hacé clic para ubicar el puente.",
    color: "#475569",
    geometry: "point",
    icon: Milestone,
  },
];

export function isCampoMapaObjetoTipo(value: unknown): value is CampoMapaObjetoTipo {
  return (
    typeof value === "string" &&
    (CAMPO_MAPA_OBJETO_TIPOS as readonly string[]).includes(value)
  );
}

export function getCampoMapaObjetoDef(tipo: CampoMapaObjetoTipo): CampoMapaObjetoDef {
  return CAMPO_MAPA_OBJETOS.find((item) => item.id === tipo) ?? CAMPO_MAPA_OBJETOS[0];
}

export function parseCampoMapaObjetoTipo(
  metadata: string | undefined | null,
): CampoMapaObjetoTipo | null {
  if (!metadata?.trim()) return null;
  try {
    const parsed = JSON.parse(metadata) as { objeto_tipo?: unknown };
    return isCampoMapaObjetoTipo(parsed.objeto_tipo) ? parsed.objeto_tipo : null;
  } catch {
    return null;
  }
}

export function withCampoMapaObjetoTipo(
  metadata: Record<string, unknown>,
  objetoTipo: CampoMapaObjetoTipo,
): Record<string, unknown> {
  return {
    ...metadata,
    objeto_tipo: objetoTipo,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function objetoGlyphSvg(tipo: CampoMapaObjetoTipo, color: string): string {
  const stroke = "#ffffff";
  switch (tipo) {
    case "molino_agua":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="10" r="5.2" fill="${color}" stroke="${stroke}" stroke-width="1.4"/><path d="M12 5.2 13.6 10 12 14.8 10.4 10Z" fill="${stroke}" fill-opacity=".9"/><path d="M12 15.2V20" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/><path d="M8.5 20h7" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    case "bomba_agua":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="9" width="8.5" height="10" rx="1.6" fill="${color}" stroke="${stroke}" stroke-width="1.4"/><path d="M9 9V7.4a2.1 2.1 0 0 1 4.2 0V9" fill="none" stroke="${stroke}" stroke-width="1.5"/><path d="M11.1 5.3h5.8M16.9 5.3v2.4" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"/><path d="M15 13.2h3.2a1.6 1.6 0 0 1 0 3.2H15" fill="none" stroke="${stroke}" stroke-width="1.5"/><path d="M19.3 18.4c0 1.05-.85 1.9-1.85 1.9s-1.85-.85-1.85-1.9c0-1.15 1.85-2.7 1.85-2.7s1.85 1.55 1.85 2.7Z" fill="${stroke}"/></svg>`;
    case "bebedero":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10h10l-1.2 7.2A2 2 0 0 1 13.8 19h-3.6a2 2 0 0 1-2-1.8L7 10Z" fill="${color}" stroke="${stroke}" stroke-width="1.4"/><path d="M9 10c.4-2.2 1.5-3.8 3-5 1.5 1.2 2.6 2.8 3 5" stroke="${stroke}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
    case "tanque_australiano":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="8" rx="7" ry="3" fill="${color}" stroke="${stroke}" stroke-width="1.4"/><path d="M5 8v7c0 1.7 3.1 3 7 3s7-1.3 7-3V8" fill="${color}" stroke="${stroke}" stroke-width="1.4"/><ellipse cx="12" cy="15" rx="7" ry="3" fill="none" stroke="${stroke}" stroke-width="1.2" opacity=".7"/></svg>`;
    case "camino":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19 10 5h4l4 14" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v2.2M12 12v2.2M12 17v2" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case "portera":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V7.5L12 5l7 2.5V19" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 10h14M5 13.5h14M5 17h14M12 5v14" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round"/></svg>`;
    case "puente":
      return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15h16" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/><path d="M6 15V9.5M18 15V9.5" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round"/><path d="M6 10c2 2.8 4 4.2 6 4.2S16 12.8 18 10" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/></svg>`;
  }
}

export function campoMapaObjetoIconHtml(
  tipo: CampoMapaObjetoTipo,
  color: string,
  label?: string,
): string {
  const def = getCampoMapaObjetoDef(tipo);
  const title = escapeHtml(label?.trim() || def.shortLabel);
  return `<span class="campo-mapa-objeto" style="--objeto-color:${color}">
    <span class="campo-mapa-objeto-badge">${objetoGlyphSvg(tipo, color)}</span>
    <span class="campo-mapa-objeto-label">${title}</span>
  </span>`;
}

export function createCampoMapaObjetoLeafletIcon(
  tipo: CampoMapaObjetoTipo,
  color: string,
  label?: string,
  selected = false,
): L.DivIcon {
  const text = (label?.trim() || getCampoMapaObjetoDef(tipo).shortLabel).trim();
  const wraps = text.length > 12 || text.includes(" ");
  const width = selected ? 138 : 128;
  const height = wraps ? (selected ? 52 : 48) : selected ? 40 : 36;
  return L.divIcon({
    className: `campo-mapa-objeto-leaflet${selected ? " is-selected" : ""}`,
    html: campoMapaObjetoIconHtml(tipo, color, label),
    iconSize: [width, height],
    iconAnchor: [22, height / 2],
    popupAnchor: [0, -height / 2 + 4],
  });
}
