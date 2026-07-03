/**
 * Descarga escudos departamentales (PNG 128px) desde Wikimedia Commons.
 * Fuentes oficiales documentadas en cada archivo de Commons / símbolos departamentales.
 * Ejecutar: node scripts/fetch-escudos-departamentos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "client", "public", "escudos-departamentos");

/** id local → nombres de archivo en Commons (primer match gana) */
const FILES = {
  artigas: ["Coat of arms of Artigas Department.png"],
  rivera: ["Coat of arms of Rivera Department.png"],
  rionegro: ["Coat of arms of Rio Negro Department.png", "Coat of arms of Río Negro Department.png"],
  florida: ["Coat of arms of Florida Department.png"],
  flores: ["Coat of arms of Flores Department.png"],
  colonia: ["Coat of arms of Colonia Department.png"],
  soriano: ["Coat of arms of Soriano Department.png"],
  sanjose: ["Coat of arms of San Jose Department.png", "Coat of arms of San José Department.png"],
  montevideo: ["Coat of arms of Montevideo Department.png", "Montevideo Department Coat of Arms.svg"],
  canelones: ["Coat of arms of Canelones Department.svg", "Coat of arms of Canelones Department.png"],
  maldonado: ["Coat of arms of Maldonado Department.png"],
  rocha: ["Coat of arms of Rocha Department.png"],
  lavalleja: ["Coat of arms of Lavalleja Department.png"],
  durazno: ["Coat of arms of Durazno Department.png"],
  cerrolargo: ["Coat of arms of Cerro Largo Department.png"],
  tacuarembo: ["Coat of arms of Tacuarembo Department.png", "Coat of arms of Tacuarembó Department.png"],
  paysandu: ["Coat of arms of Paysandu Department.png", "Coat of arms of Paysandú Department.png"],
  salto: ["Coat of arms of Salto Department.png"],
  treintaytres: ["Coat of arms of Treinta y Tres Department.png"],
};

const UA = "SCG-VencimientosImpuestos/1.0 (educational; local dev)";

fs.mkdirSync(outDir, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      const wait = 4000 * (i + 1);
      console.warn(`  rate limit, esperando ${wait}ms…`);
      await sleep(wait);
      continue;
    }
    return res;
  }
  throw new Error(`HTTP 429 tras reintentos — ${url}`);
}

function commonsThumbUrl(commonsName) {
  const encoded = encodeURIComponent(commonsName.replace(/ /g, "_"));
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=128`;
}

async function download(id, commonsNames) {
  const dest = path.join(outDir, `${id}.png`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
    console.log(`SKIP ${id} (ya existe)`);
    return;
  }

  let lastErr;
  for (const name of commonsNames) {
    try {
      await sleep(3500);
      const url = commonsThumbUrl(name);
      const res = await fetchWithRetry(url);
      if (!res.ok) {
        lastErr = new Error(`${id}: HTTP ${res.status} — ${name}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) {
        lastErr = new Error(`${id}: archivo demasiado pequeño — ${name}`);
        continue;
      }
      fs.writeFileSync(dest, buf);
      console.log(`OK ${id} ← ${name} (${buf.length} bytes)`);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error(`${id}: sin fuente`);
}

for (const [id, names] of Object.entries(FILES)) {
  try {
    await download(id, names);
  } catch (e) {
    console.error(String(e));
    process.exitCode = 1;
  }
}
