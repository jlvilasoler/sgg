import { useCallback, useEffect, useState } from "react";
import { fetchProveedores, fetchSiguienteCodProveedor } from "../api";
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
    subtitle: "Alta o edición en el catálogo de la cuenta",
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
  const [stats, setStats] = useState({ total: 0, proximoCod: 0 });

  const cargarStats = useCallback(async () => {
    if (!apiOnline) {
      setStats({ total: 0, proximoCod: 0 });
      return;
    }
    try {
      const [rows, proximoCod] = await Promise.all([
        fetchProveedores(""),
        fetchSiguienteCodProveedor(),
      ]);
      setStats({ total: rows.length, proximoCod });
    } catch {
      setStats({ total: 0, proximoCod: 0 });
    }
  }, [apiOnline]);

  useEffect(() => {
    if (vista === "menu") void cargarStats();
  }, [vista, cargarStats, listRefresh]);

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

  const onSaved = () => {
    setListRefresh((k) => k + 1);
    if (editProveedor) volverMenu();
  };

  if (vista === "ingresar") {
    return (
      <ProveedorIngresar
        key={editProveedor?.id ?? "nuevo"}
        apiOnline={apiOnline}
        editProveedor={editProveedor}
        onSaved={onSaved}
        onCancelEdit={() => setEditProveedor(null)}
        onEditarExistente={(p) => setEditProveedor(p)}
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
    <div className="subseccion-panel responsable-module proveedores-module">
      {onVolver && (
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Configuración
        </button>
      )}

      <div className="card responsable-module-hub-card">
        <header className="responsable-module-hero">
          <div className="responsable-module-hero-main">
            <div className="responsable-module-hero-icon" aria-hidden>
              <HubMenuIcon id="config_proveedores" className="menu-app-icon-svg" />
            </div>
            <div className="responsable-module-hero-body">
              <span className="responsable-module-kicker">Configuración</span>
              <h2>Proveedores</h2>
              <p>
                Catálogo de proveedores de su cuenta. Los códigos son correlativos e independientes
                por cuenta; se usan al registrar gastos y documentos.
              </p>
            </div>
          </div>
          <div className="responsable-module-stats" aria-label="Resumen del catálogo">
            <div className="responsable-module-stat">
              <span className="responsable-module-stat-val">
                {apiOnline ? stats.total : "—"}
              </span>
              <span className="responsable-module-stat-label">Registrados</span>
            </div>
            <div className="responsable-module-stat">
              <span className="responsable-module-stat-val">
                {apiOnline ? stats.proximoCod : "—"}
              </span>
              <span className="responsable-module-stat-label">Próx. código</span>
            </div>
          </div>
        </header>

        <nav className="responsable-module-actions" aria-label="Proveedores">
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
    </div>
  );
}
