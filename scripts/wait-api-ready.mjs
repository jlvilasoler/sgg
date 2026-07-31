/**
 * Espera a que la API local responda /api/health con ok + ready (init DB terminado).
 * Usado por npm run dev para no abrir Vite antes de que el backend esté listo.
 *
 * Aceleración: si la API no acepta conexiones (proceso muerto / puerto fallido),
 * falla en ~45s en vez de esperar el timeout largo de init de DB.
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
/** Sin respuesta HTTP: la API no arrancó (p. ej. EADDRINUSE). */
const NO_CONNECT_TIMEOUT_MS =
  Number(process.env.SCG_HEALTH_NO_CONNECT_MS) || 45_000;
/** Health responde pero ready=false con error de DB. */
const DB_ERROR_TIMEOUT_MS =
  Number(process.env.SCG_HEALTH_DB_ERROR_MS) || 60_000;
const INTERVAL_MS = 350;
const FETCH_TIMEOUT_MS = 4000;

const startedAt = Date.now();
const deadline = startedAt + TIMEOUT_MS;
let shuttingDown = false;
let exitCode = 0;

/**
 * @returns {Promise<{ kind: 'ready' } | { kind: 'init' } | { kind: 'db_error', error: string } | { kind: 'down' }>}
 */
async function checkHealth() {
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { kind: "down" };
    const json = await res.json();
    if (json.ok === true && json.ready === true) return { kind: "ready" };
    if (json.ok === true && json.ready === false && json.error) {
      const detail = typeof json.detail === "string" ? ` (${json.detail})` : "";
      return { kind: "db_error", error: `${json.error}${detail}` };
    }
    return { kind: "init" };
  } catch {
    return { kind: "down" };
  }
}

async function main() {
  let lastLog = 0;
  let firstHttpAt = 0;
  let firstDbErrorAt = 0;
  let lastDbError = "";

  while (!shuttingDown && Date.now() < deadline) {
    const result = await checkHealth();
    if (result.kind === "ready") return;

    const now = Date.now();
    const elapsed = Math.round((now - startedAt) / 1000);

    if (result.kind === "down") {
      if (now - startedAt >= NO_CONNECT_TIMEOUT_MS) {
        console.error(
          `[SAG] La API no acepta conexiones en ${HEALTH_URL} tras ${elapsed}s.`
        );
        console.error(
          "[SAG] Suele ser puerto 3001 ocupado o el proceso API caído. Probá de nuevo: npm run dev"
        );
        exitCode = 1;
        return;
      }
    } else {
      if (!firstHttpAt) firstHttpAt = now;
      if (result.kind === "db_error") {
        if (!firstDbErrorAt) firstDbErrorAt = now;
        lastDbError = result.error;
        if (now - firstDbErrorAt >= DB_ERROR_TIMEOUT_MS) {
          console.error(
            `[SAG] Base de datos no disponible tras ${elapsed}s: ${lastDbError}`
          );
          exitCode = 1;
          return;
        }
      } else {
        firstDbErrorAt = 0;
        lastDbError = "";
      }
    }

    if (now - lastLog > 8_000) {
      lastLog = now;
      if (result.kind === "down") {
        console.log(`[SAG] Esperando a que arranque la API… (${elapsed}s)`);
      } else if (result.kind === "db_error") {
        console.log(
          `[SAG] API arriba, DB con error — reintentando… (${elapsed}s)`
        );
      } else {
        console.log(
          `[SAG] Esperando a que la base termine de inicializar… (${elapsed}s)`
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  if (!shuttingDown) {
    console.error(`[SAG] La API no estuvo lista a tiempo: ${HEALTH_URL}`);
    if (lastDbError) console.error(`[SAG] Último error de DB: ${lastDbError}`);
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
