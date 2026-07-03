import { loadVencimientosImpuestosBootstrap } from "./vencimientos-impuestos-cache";
import {
  buildVencimientosProximosLoginAlert,
  clearVencImpLoginAlertStorage,
  vencImpLoginAlertStorageKey,
} from "./vencimientos-impuestos-alertas";
import { setVencImpProximosCount } from "./vencimientos-impuestos-proximos-badge";
import { playChatNotificationSound } from "./chat-notification-sound";
import { toastVencimientosProximos } from "./toast";

export async function notifyVencimientosProximosOnLogin(
  userId: number,
  options: { force?: boolean } = {},
): Promise<void> {
  if (options.force) clearVencImpLoginAlertStorage(userId);

  try {
    const bootstrap = await loadVencimientosImpuestosBootstrap();
    const alert = buildVencimientosProximosLoginAlert(bootstrap);
    setVencImpProximosCount(alert?.totalProximos ?? 0);
    if (!alert) return;

    const key = vencImpLoginAlertStorageKey(userId);
    if (!options.force) {
      try {
        if (sessionStorage.getItem(key)) return;
      } catch {
        /* noop */
      }
    }

    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* noop */
    }

    playChatNotificationSound();
    toastVencimientosProximos(alert.totalProximos, alert.items[0]);
  } catch {
    /* silencioso */
  }
}
