/** Vías de administración frecuentes en ganadería. */
export const FORMAS_ADMIN_REMEDIO: readonly string[] = [
  "Oral",
  "Inyectable",
  "Pour-on",
  "Tópica",
  "Intramuscular",
  "Subcutánea",
  "Intravenosa",
];

/** Vías de administración frecuentes en ovinos. */
export const FORMAS_ADMIN_REMEDIO_OVINO: readonly string[] = [
  "Oral (drench)",
  "Oral",
  "Inyectable",
  "Subcutánea",
  "Intramuscular",
  "Tópica",
  "Pour-on",
  "Spray / baño",
];

export type FormaAdminRemedioModulo = "ganadero" | "equino" | "ovino";

export function catalogoFormasPorModulo(
  modulo: FormaAdminRemedioModulo = "ganadero",
): readonly string[] {
  if (modulo === "ovino") return FORMAS_ADMIN_REMEDIO_OVINO;
  return FORMAS_ADMIN_REMEDIO;
}
