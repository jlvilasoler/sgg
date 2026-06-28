export const CLASIFICACIONES_RESULTADO = [
  "COSTOS_PRODUCCION",
  "GASTOS_ADMINISTRATIVOS",
  "GASTOS_COMERCIALES",
] as const;

export type ClasificacionResultado = (typeof CLASIFICACIONES_RESULTADO)[number];

export const CLASIFICACION_RESULTADO_LABELS: Record<ClasificacionResultado, string> = {
  COSTOS_PRODUCCION: "Costos de producción",
  GASTOS_ADMINISTRATIVOS: "Gastos administrativos",
  GASTOS_COMERCIALES: "Gastos comerciales",
};

function normRubro(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const COSTOS_PRODUCCION = new Set(
  [
    "Insumos veterinarios",
    "Alimentación animal",
    "Combustibles y lubricantes",
    "Transportes y Fletes",
    "Repuestos y maquinaria",
    "Agricultura",
    "Alambrados",
    "Servicios operativos",
  ].map(normRubro)
);

const GASTOS_ADMINISTRATIVOS = new Set(
  [
    "Sueldos y cargas sociales",
    "Impuestos y tasas",
    "Servicios profesionales",
    "Alquileres y arrendamientos",
    "Seguros",
    "Construcciones y Reformas",
  ].map(normRubro)
);

const GASTOS_COMERCIALES = new Set(["Otros gastos de funcionamiento"].map(normRubro));

export function parseClasificacionResultado(
  raw: unknown
): ClasificacionResultado | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!v) return null;
  return CLASIFICACIONES_RESULTADO.includes(v as ClasificacionResultado)
    ? (v as ClasificacionResultado)
    : null;
}

export function clasificarRubroEnResultado(rubro: string): ClasificacionResultado {
  const key = normRubro(rubro);
  if (COSTOS_PRODUCCION.has(key)) return "COSTOS_PRODUCCION";
  if (GASTOS_COMERCIALES.has(key)) return "GASTOS_COMERCIALES";
  return "GASTOS_ADMINISTRATIVOS";
}
