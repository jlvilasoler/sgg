/**
 * Logo oficial: SOLO adjunto 1 (image-4ba03085...).
 * Fondo verde unificado al header; sin transparencia ni recorte agresivo.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const ADJUNTO_1 = path.join(
  root,
  "..",
  ".cursor",
  "projects",
  "c-Users-jlvil-OneDrive-Escritorio-SCG",
  "assets",
  "c__Users_jlvil_AppData_Roaming_Cursor_User_workspaceStorage_d280f9949003498f50ea638b31882264_images_image-4ba03085-480d-4d1d-b960-963d7c266e93.png"
);

const input = process.argv[2] || ADJUNTO_1;
const output = path.join(root, "client", "public", "logo-hereford.png");

/** --header-green-dark #1e3d2a */
const G = { r: 30, g: 61, b: 42 };

function isBull(r, g, b) {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (lum > 175 && spread < 55) return true;
  if (r > g + 22 && r > 75) return true;
  if (lum < 42 && spread < 38) return true;
  return false;
}

function isGreenBg(r, g, b) {
  if (isBull(r, g, b)) return false;
  if (r > 190 && g > 190 && b > 175) return true;
  if (g >= r - 22 && g >= b - 18 && g > 38 && r < 130 && b < 200) return true;
  return false;
}

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const visited = new Uint8Array(width * height);
const queue = [];

function push(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = y * width + x;
  if (visited[idx]) return;
  const i = idx * channels;
  if (!isGreenBg(data[i], data[i + 1], data[i + 2])) return;
  visited[idx] = 1;
  queue.push(idx);
}

for (let x = 0; x < width; x++) {
  push(x, 0);
  push(x, height - 1);
}
for (let y = 0; y < height; y++) {
  push(0, y);
  push(width - 1, y);
}

while (queue.length) {
  const idx = queue.pop();
  const i = idx * channels;
  data[i] = G.r;
  data[i + 1] = G.g;
  data[i + 2] = G.b;
  data[i + 3] = 255;
  const x = idx % width;
  const y = (idx - x) / width;
  push(x - 1, y);
  push(x + 1, y);
  push(x, y - 1);
  push(x, y + 1);
}

await sharp(data, { raw: { width, height, channels: 4 } })
  .png()
  .toFile(output);

const m = await sharp(output).metadata();
console.log("Logo adjunto 1 aplicado:", output, `${m.width}x${m.height}`);
