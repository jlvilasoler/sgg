import type { ReactNode } from "react";
import { StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";
import StockEquinoHubNav from "./StockEquinoHubNav";
import type { StockEquinoHubItem } from "./StockEquinoHub";
import {
  StockEquinoHubAsideSearchField,
  useStockEquinoAsideSearch,
} from "./StockEquinoHubAsideSearch";

interface Props {
  activeId: string;
  items: StockEquinoHubItem[];
  onNavigate: (id: string) => void;
  onVolverDashboard: () => void;
  onVolverInicio?: () => void;
  apiOnline: boolean;
  title: string;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  sidebarExtra?: ReactNode;
  asideKicker?: string;
  asideTitle?: string;
  children: ReactNode;
  className?: string;
  hubClassName?: string;
}

export default function StockEquinoHubShell({
  activeId,
  items,
  onNavigate,
  onVolverDashboard,
  onVolverInicio,
  apiOnline,
  title,
  subtitle,
  headerActions,
  sidebarExtra,
  asideKicker = "SGG · Dispositivos",
  asideTitle = "Stock Equino",
  children,
  className = "",
  hubClassName = "",
}: Props) {
  const {
    busquedaModulos,
    setBusquedaModulos,
    busquedaInputRef,
    consultaActiva,
    itemsFiltrados,
    mostrarDashboard,
  } = useStockEquinoAsideSearch(items);

  return (
    <div className={`sg-hub sg-hub--module${hubClassName ? ` ${hubClassName}` : ""}${className ? ` ${className}` : ""}`}>
      <aside className="sg-hub-aside sg-hub-aside--module" aria-label="Navegación Stock Equino">
        <div className="sg-hub-aside-brand">
          <span className="sg-hub-aside-logo" aria-hidden>
            <StockEquinoModuleIcon size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="sg-hub-aside-kicker">{asideKicker}</p>
            <p className="sg-hub-aside-title">{asideTitle}</p>
          </div>
        </div>

        <StockEquinoHubAsideSearchField
          value={busquedaModulos}
          onChange={setBusquedaModulos}
          inputRef={busquedaInputRef}
        />

        <StockEquinoHubNav
          items={itemsFiltrados}
          activeId={activeId}
          onNavigate={onNavigate}
          onVolverDashboard={onVolverDashboard}
          showDashboard={mostrarDashboard}
          showSubtitles={consultaActiva}
          navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
        />

        {consultaActiva && !mostrarDashboard && itemsFiltrados.length === 0 ? (
          <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
        ) : null}

        {sidebarExtra}

        {onVolverInicio ? (
          <div className="sg-hub-aside-foot">
            <button
              type="button"
              className="sg-hub-nav-item sg-hub-nav-item--muted"
              onClick={onVolverInicio}
            >
              ‹ Volver al inicio
            </button>
          </div>
        ) : null}
      </aside>

      <main className="sg-hub-main sg-hub-main--module">
        <header className="sg-hub-main-head">
          <div>
            <h1 className="sg-hub-main-title">{title}</h1>
            {subtitle ? <p className="sg-hub-main-sub">{subtitle}</p> : null}
          </div>
          <div className="sg-hub-main-actions">
            {headerActions}
            <span
              className={`sg-hub-status${apiOnline ? " sg-hub-status--online" : ""}`}
              role="status"
            >
              {apiOnline ? "API conectada" : "Sin conexión API"}
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
