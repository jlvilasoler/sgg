import type { AuthUser } from "../../types";
import {
  canAccessIngresosVentasModulo,
  canAccessSimuladorVentaGanado,
} from "../../utils/auth-permissions";
import type { VentasHubItem } from "./VentasHubTypes";

export const INGRESOS_VENTAS_REGISTRO_ITEMS: VentasHubItem[] = [
  {
    id: "ventas_ganado",
    label: "Ventas de ganado cerradas",
    subtitle: "Ventas cerradas del simulador con totales",
    icon: "ventas_ganado_cerradas",
  },
  {
    id: "ventas_agricultura",
    label: "Ventas Agricultura",
    subtitle: "Ventas cerradas desde el simulador agrícola",
    icon: "ventas_agricultura",
  },
  {
    id: "ventas_arrendamientos",
    label: "Ingresos por Arrendamientos",
    subtitle: "Arrendamientos, medianería y uso de campos",
    icon: "ventas_arrendamientos",
  },
];

export const SIMULADOR_NAV_CHILDREN: VentasHubItem[] = [
  {
    id: "simulador_ganado",
    label: "Ventas de Ganado",
    subtitle: "En pie y cuarta balanza · precios ACG",
    icon: "ventas_ganado",
    children: [
      {
        id: "simulador_en_pie",
        label: "Venta en pie",
        subtitle: "Ternero · Ternera · Vaca invernada",
        icon: "ventas_ganado",
      },
      {
        id: "simulador_cuarta_balanza",
        label: "Venta en cuarta balanza",
        subtitle: "Novillo · Vaca · Vaquillona",
        icon: "ventas_ganado",
      },
    ],
  },
  {
    id: "simulador_agricultura",
    label: "Ventas Agrícolas",
    subtitle: "Cultivos, has y rendimiento estimado",
    icon: "ventas_agricultura",
  },
  {
    id: "simulador_arrendamientos",
    label: "Ingresos por Arrendamientos",
    subtitle: "Arrendamientos, medianería y uso de campos",
    icon: "ventas_arrendamientos",
  },
];

const SIMULADOR_HUB_ITEM: VentasHubItem = {
  id: "simulador",
  label: "Simulador de ventas",
  subtitle: "Simular ingresos por ventas de ganado, agricultura y arrendamientos",
  icon: "ventas_ingresar",
  children: SIMULADOR_NAV_CHILDREN,
};

export const SIMULADOR_VISTA_IDS = [
  "simulador_en_pie",
  "simulador_cuarta_balanza",
  "simulador_agricultura",
  "simulador_arrendamientos",
] as const;

export type SimuladorVistaId = (typeof SIMULADOR_VISTA_IDS)[number];

export function isSimuladorVistaId(id: string): id is SimuladorVistaId {
  return (SIMULADOR_VISTA_IDS as readonly string[]).includes(id);
}

export const SIMULADOR_VISTA_DEFAULT: SimuladorVistaId = "simulador_en_pie";

export function buildIngresosVentasSubmenu(user: AuthUser): VentasHubItem[] {
  const items: VentasHubItem[] = [];
  if (canAccessSimuladorVentaGanado(user)) {
    items.push(SIMULADOR_HUB_ITEM);
  }
  if (canAccessIngresosVentasModulo(user)) {
    items.push(...INGRESOS_VENTAS_REGISTRO_ITEMS);
  }
  return items;
}

export function dashboardVentasHubItems(user: AuthUser): VentasHubItem[] {
  const items: VentasHubItem[] = [];
  if (canAccessSimuladorVentaGanado(user)) {
    items.push({
      id: SIMULADOR_VISTA_DEFAULT,
      label: SIMULADOR_HUB_ITEM.label,
      subtitle: SIMULADOR_HUB_ITEM.subtitle,
      icon: SIMULADOR_HUB_ITEM.icon,
    });
  }
  if (canAccessIngresosVentasModulo(user)) {
    items.push(...INGRESOS_VENTAS_REGISTRO_ITEMS);
  }
  return items;
}
