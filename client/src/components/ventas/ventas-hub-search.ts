import type { VentasHubItem } from "./VentasHubTypes";

export function normalizarBusquedaModuloVentas(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function itemBlob(item: VentasHubItem): string {
  return normalizarBusquedaModuloVentas(`${item.label} ${item.subtitle} ${item.id}`);
}

export function coincideModuloVentasHub(item: VentasHubItem, consulta: string): boolean {
  const q = normalizarBusquedaModuloVentas(consulta);
  if (!q) return true;
  if (itemBlob(item).includes(q)) return true;
  return item.children?.some((child) => coincideModuloVentasHub(child, consulta)) ?? false;
}

function flattenMatches(items: VentasHubItem[], consulta: string): VentasHubItem[] {
  const out: VentasHubItem[] = [];
  for (const item of items) {
    const childMatches = item.children?.length
      ? flattenMatches(item.children, consulta)
      : [];
    const selfMatch = itemBlob(item).includes(normalizarBusquedaModuloVentas(consulta));
    if (item.children?.length) {
      if (childMatches.length) out.push(...childMatches);
      else if (selfMatch) out.push(item);
    } else if (selfMatch) {
      out.push(item);
    }
  }
  return out;
}

export function filtrarModulosVentasHub(items: VentasHubItem[], consulta: string): VentasHubItem[] {
  const q = normalizarBusquedaModuloVentas(consulta);
  if (!q) return items;
  return flattenMatches(items, consulta);
}

export function mostrarDashboardEnBusquedaVentas(consulta: string): boolean {
  const q = normalizarBusquedaModuloVentas(consulta);
  if (!q) return true;
  return normalizarBusquedaModuloVentas("dashboard").includes(q);
}
