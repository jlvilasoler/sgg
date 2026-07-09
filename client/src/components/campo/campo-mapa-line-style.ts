export const CAMPO_MAPA_LINE_STYLES = ["solida", "punteada", "discontinua"] as const;

export type CampoMapaLineStyle = (typeof CAMPO_MAPA_LINE_STYLES)[number];

export const DEFAULT_CAMPO_MAPA_LINE_STYLE: CampoMapaLineStyle = "solida";

export interface CampoMapaLineStyleDef {
  id: CampoMapaLineStyle;
  label: string;
  /** Valor Leaflet `dashArray`; `undefined` = línea continua. */
  dashArray: string | undefined;
}

export const CAMPO_MAPA_LINE_STYLE_DEFS: CampoMapaLineStyleDef[] = [
  { id: "solida", label: "Continua", dashArray: undefined },
  { id: "punteada", label: "Punteada", dashArray: "2 6" },
  { id: "discontinua", label: "Discontinua", dashArray: "8 6" },
];

export function isCampoMapaLineStyle(value: unknown): value is CampoMapaLineStyle {
  return (
    typeof value === "string" &&
    (CAMPO_MAPA_LINE_STYLES as readonly string[]).includes(value)
  );
}

export function getCampoMapaLineStyleDef(style: CampoMapaLineStyle): CampoMapaLineStyleDef {
  return (
    CAMPO_MAPA_LINE_STYLE_DEFS.find((item) => item.id === style) ?? CAMPO_MAPA_LINE_STYLE_DEFS[0]
  );
}

export function dashArrayForLineStyle(style: CampoMapaLineStyle | null | undefined): string | undefined {
  if (!style) return undefined;
  return getCampoMapaLineStyleDef(style).dashArray;
}
