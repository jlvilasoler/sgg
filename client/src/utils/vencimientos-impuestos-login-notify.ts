import { loadVencimientosImpuestosBootstrap } from "./vencimientos-impuestos-cache";
import {
  buildVencimientosProximosLoginAlert,
  clearVencImpLoginAlertStorage,
  vencImpLoginAlertStorageKey,
} from "./vencimientos-impuestos-alertas";
import { toastVencimientosProximos } from "./toast";

export async function notifyVencimientosProximosOnLogin(
  userId: number,
  options: { force?: boolean } = {},
): Promise<void> {
  if (options.force) clearVencImpLoginAlertStorage(userId);

  const key = vencImpLoginAlertStorageKey(userId);
  if (!options.force) {
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* noop */
    }
  }

  try {
    const bootstrap = await loadVencimientosImpuestosBootstrap();
    const alert = buildVencimientosProximosLoginAlert(bootstrap);
    if (!alert) return;

    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* noop */
    }

    toastVencimientosProximos(alert.totalProximos, alert.items[0]);
  } catch {
    /* silencioso */
  }
}
