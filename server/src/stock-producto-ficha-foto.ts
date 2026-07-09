import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fotosManifest from "./stock-control-sanitario-producto-fichas-fotos.json" with { type: "json" };

const FOTOS_BY_NOMBRE = fotosManifest as Record<string, string>;
const CATALOG_PREFIX = "/productos-sanitarios/";
const RASTER_EXT = ["jpg", "jpeg", "png", "webp"] as const;

const FOTOS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client/public/productos-sanitarios"
);

export function productoFichaSlug(nombre: string): string {
  return nombre
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fotos guardadas en ficha (base64 o raster del catálogo). */
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

function archivoCatalogoExiste(ruta: string): boolean {
  if (!ruta.startsWith(CATALOG_PREFIX)) return false;
  const rel = ruta.slice(CATALOG_PREFIX.length);
  if (!rel || rel.includes("..")) return false;
  return fs.existsSync(path.join(FOTOS_DIR, rel));
}

function candidatosFotoProducto(nombre: string, fotoData?: string): string[] {
  const slug = productoFichaSlug(nombre);
  const manifest = FOTOS_BY_NOMBRE[nombre] ?? "";
  const base: string[] = [];

  const guardada = String(fotoData ?? "").trim();
  if (guardada) base.push(guardada);
  if (manifest) base.push(manifest);

  for (const ext of RASTER_EXT) {
    base.push(`${CATALOG_PREFIX}${slug}.${ext}`);
  }

  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of base) {
    const t = item.trim();
    if (!t || vistos.has(t)) continue;
    vistos.add(t);
    out.push(t);
  }
  return out;
}

/** Mejor imagen raster disponible en disco o manifiesto para persistir en ficha. */
export function mejorFotoRasterProducto(nombre: string, fotoData?: string): string {
  for (const candidata of candidatosFotoProducto(nombre, fotoData)) {
    if (!esFotoProductoAceptable(candidata)) continue;
    if (candidata.startsWith("data:image/")) return candidata;
    if (archivoCatalogoExiste(candidata)) return candidata;
  }
  return "";
}
