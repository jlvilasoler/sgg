import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(serverDir, ".env");
const examplePath = path.join(serverDir, ".env.example");

if (fs.existsSync(envPath)) {
  process.exit(0);
}

if (!fs.existsSync(examplePath)) {
  console.error("[SCG] Falta server/.env y no hay .env.example.");
  process.exit(1);
}

fs.copyFileSync(examplePath, envPath);
console.warn(
  "[SCG] Se creó server/.env desde .env.example.\n" +
    "      Pegá tu DATABASE_URL de Supabase (la misma que en Vercel) y reiniciá npm run dev."
);
