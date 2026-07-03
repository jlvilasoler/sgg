/**
 * Descarga el logo oficial del BPS desde bps.gub.uy.
 * Ejecutar: node scripts/fetch-logo-bps.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "client", "public");
const SOURCE = "https://www.bps.gub.uy/logo_bps";
const FULL_VIEWBOX = 'viewBox="0 0 454.55 225.97"';
/** Isotipo + sigla BPS completa, sin el pie "Banco de Previsión Social". */
const COMPACT_VIEWBOX = 'viewBox="0 0 454.55 175"';

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${SOURCE}`);
  const svg = await res.text();
  if (!svg.includes("<svg")) throw new Error("Respuesta inesperada (no es SVG)");

  fs.writeFileSync(path.join(publicDir, "logo-bps.svg"), svg, "utf8");

  const compact = svg.replace(FULL_VIEWBOX, COMPACT_VIEWBOX);
  fs.writeFileSync(path.join(publicDir, "logo-bps-compact.svg"), compact, "utf8");

  console.log("Logo BPS actualizado desde", SOURCE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
