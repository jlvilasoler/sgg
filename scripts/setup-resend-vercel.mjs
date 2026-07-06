/**
 * Configura RESEND_API_KEY y EMAIL_FROM en Vercel (production + preview).
 *
 * Uso:
 *   node scripts/setup-resend-vercel.mjs re_xxxxxxxx
 *   npm run setup:resend-vercel -- re_xxxxxxxx
 *
 * También lee RESEND_API_KEY de server/.env si no pasás argumento.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, "server", ".env");
const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";

function readLocalEnv() {
  const map = {};
  if (!fs.existsSync(envPath)) return map;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    map[t.slice(0, i)] = t.slice(i + 1).trim();
  }
  return map;
}

const local = readLocalEnv();
const apiKey = (process.argv[2] || local.RESEND_API_KEY || "").trim();
// Sin < > para evitar errores de redirección en Windows (cmd.exe).
const emailFrom =
  (process.argv[3] || local.EMAIL_FROM || "onboarding@resend.dev").trim();

if (!apiKey.startsWith("re_")) {
  console.error(
    "[SAG] Falta RESEND_API_KEY válida (debe empezar con re_).\n" +
      "  1. Creá una en https://resend.com/api-keys\n" +
      "  2. Ejecutá: npm run setup:resend-vercel -- re_tu_clave_aqui"
  );
  process.exit(1);
}

function runVercel(args) {
  return spawnSync(npx, ["vercel", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
}

function upsertEnv(name, value, target, sensitive) {
  runVercel(["env", "rm", name, target, "--yes"]);
  const args = ["env", "add", name, target, "--value", value, "--yes", "--force"];
  if (sensitive) args.push("--sensitive");
  const r = runVercel(args);
  if (r.status !== 0) {
    console.error(`[SAG] Error al configurar ${name} (${target})`);
    process.exit(1);
  }
  console.log(`[SAG] ${name} (${target}): ok`);
}

for (const target of ["production", "preview"]) {
  upsertEnv("RESEND_API_KEY", apiKey, target, true);
  upsertEnv("EMAIL_FROM", emailFrom, target, false);
}

console.log(
  "\n[SAG] Variables configuradas. Ahora hacé redeploy:\n" +
    "  npx vercel --prod\n" +
    "  o en el dashboard: Deployments → Redeploy\n\n" +
    "Verificá: https://sgg-gamma.vercel.app/api/health\n" +
    '  → "password_reset_email": { "configured": true, "provider": "resend" }'
);
