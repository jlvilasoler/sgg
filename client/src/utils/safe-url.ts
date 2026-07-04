/** Solo permite enlaces http(s) para evitar javascript: y otros esquemas peligrosos. */
export function safeExternalHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    /* URL inválida */
  }
  return null;
}

export function safeExternalHostname(raw: string): string {
  const href = safeExternalHref(raw);
  if (!href) return raw.trim();
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return raw.trim();
  }
}
