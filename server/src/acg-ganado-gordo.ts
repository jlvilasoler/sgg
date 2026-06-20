import type { PrecioGanadoInput } from "./precios-ganado-db.js";
import { fetchAcgHomeHtml } from "./acg-page.js";

export const ACG_CATEGORIAS_GORDO = ["NOVILLO", "VACA", "VAQUILLONA"] as const;
export type AcgCategoriaGordo = (typeof ACG_CATEGORIAS_GORDO)[number];

const CATEGORIA_HTML_LABEL: Record<AcgCategoriaGordo, string> = {
  NOVILLO: "Novillo",
  VACA: "Vaca",
  VAQUILLONA: "Vaquillona",
};

export interface AcgSemanaMeta {
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
}

export interface AcgGanadoGordoFetchResult {
  semana: AcgSemanaMeta;
  rows: PrecioGanadoInput[];
  fuente: "ACG";
}

function parseNumEs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFechaUy(dd: string, mm: string, yyyy: string): string {
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function extractGanadoGordoSection(html: string): string {
  const start = html.indexOf("Ganado gordo (Promedios)");
  if (start < 0) {
    throw new Error("No se encontró la sección de promedios de ganado gordo.");
  }
  const endMarkers = ["<h6", "Ovinos", "id=\"ovinos\"", "Indice ternero"];
  let end = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, start + 40);
    if (idx > start && idx < end) end = idx;
  }
  return html.slice(start, end);
}

export function parseAcgSemanaMeta(sectionHtml: string): AcgSemanaMeta {
  const re =
    /semana\s*N[°º]?\s*(\d+)[\s\S]*?\(del\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\)/i;
  const m = re.exec(sectionHtml);
  if (!m) {
    throw new Error("No se pudo leer la semana y fechas de los promedios.");
  }
  const fecha_desde = parseFechaUy(m[2], m[3], m[4]);
  const fecha_hasta = parseFechaUy(m[5], m[6], m[7]);
  return {
    semana: Number(m[1]),
    anio: Number(m[7]),
    fecha_desde,
    fecha_hasta,
  };
}

export function parseAcgCategoriaValor(
  sectionHtml: string,
  categoria: AcgCategoriaGordo
): number | null {
  const label = CATEGORIA_HTML_LABEL[categoria];
  const re = new RegExp(
    `<h5[^>]*>\\s*${label}\\s*</h5>[\\s\\S]*?<h3[^>]*>\\s*([\\d.,]+)\\s*</h3>[\\s\\S]*?cuarta balanza`,
    "i"
  );
  const m = re.exec(sectionHtml);
  if (!m) return null;
  return parseNumEs(m[1]);
}

export function parseAcgGanadoGordoHtml(html: string): AcgGanadoGordoFetchResult {
  const section = extractGanadoGordoSection(html);
  const semana = parseAcgSemanaMeta(section);
  const rows: PrecioGanadoInput[] = [];

  for (const categoria of ACG_CATEGORIAS_GORDO) {
    const valor = parseAcgCategoriaValor(section, categoria);
    if (valor == null) {
      throw new Error(`No se encontró el precio de ${CATEGORIA_HTML_LABEL[categoria]}.`);
    }
    rows.push({
      anio: semana.anio,
      semana: semana.semana,
      fecha_desde: semana.fecha_desde,
      fecha_hasta: semana.fecha_hasta,
      segmento: "GORDO",
      categoria,
      valor,
      unidad: "USD_KG_CUARTA_BALANZA",
      fuente: "ACG",
    });
  }

  return { semana, rows, fuente: "ACG" };
}

export async function fetchAcgGanadoGordo(): Promise<AcgGanadoGordoFetchResult> {
  const html = await fetchAcgHomeHtml();
  if (!html.includes("Ganado gordo (Promedios)")) {
    throw new Error(
      "No se pudo leer la sección de ganado gordo. Intentá de nuevo más tarde."
    );
  }
  return parseAcgGanadoGordoHtml(html);
}
