export const APP_NAME = "SAG";
export const APP_FULL_NAME = "Sistema de Administración Ganadera";
export const APP_PAGE_TITLE = `${APP_NAME} — Administración Ganadera`;

/** Etiqueta del sidebar hub (p. ej. «SAG · Config»). */
export function hubAsideKicker(section: string): string {
  return `${APP_NAME} · ${section}`;
}
