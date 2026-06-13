import type { TipoCambioInput } from "./divisas-db.js";

const PAGE_URL =
  "https://es.investing.com/currencies/usd-uyu-historical-data";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  Referer: "https://es.investing.com/",
};

export interface InvestingImportOptions {
  /** YYYY-MM-DD — filtra filas parseadas (la web suele devolver ~1 mes). */
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface InvestingImportResult {
  rows: TipoCambioInput[];
  /** Filas leídas de la página antes de filtrar por fechas. */
  parseadas: number;
  /** Rango de fechas en la tabla HTML. */
  rango_html?: { desde: string; hasta: string };
  aviso?: string;
}

function parseNumEs(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Último precio (columna «Último») por fila del histórico USD/UYU. */
export function parseInvestingUsdUyuHtml(html: string): TipoCambioInput[] {
  const re =
    /<time\s+dateTime="(\d{2})\.(\d{2})\.(\d{4})">[\s\S]*?dir="ltr">([\d.,]+)<\/td>/gi;
  const rows: TipoCambioInput[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const fecha = `${m[3]}-${m[2]}-${m[1]}`;
    const valor = parseNumEs(m[4]);
    if (!valor || seen.has(fecha)) continue;
    seen.add(fecha);
    rows.push({ fecha, par: "UYU_USD", valor });
  }

  rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return rows;
}

function buildPageUrl(opts?: InvestingImportOptions): string {
  if (!opts?.fecha_desde && !opts?.fecha_hasta) return PAGE_URL;
  const params = new URLSearchParams();
  if (opts.fecha_desde) params.set("st_date", opts.fecha_desde);
  if (opts.fecha_hasta) params.set("end_date", opts.fecha_hasta);
  params.set("interval_sec", "daily");
  return `${PAGE_URL}?${params}`;
}

function filterByRange(
  rows: TipoCambioInput[],
  opts?: InvestingImportOptions
): TipoCambioInput[] {
  let out = rows;
  if (opts?.fecha_desde) {
    out = out.filter((r) => r.fecha >= opts.fecha_desde!);
  }
  if (opts?.fecha_hasta) {
    out = out.filter((r) => r.fecha <= opts.fecha_hasta!);
  }
  return out;
}

export async function fetchInvestingUsdUyu(
  opts?: InvestingImportOptions
): Promise<InvestingImportResult> {
  const url = buildPageUrl(opts);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  let html: string;
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(
        `Investing.com respondió ${res.status}. Intentá de nuevo en unos minutos.`
      );
    }
    html = await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al conectar con Investing.com.");
    }
    throw e instanceof Error
      ? e
      : new Error("No se pudo obtener el histórico desde Investing.com.");
  } finally {
    clearTimeout(timer);
  }

  if (!html.includes("dateTime=") && html.length < 50_000) {
    throw new Error(
      "Investing.com no devolvió la tabla histórica (posible bloqueo). Probá más tarde."
    );
  }

  const parsed = parseInvestingUsdUyuHtml(html);
  if (!parsed.length) {
    throw new Error(
      "No se encontraron cotizaciones en la página. Puede que Investing haya cambiado el formato."
    );
  }

  const filtered = filterByRange(parsed, opts);
  const rango_html = {
    desde: parsed[0].fecha,
    hasta: parsed[parsed.length - 1].fecha,
  };

  let aviso: string | undefined;
  if (parsed.length < 5) {
    aviso = "Se importó poca cantidad de días; verificá la conexión o el sitio.";
  } else if (parsed.length <= 31) {
    aviso =
      "Investing.com muestra en la página aproximadamente el último mes. Para años anteriores usá «Importar archivo» o repetí esta importación cada mes.";
  }

  if (opts?.fecha_desde || opts?.fecha_hasta) {
    if (!filtered.length) {
      throw new Error(
        `No hay datos en Investing.com para el rango solicitado. En la página figuran fechas del ${rango_html.desde} al ${rango_html.hasta}.`
      );
    }
  }

  return {
    rows: filtered,
    parseadas: parsed.length,
    rango_html,
    aviso,
  };
}
