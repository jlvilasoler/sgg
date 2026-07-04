export { APP_LOCALE, fmtDate, fmtDateHora, fmtNum, parseLocalDateFromIso } from "./utils/format";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Número de operación de 10 cifras (0000000001, …). */
export function formatNumeroOperacion(nro: number): string {
  return String(Math.max(1, Math.floor(nro))).padStart(10, "0");
}

export function empresaClass(empresa: string): string {
  return empresa.includes("GUAVIYU") ? "empresa-guaviyu" : "empresa-chivilcoy";
}

/** Etiqueta corta para columnas estrechas del listado. */
export function empresaCorta(empresa: string): string {
  if (empresa.includes("GUAVIYU")) return "GUAVIYU";
  if (empresa.includes("CHIVILCOY")) return "CHIVILCOY";
  return empresa.replace(/^GANADERA\s+/i, "").trim() || empresa;
}

export const emptyForm = () => ({
  empresa: "" as "" | import("./types").Empresa,
  fecha: todayIso(),
  codigo_proveedor: "",
  razon_social_proveedor: "",
  concepto: "",
  observaciones: "",
  rubro: "",
  responsable_gasto: "",
  nro_factura: "",
  pesos: 0,
  dolares_usd: 0,
  reales: 0,
  tc_usd: 0,
  tc_reales: 0,
  saldo_usd: 0,
});
