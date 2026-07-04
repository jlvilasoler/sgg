import type { VentasHubItem } from "./VentasHubTypes";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import { MenuAppIcon } from "../icons/MenuAppIcons";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import VentasHubNav from "./VentasHubNav";
import {
  VentasHubAsideSearchField,
  useVentasHubAsideSearch,
} from "./VentasHubAsideSearch";

export interface VentasIngresosResumen {
  ganado: number;
  agricultura: number;
  arrendamientos: number;
}

interface Props {
  apiOnline: boolean;
  resumen: VentasIngresosResumen;
  items: VentasHubItem[];
  puedeSimular?: boolean;
  onNavigate: (id: string) => void;
  onVolverInicio: () => void;
}

export default function VentasIngresosHub({
  apiOnline,
  resumen,
  items,
  puedeSimular = false,
  onNavigate,
  onVolverInicio,
}: Props) {
  const {
    busquedaModulos,
    setBusquedaModulos,
    busquedaInputRef,
    consultaActiva,
    itemsFiltrados,
    mostrarDashboard,
  } = useVentasHubAsideSearch(items);

  const totalRegistros =
    resumen.ganado + resumen.agricultura + resumen.arrendamientos;

  return (
    <div className="sg-hub">
      <aside className="sg-hub-aside" aria-label="Navegación Ingresos por ventas">
        <div className="sg-hub-aside-brand">
          <span className="sg-hub-aside-logo" aria-hidden>
            <MenuAppIcon id="ingresos_ventas" />
          </span>
          <div>
            <p className="sg-hub-aside-kicker">SGG · Ventas</p>
            <p className="sg-hub-aside-title">Ingresos por ventas</p>
          </div>
        </div>

        <VentasHubAsideSearchField
          value={busquedaModulos}
          onChange={setBusquedaModulos}
          inputRef={busquedaInputRef}
        />

        <VentasHubNav
          items={itemsFiltrados}
          activeId="menu"
          onNavigate={onNavigate}
          onVolverDashboard={() => {}}
          showDashboard={mostrarDashboard}
          showSubtitles={consultaActiva}
          navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
          ariaLabel="Módulos de ingresos por ventas"
        />

        {consultaActiva && !mostrarDashboard && itemsFiltrados.length === 0 ? (
          <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
        ) : null}

        <div className="sg-hub-aside-foot">
          <button
            type="button"
            className="sg-hub-nav-item sg-hub-nav-item--muted"
            onClick={onVolverInicio}
          >
            ‹ Volver al inicio
          </button>
        </div>
      </aside>

      <main className="sg-hub-main">
        <header className="sg-hub-main-head">
          <div>
            <h1 className="sg-hub-main-title">Dashboard</h1>
            <p className="sg-hub-main-sub">
              Ventas de ganado, agricultura, arrendamientos y catálogo de rubros de ingresos.
            </p>
          </div>
          <div className="sg-hub-main-actions">
            <span
              className={`sg-hub-status${apiOnline ? " sg-hub-status--online" : ""}`}
              role="status"
            >
              {apiOnline ? "API conectada" : "Sin conexión API"}
            </span>
            <button
              type="button"
              className="sg-hub-cta"
              onClick={() => onNavigate(puedeSimular ? "simulador_en_pie" : "ventas_ganado")}
            >
              {puedeSimular ? "Abrir simulador" : "Ver ganado cerrado"}
            </button>
          </div>
        </header>

        <section className="sg-hub-kpi-strip" aria-label="Indicadores generales">
          <SgHubKpi
            variant="dark"
            kicker="Operaciones cerradas"
            value={apiOnline ? totalRegistros : "—"}
            trend={
              apiOnline && totalRegistros > 0
                ? `${resumen.ganado} ganado · ${resumen.agricultura} agrícola`
                : undefined
            }
            hint="Ventas registradas desde los simuladores."
            bars={<SgMiniBars highlight="last" />}
          />
          <SgHubKpi
            kicker="Ganado"
            value={apiOnline ? resumen.ganado : "—"}
            hint="Ventas cerradas del simulador ganadero."
            bars={<SgMiniBars highlight="mid" />}
          />
          <SgHubKpi
            kicker="Arrendamientos"
            value={apiOnline ? resumen.arrendamientos : "—"}
            hint="Ingresos por arrendamiento y medianería."
            bars={<SgMiniBars />}
          />
        </section>

        <div className="sg-hub-panels">
          <section className="sg-hub-panel sg-hub-panel--modules" aria-labelledby="ventas-hub-mod-title">
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Accesos rápidos</p>
                <h2 id="ventas-hub-mod-title" className="sg-hub-panel-title">
                  Módulos de ingresos
                </h2>
              </div>
            </div>
            <div className="sg-hub-module-grid">
              {items.map((item) => {
                const theme = HUB_ICON_THEMES[item.icon];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="sg-hub-module-card"
                    onClick={() => onNavigate(item.id)}
                  >
                    <span
                      className="sg-hub-module-icon"
                      style={
                        {
                          "--sg-hub-icon-bg": theme?.accentSoft,
                          "--sg-hub-icon-fg": theme?.accent,
                        } as React.CSSProperties
                      }
                    >
                      <HubMenuIcon id={item.icon} />
                    </span>
                    <span className="sg-hub-module-copy">
                      <strong>{item.label}</strong>
                      <small>{item.subtitle}</small>
                    </span>
                    <span className="sg-hub-module-arrow" aria-hidden>
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sg-hub-panel sg-hub-panel--flow" aria-labelledby="ventas-hub-flow-title">
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Flujo recomendado</p>
                <h2 id="ventas-hub-flow-title" className="sg-hub-panel-title">
                  Cómo usar el módulo
                </h2>
              </div>
            </div>
            <ol className="sg-hub-flow-list">
              <li>
                <span className="sg-hub-flow-num">1</span>
                <div>
                  <strong>Simulador de ventas</strong>
                  <p>Cerrá operaciones de ganado, agricultura o arrendamiento.</p>
                </div>
              </li>
              <li>
                <span className="sg-hub-flow-num">2</span>
                <div>
                  <strong>Ingresos por ventas</strong>
                  <p>Consultá totales, filtros y detalle de cada operación cerrada.</p>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </main>
    </div>
  );
}
