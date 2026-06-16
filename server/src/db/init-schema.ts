import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPool } from "./pg-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function applySchema(): Promise<void> {
  const schemaPath = path.join(__dirname, "..", "..", "supabase", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.warn("[SCG] schema.sql no encontrado en", schemaPath, "— omitiendo DDL automático");
    return;
  }
  const sql = fs.readFileSync(schemaPath, "utf8");
  const pool = getPool();
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}
