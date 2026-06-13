import type { ParDivisa, TipoCambioInput } from "./divisas-db.js";

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseNum(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_");
}

const UYU_KEYS = new Set([
  "uyu_usd",
  "pesos_usd",
  "peso_usd",
  "pesos_uruguayos",
  "pesos",
  "uyu",
  "tc_uyu",
  "tc_usd_uyu",
]);

const BRL_KEYS = new Set([
  "brl_usd",
  "reales_usd",
  "real_usd",
  "reales",
  "brl",
  "tc_reales",
  "tc_brl",
]);

const PAR_KEYS: Record<string, ParDivisa> = {
  uyu_usd: "UYU_USD",
  pesos_usd: "UYU_USD",
  pesos_uruguayos_usd: "UYU_USD",
  brl_usd: "BRL_USD",
  reales_usd: "BRL_USD",
  reales_brasil_usd: "BRL_USD",
};

function detectDelimiter(line: string): string {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

export function parseDivisasText(content: string): TipoCambioInput[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines[0]);
  const split = (line: string) =>
    line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));

  const headers = split(lines[0]).map(normalizeHeader);
  const hasFecha = headers.includes("fecha") || headers.includes("date");
  const parIdx = headers.findIndex((h) => h === "par" || h === "divisa" || h === "tipo");
  const valorIdx = headers.findIndex(
    (h) => h === "valor" || h === "tc" || h === "tipo_cambio" || h === "cotizacion"
  );

  const rows: TipoCambioInput[] = [];

  if (hasFecha && parIdx >= 0 && valorIdx >= 0) {
    for (let i = 1; i < lines.length; i++) {
      const cols = split(lines[i]);
      const fecha = normalizeDate(cols[headers.indexOf("fecha")] ?? cols[headers.indexOf("date")] ?? "");
      const parRaw = normalizeHeader(cols[parIdx] ?? "");
      const par = PAR_KEYS[parRaw] ?? (parRaw.toUpperCase() as ParDivisa);
      const valor = parseNum(cols[valorIdx] ?? "");
      if (!fecha || !valor || (par !== "UYU_USD" && par !== "BRL_USD")) continue;
      rows.push({ fecha, par, valor });
    }
    return rows;
  }

  const fechaIdx = headers.findIndex((h) => h === "fecha" || h === "date");
  const uyuIdx = headers.findIndex((h) => UYU_KEYS.has(h));
  const brlIdx = headers.findIndex((h) => BRL_KEYS.has(h));

  const dataStart = hasFecha || uyuIdx >= 0 || brlIdx >= 0 ? 1 : 0;
  if (fechaIdx < 0 && dataStart === 1) {
    throw new Error(
      "El archivo debe tener columna fecha y columnas uyu_usd / brl_usd (o par + valor)"
    );
  }

  for (let i = dataStart; i < lines.length; i++) {
    const cols = split(lines[i]);
    const fecha = normalizeDate(
      fechaIdx >= 0 ? cols[fechaIdx] : cols[0]
    );
    if (!fecha) continue;

    if (uyuIdx >= 0) {
      const v = parseNum(cols[uyuIdx]);
      if (v) rows.push({ fecha, par: "UYU_USD", valor: v });
    }
    if (brlIdx >= 0) {
      const v = parseNum(cols[brlIdx]);
      if (v) rows.push({ fecha, par: "BRL_USD", valor: v });
    }
  }

  return rows;
}

export async function parseDivisasBuffer(
  buffer: Buffer,
  filename: string
): Promise<TipoCambioInput[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ";" });
    return parseDivisasText(csv);
  }
  return parseDivisasText(buffer.toString("utf8"));
}
