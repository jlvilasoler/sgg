import type { SgHubItem } from "../hub/SgHubTypes";

export type NotasVistaId = "todas" | "mias" | "equipo";

export const NOTAS_HUB_ITEMS: SgHubItem[] = [
  {
    id: "todas",
    label: "Todas",
    subtitle: "Personales y compartidas del equipo",
    icon: "stock_lecturas",
  },
  {
    id: "mias",
    label: "Mías",
    subtitle: "Notas que creaste vos",
    icon: "resp_listado",
  },
  {
    id: "equipo",
    label: "Equipo",
    subtitle: "Notas que otros compartieron contigo",
    icon: "usuarios_permisos_rol",
  },
];

export function notasHubMeta(id: NotasVistaId): { title: string; subtitle: string } {
  const item = NOTAS_HUB_ITEMS.find((x) => x.id === id);
  return {
    title: item?.label ?? "Notas",
    subtitle: item?.subtitle ?? "Apuntes personales y compartidos con el equipo",
  };
}
