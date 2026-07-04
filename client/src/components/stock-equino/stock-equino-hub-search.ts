import type { StockEquinoHubItem } from "./StockEquinoHub";

export function normalizarBusquedaModulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function coincideModuloHub(item: StockEquinoHubItem, consulta: string): boolean {
  const q = normalizarBusquedaModulo(consulta);
  if (!q) return true;
  const blob = normalizarBusquedaModulo(`${item.label} ${item.subtitle} ${item.id}`);
  return blob.includes(q);
}

export function filtrarModulosHub(
  items: StockEquinoHubItem[],
  consulta: string,
): StockEquinoHubItem[] {
  return items.filter((item) => coincideModuloHub(item, consulta));
}

export function mostrarDashboardEnBusquedaModulos(consulta: string): boolean {
  const q = normalizarBusquedaModulo(consulta);
  if (!q) return true;
  return normalizarBusquedaModulo("dashboard").includes(q);
}
