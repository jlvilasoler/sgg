/**
 * Duplica reglas .stock-ganadero-hub-page / .stock-ganadero-module-page / .stock-ganadero-devices-page
 * como equivalentes equinos en index.css.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, "../client/src/index.css");
let css = fs.readFileSync(cssPath, "utf8");

if (css.includes(".stock-equino-hub-page")) {
  console.log("[stock-equino-hub-css] Ya aplicado.");
  process.exit(0);
}

function expandHubPageSelectors(selectors) {
  if (!selectors.includes("stock-ganadero-hub-page") && !selectors.includes("stock-ganadero-module-page") && !selectors.includes("stock-ganadero-devices-page")) {
    return selectors;
  }
  if (selectors.includes("stock-equino-hub-page")) return selectors;
  return selectors
    .split(",")
    .flatMap((part) => {
      const t = part.trim();
      if (!t.includes("stock-ganadero-")) return [t];
      const equino = t
        .replace(/stock-ganadero-hub-page/g, "stock-equino-hub-page")
        .replace(/stock-ganadero-module-page/g, "stock-equino-module-page")
        .replace(/stock-ganadero-devices-page/g, "stock-equino-devices-page");
      return t === equino ? [t] : [t, equino];
    })
    .join(",\n");
}

function patchRules(content) {
  let out = "";
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf("{", i);
    if (open === -1) {
      out += content.slice(i);
      break;
    }
    const selectors = content.slice(i, open);
    let depth = 1;
    let j = open + 1;
    while (j < content.length && depth > 0) {
      if (content[j] === "{") depth++;
      else if (content[j] === "}") depth--;
      j++;
    }
    const body = content.slice(open, j);
    if (
      (selectors.includes("stock-ganadero-hub-page") ||
        selectors.includes("stock-ganadero-module-page") ||
        selectors.includes("stock-ganadero-devices-page")) &&
      !selectors.trim().startsWith("/*")
    ) {
      out += expandHubPageSelectors(selectors) + body;
    } else {
      out += content.slice(i, j);
    }
    i = j;
  }
  return out;
}

css = patchRules(css);
fs.writeFileSync(cssPath, css);
console.log("[stock-equino-hub-css] Reglas hub equino añadidas.");
