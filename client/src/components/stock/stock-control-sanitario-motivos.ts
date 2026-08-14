/** Motivos frecuentes de tratamiento o control sanitario en ganadería. */
export const MOTIVOS_CONTROL_SANITARIO: readonly string[] = [
  "Antiparasitario / desparasitación",
  "Vacunación",
  "Control sanitario rutinario",
  "Tratamiento respiratorio",
  "Mastitis",
  "Metritis / infección uterina",
  "Cojera / podología",
  "Diarrea",
  "Reproducción / sincronización",
  "Deficiencia mineral / vitamínica",
  "Prevención garrapatas / moscas",
  "Infección dérmica",
  "Fiebre / síndrome febril",
  "Post-operatorio / curación",
  "Anemia / desnutrición",
  "Absceso / infección localizada",
  "Oftalmía / problema ocular",
  "Retención de placenta",
  "Parto asistido / posparto",
  "Queratoconjuntivitis",
];

/** Motivos frecuentes en sanidad ovina. */
export const MOTIVOS_CONTROL_SANITARIO_OVINO: readonly string[] = [
  "Antiparasitario / desparasitación",
  "Vacunación",
  "Control sanitario rutinario",
  "Cojera / footrot",
  "Diarrea",
  "Miasis / bichera",
  "Sarna / ectoparásitos",
  "Deficiencia mineral / vitamínica",
  "Anemia / desnutrición",
  "Mastitis",
  "Aborto / infección reproductiva",
  "Parto asistido / posparto",
  "Infección dérmica",
  "Problema respiratorio",
  "Oftalmía / problema ocular",
  "Absceso / infección localizada",
  "Post-operatorio / curación",
  "Esquila / manejo de lana",
];

export type MotivoControlSanitarioModulo = "ganadero" | "equino" | "ovino";

export function catalogoMotivosPorModulo(
  modulo: MotivoControlSanitarioModulo = "ganadero",
): readonly string[] {
  if (modulo === "ovino") return MOTIVOS_CONTROL_SANITARIO_OVINO;
  return MOTIVOS_CONTROL_SANITARIO;
}
