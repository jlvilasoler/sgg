import { useState } from "react";
import type { Proveedor } from "../types";
import { HubMenuCard } from "./HubMenuCard";
import type { HubIconId } from "./icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "./icons/HubMenuIcons";
import ProveedorIngresar from "./proveedores/ProveedorIngresar";
import ProveedorListado from "./proveedores/ProveedorListado";

type VistaProveedores = "menu" | "ingresar" | "listado";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
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
    label: "Ingresar proveedor",
    subtitle: "Alta o edición en PROVEEDORES",
    icon: "prov_ingresar",
  },
  {
    id: "listado",
    label: "Listado proveedores",
    subtitle: "Buscar, editar y eliminar",
    icon: "prov_listado",
  },
];

export default function Proveedores({ apiOnline, onError, onSuccess, onVolver }: Props) {
  const [vista, setVista] = useState<VistaProveedores>("menu");
  const [editProveedor, setEditProveedor] = useState<Proveedor | null>(null);
  const [listRefresh, setListRefresh] = useState(0);

  const volverMenu = () => {
    setVista("menu");
    setEditProveedor(null);
  };

  const abrirIngresar = () => {
    setEditProveedor(null);
    setVista("ingresar");
  };

  const abrirListado = () => {
    setVista("listado");
  };

  const editarDesdeListado = (p: Proveedor) => {
    setEditProveedor(p);
    setVista("ingresar");
  };

  const irListado = () => {
    setEditProveedor(null);
    setVista("listado");
  };

  if (vista === "ingresar") {
    return (
      <ProveedorIngresar
        key={editProveedor?.id ?? "nuevo"}
        apiOnline={apiOnline}
        editProveedor={editProveedor}
        onSaved={() => {
          setListRefresh((k) => k + 1);
          if (editProveedor) volverMenu();
        }}
        onCancelEdit={() => setEditProveedor(null)}
        onVerListado={irListado}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={volverMenu}
      />
    );
  }

  if (vista === "listado") {
    return (
      <ProveedorListado
        key={listRefresh}
        apiOnline={apiOnline}
        onEdit={editarDesdeListado}
        onError={onError}
        onSuccess={onSuccess}
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
      <nav className="app-grid app-grid-2" aria-label="Opciones de proveedores">
        {SUBMENU.map((item) => (
          <HubMenuCard
            key={item.id}
            label={item.label}
            subtitle={item.subtitle}
            theme={HUB_ICON_THEMES[item.icon]}
            icon={<HubMenuIcon id={item.icon} />}
            onClick={() => (item.id === "ingresar" ? abrirIngresar() : abrirListado())}
          />
        ))}
      </nav>
    </div>
  );
}
