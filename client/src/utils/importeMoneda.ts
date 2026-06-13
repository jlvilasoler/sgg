import type { ParDivisa, PresupuestoForm } from "../types";

export type MonedaGasto = "UYU" | "USD" | "BRL";

export const MONEDAS_GASTO: ReadonlyArray<{
  id: MonedaGasto;
  label: string;
  corto: string;
}> = [
  { id: "UYU", label: "Pesos ($)", corto: "$" },
  { id: "BRL", label: "Reales (R$)", corto: "R$" },
  { id: "USD", label: "Dólares (USD)", corto: "USD" },
];

export function parDivisaDeMoneda(moneda: MonedaGasto): ParDivisa | null {
  if (moneda === "UYU") return "UYU_USD";
  if (moneda === "BRL") return "BRL_USD";
  return null;
}

export function inferirMonedaDesdeRegistro(row: {
  pesos: number;
  dolares_usd: number;
  reales: number;
}): MonedaGasto {
  if (row.dolares_usd > 0 && row.pesos <= 0 && row.reales <= 0) return "USD";
  if (row.reales > 0 && row.pesos <= 0 && row.dolares_usd <= 0) return "BRL";
  if (row.pesos > 0) return "UYU";
  if (row.reales > 0) return "BRL";
  if (row.dolares_usd > 0) return "USD";
  return "UYU";
}

export function importeDesdeRegistro(
  moneda: MonedaGasto,
  row: { pesos: number; dolares_usd: number; reales: number }
): number {
  if (moneda === "USD") return row.dolares_usd;
  if (moneda === "BRL") return row.reales;
  return row.pesos;
}

export function tcDesdeRegistro(
  moneda: MonedaGasto,
  row: { tc_usd: number; tc_reales: number }
): number {
  if (moneda === "UYU") return row.tc_usd;
  if (moneda === "BRL") return row.tc_reales;
  return 0;
}

/** Total USD en ingresos por ventas: pesos/TC + dólares directos. */
export function calcularTotalUsdVenta(
  pesos: number,
  dolares_usd: number,
  tc_usd: number
): number {
  const fromPesos = pesos > 0 && tc_usd > 0 ? pesos / tc_usd : 0;
  const usd = dolares_usd > 0 ? dolares_usd : 0;
  const total = fromPesos + usd;
  return Math.round(total * 10000) / 10000;
}

/** Unidades de moneda local por 1 USD → equivalente en USD. */
export function calcularSaldoUsd(importe: number, tc: number): number {
  if (importe <= 0) return 0;
  if (tc <= 0) return 0;
  return importe / tc;
}

export function aplicarImporteMoneda(
  moneda: MonedaGasto,
  importe: number,
  tc: number
): Pick<
  PresupuestoForm,
  "pesos" | "dolares_usd" | "reales" | "tc_usd" | "tc_reales" | "saldo_usd"
> {
  const base = {
    pesos: 0,
    dolares_usd: 0,
    reales: 0,
    tc_usd: 0,
    tc_reales: 0,
    saldo_usd: 0,
  };
  if (importe <= 0) return base;

  if (moneda === "USD") {
    return { ...base, dolares_usd: importe, saldo_usd: importe };
  }
  if (moneda === "UYU") {
    return {
      ...base,
      pesos: importe,
      tc_usd: tc,
      saldo_usd: calcularSaldoUsd(importe, tc),
    };
  }
  return {
    ...base,
    reales: importe,
    tc_reales: tc,
    saldo_usd: calcularSaldoUsd(importe, tc),
  };
}

export function etiquetaTc(moneda: MonedaGasto): string {
  if (moneda === "UYU") return "TC USD → $U (pesos por 1 USD)";
  if (moneda === "BRL") return "TC USD → R$ (reales por 1 USD)";
  return "";
}
