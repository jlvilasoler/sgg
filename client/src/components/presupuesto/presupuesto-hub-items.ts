import type { SgHubItem } from "../hub/SgHubTypes";

export const PRESUPUESTO_HUB_ITEMS: SgHubItem[] = [
  {
    id: "registro",
    label: "Ingresar gasto",
    subtitle: "Rubros · Proveedores · Documentos",
    icon: "prov_ingresar",
  },
  {
    id: "nota_credito",
    label: "Notas de crédito",
    subtitle: "Anular · Parcial · Por factura",
    icon: "presupuesto_nota_credito",
  },
  {
    id: "listado",
    label: "Presupuesto",
    subtitle: "Consultar · Filtrar · Editar",
    icon: "prov_listado",
  },
  {
    id: "automatizacion",
    label: "Automatización",
    subtitle: "Gastos rutinarios · Aprobación mensual",
    icon: "presupuesto_automatizacion",
  },
  {
    id: "resumen",
    label: "Control de Gestión",
    subtitle: "Por empresa · Por rubro",
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
  nota_credito: {
    title: "Notas de crédito",
    subtitle:
      "Anulá total o parcialmente una factura ya ingresada, vinculada al mismo proveedor.",
  },
  listado: {
    title: "Listado de gastos",
    subtitle: "Consultá, filtrá, editá y eliminá registros del presupuesto.",
  },
  automatizacion: {
    title: "Automatización",
    subtitle:
      "Programá gastos rutinarios. Cada mes el administrador de la cuenta aprueba el pago antes de registrarlo.",
  },
  resumen: {
    title: "Control de Gestión",
    subtitle: "Presupuestos por empresa y rubro — seguimiento y comparación.",
  },
};

export type PresupuestoVista = (typeof PRESUPUESTO_HUB_ITEMS)[number]["id"];
