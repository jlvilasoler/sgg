import type { StockOvinaDispositivo } from "../../types";
import {
  categoriasDispositivo,
  labelCategoriaFiltro,
  normalizarGrupoLibre,
} from "./stock-ovina-utils";

export function animalIdFromDispositivoOvino(d: StockOvinaDispositivo): string {
  return d.vid.trim() || d.clave || d.eid.trim();
}

export function animalCategoriaLoteFromDispositivoOvino(d: StockOvinaDispositivo): string {
  const parts: string[] = [];
  const cats = [...categoriasDispositivo(d)].map((k) => labelCategoriaFiltro(k));
  if (cats.length) parts.push(cats.join(", "));
  const gen = (d.grupo ?? "").trim().toUpperCase();
  const gl = normalizarGrupoLibre(d.grupo_libre ?? "");
  if (gen) parts.push(gen);
  if (gl) parts.push(gl);
  return parts.join(" · ");
}
