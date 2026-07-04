import { clearStockEquinaPageCache } from "../components/stock-equino/stock-equina-page-cache";
import { clearStockGanaderaPageCache } from "../components/stock/stock-ganadera-page-cache";
import { clearHomeActividadCache, clearHomeNotasCache } from "./home-panel-cache";
import { clearHomeInsightsCache } from "./home-insights-cache";
import { clearHomeRecentModulesCache } from "./home-quick-modules";
import { invalidateVencimientosImpuestosCache } from "./vencimientos-impuestos-cache";

/** Borra datos sensibles en sessionStorage/localStorage al cerrar sesión. */
export function clearAllSessionCaches(): void {
  clearStockGanaderaPageCache();
  clearStockEquinaPageCache();
  clearHomeNotasCache();
  clearHomeActividadCache();
  clearHomeInsightsCache();
  clearHomeRecentModulesCache();
  invalidateVencimientosImpuestosCache();
  try {
    sessionStorage.removeItem("scg-home-market-ticker-v1");
    sessionStorage.removeItem("scg-precios-ganado-cache-v1");
    sessionStorage.removeItem("scg:chat-recent-emojis");
  } catch {
    /* noop */
  }
}
