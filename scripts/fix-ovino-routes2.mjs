import fs from "fs";

const path = "server/src/index.ts";
let s = fs.readFileSync(path, "utf8");

const a = s.indexOf('app.get("/api/stock-ovino/ultima');
if (a >= 0) {
  const re = /\napp\.(get|post|patch|delete|put)\("/g;
  re.lastIndex = a;
  let b = s.length;
  let m;
  while ((m = re.exec(s))) {
    const snip = s.slice(m.index + 1, m.index + 50);
    if (!snip.includes("/api/stock-ovino")) {
      b = m.index + 1;
      break;
    }
  }
  let block = s.slice(a, b);
  block = block.replace(/\n(get|post|patch|delete|put)\n(?=app\.)/g, "\n");
  // Fix assertLote in ovino block
  block = block.split("assertLoteEquinoEnCuentaUsuario").join("assertLoteOvinoEnCuentaUsuario");
  s = s.slice(0, a) + block + s.slice(b);
}

if (!s.includes("async function stockOvinoFiltersFromRequest")) {
  const marker = "function stockEquinoQueryBase(req: Request): StockEquinoFilters {\n  return stockGanaderoQueryBase(req) as StockEquinoFilters;\n}";
  const idx = s.indexOf(marker);
  if (idx < 0) throw new Error("stockEquinoQueryBase marker not found");
  const end = idx + marker.length;
  const helpers = `

async function stockOvinoFiltersFromRequest(
  req: Request,
  base: StockOvinoFilters = {}
): Promise<StockOvinoFilters> {
  const user = req.user;
  if (!user) return base;
  let filters: StockOvinoFilters = { ...base };
  const empresas = await empresasCuenta.getEmpresasCodigosScopeFilter(db.getDb(), user);
  if (empresas) filters = { ...filters, empresas };
  const lecturasScope = await stockLecturasFiltersFromRequest(req, {});
  if (lecturasScope.cuenta_id != null) {
    filters = { ...filters, cuenta_id: lecturasScope.cuenta_id };
  }
  return filters;
}

async function assertLoteOvinoEnCuentaUsuario(req: Request, loteId: number): Promise<void> {
  const lote = await db.stockOvino.getLote(loteId);
  if (!lote) throw new Error("Lote no encontrado");
  const user = req.user!;
  if (user.es_super_admin) return;
  const cuentaId = await cuentaIdForUser(user);
  const loteCuenta = lote.cuenta_id ?? null;
  if (!cuentaId || loteCuenta !== cuentaId) {
    throw new Error("Sin permiso sobre esta importación");
  }
}

function stockOvinoQueryBase(req: Request): StockOvinoFilters {
  return stockGanaderoQueryBase(req) as StockOvinoFilters;
}
`;
  s = s.slice(0, end) + helpers + s.slice(end);
}

if (!s.includes('StockOvinoFilters } from "./stock-ovino-db.js"')) {
  s = s.replace(
    'import type { StockEquinoFilters } from "./stock-equino-db.js";',
    'import type { StockEquinoFilters } from "./stock-equino-db.js";\nimport type { StockOvinoFilters } from "./stock-ovino-db.js";'
  );
}

fs.writeFileSync(path, s);
console.log("fixed ovino routes + helpers");
console.log("ovino route count", (s.match(/\/api\/stock-ovino/g) || []).length);
console.log("stray method lines", (s.match(/\n(get|post)\napp\./g) || []).length);
