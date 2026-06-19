import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, "server", ".env");

if (!fs.existsSync(envPath)) {
  console.error("[SAG] Falta server/.env");
  process.exit(1);
}

const map = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  map[t.slice(0, i)] = t.slice(i + 1).trim();
}

const targets = ["production", "preview", "development"];
const vars = [
  ["DATABASE_URL", map.DATABASE_URL, true],
  ["SCG_ADMIN_EMAIL", map.SCG_ADMIN_EMAIL, false],
  ["SCG_ADMIN_PASSWORD", map.SCG_ADMIN_PASSWORD, true],
  ["NODE_ENV", "production", false],
  ["SCG_TRUST_PROXY", "1", false],
];

let failed = 0;
for (const target of targets) {
  for (const [name, value, sensitive] of vars) {
    if (!value) continue;
    const args = [
      "vercel",
      "env",
      "add",
      name,
      target,
      "--value",
      value,
      "--yes",
      "--force",
    ];
    if (sensitive) args.push("--sensitive");
    const r = spawnSync("npx", args, {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    const ok = r.status === 0;
    console.log(`[SAG] ${name} (${target}): ${ok ? "ok" : "error"}`);
    if (!ok) {
      failed += 1;
      if (r.stderr?.length) console.error(String(r.stderr));
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
