import type { PrecioGanadoInput } from "./precios-ganado-db.js";
import { parseAcgSemanaMeta } from "./acg-ganado-gordo.js";

export const ACG_CATEGORIAS_REPOSICION = [
  "TERNERO",
  "TERNERA",
  "VACA_INVERNADA",
] as const;
export type AcgCategoriaReposicion = (typeof ACG_CATEGORIAS_REPOSICION)[number];

const CATEGORIA_HTML_LABEL: Record<AcgCategoriaReposicion, string> = {
  TERNERO: "Ternero",
  TERNERA: "Ternera",
  VACA_INVERNADA: "Vaca de Invernada",
};

export interface AcgGanadoReposicionFetchResult {
  semana: ReturnType<typeof parseAcgSemanaMeta>;
  rows: PrecioGanadoInput[];
}

function parseNumEs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractReposicionSection(html: string): string {
  const start = html.indexOf('<h1 class="text-center fw-700">Reposición</h1>');
  if (start < 0) {
    throw new Error("No se encontró la sección de promedios de reposición.");
  }
  const endMarkers = ["<!-- Mercado de reposición -->", '<h1 class="text-center fw-700">Faena</h1>'];
  let end = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, start + 40);
    if (idx > start && idx < end) end = idx;
  }
  return html.slice(start, end);
}

export function parseAcgCategoriaValorReposicion(
  sectionHtml: string,
  categoria: AcgCategoriaReposicion
): number | null {
  const label = CATEGORIA_HTML_LABEL[categoria];
  const re = new RegExp(
    `<h5[^>]*>\\s*${label}\\s*</h5>[\\s\\S]*?<h3[^>]*>\\s*([\\d.,]+)\\s*</h3>[\\s\\S]*?en pie`,
    "i"
  );
  const m = re.exec(sectionHtml);
  if (!m) return null;
  return parseNumEs(m[1]);
}

export function parseAcgGanadoReposicionHtml(
  html: string
): AcgGanadoReposicionFetchResult {
  const section = extractReposicionSection(html);
  const semana = parseAcgSemanaMeta(section);
  const rows: PrecioGanadoInput[] = [];

  for (const categoria of ACG_CATEGORIAS_REPOSICION) {
    const valor = parseAcgCategoriaValorReposicion(section, categoria);
    if (valor == null) {
      throw new Error(`No se encontró el precio de ${CATEGORIA_HTML_LABEL[categoria]}.`);
    }
    rows.push({
      anio: semana.anio,
      semana: semana.semana,
      fecha_desde: semana.fecha_desde,
      fecha_hasta: semana.fecha_hasta,
      segmento: "REPOSICION",
      categoria,
      valor,
      unidad: "USD_KG_EN_PIE",
      fuente: "ACG",
    });
  }

  return { semana, rows };
}

export async function fetchAcgGanadoReposicion(): Promise<AcgGanadoReposicionFetchResult> {
  const { fetchAcgHomeHtml } = await import("./acg-page.js");
  const html = await fetchAcgHomeHtml();
  if (!html.includes("Reposición")) {
    throw new Error(
      "No se pudo leer la sección de reposición. Intentá de nuevo más tarde."
    );
  }
  return parseAcgGanadoReposicionHtml(html);
}
