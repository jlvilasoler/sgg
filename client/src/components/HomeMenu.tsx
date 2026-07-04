import type { TabId } from "./Header";
import type { AuthUser } from "../types";
import {
  canAccessScreen,
} from "../utils/auth-permissions";
import { HubMenuCard } from "./HubMenuCard";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";
import { prefetchVencimientosImpuestos } from "../utils/vencimientos-impuestos-cache";
import { useVencImpProximosBadge } from "../hooks/useVencImpProximosBadge";

export type ScreenId = "home" | TabId;

export interface MenuApp {
  id: TabId;
  label: string;
  subtitle: string;
}

export const MENU_APPS: MenuApp[] = [
  {
    id: "registro",
    label: "Presupuesto y gastos",
    subtitle: "Ingresar, ver y editar gastos",
  },
  {
    id: "vencimientos_impuestos",
    label: "Vencimientos Impuestos",
    subtitle: "Cuotas y fechas de tributos",
  },
  {
    id: "configuracion",
    label: "Configuración",
    subtitle: "Rubros, presupuesto asignado y proveedores",
  },
  {
    id: "divisas",
    label: "Divisas",
    subtitle: "USD → pesos y reales",
  },
  {
    id: "precios_ganado",
    label: "Precios de Ganado",
    subtitle: "Gordo y reposición (USD/kg)",
  },
  {
    id: "ingresos_ventas",
    label: "Ingresos por ventas",
    subtitle: "Simulador, ingresos cerrados y rubros",
  },
  {
    id: "recursos_humanos",
    label: "Recursos Humanos",
    subtitle: "Funcionarios, sueldos y jornales",
  },
  {
    id: "stock_ganadero",
    label: "Stock Ganadero",
    subtitle: "Importar lecturas EID desde archivo o carga manual",
  },
  {
    id: "stock_equino",
    label: "Stock Equino",
    subtitle: "Importar lecturas EID de equinos desde archivo o carga manual",
  },
  {
    id: "registro_actividad",
    label: "Registro de actividad",
    subtitle: "Historial de accesos y acciones en el sistema",
  },
  {
    id: "chat",
    label: "Chat",
    subtitle: "Mensajes con el equipo y mensajes directos",
  },
];

const SCREEN_TITLES: Record<TabId, string> = {
  registro: "Registrar gasto",
  listado: "Listado de gastos",
  vencimientos_impuestos: "Vencimientos Impuestos",
  resumen: "Resumen",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador de Ventas",
  recursos_humanos: "Recursos Humanos",
  ingresos_ventas: "Ingresos por ventas",
  stock_ganadero: "Stock Ganadero",
  stock_equino: "Stock Equino",
  stock_movimientos: "Movimientos de Dispositivos",
  registro_actividad: "Registro de actividad",
  usuarios: "Usuarios",
  panel_admin_sitio: "Administración del sitio",
  chat: "Chat",
  documentos_digitales: "Documentos Digitales",
};

export function getScreenTitle(id: TabId): string {
  return SCREEN_TITLES[id];
}

interface Props {
  user: AuthUser;
  onOpen: (id: TabId) => void;
}

export default function HomeMenu({ user, onOpen }: Props) {
  const apps = MENU_APPS.filter((app) => canAccessScreen(user, app.id));
  const vencProximosCount = useVencImpProximosBadge();

  return (
    <div className="layout-frame home-menu-inner">
      <nav className="app-grid" aria-label="Menú principal">
        {apps.map((app) => (
          <HubMenuCard
            key={app.id}
            label={app.label}
            subtitle={app.subtitle}
            theme={MENU_APP_THEMES[app.id]}
            icon={<MenuAppIcon id={app.id} className="menu-app-icon-svg" />}
            badgeCount={app.id === "vencimientos_impuestos" ? vencProximosCount : 0}
            onClick={() => onOpen(app.id)}
            onMouseEnter={
              app.id === "vencimientos_impuestos" ? prefetchVencimientosImpuestos : undefined
            }
            onFocus={
              app.id === "vencimientos_impuestos" ? prefetchVencimientosImpuestos : undefined
            }
          />
        ))}
      </nav>
    </div>
  );
}
