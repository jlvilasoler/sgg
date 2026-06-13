/** Convierte texto libre de formularios a mayúsculas (español Uruguay). */
export function aMayusculas(valor: string): string {
  return valor.toLocaleUpperCase("es-UY");
}

const PARTICULAS_TITULO = new Set([
  "y",
  "e",
  "de",
  "del",
  "la",
  "las",
  "el",
  "los",
  "en",
  "a",
  "o",
  "u",
  "con",
  "por",
  "sin",
]);

/**
 * Rubros / sub-rubros: título con mayúscula inicial; «y», «de», etc. quedan en minúscula
 * (evita duplicar grupos como «Alambrados y …» vs «Alambrados Y …»).
 */
export function normalizarTituloRubro(valor: string): string {
  const s = valor.trim().replace(/\s+/g, " ");
  if (!s) return "";
  const palabras = s.split(" ");
  return palabras
    .map((palabra, i) => {
      const lower = palabra.toLocaleLowerCase("es-UY");
      if (i > 0 && PARTICULAS_TITULO.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("es-UY") + lower.slice(1);
    })
    .join(" ");
}

const TIPOS_INPUT_SIN_MAYUS = new Set([
  "number",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
  "email",
  "password",
  "file",
  "checkbox",
  "radio",
  "range",
  "color",
  "hidden",
  "button",
  "submit",
  "reset",
]);

export function inputDebeMayusculas(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el.dataset.sinMayusculas === "true") return false;
  if (el instanceof HTMLInputElement) {
    const ac = el.autocomplete?.toLowerCase() ?? "";
    if (ac === "current-password" || ac === "new-password") return false;
  }
  if (el instanceof HTMLTextAreaElement) return true;
  const tipo = el.type || "text";
  if (TIPOS_INPUT_SIN_MAYUS.has(tipo)) return false;
  return true;
}

export function estaEnAmbitoFormulario(el: Element): boolean {
  return !!(el.closest("form") || el.closest(".mayusculas-auto"));
}

function dispararInputReact(el: HTMLInputElement | HTMLTextAreaElement, valor: string) {
  const proto =
    el instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Aplica mayúsculas en el input y notifica a React (componentes controlados). */
export function aplicarMayusculasEnInput(el: HTMLInputElement | HTMLTextAreaElement) {
  if (!inputDebeMayusculas(el)) return;
  const up = aMayusculas(el.value);
  if (el.value === up) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  dispararInputReact(el, up);
  if (start != null && end != null) {
    try {
      el.setSelectionRange(start, end);
    } catch {
      /* type=number etc. */
    }
  }
}

/** Para helpers `set` de formularios: solo strings de texto libre. */
export function valorTextoForm<K extends string>(
  key: K,
  value: unknown,
  excluir: readonly K[] = []
): unknown {
  if (typeof value !== "string") return value;
  if (excluir.includes(key)) return value;
  return aMayusculas(value);
}
