/**
 * One-shot codemod: better-sqlite3 sync → pg-client async patterns.
 * Run: node scripts/migrate-db-to-pg.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");

const FILES = [
  "proveedores-db.ts",
  "divisas-db.ts",
  "responsables-db.ts",
  "rubros-db.ts",
  "funcionarios-db.ts",
  "rrhh-pagos-db.ts",
  "sub-rubro-items-db.ts",
  "venta-sub-rubro-items-db.ts",
  "ventas-db.ts",
  "venta-sub-rubros-db.ts",
  "venta-grupo-iconos-db.ts",
  "grupo-iconos-db.ts",
  "sub-rubros-db.ts",
  "rubro-sub-rubros-db.ts",
  "stock-ganadero-db.ts",
  "auth-db.ts",
];

function replaceImport(content) {
  return content.replace(
    /import type Database from "better-sqlite3";\n?/,
    'import type { Db } from "./db/pg-client.js";\n'
  );
}

function replaceDbType(content) {
  return content.replace(/Database\.Database/g, "Db");
}

/** Add await before .get( .all( .run( when preceded by ) or prepare chain */
function addAwaitToDbCalls(content) {
  // await db.exec(
  content = content.replace(/(?<!await )db\.exec\(/g, "await db.exec(");
  content = content.replace(/(?<!await )tx\.exec\(/g, "await tx.exec(");

  // .prepare(...).get/all/run - multiline safe via repeated pass
  const chainRe =
    /(\b(?:db|tx)\.prepare\([^)]*(?:\([^)]*\)[^)]*)*\))\s*\.\s*(get|all|run)\s*\(/g;
  let prev;
  do {
    prev = content;
    content = content.replace(chainRe, "(await $1.$2(");
    // fix double await
    content = content.replace(/await \(await /g, "(await ");
  } while (content !== prev);

  // standalone stmt.run after const insert = db.prepare
  content = content.replace(
    /(?<!await )(\b(?:insert|upd|del|upsert|ins|exists|insEsc|insMod|insLink|delLink|update|seed|stmt)\b)\.(get|all|run)\s*\(/g,
    "await $1.$2("
  );

  return content;
}

function makeExportedAsync(content) {
  return content.replace(
    /^export function (\w+)/gm,
    "export async function $1"
  );
}

function fixVoidReturns(content) {
  // export async function foo(...): void → Promise<void>
  content = content.replace(
    /export async function (\w+)\(([^)]*)\):\s*void\b/g,
    "export async function $1($2): Promise<void>"
  );
  // common return types
  const types = [
    "number",
    "boolean",
    "string",
    "string\\[\\]",
    "Proveedor\\[\\]",
    "Proveedor \\| undefined",
    "TipoCambio\\[\\]",
    "TipoCambio \\| undefined",
    "DivisaIndicadores",
    "UserPublic",
    "UserPublic\\[\\]",
    "UserPublic \\| null",
    "LoginResult",
    "RolPermisosConfig",
    "RolPermisosConfig\\[\\]",
    "Rubro\\[\\]",
    "Rubro \\| undefined",
    "Responsable\\[\\]",
    "Responsable \\| undefined",
    "Funcionario\\[\\]",
    "Funcionario \\| undefined",
    "SubRubro\\[\\]",
    "SubRubro \\| undefined",
    "SubRubroItem\\[\\]",
    "SubRubroItem \\| undefined",
    "VentaSubRubro\\[\\]",
    "VentaSubRubro \\| undefined",
    "VentaSubRubroItem\\[\\]",
    "VentaSubRubroItem \\| undefined",
    "IngresoVenta\\[\\]",
    "IngresoVenta \\| undefined",
    "GrupoIconoDto",
    "VentaGrupoIconoDto",
    "Record<string, GrupoIconoDto>",
    "Record<string, VentaGrupoIconoDto>",
    "DeleteGrupoResult",
    "DeleteVentaGrupoResult",
    "RubroVinculoMapaItem\\[\\]",
    "Record<string, string\\[\\]>",
    "ResumenPagosFuncionario",
    "StockGanaderoLote\\[\\]",
    "StockGanaderoLote \\| undefined",
    "StockGanaderoRegistro\\[\\]",
    "StockGanaderoEstadisticas",
    "StockGanaderaDispositivo\\[\\]",
    "StockGanaderaDispositivoDetalle \\| undefined",
    "DispositivoMetaGuardada",
    "DispositivoSexo",
    "number \\| null",
    "ImportBajaDispositivosResult",
    "StockGanaderaDispositivoHistorial\\[\\]",
    "Record<number, SubRubroItem\\[\\]>",
    "Record<number, number>",
    "Record<number, VentaSubRubroItem\\[\\]>",
    "\\{ insertados: number; actualizados: number; ignorados: number \\}",
    "\\{ lote_id: number; insertados: number \\}",
    "Array<\\{ cedula: string; label: string; nombre_display: string \\}>",
    "readonly string\\[\\]",
  ];
  for (const t of types) {
    const re = new RegExp(
      `export async function (\\w+)\\(([^)]*)\\):\\s*${t}\\b`,
      "g"
    );
    content = content.replace(re, "export async function $1($2): Promise<$&>".replace(
      /Promise<export async function (\w+)\([^)]*\):\s*/,
      "Promise<"
    ));
  }
  // simpler pass for : Type at end of export async function lines
  content = content.replace(
    /export async function (\w+)\(([^)]*)\): ([A-Za-z_{}[\]|.<>,\s"']+)(\s*{)/g,
    (m, name, params, ret, brace) => {
      if (ret.startsWith("Promise<")) return m;
      return `export async function ${name}(${params}): Promise<${ret.trim()}>${brace}`;
    }
  );
  return content;
}

function fixTransactions(content) {
  // db.transaction((items) => { → await db.transaction(async (tx) => {
  content = content.replace(
    /const tx = db\.transaction\(\(([^)]*)\) => \{/g,
    "const result = await db.transaction(async (tx) => {"
  );
  content = content.replace(
    /const tx = db\.transaction\(\(\) => \{/g,
    "const result = await db.transaction(async (tx) => {"
  );
  content = content.replace(
    /const renombrar = db\.transaction\(\(\) => \{/g,
    "const result = await db.transaction(async (tx) => {"
  );
  content = content.replace(/\n  tx\(([^)]*)\);\n/g, "\n  return $1;\n});\n");
  content = content.replace(/\n  return tx\(\);\n/g, "\n});\n");
  content = content.replace(/\n  return renombrar\(\);\n/g, "\n});\n");
  content = content.replace(/\n  return tx\(([^)]*)\);\n/g, "\n  return $1;\n});\n");
  return content;
}

function replaceInsertOrIgnore(content) {
  const replacements = [
    [
      /INSERT OR IGNORE INTO PROVEEDORES \(cod, razon_social, rut, direccion, ciudad\)\s*VALUES \(@cod, @razon_social, @rut, @direccion, @ciudad\)/g,
      `INSERT INTO PROVEEDORES (cod, razon_social, rut, direccion, ciudad)
    VALUES (@cod, @razon_social, @rut, @direccion, @ciudad)
    ON CONFLICT (cod) DO NOTHING`,
    ],
    [
      /INSERT OR IGNORE INTO RESPONSABLES \(nombre, activo\) VALUES \(@nombre, 1\)/g,
      `INSERT INTO RESPONSABLES (nombre, activo) VALUES (@nombre, 1)
     ON CONFLICT (nombre) DO NOTHING`,
    ],
    [
      /INSERT OR IGNORE INTO RUBROS \(nombre, activo\) VALUES \(@nombre, 1\)/g,
      `INSERT INTO RUBROS (nombre, activo) VALUES (@nombre, 1)
     ON CONFLICT (nombre) DO NOTHING`,
    ],
    [
      /INSERT OR IGNORE INTO SUB_RUBROS \(nombre, grupo, activo\) VALUES \(@nombre, @grupo, 1\)/g,
      `INSERT INTO SUB_RUBROS (nombre, grupo, activo) VALUES (@nombre, @grupo, 1)
     ON CONFLICT (nombre) DO NOTHING`,
    ],
    [
      /INSERT OR IGNORE INTO RUBRO_SUB_RUBROS \(rubro_id, sub_rubro_id\) VALUES \(\?, \?\)/g,
      `INSERT INTO RUBRO_SUB_RUBROS (rubro_id, sub_rubro_id) VALUES (?, ?)
     ON CONFLICT (rubro_id, sub_rubro_id) DO NOTHING`,
    ],
    [
      /INSERT OR IGNORE INTO INGRESOS_VENTAS_SEQ \(id, ultimo\) VALUES \(1, 0\)/g,
      `INSERT INTO INGRESOS_VENTAS_SEQ (id, ultimo) VALUES (1, 0)
     ON CONFLICT (id) DO NOTHING`,
    ],
  ];
  for (const [re, rep] of replacements) {
    content = content.replace(re, rep);
  }
  return content;
}

function replaceCollateNocase(content) {
  // WHERE col = ? COLLATE NOCASE → LOWER(col) = LOWER(?)
  content = content.replace(
    /WHERE (\w+) = \? COLLATE NOCASE/g,
    "WHERE LOWER($1) = LOWER(?)"
  );
  content = content.replace(
    /WHERE (\w+) = @(\w+) COLLATE NOCASE/g,
    "WHERE LOWER($1) = LOWER(@$2)"
  );
  content = content.replace(
    /AND (\w+) = \? COLLATE NOCASE/g,
    "AND LOWER($1) = LOWER(?)"
  );
  content = content.replace(
    /AND (\w+) = @(\w+) COLLATE NOCASE/g,
    "AND LOWER($1) = LOWER(@$2)"
  );
  content = content.replace(
    /(\w+) = @(\w+) COLLATE NOCASE/g,
    "LOWER($1) = LOWER(@$2)"
  );
  content = content.replace(
    /(\w+) = \? COLLATE NOCASE AND/g,
    "LOWER($1) = LOWER(?) AND"
  );
  content = content.replace(
    /WHERE grupo = \? COLLATE NOCASE/g,
    "WHERE LOWER(grupo) = LOWER(?)"
  );
  content = content.replace(
    /WHERE nombre = \? COLLATE NOCASE/g,
    "WHERE LOWER(nombre) = LOWER(?)"
  );
  content = content.replace(
    /WHERE email = \? COLLATE NOCASE/g,
    "WHERE LOWER(email) = LOWER(?)"
  );
  content = content.replace(
    /ORDER BY nombre COLLATE NOCASE ASC/g,
    "ORDER BY LOWER(nombre) ASC"
  );
  content = content.replace(
    /ORDER BY nombre COLLATE NOCASE, apellido COLLATE NOCASE/g,
    "ORDER BY LOWER(apellido), LOWER(nombre)"
  );
  content = content.replace(
    /ORDER BY apellido COLLATE NOCASE, nombre COLLATE NOCASE/g,
    "ORDER BY LOWER(apellido), LOWER(nombre)"
  );
  content = content.replace(
    /ORDER BY grupo COLLATE NOCASE ASC, nombre COLLATE NOCASE ASC/g,
    "ORDER BY LOWER(grupo) ASC, LOWER(nombre) ASC"
  );
  content = content.replace(
    /ORDER BY grupo COLLATE NOCASE ASC/g,
    "ORDER BY LOWER(grupo) ASC"
  );
  content = content.replace(
    /ORDER BY grupo COLLATE NOCASE/g,
    "ORDER BY LOWER(grupo)"
  );
  content = content.replace(
    /, nombre COLLATE NOCASE ASC/g,
    ", LOWER(nombre) ASC"
  );
  content = content.replace(
    /sub_rubro_id, nombre COLLATE NOCASE ASC/g,
    "sub_rubro_id, LOWER(nombre) ASC"
  );
  return content;
}

function noopPragmaMigrations(content) {
  content = content.replace(
    /function migrateFuncionarioContacto\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateFuncionarioContacto(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateTipoColumn\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateTipoColumn(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function ensureUserColumn\([\s\S]*?\n\}/,
    "async function ensureUserColumn(_db: Db, _column: string, _definition: string): Promise<void> {}"
  );
  content = content.replace(
    /function migrateRacinesARaciones\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateRacinesARaciones(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateStockGanaderoDispositivoMeta\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateStockGanaderoDispositivoMeta(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateSplitEidVid\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateSplitEidVid(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateSyncGrupoDesdeNacimiento\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateSyncGrupoDesdeNacimiento(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateStockGanaderoDispositivoHistorial\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateStockGanaderoDispositivoHistorial(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateUnificarGruposSubRubros\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateUnificarGruposSubRubros(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateAlambradosRubroContable\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateAlambradosRubroContable(_db: Db): Promise<void> {}"
  );
  content = content.replace(
    /function migrateRetireRubroConstruccion\(db: Db\): void \{[\s\S]*?\n\}/,
    "async function migrateRetireRubroConstruccion(_db: Db): Promise<void> {}"
  );
  return content;
}

function noopInitTables(content, file) {
  const initPatterns = {
    "proveedores-db.ts": /export async function initProveedoresTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "divisas-db.ts": /export async function initDivisasTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "responsables-db.ts": /export async function initResponsablesTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "rubros-db.ts": /export async function initRubrosTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "funcionarios-db.ts": /export async function initFuncionariosTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "sub-rubros-db.ts": /export async function initSubRubrosTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "sub-rubro-items-db.ts": /export async function initSubRubroItemsTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "rubro-sub-rubros-db.ts": /export async function initRubroSubRubrosTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "ventas-db.ts": /export async function initVentasTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "venta-sub-rubros-db.ts": /export async function initVentaSubRubrosTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "venta-sub-rubro-items-db.ts": /export async function initVentaSubRubroItemsTable\(db: Db\): void \{[\s\S]*?\n\}/,
    "stock-ganadero-db.ts": /export async function initStockGanaderoTables\(db: Db\): void \{[\s\S]*?\n\}/,
  };
  const pat = initPatterns[file];
  if (pat) {
    if (file === "grupo-iconos-db.ts" || file === "venta-grupo-iconos-db.ts") {
      // handled separately
    } else if (file === "funcionarios-db.ts") {
      content = content.replace(
        pat,
        `export async function initFuncionariosTable(_db: Db): Promise<void> {}`
      );
    } else if (file === "responsables-db.ts") {
      content = content.replace(
        pat,
        `export async function initResponsablesTable(db: Db): Promise<void> {
  await seedResponsablesIfEmpty(db);
  await syncResponsablesFromPresupuesto(db);
}`
      );
    } else if (file === "rubros-db.ts") {
      content = content.replace(
        pat,
        `export async function initRubrosTable(db: Db): Promise<void> {
  await seedRubrosIfEmpty(db);
  await syncRubrosFromPresupuesto(db);
}`
      );
    } else if (file === "sub-rubros-db.ts") {
      content = content.replace(
        pat,
        `export async function initSubRubrosTable(db: Db): Promise<void> {
  await seedSubRubrosIfEmpty(db);
  await migrateRenombrarGrupoAlambrados(db);
  await syncSubRubrosFromPresupuesto(db);
}`
      );
    } else if (file === "venta-sub-rubros-db.ts") {
      content = content.replace(
        pat,
        `export async function initVentaSubRubrosTable(db: Db): Promise<void> {
  await seedVentaSubRubrosIfEmpty(db);
}`
      );
    } else if (file === "ventas-db.ts") {
      content = content.replace(
        pat,
        `export async function initVentasTable(_db: Db): Promise<void> {}`
      );
    } else if (file === "rubro-sub-rubros-db.ts") {
      content = content.replace(
        pat,
        `export async function initRubroSubRubrosTable(db: Db): Promise<void> {
  await rub.ensureRubrosNombres(db, [...RUBROS_POR_GRUPO, "Dividendos"]);
  await seedRubroSubRubrosIfEmpty(db);
  await migrateVinculosFueraDeOtros(db);
  await resyncAllVinculosPorGrupo(db);
}`
      );
    } else if (file === "stock-ganadero-db.ts") {
      content = content.replace(
        pat,
        `export async function initStockGanaderoTables(_db: Db): Promise<void> {}`
      );
    } else {
      content = content.replace(
        pat,
        `export async function initProveedoresTable(_db: Db): Promise<void> {}`.replace(
          "Proveedores",
          file.replace("-db.ts", "").replace(/(^|_)([a-z])/g, (_, p, c) =>
            p ? c.toUpperCase() : c
          )
        )
      );
    }
  }
  return content;
}

for (const file of FILES) {
  const fp = path.join(SRC, file);
  let content = fs.readFileSync(fp, "utf8");
  content = replaceImport(content);
  content = replaceDbType(content);
  content = replaceInsertOrIgnore(content);
  content = replaceCollateNocase(content);
  content = makeExportedAsync(content);
  content = addAwaitToDbCalls(content);
  content = fixTransactions(content);
  content = noopPragmaMigrations(content);
  content = noopInitTables(content, file);
  fs.writeFileSync(fp, content);
  console.log("migrated", file);
}
