import type { Nota } from "../types";

export const HOME_NOTAS_PREVIEW_LIMIT = 8;

export function ordenarNotasDestacadas(notas: Nota[]): Nota[] {
  return [...notas].sort((a, b) => {
    if (a.fijada !== b.fijada) return a.fijada ? -1 : 1;
    const aTs = a.actualizado_en ?? "";
    const bTs = b.actualizado_en ?? "";
    return bTs.localeCompare(aTs);
  });
}

export function notasPreviewParaHome(notas: Nota[]): Nota[] {
  return ordenarNotasDestacadas(notas).slice(0, HOME_NOTAS_PREVIEW_LIMIT);
}
