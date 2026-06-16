import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_DATA =
  process.env.SCG_DATA_DIR?.trim() ||
  (process.env.VERCEL
    ? path.join("/tmp", "scg-data")
    : path.join(__dirname, "..", "..", "data"));

export function scgDataPath(...segments: string[]): string {
  const dir = path.join(ROOT_DATA, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
