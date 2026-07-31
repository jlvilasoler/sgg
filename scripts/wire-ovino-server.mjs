import fs from "fs";

const dbPath = "server/src/database.ts";
let db = fs.readFileSync(dbPath, "utf8");

if (!db.includes("stock-ovino-db")) {
  db = db.replace(
    'import * as stockEquinoDb from "./stock-equino-db.js";',
    'import * as stockEquinoDb from "./stock-equino-db.js";\nimport * as stockOvinoDb from "./stock-ovino-db.js";'
  );
  db = db.replace(
    'import * as stockEquinoSalidas from "./stock-equina-salidas.js";',
    'import * as stockEquinoSalidas from "./stock-equina-salidas.js";\nimport * as stockOvinoSalidas from "./stock-ovina-salidas.js";'
  );
}

db = db.replaceAll(
  "stockEquinoDb.initStockEquinoTables(db),",
  "stockEquinoDb.initStockEquinoTables(db),\n    stockOvinoDb.initStockOvinoTables(db),"
);

if (!db.includes("export const stockOvino = {")) {
  const start = db.indexOf("export const stockEquino = {");
  const end = db.indexOf("export const stockAuditoria");
  if (start < 0 || end < 0) throw new Error("markers not found");
  let block = db.slice(start, end);
  block = block
    .split("stockEquinoDb")
    .join("stockOvinoDb")
    .split("stockEquinoSalidas")
    .join("stockOvinoSalidas")
    .split("stockEquino")
    .join("stockOvino")
    .split("StockEquino")
    .join("StockOvino")
    .split("StockEquina")
    .join("StockOvina")
    .split("Equino")
    .join("Ovino")
    .split("Equina")
    .join("Ovina");
  block = block
    .split("\n")
    .filter((l) => !/Pelaje|pelaje/.test(l))
    .join("\n");
  db = db.slice(0, end) + block + "\n" + db.slice(end);
}

fs.writeFileSync(dbPath, db);
console.log("database.ts OK");

// Generate ovino routes from equino block in index.ts
const idxPath = "server/src/index.ts";
let idx = fs.readFileSync(idxPath, "utf8");

const routeStart = idx.indexOf('app.get("/api/stock-equino/ultima-importacion-archivo"');
// End before next major non-equino section after ARU — find last stock-equino route
const after = idx.indexOf("\napp.", idx.lastIndexOf("/api/stock-equino/"));
// Better: find start of next app.get that is NOT stock-equino after ARU block
let searchFrom = routeStart;
let routeEnd = -1;
const re = /\napp\.(get|post|patch|delete|put)\("/g;
re.lastIndex = routeStart;
let m;
while ((m = re.exec(idx))) {
  const lineStart = m.index + 1;
  const snippet = idx.slice(lineStart, lineStart + 80);
  if (snippet.includes("/api/stock-equino")) continue;
  // first non-equino after we started
  if (lineStart > routeStart) {
    routeEnd = lineStart;
    break;
  }
}
if (routeStart < 0 || routeEnd < 0) throw new Error("route markers not found");

let routes = idx.slice(routeStart, routeEnd);
// Drop pelajes and ARU routes
routes = routes
  .split(/\n(?=app\.(get|post|patch|delete|put)\()/g)
  .filter((chunk) => {
    if (!chunk.startsWith("app.")) return true;
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
  .split("equino")
  .join("ovino")
  .split("Equino")
  .join("Ovino")
  .split("Equina")
  .join("Ovina")
  .split('"equino"')
  .join('"ovino"')
  .split("'equino'")
  .join("'ovino'");

if (!idx.includes('/api/stock-ovino/ultima-importacion-archivo')) {
  idx = idx.slice(0, routeEnd) + "\n" + routes + "\n" + idx.slice(routeEnd);
  fs.writeFileSync(idxPath, idx);
  console.log("index.ts routes OK");
} else {
  console.log("index.ts routes already present");
}
