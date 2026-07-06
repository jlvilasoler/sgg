import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..");
const rootDir = path.resolve(serverDir, "..");

// En Vercel las variables vienen del dashboard; no cargar .env locales.
if (process.env.VERCEL !== "1") {
  for (const envPath of [
    path.join(rootDir, ".env"),
    path.join(serverDir, ".env"),
  ]) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
}
