import type { ReactNode } from "react";
import { useMemo } from "react";
import SgHubNav from "./SgHubNav";
import type { SgHubItem, SgHubNavSection } from "./SgHubTypes";
import { SgHubAsideSearchField, useSgHubAsideSearch } from "./SgHubAsideSearch";

interface Props {
  activeId: string;
  items: SgHubItem[];
  navSections?: SgHubNavSection[];
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
  asideBrandExtra?: ReactNode;
  navAriaLabel?: string;
  showDashboardInNav?: boolean;
  showAsideNav?: boolean;
  children: ReactNode;
  className?: string;
  hubClassName?: string;
}

export default function SgHubShell({
  activeId,
  items,
  navSections = [],
  onNavigate,
  onVolverDashboard,
  onVolverInicio,
  apiOnline: _apiOnline,
  title,
  subtitle,
  headerActions,
  sidebarExtra,
  asideKicker = "SAG",
  asideTitle = "Módulo",
  asideLogo,
  asideBrandExtra,
  navAriaLabel,
  showDashboardInNav = true,
  showAsideNav = true,
  children,
  className = "",
  hubClassName = "",
}: Props) {
  const allNavItems = useMemo(
    () => [...navSections.flatMap((section) => section.items), ...items],
    [navSections, items]
  );

  const {
    busquedaModulos,
    setBusquedaModulos,
    busquedaInputRef,
    consultaActiva,
    itemsFiltrados,
    mostrarDashboard,
  } = useSgHubAsideSearch(allNavItems);

  return (
    <div
      className={`sg-hub sg-hub--module${hubClassName ? ` ${hubClassName}` : ""}${className ? ` ${className}` : ""}`}
    >
      <aside className="sg-hub-aside sg-hub-aside--module" aria-label={navAriaLabel ?? asideTitle}>
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
          {asideBrandExtra ? (
            <div className="sg-hub-aside-brand-extra">{asideBrandExtra}</div>
          ) : null}
        </div>

        {showAsideNav ? (
          <>
            <SgHubAsideSearchField
              value={busquedaModulos}
              onChange={setBusquedaModulos}
              inputRef={busquedaInputRef}
            />

            <SgHubNav
              items={consultaActiva ? itemsFiltrados : items}
              sections={consultaActiva ? [] : navSections}
              activeId={activeId}
              onNavigate={onNavigate}
              onVolverDashboard={onVolverDashboard}
              showDashboard={showDashboardInNav && mostrarDashboard}
              showSubtitles={consultaActiva}
              navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
              ariaLabel={navAriaLabel}
            />

            {consultaActiva && !mostrarDashboard && itemsFiltrados.length === 0 ? (
              <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
            ) : null}
          </>
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
          <div className="sg-hub-main-actions">{headerActions}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
