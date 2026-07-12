import type { Presupuesto } from "../types";

/** Total USD del registro: dólares directos + pesos/TC + reales/TC (igual que la columna TOTAL USD). */
export function totalUsdPresupuesto(r: Pick<Presupuesto, "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd">): number {
  const desdePesos = r.pesos > 0 && r.tc_usd > 0 ? r.pesos / r.tc_usd : 0;
  const desdeReales = r.reales > 0 && r.tc_reales > 0 ? r.reales / r.tc_reales : 0;
  const directo = r.dolares_usd > 0 ? r.dolares_usd : 0;
  const total = directo + desdePesos + desdeReales;
  return total > 0 ? total : Number(r.saldo_usd) || 0;
}

export function sumTotalUsdPresupuesto(
  rows: Pick<Presupuesto, "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd">[]
): number {
  return rows.reduce((s, r) => s + totalUsdPresupuesto(r), 0);
}
