import type { TabId } from "../components/Header";

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
  campo_mapa: "Mapa del campo",
  tareas_operativas: "Tareas operativas",
  stock_equino: "Stock Equino",
  stock_movimientos: "Movimientos de Dispositivos",
  registro_actividad: "Registro de actividad",
  notas: "Notas",
  usuarios: "Usuarios",
  panel_admin_sitio: "Administración del sitio",
  chat: "Chat",
  ayuda: "Ayuda",
  asistente: "Asistente",
  documentos_digitales: "Documentos Digitales",
};

export function getScreenTitle(id: TabId): string {
  return SCREEN_TITLES[id];
}
