/**
 * Apunta sgg-gamma.vercel.app al mismo deploy de producción que sgg-murex.
 * Así ambas URLs comparten RESEND_API_KEY y el resto de variables.
 *
 * Uso: npm run vercel:link-gamma
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";
const GAMMA_URL = "sgg-gamma.vercel.app";

function runVercel(args) {
  return spawnSync(npx, ["vercel", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
}

console.log("[SAG] Buscando último deploy de producción…");
const ls = runVercel(["ls", "--prod", "--limit", "1"]);
if (ls.status !== 0) {
  console.error(ls.stderr || ls.stdout);
  process.exit(1);
}

const match = (ls.stdout || "").match(/https:\/\/sgg-[a-z0-9]+-scg-s-projects\.vercel\.app/i);
if (!match) {
  console.error(
    "[SAG] No se encontró URL de deploy. Usá el dashboard:\n" +
      "  Vercel → sgg → Settings → Domains → Add → sgg-gamma.vercel.app"
  );
  process.exit(1);
}

const deploymentUrl = match[0];
console.log(`[SAG] Deploy producción: ${deploymentUrl}`);
console.log(`[SAG] Asignando alias ${GAMMA_URL}…`);

const alias = runVercel(["alias", "set", deploymentUrl, GAMMA_URL]);
if (alias.status !== 0) {
  console.error(alias.stderr || alias.stdout);
  console.error(
    "\n[SAG] Si falla, hacelo manual en Vercel:\n" +
      "  1. Proyecto sgg → Settings → Domains\n" +
      `  2. Add → ${GAMMA_URL}\n` +
      "  3. Si dice que ya existe en otro proyecto, eliminá ese dominio del proyecto viejo primero."
  );
  process.exit(1);
}

console.log(`\n[SAG] Listo. Verificá:\n  https://${GAMMA_URL}/api/health\n  → password_reset_email.configured: true`);

// Asegurar ambas URLs en SCG_CLIENT_ORIGINS
const origins =
  "https://sgg-murex.vercel.app,https://sgg-gamma.vercel.app";
for (const target of ["production", "preview"]) {
  runVercel(["env", "rm", "SCG_CLIENT_ORIGINS", target, "--yes"]);
  const r = runVercel([
    "env",
    "add",
    "SCG_CLIENT_ORIGINS",
    target,
    "--value",
    origins,
    "--yes",
    "--force",
  ]);
  console.log(
    `[SAG] SCG_CLIENT_ORIGINS (${target}): ${r.status === 0 ? "ok" : "error — configurá manual en Vercel"}`
  );
}

console.log("\n[SAG] Redeploy: Vercel → Deployments → Redeploy");
