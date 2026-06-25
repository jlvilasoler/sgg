/**
 * Espera a que la API local responda /api/health con ok + ready (init DB terminado).
 * Usado por npm run dev para no abrir Vite antes de que el backend esté listo.
 */
const URL = process.env.SCG_HEALTH_URL || "http://127.0.0.1:3001/api/health";
const TIMEOUT_MS = Number(process.env.SCG_HEALTH_TIMEOUT_MS) || 300_000;
const INTERVAL_MS = 350;

const deadline = Date.now() + TIMEOUT_MS;

let lastLog = 0;

while (Date.now() < deadline) {
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json.ok === true && json.ready === true) {
        process.exit(0);
      }
    }
  } catch {
    /* API aún no disponible */
  }
  if (Date.now() - lastLog > 10_000) {
    lastLog = Date.now();
    const elapsed = Math.round((TIMEOUT_MS - (deadline - Date.now())) / 1000);
    console.log(`[SAG] Esperando a que la base termine de inicializar… (${elapsed}s)`);
  }
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

console.error("[SAG] La API no estuvo lista a tiempo:", URL);
process.exit(1);
