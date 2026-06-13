import type { TipoCambioInput } from "./divisas-db.js";

const BCU_URL =
  "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones";

/** Máximo ~365 días por consulta; usamos 330 para margen. */
const MAX_DIAS_POR_LOTE = 330;

export interface BcuImportOptions {
  /** Años hacia atrás desde hoy (por defecto 2). */
  anos?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  /** Si se indica, reemplaza el cálculo por años (p. ej. día siguiente al último guardado). */
  desde_ultima_guardada?: string;
}

export interface BcuImportResult {
  rows: TipoCambioInput[];
  rango: { desde: string; hasta: string };
  lotes: number;
  parseadas: number;
}

function isoHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function resolveRange(opts?: BcuImportOptions): { desde: string; hasta: string } {
  const hasta = (opts?.fecha_hasta?.trim() || isoHoy()).slice(0, 10);
  if (opts?.fecha_desde?.trim()) {
    return { desde: opts.fecha_desde.trim().slice(0, 10), hasta };
  }
  if (opts?.desde_ultima_guardada?.trim()) {
    return { desde: opts.desde_ultima_guardada.trim().slice(0, 10), hasta };
  }
  const anos = Math.min(Math.max(opts?.anos ?? 2, 1), 10);
  const desde = addDays(hasta, -Math.round(anos * 365.25));
  return { desde, hasta };
}

function buildSoapXml(fechaDesde: string, fechaHasta: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="Cotiza">
  <soapenv:Body>
    <ws:wsbcucotizaciones.Execute>
      <ws:Entrada>
        <ws:Moneda><ws:item>2225</ws:item></ws:Moneda>
        <ws:FechaDesde>${fechaDesde}</ws:FechaDesde>
        <ws:FechaHasta>${fechaHasta}</ws:FechaHasta>
        <ws:Grupo>2</ws:Grupo>
      </ws:Entrada>
    </ws:wsbcucotizaciones.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseBcuResponse(xml: string): TipoCambioInput[] {
  const err = xml.match(/<codigoerror>(\d+)<\/codigoerror>/)?.[1];
  if (err && err !== "0") {
    const msg =
      xml.match(/<mensaje>([^<]*)<\/mensaje>/)?.[1]?.trim() ||
      `BCU error ${err}`;
    throw new Error(msg);
  }

  const blocks = [
    ...xml.matchAll(
      /<datoscotizaciones\.dato[\s\S]*?<\/datoscotizaciones\.dato>/g
    ),
  ];
  const rows: TipoCambioInput[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const chunk = block[0];
    const fechaRaw = chunk.match(/<Fecha>([^<]+)<\/Fecha>/)?.[1]?.trim();
    const tcc = Number(chunk.match(/<TCC>([\d.]+)<\/TCC>/)?.[1]);
    if (!fechaRaw || !Number.isFinite(tcc) || tcc <= 0) continue;

    const fecha = normalizarFechaBcu(fechaRaw);
    if (!fecha || seen.has(fecha)) continue;
    seen.add(fecha);
    rows.push({ fecha, par: "UYU_USD", valor: tcc });
  }

  rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return rows;
}

/** BCU devuelve YYYY-MM-DD; acepta DD/MM/YYYY por si cambia. */
function normalizarFechaBcu(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

async function fetchBcuLote(
  fechaDesde: string,
  fechaHasta: string
): Promise<TipoCambioInput[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(BCU_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "Cotizaaction/AWSBCUCOTIZACIONES.Execute",
      },
      body: buildSoapXml(fechaDesde, fechaHasta),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`BCU respondió ${res.status}. Intentá más tarde.`);
    }
    const xml = await res.text();
    return parseBcuResponse(xml);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar el BCU.");
    }
    throw e instanceof Error ? e : new Error("Error al consultar el BCU.");
  } finally {
    clearTimeout(timer);
  }
}

function mergeRows(lotes: TipoCambioInput[][]): TipoCambioInput[] {
  const byFecha = new Map<string, TipoCambioInput>();
  for (const batch of lotes) {
    for (const row of batch) {
      byFecha.set(row.fecha, row);
    }
  }
  return [...byFecha.values()].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );
}

/** Cotización oficial USD (2225), grupo 2 — TCC: USD → pesos uruguayos (cuántos $U por 1 USD). */
export async function fetchBcuUsdUyu(
  opts?: BcuImportOptions
): Promise<BcuImportResult> {
  const { desde, hasta } = resolveRange(opts);
  if (desde > hasta) {
    return {
      rows: [],
      rango: { desde, hasta },
      lotes: 0,
      parseadas: 0,
    };
  }

  const lotesRows: TipoCambioInput[][] = [];
  let cur = desde;
  let lotes = 0;

  while (cur <= hasta) {
    let chunkEnd = addDays(cur, MAX_DIAS_POR_LOTE - 1);
    if (chunkEnd > hasta) chunkEnd = hasta;
    const batch = await fetchBcuLote(cur, chunkEnd);
    if (batch.length) {
      lotesRows.push(batch);
      lotes++;
    }
    if (chunkEnd >= hasta) break;
    cur = addDays(chunkEnd, 1);
  }

  const rows = mergeRows(lotesRows);
  if (!rows.length) {
    return {
      rows: [],
      rango: { desde, hasta },
      lotes: 0,
      parseadas: 0,
    };
  }

  return {
    rows,
    rango: { desde: rows[0].fecha, hasta: rows[rows.length - 1].fecha },
    lotes,
    parseadas: rows.length,
  };
}
