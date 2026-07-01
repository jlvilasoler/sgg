/** Fotos de producto aceptables para mostrar (no logos, GuíaVET ni tarjetas SVG). */
export function esFotoProductoAceptable(foto: unknown): boolean {
  const t = String(foto ?? "").trim();
  if (!t) return false;
  if (t.startsWith("data:image/")) return true;

  const lower = t.toLowerCase();
  if (lower.includes("guiavet")) return false;
  if (/sin-titulo|woocommerce-placeholder|avatar\.jpg/i.test(lower)) return false;
  if (lower.endsWith(".svg")) return false;
  if (/\/logo|logo\.(png|jpg|jpeg|webp|svg)/i.test(lower)) return false;

  return /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(lower);
}

export function sanitizeProductoFichaFoto(foto: unknown): string {
  const t = String(foto ?? "").trim();
  return esFotoProductoAceptable(t) ? t : "";
}
