/**
 * Genera imágenes para fichas de productos: descarga fotos reales cuando hay URL
 * y crea tarjeta SVG profesional como respaldo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "client/public/productos-sanitarios");

/** URLs directas o páginas de fabricante/distribuidor */
const SOURCES = {
  "Agrovet Market": "https://www.agrovetmarket.com/wp-content/uploads/2021/06/logo-agrovet-market.png",
  Albex: "https://www.chanellepharma.com/wp-content/uploads/2019/05/albex-pack.png",
  Albenil: "https://www.bago.com.ar/wp-content/uploads/2021/03/albenil.png",
  Aranda: "https://www.laboratorioaranda.com.ar/images/logo.png",
  Ausmectin: "https://www.vetanco.com.ar/images/productos/ausmectin.jpg",
  Bago: "https://www.bago.com.ar/wp-content/uploads/2020/06/logo-bago.png",
  Banamine: "https://ar.zoetis.com/_locale-assets/img/productos-web/banamine.jpg",
  Baycox: "https://ar.zoetis.com/products/bovinos/baycox.aspx",
  Baymec: "https://www.virbac.com.ar/img/products/baymec.png",
  Bectin: "https://www.brouwervet.com.ar/images/productos/bectin.jpg",
  "Biogenesis Bagó": "https://www.biogenesisbago.com/images/logo-biogenesis.png",
  "Boehringer Ingelheim": "https://www.boehringer-ingelheim.com/sites/default/files/2021-06/bi-logo.png",
  Brouwer: "https://www.brouwervet.com.ar/images/logo.png",
  Calier: "https://www.calier.com/images/logo-calier.png",
  "Ceva Salud Animal": "https://www.ceva.com.ar/images/logo-ceva.png",
  Cobalt: "https://www.merck-animal-health.com.au/products/cobalt/",
  Cydectin: "https://ar.zoetis.com/products/bovinos/cydectin.aspx",
  Dectomax: "https://ar.zoetis.com/_locale-assets/img/productos-web/dectomax-x3-frascos.jpg",
  Doramec: "https://www.virbac.com.ar/img/products/doramec.png",
  Draxxin: "https://ar.zoetis.com/products/bovinos/draxxin-bovino.aspx",
  Ectocide: "https://www.vetanco.com.ar/images/productos/ectocide.jpg",
  Elanco: "https://www.elanco.com/themes/custom/elanco/logo.svg",
  Engemycin: "https://www.zoetis.com/products-and-science/products/engemycin/",
  Eprinex: "https://ar.zoetis.com/products/bovinos/eprinex.aspx",
  Excenel: "https://ar.zoetis.com/products/bovinos/excenel.aspx",
  Excede: "https://ar.zoetis.com/products/bovinos/excede.aspx",
  Fasinex: "https://www.msd-animal-health.com.ar/productos/fasinex",
  Globion: "https://www.biogenesisbago.com/images/productos/globion.png",
  Hipra: "https://www.hipra.com/sites/default/files/hipra-logo.png",
  "Hertape Calier": "https://www.hertape.com.br/images/logo.png",
  Ivomec: "https://www.boehringer-ingelheim.com/sites/default/files/2020-05/ivomec-cattle.jpg",
  "Ivomec Gold": "https://www.boehringer-ingelheim.com/sites/default/files/2020-05/ivomec-gold.jpg",
  "Ivomec Pour-On": "https://www.boehringer-ingelheim.com/sites/default/files/2020-05/ivomec-pour-on.jpg",
  Ivosan: "https://www.ivu.com.uy/images/ivosan.png",
  Ivercass: "https://www.lasca.com.br/produtos/ivercass/",
  Ivermet: "https://www.tecnovax.com.ar/productos/ivermet",
  "J.A. Baker": "https://www.jabaker.com.ar/images/logo.png",
  Konig: "https://www.konig.com.ar/images/logo.png",
  Labinco: "https://www.labinco.com.uy/images/logo.png",
  Lafox: "https://www.lafox.com.ar/images/lafox-logo.png",
  Longrange: "https://www.boehringer-ingelheim.com/sites/default/files/2020-05/longrange.jpg",
  Maximec: "https://www.vetoquinol.com.ar/images/maximec.png",
  "Merck Animal Health": "https://www.merck-animal-health.com/etc/designs/merck-animal-health/logo.png",
  Metacam: "https://www.boehringer-ingelheim.com/sites/default/files/2020-05/metacam-bovinos.jpg",
  Micotil: "https://www.elanco.com/ar/products-and-solutions/micotil",
  Morvia: "https://www.morvia.com.uy/images/logo.png",
  "MSD Salud Animal": "https://www.msd-animal-health.com.ar/images/logo-msd.png",
  Naxcel: "https://ar.zoetis.com/products/naxcel-vacuno.aspx",
  "Ouro Fino Saúde Animal": "https://www.ourofino.com/wp-content/uploads/logo-ouro-fino.png",
  Panacur: "https://ar.zoetis.com/products/bovinos/panacur.aspx",
  "Panacur 25": "https://ar.zoetis.com/products/bovinos/panacur-25.aspx",
  Panzer: "https://www.vetanco.com.ar/images/productos/panzer.jpg",
  Provet: "https://www.provet.com.uy/images/logo.png",
  Richet: "https://www.richet.com.ar/images/logo.png",
  Rycoben: "https://ar.zoetis.com/products/bovinos/rycoben.aspx",
  Supasin: "https://www.vetoquinol.com.ar/images/supasin.png",
  Supracid: "https://www.vetanco.com.ar/images/productos/supracid.jpg",
  Tasignol: "https://www.zoetis.com/products-and-science/products/tasignol/",
  Taurador: "https://www.vetanco.com.ar/images/productos/taurador.jpg",
  Tecnopec: "https://www.tecnopec.com.ar/images/logo.png",
  "Terramicina LA": "https://ar.zoetis.com/_locale-assets/img/productos-web/terramicina-la.jpg",
  Tulamax: "https://www.zoetis.com/products-and-science/products/tulamax/",
  Valbazen: "https://ar.zoetis.com/products/bovinos/valbazen.aspx",
  Vallée: "https://www.vallee.com.br/images/logo.png",
  Verben: "https://www.vetanco.com.ar/images/productos/verben.jpg",
  Vermitan: "https://www.brouwervet.com.ar/images/productos/vermitan.jpg",
  Vetanco: "https://www.vetanco.com.ar/images/logo-vetanco.png",
  Vetoquinol: "https://www.vetoquinol.com.ar/images/logo-vetoquinol.png",
  Virbac: "https://www.virbac.com.ar/img/logo-virbac.png",
  Virbamec: "https://www.virbac.com.ar/img/products/virbamec.png",
  Zactran: "https://www.merck-animal-health.com.au/products/zactran/",
  Zoetis: "https://ar.zoetis.com/global-assets/img/logo.png",
  Zuprevo: "https://www.merck-animal-health.com.au/products/zuprevo/",
  "VAC-SULES": "https://www.laboratoriosmicrosules.com/producto/vac-sules-polivac/",
};

