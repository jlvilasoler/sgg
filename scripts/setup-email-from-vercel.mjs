/**
 * Solo completa EMAIL_FROM en Vercel (si RESEND_API_KEY ya quedó configurada).
 * Uso: npm run setup:email-from-vercel
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";
const emailFrom = "onboarding@resend.dev";

function runVercel(args) {
  return spawnSync(npx, ["vercel", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
}

function upsertEnv(name, value, target) {
  runVercel(["env", "rm", name, target, "--yes"]);
  const r = runVercel([
    "env",
    "add",
    name,
    target,
    "--value",
    value,
    "--yes",
    "--force",
  ]);
  if (r.status !== 0) {
    console.error(`[SAG] Error al configurar ${name} (${target})`);
    process.exit(1);
  }
  console.log(`[SAG] ${name} (${target}): ok`);
}

for (const target of ["production", "preview"]) {
  upsertEnv("EMAIL_FROM", emailFrom, target);
}

console.log("\n[SAG] EMAIL_FROM listo. Hacé Redeploy en Vercel.");
