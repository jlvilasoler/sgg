import type { ParDivisa, SemanaPreciosGanado, TipoCambio, CategoriaPrecioGanado } from "../types";
import {
  CATEGORIA_GANADO_GORDO_LABELS,
  CATEGORIA_GANADO_REPOSICION_LABELS,
} from "../types";
import { PRECIOS_GANADO_SEGMENTO_MAP } from "../components/precios-ganado/precios-ganado-config";
import { fmtNum } from "../components/divisas/divisas-utils";

export interface HomeTickerItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  changePct: number | null;
  group: "divisas" | "gordo" | "reposicion";
}

const PAR_SHORT: Record<ParDivisa, string> = {
  UYU_USD: "USD / UYU",
  BRL_USD: "USD / BRL",
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function variacionPct(actual: number, anterior: number | undefined): number | null {
  if (anterior == null || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

function buildDivisaItems(ultimos: TipoCambio[], historial: TipoCambio[]): HomeTickerItem[] {
  const items: HomeTickerItem[] = [];
  for (const u of ultimos) {
    const prev = historial
      .filter((r) => r.par === u.par && r.fecha < u.fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    const decimals = u.par === "UYU_USD" ? 4 : 4;
    items.push({
      id: `div-${u.par}`,
      label: PAR_SHORT[u.par],
      value: fmtNum(u.valor, decimals),
      changePct: variacionPct(u.valor, prev?.valor),
      group: "divisas",
    });
  }
  return items;
}

function buildGanadoItems(
  group: "gordo" | "reposicion",
  semanas: SemanaPreciosGanado[]
): HomeTickerItem[] {
  const segmento = group === "gordo" ? "GORDO" : "REPOSICION";
  const config = PRECIOS_GANADO_SEGMENTO_MAP[segmento];
  const labels =
    group === "gordo" ? CATEGORIA_GANADO_GORDO_LABELS : CATEGORIA_GANADO_REPOSICION_LABELS;
  const prefix = group === "gordo" ? "Gordo" : "Rep.";

  const sorted = [...semanas].sort((a, b) => b.fecha_hasta.localeCompare(a.fecha_hasta));
  const ultima = sorted[0];
  const anterior = sorted[1];
  if (!ultima) return [];

  return config.categorias.map((cat) => {
    const key = cat as CategoriaPrecioGanado;
    const valor = ultima.precios[key];
    const prev = anterior?.precios[key];
    return {
      id: `${group}-${cat}`,
      label: `${prefix} ${labels[cat as keyof typeof labels]}`,
      value: valor != null ? fmtNum(valor, 2) : "—",
      unit: valor != null ? "USD/kg" : undefined,
      changePct: valor != null ? variacionPct(valor, prev) : null,
      group,
    };
  });
}

export function buildHomeTickerItems(input: {
  ultimosDivisas: TipoCambio[];
  historialDivisas: TipoCambio[];
  semanasGordo: SemanaPreciosGanado[];
  semanasReposicion: SemanaPreciosGanado[];
}): HomeTickerItem[] {
  return [
    ...buildDivisaItems(input.ultimosDivisas, input.historialDivisas),
    ...buildGanadoItems("gordo", input.semanasGordo),
    ...buildGanadoItems("reposicion", input.semanasReposicion),
  ].filter((i) => i.value !== "—");
}

export function homeTickerFetchDesde(): string {
  return isoDaysAgo(21);
}
