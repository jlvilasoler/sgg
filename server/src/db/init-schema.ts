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
  const pool = getPool();

  const exists = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'presupuesto' LIMIT 1`
  );
  if (exists.rows.length > 0) {
    console.info("[SCG] Schema ya aplicado, omitiendo DDL");
    return;
  }

  const schemaPath = resolveSchemaPath();
  console.info("[SCG] Aplicando schema desde", schemaPath);
  const sql = fs.readFileSync(schemaPath, "utf8");
  const statements = splitSqlStatements(sql);

  const client = await pool.connect();
  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg)) continue;
        console.error("[SCG] Error en DDL:", stmt.slice(0, 120), "—", msg);
        throw err;
      }
    }
  } finally {
    client.release();
  }
  console.info(`[SCG] Schema aplicado (${statements.length} sentencias)`);
}
