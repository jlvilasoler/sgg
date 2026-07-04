import { PRECIOS_GANADO_SEGMENTOS } from "./precios-ganado-config";
import type { SgHubItem } from "../hub/SgHubTypes";

export const PRECIOS_GANADO_HUB_ITEMS: SgHubItem[] = PRECIOS_GANADO_SEGMENTOS.map((s) => ({
  id: s.id,
  label: s.titulo,
  subtitle: s.subtitulo,
  icon: s.id === "GORDO" ? "divisas_usd" : "divisas_brl",
}));

export function preciosGanadoHubMeta(id: string): { title: string; subtitle: string } | undefined {
  const s = PRECIOS_GANADO_SEGMENTOS.find((x) => x.id === id);
  if (!s) return undefined;
  return { title: s.titulo, subtitle: s.subtitulo };
}
