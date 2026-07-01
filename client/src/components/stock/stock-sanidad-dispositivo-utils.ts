import type { StockGanaderaDispositivo } from "../../types";
import {
  categoriasDispositivo,
  labelCategoriaFiltro,
  normalizarGrupoLibre,
} from "./stock-ganadera-utils";

export function animalIdFromDispositivo(d: StockGanaderaDispositivo): string {
  return d.vid.trim() || d.clave || d.eid.trim();
}

export function animalCategoriaLoteFromDispositivo(d: StockGanaderaDispositivo): string {
  const parts: string[] = [];
  const cats = [...categoriasDispositivo(d)].map((k) => labelCategoriaFiltro(k));
  if (cats.length) parts.push(cats.join(", "));
  const gen = (d.grupo ?? "").trim().toUpperCase();
  const gl = normalizarGrupoLibre(d.grupo_libre ?? "");
  if (gen) parts.push(gen);
  if (gl) parts.push(gl);
  return parts.join(" · ");
}
