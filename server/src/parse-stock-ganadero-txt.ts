import { splitEidVid } from "./stock-ganadero-id.js";

/** Fila parseada desde exportación de bastón / lector RFID. */
export interface StockGanaderoRowInput {
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
  empresa?: "GUAVIYU" | "CHIVILCOY" | "";
  sexo?: "MACHO" | "HEMBRA" | "";
}

/** Convierte el sexo de exports (M/H) al formato interno. */
function parseSexoCelda(value: string): "MACHO" | "HEMBRA" | "" {
  const s = value.trim().toUpperCase();
  if (s === "M" || s === "MACHO") return "MACHO";
  if (s === "H" || s === "HEMBRA" || s === "F" || s === "HEMBRA") return "HEMBRA";
  return "";
}

function fechaHoyIso(): string {
  return new Date().toISOString().slice(0, 10);
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
  sexo: number;
};

function mapColumns(headers: string[]): ColMap | null {
  const norm = headers.map(normalizeHeader);
  const find = (...keys: string[]) =>
    norm.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));

  // "caravana" es el encabezado del export SNIG (trazabilidad), equivalente al EID.
  const eid = find("eid", "caravana");
  const vid = find("vid");
  const fecha = find("date", "fecha");
  const hora = find("time", "hora");
  const condicion = find("condicion", "condition", "cond");
  const sexo = find("sexo", "sex");

  // El SNIG no trae fecha por fila; basta con identificar la caravana/EID.
  if (eid < 0) return null;
  return {
    eid,
    vid: vid >= 0 ? vid : -1,
    fecha: fecha >= 0 ? fecha : -1,
    hora: hora >= 0 ? hora : -1,
    condicion: condicion >= 0 ? condicion : -1,
    sexo: sexo >= 0 ? sexo : -1,
  };
}

function cell(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return row[idx]?.trim() ?? "";
}

/** Parsea texto exportado del lector (cabecera EID/Caravana, VID, Date, Time, Condición, Sexo). */
export function parseStockGanaderoText(text: string): StockGanaderoRowInput[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd());
  const lines = rawLines.filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  // Algunos exports (SNIG) traen metadatos arriba; buscamos la fila de encabezado.
  let colMap: ColMap | null = null;
  let delim = "\t";
  let startIdx = 0;
  const maxBusqueda = Math.min(lines.length, 60);
  for (let i = 0; i < maxBusqueda; i++) {
    const d = detectDelimiter(lines[i]);
    const m = mapColumns(splitLine(lines[i], d));
    if (m) {
      colMap = m;
      delim = d;
      startIdx = i + 1;
      break;
    }
  }

  if (!colMap) {
    // Sin encabezado reconocible: formato posicional EID, VID, Date, Time, Condición.
    delim = detectDelimiter(lines[0]);
    colMap = { eid: 0, vid: 1, fecha: 2, hora: 3, condicion: 4, sexo: -1 };
    startIdx = 0;
  }

  const hoy = fechaHoyIso();
  const out: StockGanaderoRowInput[] = [];
  const errors: string[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    const eidRaw = cell(cells, colMap.eid);
    // Saltar filas de pie de página / metadatos (la caravana siempre es numérica).
    if (!eidRaw || !/\d/.test(eidRaw)) continue;

    let fecha = hoy;
    if (colMap.fecha >= 0) {
      const f = parseFecha(cell(cells, colMap.fecha));
      if (!f) {
        errors.push(`Línea ${i + 1}: fecha inválida`);
        continue;
      }
      fecha = f;
    }

    const horaRaw = cell(cells, colMap.hora);
    const { eid, vid } = splitEidVid(eidRaw, cell(cells, colMap.vid));
    out.push({
      eid,
      vid,
      fecha,
      hora: horaRaw ? parseTime(horaRaw) : "",
      condicion: cell(cells, colMap.condicion),
      sexo: colMap.sexo >= 0 ? parseSexoCelda(cell(cells, colMap.sexo)) : "",
    });
  }

  if (!out.length && errors.length) {
    throw new Error(errors.slice(0, 3).join(". "));
  }
  if (!out.length) {
    throw new Error(
      "No se encontraron filas válidas. Verificá que el archivo tenga una columna EID o Caravana."
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

/** Detecta firma ZIP (xlsx) o el flag .xls para usar el parser de Excel. */
function esArchivoExcel(buffer: Buffer, filename: string): boolean {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return true;
  // xlsx es un zip: empieza con "PK" (0x50 0x4B).
  return buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

/** Parsea archivo de stock soportando .txt, .csv y .xlsx/.xls (export Tru-Test o SNIG). */
export async function parseStockGanaderoFile(
  buffer: Buffer,
  filename: string
): Promise<StockGanaderoRowInput[]> {
  if (esArchivoExcel(buffer, filename)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) {
      throw new Error("El archivo Excel no tiene hojas con datos.");
    }
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", blankrows: false });
    return parseStockGanaderoText(csv);
  }
  return parseStockGanaderoBuffer(buffer);
}
