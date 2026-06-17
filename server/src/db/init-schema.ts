import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPool } from "./pg-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveSchemaPath(): string {
  const candidates = [
    path.join(__dirname, "..", "supabase", "schema.sql"),
    path.join(__dirname, "..", "..", "supabase", "schema.sql"),
    path.join(process.cwd(), "server", "supabase", "schema.sql"),
    path.join(process.cwd(), "supabase", "schema.sql"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `No se encontró schema.sql. Rutas probadas: ${candidates.join(" | ")}`
  );
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n\r]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function applySchema(): Promise<void> {
  const schemaPath = resolveSchemaPath();
  console.info("[SCG] Aplicando schema desde", schemaPath);
  const sql = fs.readFileSync(schemaPath, "utf8");
  const pool = getPool();
  const statements = splitSqlStatements(sql);

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(msg)) continue;
      console.error("[SCG] Error en DDL:", stmt.slice(0, 120), "—", msg);
      throw err;
    }
  }
  console.info(`[SCG] Schema aplicado (${statements.length} sentencias)`);
}
