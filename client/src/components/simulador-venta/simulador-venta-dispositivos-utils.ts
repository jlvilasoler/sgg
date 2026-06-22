import type { SimuladorVentaGanadoRow } from "../../types";

/** Máximo de dispositivos vinculables según cabezas de la venta cerrada (modo CABEZAS). */
export function limiteDispositivosVenta(
  row: Pick<SimuladorVentaGanadoRow, "modo_kg" | "real_cantidad_animales">
): number | null {
  if (row.modo_kg !== "CABEZAS") return null;
  if (row.real_cantidad_animales == null) return null;
  const n = Math.round(row.real_cantidad_animales);
  return n > 0 ? n : null;
}

export function mensajeLimiteDispositivosVenta(limite: number): string {
  return `La venta tiene ${limite} cabeza${limite === 1 ? "" : "s"}. No podés vincular más dispositivos.`;
}

export function puedeAgregarDispositivoVenta(
  row: Pick<SimuladorVentaGanadoRow, "modo_kg" | "real_cantidad_animales">,
  cantidadActual: number
): boolean {
  const limite = limiteDispositivosVenta(row);
  if (limite == null) return true;
  return cantidadActual < limite;
}
