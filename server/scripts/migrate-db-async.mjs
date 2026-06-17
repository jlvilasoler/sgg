/**
 * One-shot mechanical migration: better-sqlite3 → pg async layer.
 * Run from server/: node scripts/migrate-db-async.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

const files = [
  ...fs.readdirSync(srcDir).filter((f) => f.endsWith("-db.ts")),
  "database.ts",
].map((f) => path.join(srcDir, f));

function fixCollate(sql) {
  let s = sql;
  // column = ? COLLATE NOCASE → LOWER(column) = LOWER(?)
  s = s.replace(
    /(\b[a-zA-Z_][\w.]*)\s*=\s*\?\s*COLLATE\s+NOCASE/gi,
    "LOWER($1) = LOWER(?)"
  );
  s = s.replace(
    /(\b[a-zA-Z_][\w.]*)\s*=\s*@(\w+)\s*COLLATE\s+NOCASE/gi,
    "LOWER($1) = LOWER(@$2)"
  );
  // ORDER BY col COLLATE NOCASE → ORDER BY LOWER(col)
  s = s.replace(
    /ORDER BY\s+([\w.]+)\s+COLLATE\s+NOCASE(\s+ASC|\s+DESC)?/gi,
    (_, col, dir) => `ORDER BY LOWER(${col})${dir ?? ""}`
  );
  s = s.replace(
    /,\s*([\w.]+)\s+COLLATE\s+NOCASE/gi,
    ", LOWER($1)"
  );
  // WHERE rubro = 'x' COLLATE NOCASE
  s = s.replace(
    /(\b[a-zA-Z_][\w.]*)\s*=\s*'([^']*)'\s*COLLATE\s+NOCASE/gi,
    "LOWER($1) = LOWER('$2')"
  );
  return s;
}

function fixInsertOrIgnore(sql) {
  if (!/INSERT\s+OR\s+IGNORE/i.test(sql)) return sql;
  let s = sql;
  if (/PROVEEDORES/i.test(s)) {
    return s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+PROVEEDORES\s*\([^)]+\)\s*VALUES\s*\([^)]+\)/i,
      (m) => m.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT") + " ON CONFLICT (cod) DO NOTHING"
    );
  }
  if (/RUBROS/i.test(s) && /nombre/i.test(s)) {
    return s.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT").replace(
      /VALUES\s*\(@nombre,\s*1\)/i,
      "VALUES (@nombre, 1) ON CONFLICT DO NOTHING"
    );
  }
  if (/RESPONSABLES/i.test(s)) {
    return s.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT").replace(
      /VALUES\s*\(@nombre,\s*1\)/i,
      "VALUES (@nombre, 1) ON CONFLICT DO NOTHING"
    );
  }
  if (/SUB_RUBROS/i.test(s) && !/RUBRO_SUB_RUBROS/i.test(s)) {
    return s.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT").replace(
      /VALUES\s*\(@nombre,\s*@grupo,\s*1\)/i,
      "VALUES (@nombre, @grupo, 1) ON CONFLICT DO NOTHING"
    );
  }
  if (/RUBRO_SUB_RUBROS/i.test(s)) {
    return s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+RUBRO_SUB_RUBROS\s*\([^)]+\)\s*VALUES\s*\(\?,\s*\?\)/i,
      "INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?) ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING"
    );
  }
  if (/PRESUPUESTO_REGISTRO_SEQ/i.test(s)) {
    return s.replace(
      /INSERT\s+OR\s+IGNORE/i,
      "INSERT"
    ).replace(
      /VALUES\s*\(1,\s*0\)/i,
      "VALUES (1, 0) ON CONFLICT (id) DO NOTHING"
    );
  }
  if (/INGRESOS_VENTAS_SEQ/i.test(s)) {
    return s.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT").replace(
      /VALUES\s*\(1,\s*0\)/i,
      "VALUES (1, 0) ON CONFLICT (id) DO NOTHING"
    );
  }
  return s.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT");
}

function addAwaitToDbOps(content) {
  let c = content;
  // db.exec(
  c = c.replace(/(?<!await )db\.exec\(/g, "await db.exec(");
  // .run( .get( .all( after prepare chains
  c = c.replace(
    /(?<!await )((?:db|ins|upd|del|insert|exists|stmt|upsert|delLink|insLink|update|row|result)\.prepare\([^)]+\)\.(?:run|get|all))\(/g,
    "await $1("
  );
  // standalone prepare().run patterns on new lines
  c = c.replace(
    /(\n\s+)(db\.prepare\([\s\S]*?\)\.(?:run|get|all))\(/g,
    (match, indent, chain) => {
      if (match.includes("await ")) return match;
      return `${indent}await ${chain}(`;
    }
  );
  return c;
}

function makeExportedFunctionsAsync(content) {
  const skip = new Set([
    "calcularTotalUsdVenta",
    "formatNumeroOperacionVenta",
    "formatNumeroOperacion",
    "normalizeCedula",
    "formatCedulaDisplay",
    "nombreFuncionarioDisplay",
    "esRubroRemuneracion",
    "publicIconUrl",
    "publicVentaIconUrl",
    "listBancoIconos",
    "listVentaBancoIconos",
    "permissionsForRol",
    "canWrite",
    "calcularEdadMeses",
    "dispositivoClave",
    "nombresRelacionados",
    "PAR_LABELS",
    "PARES_DIVISA",
    "MODULOS",
    "ROL_LABELS",
    "MODULO_LABELS",
    "ROL_DESCRIPCION",
    "GRUPO_ICONOS_DIR",
    "VENTA_GRUPO_ICONOS_DIR",
  ]);
  return content.replace(
    /export function (\w+)\(/g,
    (m, name) => {
      if (skip.has(name)) return m;
      if (m.startsWith("export async function")) return m;
      return `export async function ${name}(`;
    }
  );
}

function wrapReturnTypes(content) {
  // Simple heuristic: add Promise<> to exported async function return types that aren't void and aren't already Promise
  return content.replace(
    /export async function (\w+)\([^)]*\):\s*([^{;\n]+)\{/g,
    (m, name, ret) => {
      const r = ret.trim();
      if (r === "void" || r.startsWith("Promise<")) return m;
      return m.replace(`: ${ret}`, `: Promise<${r}>`);
    }
  );
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("better-sqlite3") && !filePath.endsWith("database.ts")) {
    return false;
  }

  content = content.replace(
    /import type Database from "better-sqlite3";?\n/g,
    'import type { Db } from "./db/pg-client.js";\n'
  );
  content = content.replace(/Database\.Database/g, "Db");

  // sqlite_master → information_schema
  content = content.replace(
    /SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'GRUPO_ICONOS'/g,
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_iconos'"
  );

  // Fix SQL strings in template literals and regular strings
  content = content.replace(/(`(?:[^`\\]|\\.)*`|"[^"]*"|'[^']*')/g, (str) => {
    if (!/COLLATE|INSERT OR IGNORE|PRAGMA/i.test(str)) return str;
    let s = str;
    s = fixCollate(s);
    s = fixInsertOrIgnore(s);
    return s;
  });

  // PRAGMA migration functions → no-op
  content = content.replace(
    /function (migrate\w+|ensureUserColumn)\([^)]*\):\s*void\s*\{[\s\S]*?\n\}/g,
    "async function $1(_db: Db): Promise<void> {}"
  );

  // init table functions with db.exec CREATE → no-op or keep seed
  // Handled per-file manually for seed logic

  content = makeExportedFunctionsAsync(content);
  content = addAwaitToDbOps(content);

  // transaction pattern: const tx = db.transaction((args) => { ... }); tx(data);
  content = content.replace(
    /const tx = db\.transaction\(\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*return tx\(([^)]*)\);/g,
    "return await db.transaction(async (db) => {$2});"
  );
  content = content.replace(
    /const tx = db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(\);/g,
    "await db.transaction(async (db) => {$1});"
  );
  content = content.replace(
    /const tx = db\.transaction\(\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(([^)]*)\);/g,
    "await db.transaction(async (db) => {$2});"
  );

  content = wrapReturnTypes(content);

  fs.writeFileSync(filePath, content);
  return true;
}

let n = 0;
for (const f of files) {
  if (migrateFile(f)) {
    console.log("Migrated:", path.basename(f));
    n++;
  }
}
console.log(`Done: ${n} files`);
