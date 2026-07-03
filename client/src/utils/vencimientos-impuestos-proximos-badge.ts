import { loadVencimientosImpuestosBootstrap } from "./vencimientos-impuestos-cache";
import { buildVencimientosProximosLoginAlert } from "./vencimientos-impuestos-alertas";

let proximosCount = 0;
const listeners = new Set<(count: number) => void>();

export function getVencImpProximosCount(): number {
  return proximosCount;
}

export function setVencImpProximosCount(count: number): void {
  const next = Math.max(0, Math.floor(count));
  if (next === proximosCount) return;
  proximosCount = next;
  for (const listener of listeners) listener(proximosCount);
}

export function subscribeVencImpProximosCount(listener: (count: number) => void): () => void {
  listeners.add(listener);
  listener(proximosCount);
  return () => listeners.delete(listener);
}

export async function refreshVencImpProximosCount(): Promise<number> {
  try {
    const bootstrap = await loadVencimientosImpuestosBootstrap();
    const alert = buildVencimientosProximosLoginAlert(bootstrap);
    const count = alert?.totalProximos ?? 0;
    setVencImpProximosCount(count);
    return count;
  } catch {
    setVencImpProximosCount(0);
    return 0;
  }
}
