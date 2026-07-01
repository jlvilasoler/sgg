/**
 * Descarga imágenes de productos veterinarios desde GuíaVET (UY) hacia
 * client/public/productos-sanitarios/{slug}.jpg
 *
 * Uso: node server/scripts/download-producto-fichas-images.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "client/public/productos-sanitarios");
const SEED_PATH = path.join(ROOT, "server/src/stock-control-sanitario-producto-fichas-seed.ts");

const PRODUCTOS = [
  "Agrovet Market", "Albex", "Albenil", "Aranda", "Ausmectin", "Bago", "Banamine", "Baycox",
  "Baymec", "Bectin", "Biogenesis Bagó", "Boehringer Ingelheim", "Brouwer", "Calier",
  "Ceva Salud Animal", "Cobalt", "Cydectin", "Dectomax", "Doramec", "Draxxin", "Ectocide",
  "Elanco", "Engemycin", "Eprinex", "Excenel", "Excede", "Fasinex", "Globion", "Hipra",
  "Hertape Calier", "Ivomec", "Ivomec Gold", "Ivomec Pour-On", "Ivosan", "Ivercass",
  "Ivermet", "J.A. Baker", "Konig", "Labinco", "Lafox", "Longrange", "Maximec",
  "Merck Animal Health", "Metacam", "Micotil", "Morvia", "MSD Salud Animal", "Naxcel",
  "Ouro Fino Saúde Animal", "Panacur", "Panacur 25", "Panzer", "Provet", "Richet",
  "Rycoben", "Supasin", "Supracid", "Tasignol", "Taurador", "Tecnopec", "Terramicina LA",
  "Tulamax", "Valbazen", "Vallée", "Verben", "Vermitan", "Vetanco", "Vetoquinol", "Virbac",
  "Virbamec", "Zactran", "Zoetis", "Zuprevo",
];

function slug(nombre) {
  return nombre
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SCG-ProductoFicha/1.0" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  return res.text();
}

async function findGuiaVetProductUrl(nombre) {
  const slugGuess = slug(nombre);
  const direct = `https://guiavet.uy/producto/${slugGuess}/`;
  const directHtml = await fetchText(direct);
  if (directHtml && directHtml.includes("Principio activo")) return direct;

  const searchUrl = `https://guiavet.uy/?s=${encodeURIComponent(nombre)}`;
  const html = await fetchText(searchUrl);
  if (!html) return null;

  const re = new RegExp(
    `href="(https://guiavet\\.uy/producto/[^"]+)"[^>]*>\\s*${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i"
  );
  const m = html.match(re);
  if (m?.[1]) return m[1];

  const first = html.match(/href="(https:\/\/guiavet\.uy\/producto\/[^"]+)"/i);
  return first?.[1] ?? null;
}

function extractImageFromProductHtml(html) {
  const og = html.match(/property="og:image"\s+content="([^"]+)"/i);
  if (og?.[1]) return og[1];

  const img = html.match(/<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]+src="([^"]+)"/i);
  if (img?.[1]) return img[1];

  const any = html.match(/<img[^>]+src="(https:\/\/guiavet\.uy\/wp-content\/uploads\/[^"]+)"/i);
  return any?.[1] ?? null;
}

async function downloadImage(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SCG-ProductoFicha/1.0" },
  });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) return false;
  fs.writeFileSync(dest, buf);
  return true;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const nombre of PRODUCTOS) {
    const file = path.join(OUT_DIR, `${slug(nombre)}.jpg`);
    if (fs.existsSync(file) && fs.statSync(file).size > 2000) {
      skip++;
      continue;
    }

    process.stdout.write(`… ${nombre}: `);
    try {
      const productUrl = await findGuiaVetProductUrl(nombre);
      if (!productUrl) {
        console.log("sin URL");
        fail++;
        await sleep(400);
        continue;
      }
      const html = await fetchText(productUrl);
      const imgUrl = html ? extractImageFromProductHtml(html) : null;
      if (!imgUrl) {
        console.log("sin imagen");
        fail++;
        await sleep(400);
        continue;
      }
      const saved = await downloadImage(imgUrl, file);
      if (saved) {
        console.log("ok");
        ok++;
      } else {
        console.log("fallo descarga");
        fail++;
      }
    } catch (e) {
      console.log(`error (${e.message})`);
      fail++;
    }
    await sleep(500);
  }

  console.log(`\nListo: ${ok} nuevas, ${skip} ya existían, ${fail} sin imagen.`);
  console.log(`Carpeta: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
