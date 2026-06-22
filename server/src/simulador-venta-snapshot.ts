import type { SimuladorVentaGanadoRow } from "./simulador-venta-ganado-db.js";

export interface OperacionSnapshot {
  id: number;
  numero_operacion: string;
  tipo: string;
  segmento: string;
  categoria: string;
  simulacion: {
    modo_kg: string;
    precio_usd_kg: number;
    precio_ref_anio: number | null;
    precio_ref_semana: number | null;
    precio_ref_fecha_hasta: string | null;
    cantidad_animales: number | null;
    kg_promedio: number | null;
    kg_total: number;
    rendimiento: number | null;
    total_usd: number;
    total_usd_por_cabeza: number | null;
    notas: string | null;
  };
  venta_real: {
    venta_realizada: boolean;
    venta_realizada_en: string | null;
    precio_usd_kg: number | null;
    cantidad_animales: number | null;
    kg_promedio: number | null;
    kg_total: number | null;
    total_usd: number | null;
    total_usd_por_cabeza: number | null;
    notas: string | null;
  } | null;
  destacada: boolean;
  usuario_id: number | null;
  usuario_nombre: string | null;
  creado_en: string;
}

export function snapshotOperacion(row: SimuladorVentaGanadoRow): OperacionSnapshot {
  const tieneReal = row.venta_realizada && row.real_total_usd != null;

  return {
    id: row.id,
    numero_operacion: row.numero_operacion,
    tipo: row.tipo,
    segmento: row.segmento,
    categoria: row.categoria,
    simulacion: {
      modo_kg: row.modo_kg,
      precio_usd_kg: row.precio_usd_kg,
      precio_ref_anio: row.precio_ref_anio,
      precio_ref_semana: row.precio_ref_semana,
      precio_ref_fecha_hasta: row.precio_ref_fecha_hasta,
      cantidad_animales: row.cantidad_animales,
      kg_promedio: row.kg_promedio,
      kg_total: row.kg_total,
      rendimiento: row.rendimiento,
      total_usd: row.total_usd,
      total_usd_por_cabeza: row.total_usd_por_cabeza,
      notas: row.notas,
    },
    venta_real: tieneReal
      ? {
          venta_realizada: row.venta_realizada,
          venta_realizada_en: row.venta_realizada_en,
          precio_usd_kg: row.real_precio_usd_kg,
          cantidad_animales: row.real_cantidad_animales,
          kg_promedio: row.real_kg_promedio,
          kg_total: row.real_kg_total,
          total_usd: row.real_total_usd,
          total_usd_por_cabeza: row.real_total_usd_por_cabeza,
          notas: row.real_notas,
        }
      : row.venta_realizada
        ? {
            venta_realizada: true,
            venta_realizada_en: row.venta_realizada_en,
            precio_usd_kg: row.real_precio_usd_kg,
            cantidad_animales: row.real_cantidad_animales,
            kg_promedio: row.real_kg_promedio,
            kg_total: row.real_kg_total,
            total_usd: row.real_total_usd,
            total_usd_por_cabeza: row.real_total_usd_por_cabeza,
            notas: row.real_notas,
          }
        : null,
    destacada: row.destacada,
    usuario_id: row.usuario_id,
    usuario_nombre: row.usuario_nombre,
    creado_en: row.creado_en,
  };
}

const SIM_FIELDS: (keyof OperacionSnapshot["simulacion"])[] = [
  "modo_kg",
  "precio_usd_kg",
  "precio_ref_anio",
  "precio_ref_semana",
  "precio_ref_fecha_hasta",
  "cantidad_animales",
  "kg_promedio",
  "kg_total",
  "rendimiento",
  "total_usd",
  "total_usd_por_cabeza",
  "notas",
];

const REAL_FIELDS = [
  "precio_usd_kg",
  "cantidad_animales",
  "kg_promedio",
  "kg_total",
  "total_usd",
  "total_usd_por_cabeza",
  "notas",
] as const;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.000_001;
  }
  return String(a ?? "") === String(b ?? "");
}

export function computeCambiosSimulacion(
  antes: OperacionSnapshot,
  despues: OperacionSnapshot
): string[] {
  const cambios: string[] = [];
  if (antes.categoria !== despues.categoria) cambios.push("categoria");
  if (antes.tipo !== despues.tipo) cambios.push("tipo");
  for (const key of SIM_FIELDS) {
    if (!valuesEqual(antes.simulacion[key], despues.simulacion[key])) {
      cambios.push(`simulacion.${key}`);
    }
  }
  return cambios;
}

export function computeCambiosVentaReal(
  antes: OperacionSnapshot,
  despues: OperacionSnapshot
): string[] {
  const cambios: string[] = [];
  const a = antes.venta_real;
  const d = despues.venta_real;
  if (!a && d) return REAL_FIELDS.map((f) => `venta_real.${f}`);
  if (a && !d) return ["venta_real"];
  if (!a || !d) return cambios;
  for (const key of REAL_FIELDS) {
    if (!valuesEqual(a[key], d[key])) cambios.push(`venta_real.${key}`);
  }
  if (a.venta_realizada_en !== d.venta_realizada_en) {
    cambios.push("venta_real.venta_realizada_en");
  }
  return cambios;
}
