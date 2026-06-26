export type BrouMoneda = "UYU" | "USD";

export interface BrouImporte {
  moneda: BrouMoneda;
  valor: number;
}

export interface BrouTransferenciaParsed {
  numero_operacion: string;
  numero_transferencia: string;
  /** ISO YYYY-MM-DD */
  fecha: string;
  importe_acreditar: BrouImporte;
  comision: BrouImporte | null;
  beneficiario_nombre: string;
  beneficiario_direccion: string;
  beneficiario_observaciones: string;
  banco_destino: string;
  cuenta_destino: string;
  concepto_brou: string;
  cuenta_origen: string;
}

function parseMontoUy(text: string): number {
  const cleaned = text.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseMonedaMonto(raw: string): BrouImporte | null {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const isUsd = /U\$S|US\$|USD|USS/.test(compact);
  const m = raw.match(/([\d.,]+)/);
  if (!m) return null;
  const valor = parseMontoUy(m[1]);
  if (valor <= 0) return null;
  return { moneda: isUsd ? "USD" : "UYU", valor };
}

function fechaUyToIso(fecha: string): string {
  const m = fecha.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function pickFirst(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

function normalizeForSearch(text: string): string {
  return text.replace(/\r/g, "\n").replace(/\t/g, " ");
}

/**
 * Valor asociado a un rótulo. Soporta los dos órdenes del comprobante BROU:
 *  - «valor <tab/espacios> rótulo» (PDF «Transferencia a Otros Bancos»)
 *  - «rótulo: valor» / rótulo y valor en líneas contiguas (capturas / OCR)
 */
function labeledValue(text: string, label: RegExp, valueRe: RegExp): string {
  const lines = text.split("\n");
  const value = new RegExp(valueRe.source, valueRe.flags.replace("g", ""));
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lm = line.match(label);
    if (!lm) continue;
    const labelIdx = lm.index ?? 0;
    const before = line.slice(0, labelIdx);
    const rest = line.slice(labelIdx + lm[0].length);
    // «Rótulo: valor» (con dos puntos) → el valor está en la misma línea.
    // «Rótulo» sin dos puntos (encabezado de columna) → el valor suele estar
    // en la línea de abajo; el texto de la misma línea puede ser otra columna.
    const hasColon = /^\s*:/.test(rest);
    const after = rest.replace(/^\s*:?\s*/, "");

    const mb = before.match(value);
    if (mb?.[1]?.trim()) return mb[1].trim();

    if (hasColon) {
      const ma = after.match(value);
      if (ma?.[1]?.trim()) return ma[1].trim();
    }
    if (i + 1 < lines.length) {
      const mn = lines[i + 1].match(value);
      if (mn?.[1]?.trim()) return mn[1].trim();
    }
    if (!hasColon) {
      const ma = after.match(value);
      if (ma?.[1]?.trim()) return ma[1].trim();
    }
    if (i - 1 >= 0) {
      const mp = lines[i - 1].match(value);
      if (mp?.[1]?.trim()) return mp[1].trim();
    }
  }
  return "";
}

const IMPORTE_RE =
  /((?:UYU|USD|U\$S|US\$|USS|U\s*\$?\s*S|\$U|\$)\s*[\d.,]+)/i;

function labeledImporte(text: string, label: RegExp): BrouImporte | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lm = line.match(label);
    if (!lm) continue;
    const labelIdx = lm.index ?? 0;
    const before = line.slice(0, labelIdx);
    const after = line.slice(labelIdx + lm[0].length);

    const mb = before.match(IMPORTE_RE);
    if (mb) return parseMonedaMonto(mb[1]);
    const ma = after.match(IMPORTE_RE);
    if (ma) return parseMonedaMonto(ma[1]);
    if (i + 1 < lines.length) {
      const mn = lines[i + 1].match(IMPORTE_RE);
      if (mn) return parseMonedaMonto(mn[1]);
    }
  }
  return null;
}

function cleanConcepto(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/importe|acreditar|debitar|u\$s|us\$|\$\s*\d/i.test(t)) return "";
  if (t.length > 40) return t.slice(0, 40).trim();
  return t;
}

