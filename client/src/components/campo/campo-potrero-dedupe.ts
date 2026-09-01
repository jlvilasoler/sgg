import { parseCampoMapaMarcadorId } from "./campo-mapa-metadata";

/** Clave de nombre para detectar potreros duplicados entre empresas. */
export function claveNombrePotreroMapa(nombre: string): string {
  return String(nombre ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ");
}

/**
 * En modo consolidado el mapa se partió por empresa y el mismo potrero aparece N veces.
 * Queda una sola fila por nombre; si hay vínculo a estancia, se prioriza esa copia.
 */
export function dedupeCampoPotrerosMapaByNombre<
  T extends { id: number; nombre: string; metadata?: string | null },
>(rows: readonly T[]): T[] {
  const byKey = new Map<string, T>();
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  for (const row of sorted) {
    const key = claveNombrePotreroMapa(row.nombre);
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    const prevHas = parseCampoMapaMarcadorId(prev.metadata) != null;
    const rowHas = parseCampoMapaMarcadorId(row.metadata) != null;
    if (!prevHas && rowHas) byKey.set(key, row);
  }
  return [...byKey.values()];
}
