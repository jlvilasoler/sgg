import type { TabId } from "./Header";
import type { AuthUser } from "../types";
import { canAccessScreen } from "../utils/auth-permissions";

export type ScreenId = "home" | TabId;

export interface MenuApp {
  id: TabId;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
}

export const MENU_APPS: MenuApp[] = [
  {
    id: "registro",
    label: "Ingresar gasto",
    subtitle: "Cargar gasto en PRESUPUESTO",
    icon: "📝",
    color: "#2d6a4f",
  },
  {
    id: "listado",
    label: "Presupuesto",
    subtitle: "Ver y editar gastos",
    icon: "📋",
    color: "#1d4e89",
  },
  {
    id: "resumen",
    label: "Resumen",
    subtitle: "Totales por empresa y rubro",
    icon: "📊",
    color: "#7b4b2a",
  },
  {
    id: "configuracion",
    label: "Configuración",
    subtitle: "Rubros, presupuesto asignado y proveedores",
    icon: "⚙️",
    color: "#5c6370",
  },
  {
    id: "divisas",
    label: "Divisas",
    subtitle: "USD → pesos y reales",
    icon: "💱",
    color: "#0d6e6e",
  },
  {
    id: "recursos_humanos",
    label: "Recursos Humanos",
    subtitle: "Funcionarios, sueldos y jornales",
    icon: "👥",
    color: "#6b3fa0",
  },
  {
    id: "ingresos_ventas",
    label: "Ingresos por ventas",
    subtitle: "Documentos e ingresos por ventas",
    icon: "💰",
    color: "#b8860b",
  },
  {
    id: "stock_ganadero",
    label: "Stock Ganadero",
    subtitle: "Importar lecturas EID desde archivo TXT",
    icon: "🐄",
    color: "#6b4423",
  },
  {
    id: "usuarios",
    label: "Usuarios",
    subtitle: "Cuentas, roles y permisos del sistema",
    icon: "🔐",
    color: "#3d4f5f",
  },
];

const SCREEN_TITLES: Record<TabId, string> = {
  registro: "Registrar gasto",
  listado: "Listado de gastos",
  resumen: "Resumen",
  configuracion: "Configuración",
  divisas: "Divisas",
  recursos_humanos: "Recursos Humanos",
  ingresos_ventas: "Ingresos por ventas",
  stock_ganadero: "Stock Ganadero",
  usuarios: "Usuarios y permisos",
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

  return (
    <div className="layout-frame home-menu-inner">
      <nav className="app-grid" aria-label="Menú principal">
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            className="app-card-btn"
            onClick={() => onOpen(app.id)}
          >
            <span
              className="app-card-icon"
              style={{ background: `linear-gradient(145deg, ${app.color}, ${app.color}bb)` }}
            >
              <span className="app-icon-emoji" aria-hidden>
                {app.icon}
              </span>
            </span>
            <span className="app-card-text">
              <span className="app-card-label">{app.label}</span>
              <span className="app-card-sub">{app.subtitle}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
