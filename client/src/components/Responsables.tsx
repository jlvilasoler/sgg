import { useCallback, useEffect, useState } from "react";
import { fetchResponsables } from "../api";
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
    label: "Nueva asignación",
    subtitle: "Alta y edición de personas del catálogo",
    icon: "resp_ingresar",
  },
  {
    id: "listado",
    label: "Listado completo",
    subtitle: "Activar, editar o eliminar asignaciones",
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
  const [stats, setStats] = useState({ total: 0, activos: 0 });

  const cargarStats = useCallback(async () => {
    if (!apiOnline) {
      setStats({ total: 0, activos: 0 });
      return;
    }
    try {
      const rows = await fetchResponsables(false, { ambitoCuenta: true });
      setStats({
        total: rows.length,
        activos: rows.filter((r) => r.activo).length,
      });
    } catch {
      setStats({ total: 0, activos: 0 });
    }
  }, [apiOnline]);

  useEffect(() => {
    if (vista === "menu") void cargarStats();
  }, [vista, cargarStats, listRefresh]);

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
        onEditarExistente={(r) => setEditResponsable(r)}
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
    <div className="subseccion-panel responsable-module">
      {onVolver && (
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Configuración
        </button>
      )}

      <div className="card responsable-module-hub-card">
        <header className="responsable-module-hero">
          <div className="responsable-module-hero-main">
            <div className="responsable-module-hero-icon" aria-hidden>
              <HubMenuIcon id="config_responsables" className="menu-app-icon-svg" />
            </div>
            <div className="responsable-module-hero-body">
              <span className="responsable-module-kicker">Configuración</span>
              <h2>Asignación de presupuesto</h2>
              <p>
                Personas a quien se asigna el gasto al registrar operaciones. Solo los nombres{" "}
                <strong>activos</strong> aparecen en gastos y filtros.
              </p>
            </div>
          </div>
          <div className="responsable-module-stats" aria-label="Resumen del catálogo">
            <div className="responsable-module-stat">
              <span className="responsable-module-stat-val">
                {apiOnline ? stats.activos : "—"}
              </span>
              <span className="responsable-module-stat-label">Activos</span>
            </div>
            <div className="responsable-module-stat">
              <span className="responsable-module-stat-val">
                {apiOnline ? stats.total : "—"}
              </span>
              <span className="responsable-module-stat-label">Total</span>
            </div>
          </div>
        </header>

        <nav className="responsable-module-actions" aria-label="Asignación de presupuesto">
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
    </div>
  );
}
