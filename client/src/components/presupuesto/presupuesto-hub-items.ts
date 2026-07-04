import type { SgHubItem } from "../hub/SgHubTypes";

export const PRESUPUESTO_HUB_ITEMS: SgHubItem[] = [
  {
    id: "registro",
    label: "Ingresar gasto",
    subtitle: "Cargar gasto en PRESUPUESTO",
    icon: "prov_ingresar",
  },
  {
    id: "listado",
    label: "Presupuesto",
    subtitle: "Ver y editar gastos",
    icon: "prov_listado",
  },
  {
    id: "resumen",
    label: "Control de Gestión",
    subtitle: "Presupuestos por Empresa y Rubro",
    icon: "config_responsables",
  },
];

export const PRESUPUESTO_HUB_META: Record<
  (typeof PRESUPUESTO_HUB_ITEMS)[number]["id"],
  { title: string; subtitle: string }
> = {
  registro: {
    title: "Registrar gasto",
    subtitle: "Carga de gastos en el presupuesto con rubros, proveedores y documentos.",
  },
  listado: {
    title: "Listado de gastos",
    subtitle: "Consultá, filtrá, editá y eliminá registros del presupuesto.",
  },
  resumen: {
    title: "Control de Gestión",
    subtitle: "Presupuestos por empresa y rubro — seguimiento y comparación.",
  },
};

export type PresupuestoVista = (typeof PRESUPUESTO_HUB_ITEMS)[number]["id"];
