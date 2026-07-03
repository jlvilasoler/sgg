/**
 * Espera a que la API local responda /api/health con ok + ready (init DB terminado).
 * Usado por npm run dev para no abrir Vite antes de que el backend esté listo.
 */
import http from "node:http";

function parseHealthTarget() {
  const rawUrl = process.env.SCG_HEALTH_URL?.trim();
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      return {
        host: url.hostname || "127.0.0.1",
        port: Number(url.port) || 3001,
        path: url.pathname || "/api/health",
      };
    } catch {
      /* fallback abajo */
    }
  }
  return {
    host: process.env.SCG_HEALTH_HOST || "127.0.0.1",
    port: Number(process.env.SCG_HEALTH_PORT) || 3001,
    path: process.env.SCG_HEALTH_PATH || "/api/health",
  };
}

const { host: HOST, port: PORT, path: HEALTH_PATH } = parseHealthTarget();
const TIMEOUT_MS = Number(process.env.SCG_HEALTH_TIMEOUT_MS) || 300_000;
const INTERVAL_MS = 350;
const FETCH_TIMEOUT_MS = 4000;

const deadline = Date.now() + TIMEOUT_MS;
let lastLog = 0;
let pollTimer = null;
let finished = false;

function finish(code) {
  if (finished) return;
  finished = true;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  process.exitCode = code;
  process.exit(code);
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: HEALTH_PATH,
        method: "GET",
        timeout: FETCH_TIMEOUT_MS,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            resolve(false);
            return;
          }
          try {
            const json = JSON.parse(body);
            resolve(json.ok === true && json.ready === true);
          } catch {
            resolve(false);
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function poll() {
  if (finished) return;

  if (Date.now() >= deadline) {
    console.error(`[SAG] La API no estuvo lista a tiempo: http://${HOST}:${PORT}${HEALTH_PATH}`);
    finish(1);
    return;
  }

  checkHealth()
    .then((ready) => {
      if (finished) return;
      if (ready) {
        finish(0);
        return;
      }

      if (Date.now() - lastLog > 10_000) {
        lastLog = Date.now();
        const elapsed = Math.round((TIMEOUT_MS - (deadline - Date.now())) / 1000);
        console.log(`[SAG] Esperando a que la base termine de inicializar… (${elapsed}s)`);
      }

      pollTimer = setTimeout(poll, INTERVAL_MS);
    })
    .catch(() => {
      if (!finished) pollTimer = setTimeout(poll, INTERVAL_MS);
    });
}

poll();

process.on("SIGINT", () => finish(130));
process.on("SIGTERM", () => finish(143));
