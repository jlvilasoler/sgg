/** Cantidades predefinidas para control sanitario (cc, comprimidos, mm). */
export const CANTIDADES_REMEDIO_PRESET: readonly string[] = (() => {
  const cc = Array.from({ length: 30 }, (_, i) => `${i + 1} cc`);
  const comprimidos = [1, 2, 3, 4, 5].map((n) =>
    n === 1 ? "1 Comprimido" : `${n} Comprimidos`
  );
  const mm = Array.from({ length: 20 }, (_, i) => `${i + 1} mm`);
  return [...cc, ...comprimidos, ...mm];
})();

export function mergeCantidadOpciones(
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
  for (const c of CANTIDADES_REMEDIO_PRESET) push(c);
  for (const c of catalogoDb) push(c);
  for (const c of historial) push(c);
  if (valorActual) push(valorActual);
  return list;
}
