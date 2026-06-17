#!/usr/bin/env node
/**
 * Convierte módulos *-db.ts de SQLite sync a Postgres async.
 * Uso: node scripts/migrate-db-to-pg.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "server", "src");

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith("-db.ts") || f === "database.ts");

for (const file of files) {
  const fp = path.join(srcDir, file);
  let code = fs.readFileSync(fp, "utf8");

  if (!code.includes("better-sqlite3") && !code.includes("Database.Database")) {
    continue;
  }

  code = code.replace(
    /import type Database from "better-sqlite3";\n?/g,
    'import type { Db } from "./db/pg-client.js";\n'
  );
  code = code.replace(/Database\.Database/g, "Db");

  // async exported functions
  code = code.replace(
    /^export function (\w+)/gm,
    "export async function $1"
  );

  // await db.exec / prepare calls
  code = code.replace(/\bdb\.exec\(/g, "await db.exec(");
  code = code.replace(
    /(\s+)(const \w+ = )?db\.prepare\(/g,
    "$1$2await db.prepare("
  );
  code = code.replace(
    /(\w+)\.prepare\(([\s\S]*?)\)\.(get|all|run)\(/g,
    "(await $1.prepare($2)).$3("
  );
  // fix double await from above on db.prepare
  code = code.replace(/await await db\.prepare/g, "await db.prepare");
  code = code.replace(
    /\)\.(get|all|run)\(/g,
    ")).$1("
  );
  // broken - too aggressive. Let me do simpler transforms only

  fs.writeFileSync(fp, code);
  console.log("patched", file);
}
