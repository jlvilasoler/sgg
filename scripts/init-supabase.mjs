import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverDir = path.join(root, "server");

console.log("[SAG] Compilando servidor…");
const build = spawnSync("npm", ["run", "build"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) process.exit(build.status ?? 1);

console.log("[SAG] Aplicando schema y módulos en Supabase…");
const init = spawnSync("npx", ["tsx", "scripts/init-supabase.ts"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
});
process.exit(init.status ?? 1);
