import {
  BROU_CAMPO_IDS,
  type BrouCampoId,
} from "./gasto-campos.js";

export const BROU_CAMPO_LABELS: Record<BrouCampoId, string> = {
  numero_operacion: "Número de la operación",
  numero_transferencia: "Número de transferencia",
  fecha: "Fecha de realización",
  importe_acreditar: "Importe a acreditar",
  comision: "Comisiones y gastos",
  beneficiario_nombre: "Beneficiario — nombre completo",
  beneficiario_direccion: "Beneficiario — dirección",
  beneficiario_observaciones: "Beneficiario — observaciones",
  banco_destino: "Banco de destino",
  cuenta_destino: "Cuenta de destino",
  cuenta_origen: "Cuenta de origen",
  concepto_brou: "Concepto",
};

/** Textos alternativos que aparecen en comprobantes BROU reales. */
const BROU_ETIQUETA_ALIASES: Partial<Record<BrouCampoId, string[]>> = {
  fecha: ["fecha de realizacion", "fecha contable", "fecha de solicitud"],
  beneficiario_nombre: ["nombre completo"],
  beneficiario_direccion: ["direccion"],
  beneficiario_observaciones: ["observaciones"],
  banco_destino: ["banco"],
  comision: ["comisiones y gastos"],
  importe_acreditar: ["importe a acreditar", "importe a debitar"],
  concepto_brou: ["concepto"],
  numero_operacion: ["numero de la operacion"],
  numero_transferencia: ["numero de transferencia"],
  cuenta_destino: ["cuenta de destino"],
  cuenta_origen: ["cuenta de origen"],
};

export interface CampoDocumentoDetectado {
  etiqueta: string;
  valor_muestra: string;
  campo_id: BrouCampoId | null;
  coincidencia_exacta: boolean;
}

function normalizeEtiqueta(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyValor(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^\d{15,}$/.test(t.replace(/\s/g, ""))) return true;
  if (/^(U\s*\$?\s*S|US\$|\$)\s*[\d.,]+/i.test(t)) return true;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(t)) return true;
  if (/^CA\s+\d/i.test(t)) return true;
  if (/^\d{10,}$/.test(t.replace(/[-\s]/g, ""))) return true;
  return false;
}

function isLikelyEtiqueta(s: string): boolean {
  const t = s.trim();
  if (!t || t.length < 3) return false;
  if (isLikelyValor(t)) return false;
  if (/^(mobile|canal|beneficiario|informacion brindada|--|\d+ of \d+)/i.test(t)) return false;
  if (/se ha procesado|sistemas del banco/i.test(t)) return false;
  return /[a-záéíóúñ]/i.test(t);
}

function resolverCampoId(etiqueta: string): { id: BrouCampoId | null; exacta: boolean } {
  const norm = normalizeEtiqueta(etiqueta);

  for (const id of BROU_CAMPO_IDS) {
    if (normalizeEtiqueta(BROU_CAMPO_LABELS[id]) === norm) {
      return { id, exacta: true };
    }
  }

  for (const id of BROU_CAMPO_IDS) {
    const aliases = BROU_ETIQUETA_ALIASES[id] ?? [];
    if (aliases.some((a) => normalizeEtiqueta(a) === norm)) {
      return { id, exacta: true };
    }
  }

  for (const id of BROU_CAMPO_IDS) {
    const canon = normalizeEtiqueta(BROU_CAMPO_LABELS[id]);
    if (norm.includes(canon) || canon.includes(norm)) {
      return { id, exacta: false };
    }
  }

  return { id: null, exacta: false };
}

function extraerPares(text: string): { etiqueta: string; valor: string }[] {
  const rawLines = text.replace(/\r/g, "\n").split("\n");
  const pairs: { etiqueta: string; valor: string }[] = [];
  const seen = new Set<string>();

  const push = (etiqueta: string, valor: string) => {
    const e = etiqueta.trim();
    const v = valor.trim();
    if (!e || !v || !isLikelyEtiqueta(e)) return;
    const key = `${normalizeEtiqueta(e)}|${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ etiqueta: e, valor: v });
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    if (line.includes("\t")) {
      const parts = line.split("\t").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const [a, b] = parts;
        if (isLikelyEtiqueta(b) && isLikelyValor(a)) push(b, a);
        else if (isLikelyEtiqueta(a) && isLikelyValor(b)) push(a, b);
        else if (isLikelyEtiqueta(b)) push(b, a);
        else if (isLikelyEtiqueta(a)) push(a, b);
      }
      continue;
    }

    const colon = line.match(/^(.+?)\s*:\s*(.+)$/);
    if (colon && isLikelyEtiqueta(colon[1])) {
      push(colon[1], colon[2]);
      continue;
    }

    if (isLikelyEtiqueta(line)) {
      if (i > 0 && isLikelyValor(rawLines[i - 1].trim())) {
        push(line, rawLines[i - 1].trim());
      } else if (i + 1 < rawLines.length && isLikelyValor(rawLines[i + 1].trim())) {
        push(line, rawLines[i + 1].trim());
      }
    }
  }

  return pairs;
}

/** Detecta pares etiqueta→valor en el texto del comprobante. */
export function detectarCamposDocumento(raw: string): CampoDocumentoDetectado[] {
  const pares = extraerPares(raw);
  const byId = new Map<BrouCampoId, CampoDocumentoDetectado>();
  const sinCatalogo: CampoDocumentoDetectado[] = [];

  for (const { etiqueta, valor } of pares) {
    const { id, exacta } = resolverCampoId(etiqueta);
    const row: CampoDocumentoDetectado = {
      etiqueta,
      valor_muestra: valor,
      campo_id: id,
      coincidencia_exacta: exacta,
    };

    if (id) {
      const prev = byId.get(id);
      if (!prev || (exacta && !prev.coincidencia_exacta)) {
        byId.set(id, row);
      }
    } else {
      sinCatalogo.push(row);
    }
  }

  const out = [...byId.values()].sort((a, b) =>
    a.etiqueta.localeCompare(b.etiqueta, "es")
  );
  sinCatalogo.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));

  return [...out, ...sinCatalogo];
}
