import type { SubRubro } from "../types";
import { grupoClaveOrden, grupoTituloCanon } from "./grupoRubro";

export interface RubrosCatalogoGasto {
  rubros: string[];
  sub_rubros_por_rubro: Record<string, string[]>;
}

function esSubRubroActivo(activo: unknown): boolean {
  return activo === 1 || activo === true;
}

const sortNombre = (a: string, b: string) =>
  a.localeCompare(b, "es", { sensitivity: "accent" });

/** Misma lógica que Configuración → Rubros: grupos y sub-rubros activos vinculados. */
export function buildRubrosCatalogoGasto(rows: SubRubro[]): RubrosCatalogoGasto {
  const buckets = new Map<string, { titulo: string; subs: string[] }>();

  for (const row of rows) {
    const clave = grupoClaveOrden(row.grupo);
    const titulo = grupoTituloCanon(row.grupo);
    let bucket = buckets.get(clave);
    if (!bucket) {
      bucket = { titulo, subs: [] };
      buckets.set(clave, bucket);
    }
    if (!esSubRubroActivo(row.activo)) continue;
    if (!bucket.subs.some((s) => s.localeCompare(row.nombre, "es", { sensitivity: "accent" }) === 0)) {
      bucket.subs.push(row.nombre);
    }
  }

  let rubros = [...buckets.values()]
    .filter((b) => b.subs.length > 0)
    .map((b) => b.titulo)
    .sort(sortNombre);

  if (rubros.length === 0) {
    rubros = [...buckets.values()].map((b) => b.titulo).sort(sortNombre);
  }

  const sub_rubros_por_rubro: Record<string, string[]> = {};
  for (const b of buckets.values()) {
    sub_rubros_por_rubro[b.titulo] = [...b.subs].sort(sortNombre);
  }

  return { rubros, sub_rubros_por_rubro };
}
