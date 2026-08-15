import type { Db } from "./db/pg-client.js";
import { categoriasDispositivo } from "./stock-ganadera-categoria.js";
import { getMetasDispositivosPorClaves } from "./stock-ganadero-db.js";
import {
  categoriasPorTipo,
  labelsPorTipo,
  updateCategoriaSimulacionVentaGanado,
  type SimuladorVentaGanadoRow,
  type SimuladorVentaTipo,
} from "./simulador-venta-ganado-db.js";

/** Clave de evolución del stock → categoría del simulador según tipo de venta. */
const FILTRO_A_SIMULADOR: Record<SimuladorVentaTipo, Record<string, string>> = {
  EN_PIE: {
    TERNERO: "TERNERO",
    TERNERA: "TERNERA",
    VACA: "VACA_INVERNADA",
  },
  CUARTA_BALANZA: {
    NOVILLO_1_2: "NOVILLO",
    NOVILLO_MAS_2: "NOVILLO",
    TORO_1_2: "NOVILLO",
    TORO_MAS_2: "NOVILLO",
    VACA: "VACA",
    VAQUILLONA_1_2: "VAQUILLONA",
    VAQUILLONA_MAS_2: "VAQUILLONA",
  },
};

export function categoriaSimuladorDesdeFiltroKeys(
  tipo: SimuladorVentaTipo,
  filtroKeys: readonly string[]
): string | null {
  const permitidas = new Set(categoriasPorTipo(tipo));
  const map = FILTRO_A_SIMULADOR[tipo] ?? {};
  const encontradas = new Set<string>();
  for (const key of filtroKeys) {
    const cat = map[key];
    if (cat && permitidas.has(cat as never)) encontradas.add(cat);
  }
  if (encontradas.size === 1) return [...encontradas][0]!;
  return null;
}

/**
 * Si todos los dispositivos vinculados apuntan a la misma categoría válida
 * para el tipo de venta, la devuelve. Si hay mezcla o datos incompletos, null.
 */
export function inferirCategoriaSimuladorUnanime(
  tipo: SimuladorVentaTipo,
  metas: ReadonlyArray<{
    sexo: "" | "MACHO" | "HEMBRA";
    edad: number | null;
    nacimiento_mes: number | null;
    nacimiento_anio: number | null;
    estado: "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";
    baja_mes: number | null;
    baja_anio: number | null;
  }>
): string | null {
  if (!metas.length) return null;

  const cats: string[] = [];
  for (const meta of metas) {
    const keys = categoriasDispositivo(meta);
    const cat = categoriaSimuladorDesdeFiltroKeys(tipo, keys);
    if (!cat) return null;
    cats.push(cat);
  }

  const first = cats[0]!;
  if (cats.every((c) => c === first)) return first;
  return null;
}

export interface CorregirCategoriaDesdeDispositivosResult {
  actualizo: boolean;
  antes: string;
  despues: string;
  row: SimuladorVentaGanadoRow;
  labelAntes: string;
  labelDespues: string;
}

/**
 * Corrige la categoría de la venta según sexo/edad de los dispositivos vinculados.
 * Solo actúa si hay coincidencia unánime y distinta a la actual.
 * No modifica precios ni totales.
 */
export async function corregirCategoriaVentaDesdeDispositivos(
  db: Db,
  simulacion: SimuladorVentaGanadoRow,
  claves: readonly string[],
  cuentaId?: number | null
): Promise<CorregirCategoriaDesdeDispositivosResult | null> {
  if (!claves.length) return null;

  const metasMap = await getMetasDispositivosPorClaves(db, claves);
  if (metasMap.size !== new Set(claves.map((c) => String(c).replace(/\D/g, "")).filter(Boolean)).size) {
    return null;
  }
  const metas = [...metasMap.values()];
  if (!metas.length) return null;

  const inferida = inferirCategoriaSimuladorUnanime(simulacion.tipo, metas);
  if (!inferida || inferida === simulacion.categoria) return null;

  const row = await updateCategoriaSimulacionVentaGanado(
    db,
    simulacion.id,
    inferida,
    cuentaId
  );
  const labels = labelsPorTipo(simulacion.tipo);
  return {
    actualizo: true,
    antes: simulacion.categoria,
    despues: row.categoria,
    row,
    labelAntes: labels[simulacion.categoria] ?? simulacion.categoria,
    labelDespues: labels[row.categoria] ?? row.categoria,
  };
}
