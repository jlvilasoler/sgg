/**
 * Safe SQLite → Postgres async migration for *-db.ts and database.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

const SKIP_ASYNC = new Set([
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
  "nombresRelacionados",
  "normalizeEmail",
  "newSessionToken",
  "sessionExpiryIso",
  "lockoutExpiryIso",
  "isAccountLocked",
  "dbLockedUntilMs",
  "primaryAdminCredentials",
  "assertPasswordPolicy",
  "clasificarVinculo",
  "cedulaNormSql",
  "normalizeInput",
  "validarGrupo",
  "normalizarGrupoAlmacenado",
  "grupoDesdeNacimiento",
  "aplicarEdadCalculada",
  "validarNacimiento",
  "validarFechaBaja",
  "normalizeNombreKey",
  "sameNombre",
  "gruposExplicitosParaRubro",
  "appendRegistroFilters",
  "extFromMime",
  "deleteIconFile",
  "rowToDto",
  "normalizeClaveDispositivo",
]);

function fixSqlLiterals(content) {
  return content.replace(/(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (str) => {
    let s = str;
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*\?\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER(?)");
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*@(\w+)\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER(@$2)");
    s = s.replace(/(\b[a-zA-Z_][\w.]*)\s*=\s*'([^']*)'\s*COLLATE\s+NOCASE/gi, "LOWER($1) = LOWER('$2')");
    s = s.replace(/ORDER BY\s+([\w.]+)\s+COLLATE\s+NOCASE(\s+ASC|\s+DESC)?/gi, (_, col, dir) =>
      `ORDER BY LOWER(${col})${dir ?? ""}`
    );
    s = s.replace(/,\s*([\w.]+)\s+COLLATE\s+NOCASE/gi, ", LOWER($1)");
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+PROVEEDORES\s*\([^)]+\)\s*VALUES\s*\([^)]+\)/gi,
      (m) => m.replace(/INSERT\s+OR\s+IGNORE/i, "INSERT") + " ON CONFLICT (cod) DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+RUBROS\s*\([^)]+\)\s*VALUES\s*\(@nombre,\s*1\)/gi,
      "INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1) ON CONFLICT DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+RESPONSABLES\s*\([^)]+\)\s*VALUES\s*\(@nombre,\s*1\)/gi,
      "INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1) ON CONFLICT DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+SUB_RUBROS\s*\([^)]+\)\s*VALUES\s*\(@nombre,\s*@grupo,\s*1\)/gi,
      "INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1) ON CONFLICT DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+RUBRO_SUB_RUBROS\s*\(rubro_id,\s*sub_rubro_id\)\s*VALUES\s*\(\?,\s*\?\)/gi,
      "INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?) ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+PRESUPUESTO_REGISTRO_SEQ\s*\(id,\s*ultimo\)\s*VALUES\s*\(1,\s*0\)/gi,
      "INSERT INTO PRESUPUESTO_REGISTRO_SEQ (id, ultimo) VALUES (1, 0) ON CONFLICT (id) DO NOTHING"
    );
    s = s.replace(
      /INSERT\s+OR\s+IGNORE\s+INTO\s+INGRESOS_VENTAS_SEQ\s*\(id,\s*ultimo\)\s*VALUES\s*\(1,\s*0\)/gi,
      "INSERT INTO INGRESOS_VENTAS_SEQ (id, ultimo) VALUES (1, 0) ON CONFLICT (id) DO NOTHING"
    );
    s = s.replace(
      /SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'GRUPO_ICONOS'/g,
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grupo_iconos'"
    );
    return s;
  });
}

function wrapReturnType(sig, ret) {
  const r = ret.trim();
  if (!r || r === "void") return ": Promise<void>";
  if (r.startsWith("Promise<")) return `: ${r}`;
  return `: Promise<${r}>`;
}

function migrateExports(content) {
  return content.replace(
    /export function (\w+)\(([\s\S]*?)\)(:\s*([^{;\n]+))?\s*\{/g,
    (full, name, params, retPart, ret) => {
      if (SKIP_ASYNC.has(name)) return full;
      if (full.includes("export async function")) return full;
      const rt = ret ? wrapReturnType(retPart, ret) : ": Promise<void>";
      return `export async function ${name}(${params})${rt} {`;
    }
  );
}

function addAwaitDbOps(content) {
  const lines = content.split("\n");
  return lines
    .map((line) => {
      if (/^\s*export (async )?function/.test(line)) return line;
      if (/^\s*(async )?function \w+/.test(line)) return line;
      if (line.includes("await ")) {
        // still may need await on other calls on same line
      }
      let l = line;
      if (/\.prepare\([^)]*\)\.(get|all|run)\(/.test(l) && !/await\s+.*\.prepare/.test(l)) {
        l = l.replace(
          /(\S+\.prepare\([^)]*\)\.(?:get|all|run))/,
          (m) => (m.startsWith("await ") ? m : `await ${m}`)
        );
      }
      if (/\bdb\.exec\(/.test(l) && !/await db\.exec/.test(l)) {
        l = l.replace(/\bdb\.exec\(/, "await db.exec(");
      }
      return l;
    })
    .join("\n");
}

function migrateTransactions(content) {
  let c = content;
  c = c.replace(
    /const tx = db\.transaction\(\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*return tx\([^)]*\);/g,
    "return await db.transaction(async (tx) => {$1});"
  );
  c = c.replace(
    /const tx = db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(\);/g,
    "await db.transaction(async (tx) => {$1});"
  );
  c = c.replace(
    /const tx = db\.transaction\(\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(([^)]*)\);/g,
    "await db.transaction(async (tx) => {$1});"
  );
  c = c.replace(
    /const renombrar = db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*return renombrar\(\);/g,
    "return await db.transaction(async (tx) => {$1});"
  );
  return c;
}

function noopPragmaMigrations(content) {
  const pragmaFns = [
    "migrateNroRegistro",
    "migrateResponsableGasto",
    "migrateSubRubro",
    "migrateFuncionarioCedula",
    "migrateObservaciones",
    "migrateFuncionarioContacto",
    "migrateTipoColumn",
    "migrateRacinesARaciones",
    "migrateUnificarGruposSubRubros",
    "migrateRenombrarGrupoAlambrados",
    "migrateAlambradosRubroContable",
    "migrateRetireRubroConstruccion",
    "migrateSyncGrupoDesdeNacimiento",
    "migrateStockGanaderoDispositivoHistorial",
    "migrateSplitEidVid",
    "migrateStockGanaderoDispositivoMeta",
    "ensureUserColumn",
  ];
  for (const fn of pragmaFns) {
    content = content.replace(
      new RegExp(`function ${fn}\\([^)]*\\):\\s*void\\s*\\{[\\s\\S]*?\\n\\}`, "m"),
      `async function ${fn}(_db: Db): Promise<void> {}`
    );
  }
  return content;
}

function migrateInitTables(content, fileName) {
  const seedOnly = {
    "proveedores-db.ts": { init: true, seed: "seedProveedoresIfEmpty" },
    "rubros-db.ts": { init: true, seed: null },
    "responsables-db.ts": { init: true, seed: null },
    "sub-rubros-db.ts": { init: true, seed: null },
    "venta-sub-rubros-db.ts": { init: true, seed: null },
  };
  // Replace init*Table bodies that only do CREATE with no-op
  content = content.replace(
    /export function init(\w+Table[s]?)\(db: Db\): void \{[\s\S]*?\n\}/g,
    (m, name) => {
      if (fileName === "grupo-iconos-db.ts" && name === "GrupoIconosTable") {
        return `export async function initGrupoIconosTable(db: Db): Promise<void> {
  fs.mkdirSync(GRUPO_ICONOS_DIR, { recursive: true });
}`;
      }
      if (fileName === "venta-grupo-iconos-db.ts" && name === "VentaGrupoIconosTable") {
        return `export async function initVentaGrupoIconosTable(db: Db): Promise<void> {
  fs.mkdirSync(VENTA_GRUPO_ICONOS_DIR, { recursive: true });
}`;
      }
      if (fileName === "auth-db.ts" && name === "AuthTables") {
        return `export async function initAuthTables(db: Db): Promise<void> {
  await seedRolePermissionsIfEmpty(db);
  await purgeExpiredSessions(db);
  await seedAdminIfEmpty(db);
  await migrateLegacyAdmin(db);
}`;
      }
      return `export async function init${name}(_db: Db): Promise<void> {}`;
    }
  );
  return content;
}

function migrateFile(filePath) {
  const fileName = path.basename(filePath);
  let c = fs.readFileSync(filePath, "utf8");

  c = c.replace(/import type Database from "better-sqlite3";\n?/g, "");
  c = c.replace(/import Database from "better-sqlite3";\n?/g, "");
  if (!c.includes('from "./db/pg-client.js"')) {
    if (fileName === "database.ts") {
      c =
        'import { PgDb } from "./db/pg-client.js";\nimport type { Db } from "./db/pg-client.js";\nimport { applySchema } from "./db/init-schema.js";\n' +
        c;
    } else {
      c = 'import type { Db } from "./db/pg-client.js";\n' + c;
    }
  }

  c = c.replace(/Database\.Database/g, "Db");
  c = fixSqlLiterals(c);
  c = noopPragmaMigrations(c);

  if (fileName !== "database.ts") {
    c = migrateInitTables(c, fileName);
    c = migrateExports(c);
    c = migrateTransactions(c);
    c = addAwaitDbOps(c);
    // internal async calls need await - second pass for known helpers
    c = c.replace(/(?<!await )(?<![.\w])getRubroByNombre\(/g, "await getRubroByNombre(");
    c = c.replace(/(?<!await )(?<![.\w])getSubRubroByNombre\(/g, "await getSubRubroByNombre(");
    c = c.replace(/(?<!await )(?<![.\w])getResponsableByNombre\(/g, "await getResponsableByNombre(");
    c = c.replace(/(?<!await )(?<![.\w])getFuncionarioByCedula\(/g, "await getFuncionarioByCedula(");
    c = c.replace(/(?<!await )(?<![.\w])getFuncionarioById\(/g, "await getFuncionarioById(");
    c = c.replace(/(?<!await )(?<![.\w])getRubroById\(/g, "await getRubroById(");
    c = c.replace(/(?<!await )(?<![.\w])getSubRubroById\(/g, "await getSubRubroById(");
    c = c.replace(/(?<!await )(?<![.\w])getItemById\(/g, "await getItemById(");
    c = c.replace(/(?<!await )(?<![.\w])getByGrupo\(/g, "await getByGrupo(");
    c = c.replace(/(?<!await )(?<![.\w])listFuncionarios\(/g, "await listFuncionarios(");
    c = c.replace(/(?<!await )(?<![.\w])listRubros\(/g, "await listRubros(");
    c = c.replace(/(?<!await )(?<![.\w])listSubRubros\(/g, "await listSubRubros(");
    c = c.replace(/(?<!await )(?<![.\w])listItemsBySubRubroId\(/g, "await listItemsBySubRubroId(");
    c = c.replace(/(?<!await )(?<![.\w])listVentaItemsBySubRubroId\(/g, "await listVentaItemsBySubRubroId(");
    c = c.replace(/(?<!await )(?<![.\w])getVentaSubRubroByNombre\(/g, "await getVentaSubRubroByNombre(");
    c = c.replace(/(?<!await )(?<![.\w])insertRubro\(/g, "await insertRubro(");
    c = c.replace(/(?<!await )(?<![.\w])updateRubro\(/g, "await updateRubro(");
    c = c.replace(/(?<!await )(?<![.\w])ensureRubrosNombres\(/g, "await ensureRubrosNombres(");
    c = c.replace(/(?<!await )(?<![.\w])deleteSubRubro\(/g, "await deleteSubRubro(");
    c = c.replace(/(?<!await )(?<![.\w])deleteGrupoIcono\(/g, "await deleteGrupoIcono(");
    c = c.replace(/(?<!await )(?<![.\w])deleteVentaGrupoIcono\(/g, "await deleteVentaGrupoIcono(");
    c = c.replace(/(?<!await )(?<![.\w])roleCapabilities\(/g, "await roleCapabilities(");
    c = c.replace(/(?<!await )(?<![.\w])toUserPublic\(/g, "await toUserPublic(");
    c = c.replace(/(?<!await )(?<![.\w])getUserById\(/g, "await getUserById(");
    c = c.replace(/(?<!await )(?<![.\w])listRolePermissions\(/g, "await listRolePermissions(");
    c = c.replace(/(?<!await )(?<![.\w])purgeExpiredSessions\(/g, "await purgeExpiredSessions(");
    c = c.replace(/(?<!await )(?<![.\w])deleteAllUserSessions\(/g, "await deleteAllUserSessions(");
    c = c.replace(/(?<!await )(?<![.\w])recordAuthEvent\(/g, "await recordAuthEvent(");
    c = c.replace(/(?<!await )(?<![.\w])upsertTipoCambio\(/g, "await upsertTipoCambio(");
    c = c.replace(/(?<!await )(?<![.\w])getSubRubroNombresForRubro\(/g, "await getSubRubroNombresForRubro(");
    c = c.replace(/(?<!await )(?<![.\w])listDistinctGrupos\(/g, "await listDistinctGrupos(");
    c = c.replace(/(?<!await )(?<![.\w])rubrosRelacionadosAlGrupo\(/g, "await rubrosRelacionadosAlGrupo(");
    c = c.replace(/(?<!await )(?<![.\w])gruposAsociadosAlRubro\(/g, "await gruposAsociadosAlRubro(");
    c = c.replace(/(?<!await )(?<![.\w])syncVinculoSubRubroPorGrupo\(/g, "await syncVinculoSubRubroPorGrupo(");
    c = c.replace(/(?<!await )(?<![.\w])mapMetaDispositivos\(/g, "await mapMetaDispositivos(");
    c = c.replace(/(?<!await )(?<![.\w])enrichDispositivosWithMeta\(/g, "await enrichDispositivosWithMeta(");
    c = c.replace(/(?<!await )(?<![.\w])clavesEidRepetidas\(/g, "await clavesEidRepetidas(");
    c = c.replace(/await await /g, "await ");
  } else {
    // database.ts special handling - write separately
    return false;
  }

  fs.writeFileSync(filePath, c);
  return true;
}

const files = [
  ...fs.readdirSync(srcDir).filter((f) => f.endsWith("-db.ts")),
];
for (const f of files) {
  if (migrateFile(path.join(srcDir, f))) console.log("OK", f);
}
console.log("Skip database.ts - handled separately");
