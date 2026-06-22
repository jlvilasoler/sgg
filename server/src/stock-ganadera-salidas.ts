import type { Db } from "./db/pg-client.js";
import { listDispositivosVentasCerradasDetalle } from "./simulador-venta-dispositivos-db.js";
import {
  fechaEmbarqueIso,
  tipoBajaDesdeSimuladorVenta,
} from "./simulador-venta-stock-sync.js";
import {
  aplicarBajaDispositivoStock,
  getEstadoDispositivoStock,
  HISTORIAL_AUTOR_VENTA,
  listStockGanaderaDispositivos,
  type StockGanaderaDispositivo,
  type StockGanaderoFilters,
} from "./stock-ganadero-db.js";

/** Aplica baja en stock a dispositivos vinculados a ventas cerradas que siguen VIVO. */
export async function sincronizarBajasPendientesVentasSimulador(db: Db): Promise<number> {
  const vinculos = await listDispositivosVentasCerradasDetalle(db);
  let reparados = 0;
  for (const v of vinculos) {
    if (!v.clave) continue;
    try {
      const estado = await getEstadoDispositivoStock(db, v.clave);
      if (estado !== "VIVO") continue;
      const tipo_baja = tipoBajaDesdeSimuladorVenta(v.tipo);
      const fechaIso = fechaEmbarqueIso(v.venta_realizada_en);
      const refVenta = v.numero_operacion || `SIM-${v.simulacion_id}`;
      await aplicarBajaDispositivoStock(db, v.clave, v.eid, {
        tipo_baja,
        fecha_baja_iso: fechaIso,
        observaciones: `Venta simulador ${refVenta}`,
        numero_guia: refVenta,
        autor: HISTORIAL_AUTOR_VENTA,
      });
      reparados += 1;
    } catch {
      // Dispositivo inexistente o no aplicable — omitir.
    }
  }
  return reparados;
}

export interface SalidasSistemaResult {
  data: StockGanaderaDispositivo[];
  bajas_reparadas: number;
}

export async function listSalidasSistemaDispositivos(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<SalidasSistemaResult> {
  const bajas_reparadas = await sincronizarBajasPendientesVentasSimulador(db);
  const data = await listStockGanaderaDispositivos(db, { ...filters, solo_bajas: true });
  return { data, bajas_reparadas };
}
