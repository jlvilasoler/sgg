/**
 * Genera Stock Ovino a partir de Stock Equino (servidor + cliente).
 * Uso: node scripts/gen-ovino-from-equino.mjs
 */
import fs from "fs";
import path from "path";

const root = process.cwd();

function adapt(content) {
  const map = [
    // Orden: strings más largos / específicos primero
    ["stock-equina-categoria", "stock-ovina-categoria"],
    ["stock-equino-db", "stock-ovino-db"],
    ["stock-equina-salidas", "stock-ovina-salidas"],
    ["stock-equino-hub-search", "stock-ovino-hub-search"],
    ["stock-equino-sanidad-dispositivo-utils", "stock-ovino-sanidad-dispositivo-utils"],
    ["stock-equina-page-cache", "stock-ovina-page-cache"],
    ["stock-equina-utils", "stock-ovina-utils"],
    ["STOCK_EQUINO", "STOCK_OVINO"],
    ["EQUINO_ID_PREFIJO", "OVINO_ID_PREFIJO"],
    ["EQUINO_ID_PRIMERO", "OVINO_ID_PRIMERO"],
    ["EQUINO_ID_SEED_ULTIMO", "OVINO_ID_SEED_ULTIMO"],
    ["EQUINO_FRONTERA_JOVEN", "OVINO_FRONTERA_JOVEN"],
    ["EQUINO_FRONTERA_ADULTO", "OVINO_FRONTERA_ADULTO"],
    ["CategoriaEquino", "CategoriaOvino"],
    ["CATEGORIAS_EQUINO", "CATEGORIAS_OVINO"],
    ["CATEGORIA_EQUINO", "CATEGORIA_OVINO"],
    ["esCategoriaEquino", "esCategoriaOvino"],
    ["formatEquinoIdDisplay", "formatOvinoIdDisplay"],
    ["splitEquinoIdInterno", "splitOvinoIdInterno"],
    ["AltaEquino", "AltaOvino"],
    ["crearEquinos", "crearOvinos"],
    ["crearEquino", "crearOvino"],
    ["StockEquina", "StockOvina"],
    ["StockEquino", "StockOvino"],
    ["stockEquina", "stockOvina"],
    ["stockEquino", "stockOvino"],
    ["stock-equina", "stock-ovina"],
    ["stock-equino", "stock-ovino"],
    ["Stock Equino", "Stock Ovino"],
    ["stock equino", "stock ovino"],
    ["Equinos", "Ovinos"],
    ["equinos", "ovinos"],
    ["Equino", "Ovino"],
    ["Equina", "Ovina"],
    ["equino", "ovino"],
    ["equina", "ovina"],
    // Categorías equinas residuales → ovinas (por si quedaron strings literales)
    ["POTRANCA", "CORDERA"],
    ["POTRA", "BORREGA"],
    ["YEGUA", "OVEJA"],
    ["POTRILLO", "CORDERO"],
    ["POTRO", "BORREGO"],
    ['"CABALLO"', '"CAPON"'],
    ["PADRILLO", "CARNERO"],
    ["Potranca", "Cordera"],
    ["Potra", "Borrega"],
    ["Yegua", "Oveja"],
    ["Potrillo", "Cordero"],
    ["Potro", "Borrego"],
    ["Caballo (castrado)", "Capón (castrado)"],
    ["Caballo", "Capón"],
    ["Padrillo", "Carnero"],
    ['"600"', '"199"'],
    ["6000000000000000010", "1990000000000000010"],
    ["6000000000000000009", "1990000000000000009"],
  ];
  let out = content;
  for (const [from, to] of map) {
    out = out.split(from).join(to);
  }
  return out;
}

function copyFile(srcRel, destRel) {
  const src = path.join(root, srcRel);
  const dest = path.join(root, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = fs.readFileSync(src, "utf8");
  fs.writeFileSync(dest, adapt(raw));
  console.log("wrote", destRel);
}

// Server DB + salidas (categoria se escribe a mano)
copyFile("server/src/stock-equino-db.ts", "server/src/stock-ovino-db.ts");
copyFile("server/src/stock-equina-salidas.ts", "server/src/stock-ovina-salidas.ts");

// Client: copiar carpeta excepto ARU / pelaje / iconos caballo-yegua específicos
const skip = new Set([
  "StockEquinoAruArbolModal.tsx",
  "StockEquinoAruPedigreeLookup.tsx",
  "SelectPelajeEquinoDispositivo.tsx",
  "PedigreeTreeIcon.tsx",
  "IconoCaballoEvolucion.tsx",
  "IconoYeguaEvolucion.tsx",
]);

const equinoDir = path.join(root, "client/src/components/stock-equino");
const ovinoDir = path.join(root, "client/src/components/stock-ovino");
fs.mkdirSync(ovinoDir, { recursive: true });

for (const name of fs.readdirSync(equinoDir)) {
  if (skip.has(name)) {
    console.log("skip", name);
    continue;
  }
  const src = path.join(equinoDir, name);
  if (!fs.statSync(src).isFile()) continue;
  let destName = adapt(name);
  // Fix double-adapt edge cases on filenames already partially mapped
  destName = destName
    .replace(/StockOvina/, "StockOvina")
    .replace(/stock-ovina/, "stock-ovina");
  const dest = path.join(ovinoDir, destName);
  let content = adapt(fs.readFileSync(src, "utf8"));
  // Quitar imports ARU / pelaje residuales
  content = content
    .split("\n")
    .filter((line) => {
      if (/Aru|aru-pedigree|Pelaje|pelaje|PedigreeTree|IconoCaballo|IconoYegua/.test(line) && /import /.test(line)) {
        return false;
      }
      return true;
    })
    .join("\n");
  fs.writeFileSync(dest, content);
  console.log("wrote", path.relative(root, dest));
}

console.log("done");
