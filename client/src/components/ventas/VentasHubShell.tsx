import type { ReactNode } from "react";
import VentasHubNav from "./VentasHubNav";
import type { VentasHubItem } from "./VentasHubTypes";
import {
  VentasHubAsideSearchField,
  useVentasHubAsideSearch,
} from "./VentasHubAsideSearch";

interface Props {
  activeId: string;
  items: VentasHubItem[];
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
  asideLogo?: ReactNode;
  navAriaLabel?: string;
  children: ReactNode;
  className?: string;
  hubClassName?: string;
}

export default function VentasHubShell({
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
  asideKicker = "SAG",
  asideTitle = "Ingresos por ventas",
  asideLogo,
  navAriaLabel,
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
  } = useVentasHubAsideSearch(items);

  return (
    <div
      className={`sg-hub sg-hub--module${hubClassName ? ` ${hubClassName}` : ""}${className ? ` ${className}` : ""}`}
    >
      <aside className="sg-hub-aside sg-hub-aside--module" aria-label="Navegación ventas">
        <div className="sg-hub-aside-brand">
          {asideLogo ? (
            <span className="sg-hub-aside-logo" aria-hidden>
              {asideLogo}
            </span>
          ) : null}
          <div>
            <p className="sg-hub-aside-kicker">{asideKicker}</p>
            <p className="sg-hub-aside-title">{asideTitle}</p>
          </div>
        </div>

        <VentasHubAsideSearchField
          value={busquedaModulos}
          onChange={setBusquedaModulos}
          inputRef={busquedaInputRef}
        />

        <VentasHubNav
          items={itemsFiltrados}
          activeId={activeId}
          onNavigate={onNavigate}
          onVolverDashboard={onVolverDashboard}
          showDashboard={mostrarDashboard}
          showSubtitles={consultaActiva}
          navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
          ariaLabel={navAriaLabel}
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
