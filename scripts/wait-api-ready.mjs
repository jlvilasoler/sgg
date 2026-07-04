/**
 * Espera a que la API local responda /api/health con ok + ready (init DB terminado).
 * Usado por npm run dev para no abrir Vite antes de que el backend esté listo.
 */
function parseHealthTarget() {
  const rawUrl = process.env.SCG_HEALTH_URL?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `${url.origin}${url.pathname || "/api/health"}`;
    } catch {
      /* fallback abajo */
    }
  }
  const host = process.env.SCG_HEALTH_HOST || "127.0.0.1";
  const port = Number(process.env.SCG_HEALTH_PORT) || 3001;
  const path = process.env.SCG_HEALTH_PATH || "/api/health";
  return `http://${host}:${port}${path}`;
}

const HEALTH_URL = parseHealthTarget();
const TIMEOUT_MS = Number(process.env.SCG_HEALTH_TIMEOUT_MS) || 300_000;
const INTERVAL_MS = 350;
const FETCH_TIMEOUT_MS = 4000;

const deadline = Date.now() + TIMEOUT_MS;
let shuttingDown = false;
let exitCode = 0;

async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.ok === true && json.ready === true;
  } catch {
    return false;
  }
}

async function main() {
  let lastLog = 0;
  while (!shuttingDown && Date.now() < deadline) {
    if (await checkHealth()) return;
    if (Date.now() - lastLog > 10_000) {
      lastLog = Date.now();
      const elapsed = Math.round((Date.now() - (deadline - TIMEOUT_MS)) / 1000);
      console.log(`[SAG] Esperando a que la base termine de inicializar… (${elapsed}s)`);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  if (!shuttingDown) {
    console.error(`[SAG] La API no estuvo lista a tiempo: ${HEALTH_URL}`);
    exitCode = 1;
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

main()
  .catch((err) => {
    console.error("[SAG] wait-api-ready:", err);
    exitCode = 1;
  })
  .finally(() => {
    process.exitCode = exitCode;
  });
