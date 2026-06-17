/**
 * Line-oriented async/await migration (safe for multiline signatures).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const SYNC_EXPORTS = new Set([
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
]);

const AWAIT_CALLS =
  /\b(getRubroByNombre|getSubRubroByNombre|getResponsableByNombre|getFuncionarioByCedula|getFuncionarioById|getRubroById|getSubRubroById|getItemById|getVentaItemById|getVentaSubRubroByNombre|getVentaSubRubroById|getByGrupo|listFuncionarios|listRubros|listSubRubros|listItemsBySubRubroId|listVentaItemsBySubRubroId|insertRubro|updateRubro|ensureRubrosNombres|deleteSubRubro|deleteGrupoIcono|deleteVentaGrupoIcono|roleCapabilities|toUserPublic|getUserById|listRolePermissions|purgeExpiredSessions|deleteAllUserSessions|recordAuthEvent|upsertTipoCambio|getSubRubroNombresForRubro|listDistinctGrupos|rubrosRelacionadosAlGrupo|gruposAsociadosAlRubro|syncVinculoSubRubroPorGrupo|mapMetaDispositivos|enrichDispositivosWithMeta|clavesEidRepetidas|listResponsables|listRubrosNombres|listSubRubrosNombres|listResponsablesNombres|syncResponsablesFromPresupuesto|seedRubrosIfEmpty|seedResponsablesIfEmpty|seedSubRubrosIfEmpty|seedVentaSubRubrosIfEmpty|seedRolePermissionsIfEmpty|seedAdminIfEmpty|migrateLegacyAdmin|migrateUnificarGruposIconos|migrateVinculosFueraDeOtros|resyncAllVinculosPorGrupo|ensureRubrosFromSubRubroGrupos|deleteVentaSubRubro|getPresupuestoById)\(/g;

function wrapReturn(ret) {
  const r = ret.trim();
  if (!r || r === "void") return "Promise<void>";
  if (r.startsWith("Promise<")) return r;
  return `Promise<${r}>`;
}

function migrateExports(content) {
  const lines = content.split("\n");
  let pendingFn = null;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const exp = line.match(/^export function (\w+)\(/);
    if (exp && !SYNC_EXPORTS.has(exp[1])) {
      line = line.replace(/^export function /, "export async function ");
      pendingFn = exp[1];
      out.push(line);
      continue;
    }

    if (pendingFn && /^\): (.+) \{$/.test(line.trim())) {
      const m = line.match(/^\s*\): (.+) \{$/);
      if (m) {
        const indent = line.match(/^\s*/)[0];
        line = `${indent}): ${wrapReturn(m[1])} {`;
      }
      pendingFn = null;
      out.push(line);
      continue;
    }

    if (pendingFn && line.trim() === "{") {
      pendingFn = null;
    }

    if (/^export async function/.test(line) && line.includes("{")) {
      pendingFn = null;
      const m = line.match(/^export async function \w+\([^)]*\): (?!Promise)(.+) \{$/);
      if (m) {
        line = line.replace(/: (.+) \{/, `: ${wrapReturn(m[1])} {`);
      }
    }

    out.push(line);
  }
  return out.join("\n");
}

function addAwaitOps(content) {
  let c = content;
  c = c.replace(/\bdb\.exec\(/g, (m, offset) =>
    c.slice(Math.max(0, offset - 7), offset).includes("await ") ? m : "await db.exec("
  );
  c = c.replace(
    /(?<!await )(\w+\.prepare\([\s\S]*?\)\.(?:get|all|run))\(/g,
    "await $1("
  );
  c = c.replace(/await await /g, "await ");
  c = c.replace(AWAIT_CALLS, (m) => (m.startsWith("await ") ? m : `await ${m}`));
  c = c.replace(/await await /g, "await ");
  return c;
}

function migrateTransactions(content) {
  return content
    .replace(
      /const tx = db\.transaction\(\([^)]*\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*return tx\([^)]*\);/g,
      "return await db.transaction(async (tx) => {$1});"
    )
    .replace(
      /const tx = db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(\);/g,
      "await db.transaction(async (tx) => {$1});"
    )
    .replace(
      /const tx = db\.transaction\(\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*tx\(([^)]*)\);/g,
      "await db.transaction(async (tx) => {$2});"
    )
    .replace(
      /const renombrar = db\.transaction\(\(\)\s*=>\s*\{([\s\S]*?)\}\);\s*\n\s*return renombrar\(\);/g,
      "return await db.transaction(async (tx) => {$1});"
    );
}

function noopInits(content, file) {
  if (file === "proveedores-db.ts") {
    content = content.replace(
      /export async function initProveedoresTable[\s\S]*?^}/m,
      "export async function initProveedoresTable(_db: Db): Promise<void> {}"
    );
  }
  if (file === "divisas-db.ts") {
    content = content.replace(
      /export async function initDivisasTable[\s\S]*?^}/m,
      "export async function initDivisasTable(_db: Db): Promise<void> {}"
    );
  }
  const noopInit = [
    "initRubrosTable",
    "initSubRubrosTable",
    "initSubRubroItemsTable",
    "initRubroSubRubrosTable",
    "initResponsablesTable",
    "initFuncionariosTable",
    "initVentasTable",
    "initVentaSubRubrosTable",
    "initVentaSubRubroItemsTable",
    "initStockGanaderoTables",
  ];
  for (const fn of noopInit) {
    const re = new RegExp(`export async function ${fn}\\([\\s\\S]*?^}`, "m");
    if (re.test(content)) {
      content = content.replace(re, `export async function ${fn}(_db: Db): Promise<void> {}`);
    }
  }
  if (file === "grupo-iconos-db.ts") {
    content = content.replace(
      /export async function initGrupoIconosTable[\s\S]*?^}/m,
      `export async function initGrupoIconosTable(db: Db): Promise<void> {
  fs.mkdirSync(GRUPO_ICONOS_DIR, { recursive: true });
}`
    );
  }
  if (file === "venta-grupo-iconos-db.ts") {
    content = content.replace(
      /export async function initVentaGrupoIconosTable[\s\S]*?^}/m,
      `export async function initVentaGrupoIconosTable(db: Db): Promise<void> {
  fs.mkdirSync(VENTA_GRUPO_ICONOS_DIR, { recursive: true });
}`
    );
  }
  if (file === "auth-db.ts") {
    content = content.replace(
      /export async function initAuthTables[\s\S]*?^}/m,
      `export async function initAuthTables(db: Db): Promise<void> {
  await seedRolePermissionsIfEmpty(db);
  await purgeExpiredSessions(db);
  await seedAdminIfEmpty(db);
  await migrateLegacyAdmin(db);
}`
    );
  }
  // PRAGMA migrations → no-op
  const pragmaFns = [
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
      new RegExp(`function ${fn}\\([\\s\\S]*?^}`, "m"),
      `async function ${fn}(_db: Db): Promise<void> {}`
    );
  }
  return content;
}

for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith("-db.ts"))) {
  const fp = path.join(srcDir, f);
  let c = fs.readFileSync(fp, "utf8");
  c = migrateExports(c);
  c = migrateTransactions(c);
  c = addAwaitOps(c);
  c = noopInits(c, f);
  fs.writeFileSync(fp, c);
  console.log("async:", f);
}
