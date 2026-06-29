/**
 * Duplica selectores .stock-ganadera-* como .stock-equina-* en index.css.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, "../client/src/index.css");
let css = fs.readFileSync(cssPath, "utf8");

if (css.includes(".stock-equina-layout")) {
  console.log("[stock-equino-css-alias] Ya aplicado.");
  process.exit(0);
}

function expandSelectors(selectors) {
  if (!selectors.includes("stock-ganadera") || selectors.includes("stock-equina")) {
    return selectors;
  }
  return selectors
    .split(",")
    .flatMap((part) => {
      const t = part.trim();
      if (!t.includes("stock-ganadera")) return [t];
      const equina = t.replace(/stock-ganadera/g, "stock-equina");
      return t === equina ? [t] : [t, equina];
    })
    .join(",\n");
}

function patchRules(content) {
  let out = "";
  let i = 0;
  while (i < content.length) {
    if (content[i] === "@") {
      const open = content.indexOf("{", i);
      if (open === -1) {
        out += content.slice(i);
        break;
      }
      let depth = 1;
      let j = open + 1;
      while (j < content.length && depth > 0) {
        if (content[j] === "{") depth++;
        else if (content[j] === "}") depth--;
        j++;
      }
      const block = content.slice(i, j);
      const innerOpen = block.indexOf("{") + 1;
      const innerClose = block.lastIndexOf("}");
      out +=
        block.slice(0, innerOpen) +
        patchRules(block.slice(innerOpen, innerClose)) +
        block.slice(innerClose);
      i = j;
      continue;
    }

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

    if (selectors.includes("stock-ganadera") && !selectors.trim().startsWith("/*")) {
      out += expandSelectors(selectors) + body;
    } else {
      out += content.slice(i, j);
    }
    i = j;
  }
  return out;
}

fs.writeFileSync(cssPath, patchRules(css));
console.log("[stock-equino-css-alias] Listo.");
