import fs from "fs";

const idxPath = "server/src/index.ts";
let idx = fs.readFileSync(idxPath, "utf8");

// Remove broken previously inserted ovino block (from first stock-ovino to end of file before we re-add)
const firstOvino = idx.indexOf('app.get("/api/stock-ovino/ultima-importacion-archivo"');
if (firstOvino >= 0) {
  // Find a clean cut: from firstOvino back to include any stray lines, forward until we hit a non-ovino app. that isn't leftover junk
  // Prefer: delete from firstOvino to EOF markers of last ovino route by scanning
  let end = idx.length;
  const re = /\napp\.(get|post|patch|delete|put)\("/g;
  re.lastIndex = firstOvino;
  let m;
  let lastOvinoEnd = firstOvino;
  while ((m = re.exec(idx))) {
    const lineStart = m.index + 1;
    const snip = idx.slice(lineStart, lineStart + 60);
    if (snip.includes("/api/stock-ovino")) {
      // find end of this handler: next \napp. or end
      const next = idx.indexOf("\napp.", lineStart + 1);
      lastOvinoEnd = next > 0 ? next : idx.length;
      continue;
    }
    // also skip bare method words leftover like "\nget\n"
    break;
  }
  // Also remove trailing leftover method-only lines after lastOvinoEnd
  let cut = lastOvinoEnd;
  while (true) {
    const rest = idx.slice(cut);
    const mm = rest.match(/^\s*\n(get|post|patch|delete|put)\s*\n/);
    if (mm) {
      cut += mm[0].length;
      continue;
    }
    break;
  }
  idx = idx.slice(0, firstOvino) + idx.slice(cut);
}

const routeStart = idx.indexOf('app.get("/api/stock-equino/ultima-importacion-archivo"');
const re = /\napp\.(get|post|patch|delete|put)\("/g;
re.lastIndex = routeStart + 10;
let routeEnd = -1;
let m;
while ((m = re.exec(idx))) {
  const lineStart = m.index + 1;
  const snip = idx.slice(lineStart, lineStart + 80);
  if (snip.includes("/api/stock-equino")) continue;
  routeEnd = lineStart;
  break;
}
if (routeStart < 0 || routeEnd < 0) throw new Error("equino route markers missing");

let routes = idx.slice(routeStart, routeEnd);

// Split into route handlers without eating method names
const parts = routes.split(/\n(?=app\.(?:get|post|patch|delete|put)\()/);
routes = parts
  .filter((chunk) => {
    if (chunk.includes("/pelajes")) return false;
    if (chunk.includes("/aru/")) return false;
    return true;
  })
  .join("\n");

routes = routes
  .split("/api/stock-equino")
  .join("/api/stock-ovino")
  .split("stockEquino")
  .join("stockOvino")
  .split("StockEquino")
  .join("StockOvino")
  .split("StockEquina")
  .join("StockOvina")
  .split('"equino"')
  .join('"ovino"')
  .split("'equino'")
  .join("'ovino'");

// Insert helpers after stockEquinoQueryBase if missing
if (!idx.includes("async function stockOvinoFiltersFromRequest")) {
  const helperSrcStart = idx.indexOf("async function stockEquinoFiltersFromRequest");
  const helperSrcEnd = idx.indexOf("\nasync function ", helperSrcStart + 1);
  // find stockEquinoQueryBase function end - include both functions
  const qStart = idx.indexOf("function stockEquinoQueryBase");
  // next function after query base
  const afterQ = idx.indexOf("\nasync function ", qStart);
  const afterQ2 = idx.indexOf("\nfunction ", qStart + 1);
  let qEnd = afterQ;
  if (afterQ2 > qStart && (qEnd < 0 || afterQ2 < qEnd)) qEnd = afterQ2;
  if (helperSrcStart < 0 || qEnd < 0) throw new Error("helpers missing");

  let helpers = idx.slice(helperSrcStart, qEnd);
  helpers = helpers
    .split("stockEquino")
    .join("stockOvino")
    .split("StockEquino")
    .join("StockOvino")
    .split("StockEquina")
    .join("StockOvina")
    .split("equino")
    .join("ovino");

  idx = idx.slice(0, qEnd) + "\n" + helpers + "\n" + idx.slice(qEnd);
}

// Recompute routeEnd after helper insert may have shifted — re-find equino block end
const rs2 = idx.indexOf('app.get("/api/stock-equino/ultima-importacion-archivo"');
re.lastIndex = rs2 + 10;
routeEnd = -1;
while ((m = re.exec(idx))) {
  const lineStart = m.index + 1;
  const snip = idx.slice(lineStart, lineStart + 80);
  if (snip.includes("/api/stock-equino")) continue;
  routeEnd = lineStart;
  break;
}

idx = idx.slice(0, routeEnd) + "\n" + routes + "\n" + idx.slice(routeEnd);

// Ensure StockOvinoFilters type import if StockEquinoFilters imported
if (idx.includes("StockEquinoFilters") && !idx.includes("StockOvinoFilters")) {
  idx = idx.replace(
    /import type \{([^}]*)StockEquinoFilters([^}]*)\} from "\.\/stock-equino-db\.js"/,
    (full, a, b) =>
      `import type {${a}StockEquinoFilters${b}} from "./stock-equino-db.js";\nimport type { StockOvinoFilters } from "./stock-ovino-db.js"`
  );
}

fs.writeFileSync(idxPath, idx);
console.log("routes regenerated cleanly");
