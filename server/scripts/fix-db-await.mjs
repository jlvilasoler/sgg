/**
 * Fix await/import/return types after partial migration.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith("-db.ts") || f === "database.ts");

for (const name of files) {
  const fp = path.join(srcDir, name);
  let c = fs.readFileSync(fp, "utf8");
  let changed = false;

  if (c.includes("better-sqlite3")) {
    c = c.replace(/import Database from "better-sqlite3";\n?/g, "");
    c = c.replace(/import type Database from "better-sqlite3";\n?/g, "");
    if (!c.includes('from "./db/pg-client.js"') && !c.includes('from "./db/pg-client.js"')) {
      c = 'import type { Db } from "./db/pg-client.js";\n' + c;
    }
    changed = true;
  }

  if (!c.includes('import type { Db }') && c.includes(": Db")) {
    c = 'import type { Db } from "./db/pg-client.js";\n' + c;
    changed = true;
  }

  // Fix broken Promise<Array<> from bad regex
  c = c.replace(/Promise<Array<>\{/g, "Promise<Array<{");
  c = c.replace(/Promise<Array<>\(/g, "Promise<Array<(");

  // async function with : void return → Promise<void>
  c = c.replace(
    /(export async function \w+\([^)]*\)):\s*void\b/g,
    "$1: Promise<void>"
  );

  // Add await before prepare().get/all/run if missing
  c = c.replace(
    /(?<!await )((?:await )?(?:db|tx|insert|exists|ins|upd|del|stmt|upsert|delLink|insLink|row|result|update)\.prepare\([^;]+?\)\.(?:get|all|run))\(/g,
    (m, chain) => (chain.startsWith("await ") ? m : `await ${chain}(`)
  );

  // Fix double await
  c = c.replace(/await await /g, "await ");

  // await listX/db calls in async functions - common patterns
  const asyncCalls = [
    "listFuncionarios(",
    "getFuncionarioByCedula(",
    "getFuncionarioById(",
    "getRubroByNombre(",
    "getRubroById(",
    "insertRubro(",
    "updateRubro(",
    "listRubros(",
    "getSubRubroByNombre(",
    "getSubRubroById(",
    "getResponsableByNombre(",
    "getResponsableById(",
    "listItemsBySubRubroId(",
    "listVentaItemsBySubRubroId(",
    "getVentaSubRubroByNombre(",
    "getItemById(",
    "getVentaItemById(",
    "ensureRubrosNombres(",
    "syncResponsablesFromPresupuesto(",
    "roleCapabilities(",
    "toUserPublic(",
    "getUserById(",
    "listRolePermissions(",
    "purgeExpiredSessions(",
    "deleteAllUserSessions(",
    "recordAuthEvent(",
    "getByGrupo(",
    "getGrupoIconosMap(",
    "deleteGrupoIcono(",
    "allocNroRegistro(",
    "peekNextNroRegistro(",
    "insertPresupuesto(",
    "getCatalogos(",
    "listSubRubros(",
    "listResponsables(",
    "listRubrosNombres(",
    "listSubRubrosNombres(",
    "listResponsablesNombres(",
    "listFuncionariosParaSelector(",
    "getSubRubroNombresForRubro(",
    "rubrosRelacionadosAlGrupo(",
    "gruposAsociadosAlRubro(",
    "listDistinctGrupos(",
    "syncVinculoSubRubroPorGrupo(",
    "deleteSubRubro(",
    "mapMetaDispositivos(",
    "enrichDispositivosWithMeta(",
    "clavesEidRepetidas(",
  ];
  for (const call of asyncCalls) {
    c = c.replace(
      new RegExp(`(?<!await )(?<!= )${call.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"),
      `await ${call}`
    );
  }

  // Fix return type for non-async exported functions incorrectly marked
  c = c.replace(/await (formatNumeroOperacion|normalizeCedula|formatCedulaDisplay|calcularTotalUsdVenta|nombreFuncionarioDisplay|publicIconUrl|publicVentaIconUrl)\(/g, "$1(");

  if (changed || c !== fs.readFileSync(fp, "utf8")) {
    fs.writeFileSync(fp, c);
    console.log("Fixed:", name);
  }
}
