import type { ParDivisa, TipoCambioInput } from "./divisas-db.js";

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X";

export interface YahooImportOptions {
  anos?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  desde_ultima_guardada?: string;
}

export interface YahooImportResult {
  rows: TipoCambioInput[];
  rango: { desde: string; hasta: string };
  parseadas: number;
}

function isoHoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function resolveRange(opts?: YahooImportOptions): { desde: string; hasta: string } {
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

function isoToUnix(iso: string): number {
  return Math.floor(new Date(`${iso}T12:00:00Z`).getTime() / 1000);
}

/** Reales brasileños por 1 USD (USDBRL=X, cierre diario). */
export async function fetchYahooUsdBrl(
  opts?: YahooImportOptions
): Promise<YahooImportResult> {
  const { desde, hasta } = resolveRange(opts);
  if (desde > hasta) {
    return { rows: [], rango: { desde, hasta }, parseadas: 0 };
  }

  const period1 = isoToUnix(desde);
  const period2 = isoToUnix(addDays(hasta, 1));
  const url = `${CHART_URL}?period1=${period1}&period2=${period2}&interval=1d`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let json: unknown;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SGG/1.0)" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Yahoo Finance respondió ${res.status}. Intentá más tarde.`);
    }
    json = await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Tiempo de espera agotado al consultar Yahoo Finance.");
    }
    throw e instanceof Error ? e : new Error("No se pudo obtener el histórico BRL/USD.");
  } finally {
    clearTimeout(timer);
  }

  const result = json as {
    chart?: { result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }> };
  };
  const block = result.chart?.result?.[0];
  const timestamps = block?.timestamp ?? [];
  const closes = block?.indicators?.quote?.[0]?.close ?? [];

  const rows: TipoCambioInput[] = [];
  const par: ParDivisa = "BRL_USD";

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null || !Number.isFinite(close) || close <= 0) continue;
    const d = new Date(timestamps[i] * 1000);
    const fecha = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (fecha < desde || fecha > hasta) continue;
    rows.push({ fecha, par, valor: close });
  }

  rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!rows.length) {
    return { rows: [], rango: { desde, hasta }, parseadas: 0 };
  }

  return {
    rows,
    rango: { desde: rows[0].fecha, hasta: rows[rows.length - 1].fecha },
    parseadas: rows.length,
  };
}
