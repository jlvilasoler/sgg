/**
 * Crea una cuenta SMTP de prueba (Ethereal) y la guarda en server/.env.local-smtp
 * para recuperación de contraseña en desarrollo.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(serverDir, ".env");
const snippetPath = path.join(serverDir, ".env.local-smtp");

console.log("[SAG] Creando cuenta SMTP de prueba (Ethereal)…");
const account = await nodemailer.createTestAccount();

const lines = [
  "",
  "# SMTP de desarrollo (generado por scripts/provision-dev-smtp.mjs)",
  `SMTP_HOST=${account.smtp.host}`,
  `SMTP_PORT=${account.smtp.port}`,
  `SMTP_SECURE=${account.smtp.secure ? "1" : "0"}`,
  `SMTP_USER=${account.user}`,
  `SMTP_PASS=${account.pass}`,
  `SMTP_FROM=SAG <${account.user}>`,
  "",
];

fs.writeFileSync(snippetPath, lines.join("\n"), "utf8");

let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
for (const key of [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
]) {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = lines.find((l) => l.startsWith(`${key}=`));
  if (!line) continue;
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    env = env.trimEnd() + "\n" + line + "\n";
  }
}

fs.writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`, "utf8");
console.log("[SAG] SMTP de desarrollo guardado en server/.env");
console.log("[SAG] Reiniciá npm run dev para aplicar los cambios.");
