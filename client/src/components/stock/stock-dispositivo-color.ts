export const COLORES_CARAVANA = [
  { id: "amarillo", label: "Amarillo", hex: "#facc15" },
  { id: "rojo", label: "Rojo", hex: "#dc2626" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "verde", label: "Verde", hex: "#16a34a" },
  { id: "naranja", label: "Naranja", hex: "#ea580c" },
  { id: "blanco", label: "Blanco", hex: "#f8fafc" },
  { id: "negro", label: "Negro", hex: "#1e293b" },
  { id: "rosa", label: "Rosa", hex: "#ec4899" },
  { id: "violeta", label: "Violeta", hex: "#7c3aed" },
  { id: "celeste", label: "Celeste", hex: "#38bdf8" },
] as const;

export type ColorCaravanaId = (typeof COLORES_CARAVANA)[number]["id"];

const COLOR_IDS = new Set<string>(COLORES_CARAVANA.map((c) => c.id));

export function normalizarColorCaravana(val: string | undefined | null): string {
  const norm = String(val ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!norm || !COLOR_IDS.has(norm)) return "";
  return norm;
}

export function etiquetaColorCaravana(val: string | undefined | null): string {
  const id = normalizarColorCaravana(val);
  if (!id) return "—";
  return COLORES_CARAVANA.find((c) => c.id === id)?.label ?? id;
}

export function hexColorCaravana(val: string | undefined | null): string | null {
  const id = normalizarColorCaravana(val);
  if (!id) return null;
  return COLORES_CARAVANA.find((c) => c.id === id)?.hex ?? null;
}
