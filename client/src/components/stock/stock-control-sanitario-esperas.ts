/** Tiempos de espera predefinidos (carne / retiro). */
export const ESPERAS_CONTROL_SANITARIO_PRESET: readonly string[] = [
  "30 DIAS",
  "40 DIAS",
  "50 DIAS",
  "60 DIAS",
];

export function mergeEsperaOpciones(
  catalogoDb: string[],
  historial: string[],
  valorActual = ""
): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  const push = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(t);
  };
  for (const e of ESPERAS_CONTROL_SANITARIO_PRESET) push(e);
  for (const e of catalogoDb) push(e);
  for (const e of historial) push(e);
  if (valorActual) push(valorActual);
  return list.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}
