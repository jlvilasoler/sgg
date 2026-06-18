import { useState } from "react";
import type { Responsable } from "../types";
import { HubMenuCard } from "./HubMenuCard";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import ResponsableIngresar from "./responsables/ResponsableIngresar";
import ResponsableListado from "./responsables/ResponsableListado";

type VistaResponsables = "menu" | "ingresar" | "listado";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  /** Vuelve al menú de Configuración (si se abrió desde ahí). */
  onVolver?: () => void;
}

const SUBMENU: {
  id: "ingresar" | "listado";
  label: string;
  subtitle: string;
  icon: HubIconId;
}[] = [
  {
    id: "ingresar",
    label: "Ingresar nombre",
    subtitle: "Alta o edición en presupuesto asignado",
    icon: "resp_ingresar",
  },
  {
    id: "listado",
    label: "Listado nombres",
    subtitle: "Ver, activar/desactivar y eliminar",
    icon: "resp_listado",
  },
];

export default function Responsables({
  apiOnline,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
}: Props) {
  const [vista, setVista] = useState<VistaResponsables>("menu");
  const [editResponsable, setEditResponsable] = useState<Responsable | null>(null);
  const [listRefresh, setListRefresh] = useState(0);

  const volverMenu = () => {
    setVista("menu");
    setEditResponsable(null);
  };

  const onSaved = () => {
    setListRefresh((k) => k + 1);
    onCatalogosChanged();
    if (editResponsable) volverMenu();
  };

  if (vista === "ingresar") {
    return (
      <ResponsableIngresar
        key={editResponsable?.id ?? "nuevo"}
        apiOnline={apiOnline}
        editResponsable={editResponsable}
        onSaved={onSaved}
        onCancelEdit={() => setEditResponsable(null)}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "listado") {
    return (
      <ResponsableListado
        key={listRefresh}
        apiOnline={apiOnline}
        onEdit={(r) => {
          setEditResponsable(r);
          setVista("ingresar");
        }}
        onError={onError}
        onSuccess={(m) => {
          onSuccess(m);
          onCatalogosChanged();
        }}
        onVolver={volverMenu}
      />
    );
  }

  return (
    <div className="proveedores-hub">
      {onVolver && (
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Configuración
        </button>
      )}
      <p className="muted hub-intro">
        Administrá las personas del <strong>presupuesto asignado</strong>. Solo los nombres{" "}
        <strong>activos</strong> aparecen al registrar gastos y en los filtros del listado.
      </p>
      <nav className="app-grid app-grid-2" aria-label="Opciones de presupuesto asignado">
        {SUBMENU.map((item) => (
          <HubMenuCard
            key={item.id}
            label={item.label}
            subtitle={item.subtitle}
            theme={HUB_ICON_THEMES[item.icon]}
            icon={<HubMenuIcon id={item.icon} />}
            onClick={() => {
              setEditResponsable(null);
              setVista(item.id);
            }}
          />
        ))}
      </nav>
    </div>
  );
}
