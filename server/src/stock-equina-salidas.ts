import type { Db } from "./db/pg-client.js";
import {
  listStockEquinaDispositivos,
  type StockEquinaDispositivo,
  type StockEquinoFilters,
} from "./stock-equino-db.js";

export interface SalidasSistemaResult {
  data: StockEquinaDispositivo[];
  bajas_reparadas: number;
}

export async function listSalidasSistemaDispositivos(
  db: Db,
  filters?: StockEquinoFilters
): Promise<SalidasSistemaResult> {
  const data = await listStockEquinaDispositivos(db, { ...filters, solo_bajas: true });
  return { data, bajas_reparadas: 0 };
}
