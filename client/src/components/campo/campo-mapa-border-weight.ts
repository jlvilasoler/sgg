export const CAMPO_MAPA_BORDER_WEIGHTS = [5, 4, 3, 2, 1] as const;

export type CampoMapaBorderWeight = (typeof CAMPO_MAPA_BORDER_WEIGHTS)[number];

export const DEFAULT_CAMPO_MAPA_BORDER_WEIGHT: CampoMapaBorderWeight = 2;

export function strokeWeightForSelection(
  base: CampoMapaBorderWeight,
  selected: boolean,
): number {
  return selected ? base + 1 : base;
}
