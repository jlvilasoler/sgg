import { createVentaSubRubro, fetchVentaSubRubros } from "../../api";

/** Rubro (grupo) en ingresos por ventas para cultivos agrícolas. */
export const VENTA_AGRICULTURA_RUBRO_GRUPO = "Venta agricultura";

const LEGACY_CULTIVO_IDS: Record<string, string> = {
  TRIGO: "Trigo",
  SOJA: "Soja",
  MAIZ: "Maíz",
  COLZA: "Colza",
};

export function esGrupoVentaAgricultura(grupo: string): boolean {
  return (
    grupo.trim().localeCompare(VENTA_AGRICULTURA_RUBRO_GRUPO, "es", {
      sensitivity: "accent",
    }) === 0
  );
}

export function normalizeCultivoNombre(value: string): string {
  const t = value.trim();
  if (!t) return "";
  return LEGACY_CULTIVO_IDS[t.toUpperCase()] ?? t;
}

export async function fetchCultivosVentaAgricultura(): Promise<string[]> {
  const subs = await fetchVentaSubRubros(true);
  const names = subs
    .filter((s) => esGrupoVentaAgricultura(s.grupo))
    .map((s) => s.nombre.trim())
    .filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

export async function crearCultivoVentaAgricultura(nombre: string): Promise<string> {
  const created = await createVentaSubRubro({
    nombre: nombre.trim(),
    grupo: VENTA_AGRICULTURA_RUBRO_GRUPO,
    activo: true,
  });
  return created.nombre;
}
