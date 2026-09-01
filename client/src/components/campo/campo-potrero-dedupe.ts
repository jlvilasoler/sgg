/** Clave de nombre para detectar potreros duplicados entre empresas. */
export function claveNombrePotreroMapa(nombre: string): string {
  return String(nombre ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");
}

/**
 * En modo consolidado el mapa se partió por empresa y el mismo potrero aparece N veces.
 * Para resúmenes de Inicio / UI agregada, queda una sola fila por nombre.
 */
export function dedupeCampoPotrerosMapaByNombre<T extends { id: number; nombre: string }>(
  rows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  for (const row of sorted) {
    const key = claveNombrePotreroMapa(row.nombre);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
