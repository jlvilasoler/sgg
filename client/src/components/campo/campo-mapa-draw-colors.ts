export const CAMPO_MAPA_DRAW_COLORS = [
  "#7cb342",
  "#2d5a3d",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#0d9488",
  "#ca8a04",
  "#4338ca",
  "#e11d48",
  "#0891b2",
  "#ffffff",
] as const;

export type CampoMapaDrawColor = (typeof CAMPO_MAPA_DRAW_COLORS)[number];

export const DEFAULT_CAMPO_MAPA_DRAW_COLOR: CampoMapaDrawColor = "#7cb342";

export const CAMPO_MAPA_MEASURE_COLOR = "#7cb342";

const DRAW_COLOR_STORAGE_KEY = "campo-mapa-draw-color";

export function isCampoMapaDrawColor(value: string): value is CampoMapaDrawColor {
  return (CAMPO_MAPA_DRAW_COLORS as readonly string[]).includes(value);
}

export function loadCampoMapaDrawColor(): CampoMapaDrawColor {
  try {
    const raw = localStorage.getItem(DRAW_COLOR_STORAGE_KEY);
    if (raw && isCampoMapaDrawColor(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CAMPO_MAPA_DRAW_COLOR;
}

export function saveCampoMapaDrawColor(color: CampoMapaDrawColor): void {
  try {
    localStorage.setItem(DRAW_COLOR_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
}

export function normalizePotreroMapaColor(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  return DEFAULT_CAMPO_MAPA_DRAW_COLOR;
}

export function potreroColorPickerOptions(current?: string | null): string[] {
  const base = [...CAMPO_MAPA_DRAW_COLORS] as string[];
  const raw = String(current ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw) && !base.includes(raw)) {
    return [raw, ...base];
  }
  return base;
}