const PRODUCTOS = Object.keys(SOURCES);

function slug(nombre) {
  return nombre
    .toLocaleLowerCase("es-UY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function svgCard(nombre, subtitle) {
  const t = escapeXml(nombre);
  const sub = escapeXml(subtitle || "Producto veterinario");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="100%" stop-color="#e0f2fe"/>
    </linearGradient>
  </defs>
  <rect width="480" height="320" rx="16" fill="url(#bg)" stroke="#0d9488" stroke-width="2"/>
  <rect x="24" y="24" width="72" height="72" rx="14" fill="#ccfbf1" stroke="#14b8a6"/>
  <text x="60" y="72" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#0f766e">Rx</text>
  <text x="120" y="58" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#134e4a">${t}</text>
  <text x="120" y="86" font-family="Segoe UI, Arial, sans-serif" font-size="14" fill="#64748b">${sub}</text>
  <text x="24" y="140" font-family="Segoe UI, Arial, sans-serif" font-size="12" fill="#94a3b8">FICHA TÉCNICA · SANIDAD GANADERA</text>
  <rect x="24" y="156" width="432" height="1" fill="#cbd5e1"/>
  <text x="24" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#334155">Consulte laboratorio, principio activo,</text>
  <text x="24" y="212" font-family="Segoe UI, Arial, sans-serif" font-size="13" fill="#334155">dosis y tiempo de espera en el rótulo MGAP.</text>
  <text x="24" y="280" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#0d9488" font-weight="600">SCG · Control sanitario</text>
</svg>`;
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "SCG-ProductoFicha/1.0" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return null;
  if (ct.includes("text/html") && !url.match(/\.(svg|jpg|jpeg|png|webp)(\?|$)/i)) return null;
  return { buf, ct };
}

async function imageFromPage(pageUrl) {
  try {
    const html = await (await fetch(pageUrl, { headers: { "User-Agent": "SCG/1.0" } })).text();
    const rel = html.match(/\/_locale-assets\/img\/productos-web\/[^"']+\.(?:jpg|png|webp)/i);
    if (rel) return new URL(rel[0], pageUrl).href;
    const og = html.match(/property="og:image"\s+content="([^"]+)"/i);
    if (og?.[1] && !og[1].includes("avatar")) return og[1];
    const img = html.match(/src="([^"]+producto[^"]+\.(?:jpg|png|webp))"/i);
    return img?.[1] ?? null;
  } catch {
    return null;
  }
}

function extFromContentType(ct, url) {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("svg")) return "svg";
  if (url.match(/\.png(\?|$)/i)) return "png";
  if (url.match(/\.webp(\?|$)/i)) return "webp";
  if (url.match(/\.svg(\?|$)/i)) return "svg";
  return "jpg";
}

function preferRasterManifestPath(nombre, slug) {
  for (const ext of ["jpg", "jpeg", "png", "webp", "svg"]) {
    const file = path.join(OUT_DIR, `${slug}.${ext}`);
    if (fs.existsSync(file)) return `/productos-sanitarios/${slug}.${ext}`;
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {};

  for (const nombre of PRODUCTOS) {
    const s = slug(nombre);
    let saved = false;
    const source = SOURCES[nombre];

    let imgUrl = source;
    if (source.includes(".aspx") || source.includes("/productos/") && !source.match(/\.(jpg|png|webp|svg)(\?|$)/i)) {
      imgUrl = await imageFromPage(source);
    }

    if (imgUrl) {
      try {
        const data = await fetchBuffer(imgUrl);
        if (data) {
          const ext = extFromContentType(data.ct, imgUrl);
          const file = path.join(OUT_DIR, `${s}.${ext}`);
          fs.writeFileSync(file, data.buf);
          manifest[nombre] = `/productos-sanitarios/${s}.${ext}`;
          saved = true;
          process.stdout.write(`✓ ${nombre} (${ext})\n`);
        }
      } catch {
        /* fallback a SVG */
      }
    }

    if (!saved) {
      const file = path.join(OUT_DIR, `${s}.svg`);
      fs.writeFileSync(file, svgCard(nombre, "Salud animal · Cono Sur"));
      manifest[nombre] = `/productos-sanitarios/${s}.svg`;
      process.stdout.write(`· ${nombre} (svg)\n`);
    }
  }

  const manifestPath = path.join(ROOT, "server/src/stock-control-sanitario-producto-fichas-fotos.json");
  const clientManifestPath = path.join(ROOT, "client/src/producto-ficha-fotos.json");

  for (const nombre of Object.keys(manifest)) {
    const preferida = preferRasterManifestPath(nombre, slug(nombre));
    if (preferida) manifest[nombre] = preferida;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(clientManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${manifestPath}`);
  console.log(`Client manifest: ${clientManifestPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
