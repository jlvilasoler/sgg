import type { GastoDestinoId } from "./gasto-campos.js";
import { valorImportePorEtiqueta, valorPorEtiqueta } from "./parse-brou-transferencia.js";

function fechaUyToIso(fecha: string): string {
  const m = fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  return `${m[3]}-${mm}-${dd}`;
}

/**
 * Detecta el comprobante Santander «Transferencias en el país» (transferencia
 * local a otro banco, p. ej. a BROU). Este formato no incluye la palabra
 * «Santander» ni las etiquetas del comprobante «a Otros Bancos», así que se
 * reconoce por su título y campos propios.
 */
export function looksLikeSantanderEnElPais(raw: string): boolean {
  const t = raw.replace(/\r/g, "\n");
  if (/transferencias?\s+en\s+el\s+pa[ií]s/i.test(t)) return true;
  const señales = [
    /nro\.?\s*de\s*referencia/i.test(t),
    /monto\s+acreditado/i.test(t),
    /usuario\s+originador/i.test(t),
    /cuenta\s+origen/i.test(t) && /cuenta\s+destino/i.test(t),
  ].filter(Boolean).length;
  return señales >= 2;
}

/**
 * Extrae los campos del comprobante Santander «Transferencias en el país» y los
 * devuelve con las claves del formulario de gasto (mismo formato que el mapeo).
 */
export function parseSantanderEnElPais(
  raw: string
): Partial<Record<GastoDestinoId, string>> {
  const out: Partial<Record<GastoDestinoId, string>> = {};

  const nro = valorPorEtiqueta(raw, "Nro. de Referencia").replace(/\D/g, "");
  if (nro) out.nro_operacion_origen = nro;

  const fecha = fechaUyToIso(
    valorPorEtiqueta(raw, "Fecha de finalización") ||
      valorPorEtiqueta(raw, "Fecha de finalizacion")
  );
  if (fecha) out.fecha = fecha;

  const imp = valorImportePorEtiqueta(raw, "Monto acreditado");
  if (imp && imp.valor > 0) out.importes = `${imp.moneda}:${imp.valor}`;

  const beneficiario = valorPorEtiqueta(raw, "Cuenta Destino").trim();
  if (beneficiario && /[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}/.test(beneficiario)) {
    out.proveedor = beneficiario;
  }

  out.concepto = "TRANSFERENCIA SANTANDER";

  return out;
}
