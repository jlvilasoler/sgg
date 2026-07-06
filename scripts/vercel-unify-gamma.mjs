/**
 * Unifica producción en https://sgg-gamma.vercel.app
 *
 * Uso: npm run vercel:unify-gamma
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const isWin = process.platform === "win32";
const npx = isWin ? "npx.cmd" : "npx";
const GAMMA_HOST = "sgg-gamma.vercel.app";
const GAMMA_ORIGIN = `https://${GAMMA_HOST}`;

function runVercel(args) {
  const r = spawnSync(npx, ["vercel", ...args], {
    cwd: root,
    encoding: "utf8",
    shell: isWin,
    windowsHide: true,
  });
  return {
    status: r.status ?? 1,
    stdout: `${r.stdout ?? ""}${r.stderr ?? ""}`,
  };
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
    console.error(`[SAG] Error: ${name} (${target})\n${r.stdout}`);
    return false;
  }
  console.log(`[SAG] ${name} (${target}): ok`);
  return true;
}

function latestProductionDeployment() {
  const ls = runVercel(["ls", "--prod"]);
  if (ls.status !== 0) {
    console.error(ls.stdout || "vercel ls falló");
    return null;
  }
  const match = ls.stdout.match(/https:\/\/sgg-[a-z0-9]+-scg-s-projects\.vercel\.app/i);
  return match?.[0] ?? null;
}

console.log("[SAG] Unificando todo en", GAMMA_ORIGIN);

const deploymentUrl = latestProductionDeployment();
if (!deploymentUrl) {
  console.error("[SAG] No se encontró deploy de producción.");
  process.exit(1);
}

console.log("[SAG] Deploy:", deploymentUrl);
console.log("[SAG] Alias →", GAMMA_HOST);

const alias = runVercel(["alias", "set", deploymentUrl, GAMMA_HOST]);
if (alias.status !== 0) {
  console.error(alias.stdout);
  console.error(
    "\n[SAG] Manual: Vercel → sgg → Settings → Domains → Add → sgg-gamma.vercel.app"
  );
  process.exit(1);
}

console.log("[SAG] Alias ok. Variables…");
let ok = true;
for (const target of ["production", "preview"]) {
  ok = upsertEnv("SCG_CLIENT_ORIGIN", GAMMA_ORIGIN, target) && ok;
  runVercel(["env", "rm", "SCG_CLIENT_ORIGINS", target, "--yes"]);
}

if (!ok) process.exit(1);

console.log(
  `\n[SAG] URL única: ${GAMMA_ORIGIN}\n` +
    `  Verificá: ${GAMMA_ORIGIN}/api/health\n` +
    "  Luego: Vercel → Deployments → Redeploy"
);
