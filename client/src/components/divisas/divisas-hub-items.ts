import { DIVISAS_MONEDA_LIST } from "../divisas/divisas-config";
import type { SgHubItem } from "../hub/SgHubTypes";

export const DIVISAS_HUB_ITEMS: SgHubItem[] = DIVISAS_MONEDA_LIST.map((m) => ({
  id: m.id,
  label: m.titulo,
  subtitle: m.subtitulo,
  icon: m.icon,
}));

export function divisasHubMeta(id: string): { title: string; subtitle: string } | undefined {
  const m = DIVISAS_MONEDA_LIST.find((x) => x.id === id);
  if (!m) return undefined;
  return { title: m.titulo, subtitle: m.subtitulo };
}
