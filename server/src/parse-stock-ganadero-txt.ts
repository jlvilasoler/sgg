import { splitEidVid } from "./stock-ganadero-id.js";

/** Fila parseada desde exportación de bastón / lector RFID. */
export interface StockGanaderoRowInput {
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
  empresa?: "GUAVIYU" | "CHIVILCOY" | "";
}

function normalizeHeader(cell: string): string {
  return cell
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";")) return ";";
  if (line.includes(",")) return ",";
  return "\t";
}

function splitLine(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t");
  return line.split(delim).map((c) => c.trim());
}

/** Fechas con barra: día/mes/año (Uruguay y región). Ej. 08/12/2023 → 8 dic 2023. */
function parseSlashDate(value: string): string {
  const s = value.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  const d = Number(day);
  const mo = Number(month);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return `${m[3]}-${month}-${day}`;
}

/** Tru-Test CSV usa AAAA-MM-DD; otros exports usan DD/MM/AAAA. */
function parseFecha(value: string): string {
  const s = value.trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  return parseSlashDate(s);
}

function parseTime(value: string): string {
  const s = value.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return s;
  const h = m[1].padStart(2, "0");
  const min = m[2].padStart(2, "0");
  const sec = (m[3] ?? "00").padStart(2, "0");
  return `${h}:${min}:${sec}`;
}

type ColMap = {
  eid: number;
  vid: number;
  fecha: number;
  hora: number;
  condicion: number;
};

function mapColumns(headers: string[]): ColMap | null {
  const norm = headers.map(normalizeHeader);
  const find = (...keys: string[]) =>
    norm.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));

  const eid = find("eid");
  const vid = find("vid");
  const fecha = find("date", "fecha");
  const hora = find("time", "hora");
  const condicion = find("condicion", "condition", "cond");

  if (eid < 0 || fecha < 0) return null;
  return {
    eid,
    vid: vid >= 0 ? vid : -1,
    fecha,
    hora: hora >= 0 ? hora : -1,
    condicion: condicion >= 0 ? condicion : -1,
  };
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return row[idx]?.trim() ?? "";
}

/** Parsea texto exportado del lector (cabecera EID, VID, Date, Time, Condición). */
export function parseStockGanaderoText(text: string): StockGanaderoRowInput[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const lines = rawLines.filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const firstCells = splitLine(lines[0], delim);
  let colMap = mapColumns(firstCells);
  let startIdx = 0;

  if (colMap) {
    startIdx = 1;
  } else {
    colMap = { eid: 0, vid: 1, fecha: 2, hora: 3, condicion: 4 };
  }

  const out: StockGanaderoRowInput[] = [];
  const errors: string[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const eidRaw = cell(cells, colMap.eid);
    if (!eidRaw) continue;

    const fecha = parseFecha(cell(cells, colMap.fecha));
    if (!fecha) {
      errors.push(`Línea ${i + 1}: fecha inválida`);
      continue;
    }

    const horaRaw = cell(cells, colMap.hora);
    const { eid, vid } = splitEidVid(eidRaw, cell(cells, colMap.vid));
    out.push({
      eid,
      vid,
      fecha,
      hora: horaRaw ? parseTime(horaRaw) : "",
      condicion: cell(cells, colMap.condicion),
    });
  }

  if (!out.length && errors.length) {
    throw new Error(errors.slice(0, 3).join(". "));
  }
  if (!out.length) {
    throw new Error(
      "No se encontraron filas válidas. Verificá que el archivo tenga columnas EID, Date y Time."
    );
  }

  return out;
}

/** Normaliza filas enviadas desde carga manual (formulario). */
export function normalizeStockGanaderoRows(
  raw: Array<{
    eid?: string;
    vid?: string;
    fecha?: string;
    hora?: string;
    condicion?: string;
    empresa?: string;
  }>
): StockGanaderoRowInput[] {
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error("Agregá al menos una lectura válida.");
  }

  const out: StockGanaderoRowInput[] = [];
  const errors: string[] = [];

  raw.forEach((row, idx) => {
    const eidRaw = String(row.eid ?? "").trim();
    if (!eidRaw) {
      errors.push(`Fila ${idx + 1}: EID obligatorio`);
      return;
    }
    const fecha = parseFecha(String(row.fecha ?? ""));
    if (!fecha) {
      errors.push(`Fila ${idx + 1}: fecha inválida`);
      return;
    }
    const horaRaw = String(row.hora ?? "").trim();
    const empresaRaw = String(row.empresa ?? "").trim().toUpperCase();
    const empresa =
      empresaRaw === "GUAVIYU" || empresaRaw === "CHIVILCOY" ? empresaRaw : "";
    const { eid, vid } = splitEidVid(eidRaw, String(row.vid ?? "").trim());
    out.push({
      eid,
      vid,
      fecha,
      hora: horaRaw ? parseTime(horaRaw) : "",
      condicion: String(row.condicion ?? "").trim(),
      empresa,
    });
  });

  if (!out.length) {
    throw new Error(errors.slice(0, 3).join(". ") || "No hay lecturas válidas.");
  }
  if (errors.length) {
    throw new Error(errors.slice(0, 3).join(". "));
  }
  return out;
}

export function parseStockGanaderoBuffer(buffer: Buffer): StockGanaderoRowInput[] {
  let text = buffer.toString("utf8");
  if (text.includes("\uFFFD") || /CONDICIÃ/.test(text)) {
    text = buffer.toString("latin1");
  }
  return parseStockGanaderoText(text);
}
