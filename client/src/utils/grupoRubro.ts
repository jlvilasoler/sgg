import { normalizarTituloRubro } from "./formText";

const GRUPO_ALAMBRADOS = "Alambrados";

function esGrupoAlambradosLegacy(grupo: string): boolean {
  const n = grupo
    .trim()
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return (
    n === "alambrados y cerramientos" ||
    n === "alambrados y cerramiento" ||
    n.startsWith("alambrados y cerr")
  );
}

/** Clave estable para agrupar el mismo rubro aunque varíe mayúsculas en la BD. */
export function grupoClaveOrden(grupo: string): string {
  if (esGrupoAlambradosLegacy(grupo)) return GRUPO_ALAMBRADOS.toLocaleLowerCase("es-UY");
  return grupo.toLocaleLowerCase("es-UY");
}

/** Nombre canónico de grupo para mostrar en listados. */
export function grupoTituloCanon(grupo: string): string {
  if (esGrupoAlambradosLegacy(grupo)) return GRUPO_ALAMBRADOS;
  return normalizarTituloRubro(grupo);
}

/** Rubro contable en selector de gastos: unifica nombre legacy. */
export function rubroTituloCanon(nombre: string): string {
  const t = nombre.trim();
  if (!t) return "";
  const n = t
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (n === "alambrados y cerramientos" || n.startsWith("alambrados y cerr")) {
    return GRUPO_ALAMBRADOS;
  }
  return normalizarTituloRubro(t);
}
