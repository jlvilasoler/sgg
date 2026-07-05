import { loadVencimientosImpuestosBootstrap } from "./vencimientos-impuestos-cache";
import { buildVencimientosProximosLoginAlert } from "./vencimientos-impuestos-alertas";
import { setVencImpProximosCount } from "./vencimientos-impuestos-proximos-badge";

/** Actualiza el badge de vencimientos próximos sin mostrar toast al iniciar sesión. */
export async function notifyVencimientosProximosOnLogin(
  _userId: number,
  _options: { force?: boolean } = {},
): Promise<void> {
  try {
    const bootstrap = await loadVencimientosImpuestosBootstrap();
    const alert = buildVencimientosProximosLoginAlert(bootstrap);
    setVencImpProximosCount(alert?.totalProximos ?? 0);
  } catch {
    /* silencioso */
  }
}
