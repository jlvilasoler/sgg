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

/** Si no hay edad/nacimiento, el sexo alcanza para no dejar mal una venta (ej. Novillo vs Vaca). */
const FALLBACK_POR_SEXO: Record<SimuladorVentaTipo, Record<"MACHO" | "HEMBRA", string>> = {
  EN_PIE: {
    MACHO: "TERNERO",
    HEMBRA: "VACA_INVERNADA",
  },
  CUARTA_BALANZA: {
    MACHO: "NOVILLO",
    HEMBRA: "VACA",
  },
};

export function categoriaSimuladorDesdeFiltroKeys(
  tipo: SimuladorVentaTipo,
  filtroKeys: readonly string[]
): string | null {
  const permitidas = new Set(categoriasPorTipo(tipo).map((c) => String(c)));
  const map = FILTRO_A_SIMULADOR[tipo] ?? {};
  const encontradas = new Set<string>();
  for (const key of filtroKeys) {
    const cat = map[key];
    if (cat && permitidas.has(cat)) encontradas.add(cat);
  }
  if (encontradas.size === 1) return [...encontradas][0]!;
  return null;
}

function categoriaDesdeSexoFallback(
  tipo: SimuladorVentaTipo,
  sexo: "" | "MACHO" | "HEMBRA"
): string | null {
  if (sexo !== "MACHO" && sexo !== "HEMBRA") return null;
  const cat = FALLBACK_POR_SEXO[tipo]?.[sexo];
  if (!cat) return null;
  const permitidas = new Set(categoriasPorTipo(tipo).map((c) => String(c)));
  return permitidas.has(cat) ? cat : null;
}

/**
 * Categoría de un dispositivo: primero por edad/sexo de evolución;
 * si faltan fechas, usa el sexo (HEMBRA→Vaca / MACHO→Novillo en cuarta balanza).
 */
export function inferirCategoriaSimuladorDispositivo(
  tipo: SimuladorVentaTipo,
  meta: {
    sexo: "" | "MACHO" | "HEMBRA";
    edad: number | null;
    nacimiento_mes: number | null;
    nacimiento_anio: number | null;
    estado: "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";
    baja_mes: number | null;
    baja_anio: number | null;
  }
): string | null {
  const keys = categoriasDispositivo(meta);
  const porEdad = categoriaSimuladorDesdeFiltroKeys(tipo, keys);
  if (porEdad) return porEdad;
  return categoriaDesdeSexoFallback(tipo, meta.sexo);
}

/**
 * Si todos los dispositivos vinculados apuntan a la misma categoría válida
 * para el tipo de venta, la devuelve. Si hay mezcla, null.
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
    const cat = inferirCategoriaSimuladorDispositivo(tipo, meta);
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

  const uniqClaves = [
    ...new Set(claves.map((c) => String(c ?? "").replace(/\D/g, "")).filter(Boolean)),
  ];
  if (!uniqClaves.length) return null;

  let metasMap: Awaited<ReturnType<typeof getMetasDispositivosPorClaves>>;
  try {
    metasMap = await getMetasDispositivosPorClaves(db, uniqClaves);
  } catch {
    return null;
  }
  if (metasMap.size !== uniqClaves.length) return null;

  const metas = [...metasMap.values()];
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
