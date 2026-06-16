import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPool } from "./pg-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function applySchema(): Promise<void> {
  const schemaPath = path.join(__dirname, "..", "..", "supabase", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const pool = getPool();
  await pool.query(sql);
}
