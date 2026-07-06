import type { ReactNode } from "react";
import { StockGanaderoModuleIcon } from "./StockControlSanitarioSectionTitle";
import StockGanaderoHubNav from "./StockGanaderoHubNav";
import type { StockGanaderoHubItem } from "./StockGanaderoHub";
import {
  StockGanaderoHubAsideSearchField,
  useStockGanaderoAsideSearch,
} from "./StockGanaderoHubAsideSearch";

interface Props {
  activeId: string;
  items: StockGanaderoHubItem[];
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

export default function StockGanaderoHubShell({
  activeId,
  items,
  onNavigate,
  onVolverDashboard,
  onVolverInicio,
  apiOnline: _apiOnline,
  title,
  subtitle,
  headerActions,
  sidebarExtra,
  asideKicker = "SAG",
  asideTitle = "Stock Ganadero",
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
  } = useStockGanaderoAsideSearch(items);

  return (
    <div className={`sg-hub sg-hub--module${hubClassName ? ` ${hubClassName}` : ""}${className ? ` ${className}` : ""}`}>
      <aside className="sg-hub-aside sg-hub-aside--module" aria-label="Navegación Stock Ganadero">
        <div className="sg-hub-aside-brand">
          <span className="sg-hub-aside-logo" aria-hidden>
            <StockGanaderoModuleIcon size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="sg-hub-aside-kicker">{asideKicker}</p>
            <p className="sg-hub-aside-title">{asideTitle}</p>
          </div>
        </div>

        <StockGanaderoHubAsideSearchField
          value={busquedaModulos}
          onChange={setBusquedaModulos}
          inputRef={busquedaInputRef}
        />

        <StockGanaderoHubNav
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
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