/** Indica si el texto parece un comprobante BROU de transferencia / pago. */
export function looksLikeBrouTransferenciaComprobante(raw: string): boolean {
  const text = normalizeForSearch(raw);
  // El comprobante no siempre incluye la marca «BROU» como texto, así que el
  // título del documento o la combinación de campos clave alcanza para detectarlo.
  if (/transferencia\s+a\s+otros\s+bancos/i.test(text)) return true;
  const hasOperacion = /n[uú]mero de la operaci[oó]n/i.test(text);
  const hasTransferencia = /n[uú]mero de transferencia/i.test(text);
  const hasImporte = /importe\s+a\s+acreditar/i.test(text);
  const señales = [hasOperacion, hasTransferencia, hasImporte].filter(Boolean).length;
  return señales >= 2;
}

/** Extrae datos de un comprobante BROU «Transferencia a Otros Bancos» (texto OCR o PDF). */
export function parseBrouTransferenciaText(raw: string): BrouTransferenciaParsed {
  const text = normalizeForSearch(raw);
  if (!looksLikeBrouTransferenciaComprobante(text)) {
    throw new Error(
      "El archivo no parece un comprobante BROU de transferencia o pago. Podés completar el gasto manualmente."
    );
  }

  const numero_operacion = labeledValue(
    text,
    /n[uú]mero de la operaci[oó]n/i,
    /(\d{15,18})/
  );

  const numero_transferencia = labeledValue(
    text,
    /n[uú]mero de transferencia/i,
    /(\d{15,18})/
  );

  const fechaRaw = pickFirst(
    labeledValue(text, /fecha de realizaci[oó]n/i, /(\d{2}\/\d{2}\/\d{4})/),
    labeledValue(text, /fecha contable/i, /(\d{2}\/\d{2}\/\d{4})/)
  );
  const fecha = fechaUyToIso(fechaRaw);

  const importe_acreditar =
    labeledImporte(text, /importe\s+a\s+acreditar/i) ??
    ({ moneda: "USD" as const, valor: 0 });

  const comision = labeledImporte(text, /comisiones\s+y\s+gastos/i);

  const beneficiario_nombre = labeledValue(
    text,
    /nombre completo/i,
    /([A-Za-zÁÉÍÓÚáéíóúñÑ][^\n]+)/
  ).replace(/\s{2,}/g, " ");

  const beneficiario_direccion = labeledValue(text, /direcci[oó]n/i, /([^\n]+)/);

  const beneficiario_observaciones = labeledValue(
    text,
    /observaciones/i,
    /([^\n]+)/
  );

  const banco_destino = pickFirst(
    labeledValue(text, /\bbanco\s*$/i, /([A-Za-zÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ\s.]{2,24})/),
    labeledValue(text, /^\s*banco\b(?!\s+de\s+destino)/i, /([A-Za-zÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ\s.]{2,24})/)
  )
    .split("\n")[0]
    .trim();

  const cuenta_destino = labeledValue(
    text,
    /cuenta de destino/i,
    /([\d-]+)/
  );

  const cuenta_origen = labeledValue(
    text,
    /cuenta de origen/i,
    /([^\n]+)/
  );

  const conceptoRaw = labeledValue(text, /concepto/i, /([^\n]+)/).split("\n")[0];
  const concepto_brou = cleanConcepto(conceptoRaw);

  if (!numero_operacion) {
    throw new Error(
      "No se encontró el número de operación. Verificá que sea un comprobante BROU «Transferencia a Otros Bancos»."
    );
  }
  if (!fecha) {
    throw new Error("No se pudo leer la fecha de realización del comprobante.");
  }
  if (importe_acreditar.valor <= 0) {
    throw new Error("No se pudo leer el importe a acreditar.");
  }

  return {
    numero_operacion,
    numero_transferencia,
    fecha,
    importe_acreditar,
    comision: comision && comision.valor > 0 ? comision : null,
    beneficiario_nombre,
    beneficiario_direccion,
    beneficiario_observaciones,
    banco_destino,
    cuenta_destino,
    concepto_brou,
    cuenta_origen,
  };
}

function etiquetaToRegex(etiqueta: string): RegExp {
  const escaped = etiqueta.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

/** Lee el valor de un campo del documento por su título (etiqueta). */
export function valorPorEtiqueta(text: string, etiqueta: string): string {
  if (!etiqueta.trim()) return "";
  const label = etiquetaToRegex(etiqueta);
  return labeledValue(text, label, /([^\n]+)/).split("\n")[0].trim();
}

/** Lee un importe del documento por su título (etiqueta). */
export function valorImportePorEtiqueta(text: string, etiqueta: string): BrouImporte | null {
  if (!etiqueta.trim()) return null;
  return labeledImporte(text, etiquetaToRegex(etiqueta));
}
