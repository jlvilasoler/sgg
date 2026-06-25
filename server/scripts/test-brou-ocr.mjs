import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractTextFromBrouDocument } from "../dist/extract-brou-document-text.js";
import { parseBrouTransferenciaText } from "../dist/parse-brou-transferencia.js";

const img = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../.cursor/projects/c-Users-jlvil-OneDrive-Escritorio-SCG/assets/c__Users_jlvil_AppData_Roaming_Cursor_User_workspaceStorage_d280f9949003498f50ea638b31882264_images_image-9532d8c7-e7d6-4b08-ba40-5b9708d97a62.png"
);

if (!fs.existsSync(img)) {
  console.error("Image not found:", img);
  process.exit(1);
}

const buffer = fs.readFileSync(img);
const text = await extractTextFromBrouDocument(buffer, "image/png", "brou.png");
console.log("--- OCR TEXT (first 800 chars) ---");
console.log(text.slice(0, 800));
console.log("--- PARSED ---");
console.log(JSON.stringify(parseBrouTransferenciaText(text), null, 2));
