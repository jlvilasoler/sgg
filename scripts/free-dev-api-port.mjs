/**
 * Liberar el puerto de la API en desarrollo si quedó una instancia colgada.
 * Si /api/health ya responde ready=true, no mata el proceso (reutiliza).
 */
import { execSync } from "node:child_process";
import net from "node:net";

const HOST = process.env.SCG_HEALTH_HOST || "127.0.0.1";
const PORT = Number(process.env.SCG_HEALTH_PORT) || 3001;
const HEALTH_URL =
  process.env.SCG_HEALTH_URL?.trim() || `http://${HOST}:${PORT}/api/health`;
const KEEP = process.env.SCG_KEEP_EXISTING_API === "1";

async function probeHealth() {
  try {
    const res = await fetch(HEALTH_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { status: "bad" };
    const json = await res.json();
    if (json?.ok === true && json?.ready === true) return { status: "ready" };
    return {
      status: "busy",
      error: typeof json?.error === "string" ? json.error : null,
      detail: typeof json?.detail === "string" ? json.detail : null,
    };
  } catch {
    return { status: "down" };
  }
}

function portInUse(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function pidsOnPort(port) {
  const isWin = process.platform === "win32";
  try {
    if (isWin) {
      const out = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes(`:${port}`) || !/LISTENING/i.test(line)) continue;
        const m = line.trim().match(/(\d+)\s*$/);
        if (m) pids.add(Number(m[1]));
      }
      return [...pids].filter((pid) => Number.isFinite(pid) && pid > 0);
    }
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out
      .split(/\s+/)
      .map((s) => Number(s.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPids(pids) {
  const isWin = process.platform === "win32";
  for (const pid of pids) {
    try {
      if (isWin) {
        execSync(`taskkill /PID ${pid} /T /F`, {
          stdio: "ignore",
          windowsHide: true,
        });
      } else {
        process.kill(pid, "SIGTERM");
      }
      console.log(`[SAG] Proceso anterior en :${PORT} cerrado (pid ${pid}).`);
    } catch (err) {
      console.warn(
        `[SAG] No se pudo cerrar pid ${pid}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (KEEP) {
    console.log("[SAG] SCG_KEEP_EXISTING_API=1 — no se libera el puerto.");
    return;
  }

  const health = await probeHealth();
  if (health.status === "ready") {
    console.log(
      `[SAG] API ya lista en ${HEALTH_URL}. Se reiniciará con la instancia nueva.`
    );
  } else if (health.status === "busy") {
    const detail = [health.error, health.detail].filter(Boolean).join(" — ");
    console.warn(
      `[SAG] API en :${PORT} ocupada pero no lista${detail ? `: ${detail}` : ""}. Se libera el puerto.`
    );
  }

  const inUse = await portInUse(PORT, HOST);
  if (!inUse) return;

  const pids = pidsOnPort(PORT);
  if (pids.length === 0) {
    console.warn(
      `[SAG] Puerto ${PORT} en uso pero no se pudo identificar el proceso. Cerralo manualmente.`
    );
    process.exitCode = 1;
    return;
  }

  killPids(pids);
  // Esperar a que el SO libere el socket (Windows a veces tarda).
  for (let i = 0; i < 20; i++) {
    await sleep(150);
    if (!(await portInUse(PORT, HOST))) return;
  }
  console.warn(
    `[SAG] El puerto ${PORT} sigue ocupado tras cerrar procesos. Reintentá en unos segundos.`
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("[SAG] free-dev-api-port:", err);
  process.exitCode = 1;
});
