import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..");
const rootDir = path.resolve(serverDir, "..");

for (const envPath of [
  path.join(rootDir, ".env"),
  path.join(serverDir, ".env"),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
