/** Clave estable de nombre para unificar establecimientos duplicados entre empresas. */
export function claveNombreEstablecimiento(nombre: string | null | undefined): string {
  return String(nombre ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");
}

/**
 * Marcadores del mapa se copian por empresa en modo individual.
 * En vistas agregadas (consolidado / home) debe quedar uno por nombre.
 */
export function dedupeMarcadoresMapaByNombre<T extends { id: number; nombre: string }>(
  rows: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  for (const row of sorted) {
    const key = claveNombreEstablecimiento(row.nombre);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
