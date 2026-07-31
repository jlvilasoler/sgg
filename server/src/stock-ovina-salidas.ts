import type { Db } from "./db/pg-client.js";
import {
  listStockOvinaDispositivos,
  type StockOvinaDispositivo,
  type StockOvinoFilters,
} from "./stock-ovino-db.js";

export interface SalidasSistemaResult {
  data: StockOvinaDispositivo[];
  bajas_reparadas: number;
}

export async function listSalidasSistemaDispositivos(
  db: Db,
  filters?: StockOvinoFilters
): Promise<SalidasSistemaResult> {
  const data = await listStockOvinaDispositivos(db, { ...filters, solo_bajas: true });
  return { data, bajas_reparadas: 0 };
}
