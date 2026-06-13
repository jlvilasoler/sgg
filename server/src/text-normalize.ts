/** Artículos y conjunciones en minúscula dentro de títulos (español). */
const PARTICULAS_TITULO = new Set([
  "y",
  "e",
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "a",
  "o",
  "u",
  "con",
  "por",
  "sin",
]);

/** Misma regla que el cliente: título con mayúscula inicial por palabra; «y», «de», etc. en minúscula. */
export function normalizarTituloRubro(valor: string): string {
  const s = valor.trim().replace(/\s+/g, " ");
  if (!s) return "";
  const palabras = s.split(" ");
  return palabras
    .map((palabra, i) => {
      const lower = palabra.toLocaleLowerCase("es-UY");
      if (i > 0 && PARTICULAS_TITULO.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("es-UY") + lower.slice(1);
    })
    .join(" ");
}
