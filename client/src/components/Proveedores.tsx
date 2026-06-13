import { useState } from "react";
import type { Proveedor } from "../types";
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

const SUBMENU = [
  {
    id: "ingresar" as const,
    label: "Ingresar proveedor",
    subtitle: "Alta o edición en PROVEEDORES",
    icon: "➕",
    color: "#2d6a4f",
  },
  {
    id: "listado" as const,
    label: "Listado proveedores",
    subtitle: "Buscar, editar y eliminar",
    icon: "📑",
    color: "#1d4e89",
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
          <button
            key={item.id}
            type="button"
            className="app-card-btn"
            onClick={() => (item.id === "ingresar" ? abrirIngresar() : abrirListado())}
          >
            <span
              className="app-card-icon"
              style={{ background: `linear-gradient(145deg, ${item.color}, ${item.color}bb)` }}
            >
              <span className="app-icon-emoji" aria-hidden>
                {item.icon}
              </span>
            </span>
            <span className="app-card-text">
              <span className="app-card-label">{item.label}</span>
              <span className="app-card-sub">{item.subtitle}</span>
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
