import fotosManifest from "../../data/producto-ficha-fotos.json";

const FOTOS_BY_NOMBRE = fotosManifest as Record<string, string>;
const CATALOG_PREFIX = "/productos-sanitarios/";
const RASTER_EXT = ["jpg", "jpeg", "png", "webp"] as const;
const DISPLAY_EXT = [...RASTER_EXT, "svg"] as const;

export function productoFichaSlug(nombre: string): string {
  return nombre
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function esRutaCatalogo(foto: string): boolean {
  return foto.startsWith(CATALOG_PREFIX);
}

/** Fotos guardadas en ficha (base64 o imagen raster del catálogo). */
export function esFotoProductoAceptable(foto: unknown): boolean {
  const t = String(foto ?? "").trim();
  if (!t) return false;
  if (t.startsWith("data:image/")) return true;

  const lower = t.toLowerCase();
  if (lower.includes("guiavet")) return false;
  if (/sin-titulo|woocommerce-placeholder|avatar\.jpg/i.test(lower)) return false;
  if (lower.endsWith(".svg")) return false;
  if (/\/logo|logo\.(png|jpg|jpeg|webp|svg)/i.test(lower)) return false;

  return /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(lower) || esRutaCatalogo(t);
}

/** Incluye tarjetas SVG propias del catálogo SCG como respaldo visual. */
export function esFotoProductoMostrable(foto: unknown): boolean {
  const t = String(foto ?? "").trim();
  if (!t) return false;
  if (t.startsWith("data:image/")) return true;
  if (esFotoProductoAceptable(t)) return true;

  const lower = t.toLowerCase();
  if (!esRutaCatalogo(lower)) return false;
  if (lower.includes("guiavet")) return false;
  return /\.(jpg|jpeg|png|webp|svg)(\?|#|$)/i.test(lower);
}

export function sanitizeProductoFichaFoto(foto: unknown): string {
  const t = String(foto ?? "").trim();
  return esFotoProductoAceptable(t) ? t : "";
}

function priorizarCandidatos(paths: string[]): string[] {
  const vistos = new Set<string>();
  const ordenados: string[] = [];

  const push = (value: string) => {
    const t = value.trim();
    if (!t || vistos.has(t)) return;
    vistos.add(t);
    ordenados.push(t);
  };

  for (const ext of RASTER_EXT) {
    for (const p of paths) {
      if (p.toLowerCase().endsWith(`.${ext}`)) push(p);
    }
  }
  for (const p of paths) push(p);

  return ordenados;
}

/** Rutas a probar en orden (ficha guardada → manifiesto → slug con extensiones). */
export function buildProductoFichaFotoCandidatos(nombre: string, fotoData?: string): string[] {
  const slug = productoFichaSlug(nombre);
  const manifest = FOTOS_BY_NOMBRE[nombre] ?? "";
  const base: string[] = [];

  const guardada = String(fotoData ?? "").trim();
  if (guardada) base.push(guardada);
  if (manifest) base.push(manifest);

  for (const ext of DISPLAY_EXT) {
    base.push(`${CATALOG_PREFIX}${slug}.${ext}`);
  }

  return priorizarCandidatos(base).filter(esFotoProductoMostrable);
}

export function resolveProductoFichaFotoSrc(nombre: string, fotoData?: string): string {
  return buildProductoFichaFotoCandidatos(nombre, fotoData)[0] ?? "";
}
