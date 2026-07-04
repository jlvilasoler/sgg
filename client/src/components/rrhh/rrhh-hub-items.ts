import type { SgHubItem } from "../hub/SgHubTypes";

export const RRHH_HUB_ITEMS: SgHubItem[] = [
  {
    id: "funcionarios",
    label: "Funcionarios",
    subtitle: "Datos personales y cuenta bancaria",
    icon: "rrhh_funcionarios",
  },
  {
    id: "sueldos",
    label: "Sueldos y Jornales",
    subtitle: "Pagos por cédula y resumen de gastos",
    icon: "rrhh_sueldos",
  },
];

export const RRHH_HUB_META: Record<
  (typeof RRHH_HUB_ITEMS)[number]["id"] | "funcionario-form",
  { title: string; subtitle: string }
> = {
  funcionarios: {
    title: "Funcionarios",
    subtitle: "Alta, edición y listado de colaboradores vinculados a gastos por cédula.",
  },
  sueldos: {
    title: "Sueldos y Jornales",
    subtitle: "Pagos por cédula y resumen de gastos del personal.",
  },
  "funcionario-form": {
    title: "Funcionario",
    subtitle: "Datos personales, contacto y cuenta bancaria.",
  },
};
