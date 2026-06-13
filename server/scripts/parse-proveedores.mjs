/** Genera proveedores-seed.json desde proveedores-inicial.txt (tab o espacios) */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(__dirname, "..", "data", "proveedores-inicial.txt");
const output = path.join(__dirname, "..", "src", "proveedores-seed.json");

const text = fs.readFileSync(input, "utf8");
const rows = [];

for (const line of text.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("COD")) continue;

  let parts = trimmed.split("\t").map((p) => p.trim());
  if (parts.length < 2) {
    const m = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    parts = [m[1], m[2]];
  }

  const cod = parseInt(parts[0], 10);
  if (!Number.isFinite(cod)) continue;

  const rutRe = /^\d{2,3}(\.\d{3}){2,3}\.?\d{0,3}$/;
  let razon = parts[1] || "";
  let rut = "";
  let direccion = "";
  let ciudad = "";

  if (parts.length >= 5) {
    razon = parts[1];
    rut = parts[2] || "";
    direccion = parts[3] || "";
    ciudad = parts[4] || "";
  } else if (parts.length === 4) {
    razon = parts[1];
    if (rutRe.test(parts[2].replace(/\s/g, ""))) {
      rut = parts[2].trim();
      ciudad = parts[3] || "";
    } else {
      direccion = parts[2] || "";
      ciudad = parts[3] || "";
    }
  } else if (parts.length === 3) {
    razon = parts[1];
    const p2 = parts[2];
    if (rutRe.test(p2.replace(/\s/g, ""))) rut = p2.trim();
    else if (p2) ciudad = p2;
  }

  rows.push({
    cod,
    razon_social: razon.trim(),
    rut: rut.trim(),
    direccion: direccion.trim(),
    ciudad: ciudad.trim(),
  });
}

rows.sort((a, b) => a.cod - b.cod);
fs.writeFileSync(output, JSON.stringify(rows, null, 0));
console.log(`OK: ${rows.length} proveedores -> ${output}`);
