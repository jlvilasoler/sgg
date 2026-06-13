import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const input =
  process.argv[2] ||
  path.join(root, "client", "public", "logo-hereford.png");
const output = path.join(root, "client", "public", "logo-hereford.png");

function isBackground(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  if (max > 195 && spread < 50) return true;
  if (max < 70 && spread < 40) return true;
  if (g > r + 12 && g > b + 8 && g > 40 && r < 120) return true;
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
  if (!isBackground(data[i], data[i + 1], data[i + 2])) return;
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
  data[i + 3] = 0;
  const x = idx % width;
  const y = (idx - x) / width;
  push(x - 1, y);
  push(x + 1, y);
  push(x, y - 1);
  push(x, y + 1);
}

const trimmed = await sharp(data, { raw: { width, height, channels: 4 } })
  .png()
  .trim({ threshold: 10 })
  .toBuffer();

await sharp(trimmed).png().toFile(output);
console.log("Logo sin marco (fondo transparente):", output);
