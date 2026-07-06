import { Bell } from "lucide-react";
import type { HubIconId } from "../icons/HubMenuIcons";
import { HUB_ICON_THEMES, HubMenuIcon } from "../icons/HubMenuIcons";
import { StockGanaderoModuleIcon } from "./StockControlSanitarioSectionTitle";
import { SgHubKpi, SgMiniBars } from "./SgHubUi";
import StockGanaderoHubNav from "./StockGanaderoHubNav";
import {
  StockGanaderoHubAsideSearchField,
  useStockGanaderoAsideSearch,
} from "./StockGanaderoHubAsideSearch";

export interface StockGanaderoHubItem {
  id: string;
  label: string;
  subtitle: string;
  icon: HubIconId;
}

interface Resumen {
  lotes: number;
  registros: number;
  dispositivos: number;
}

interface Props {
  apiOnline: boolean;
  resumen: Resumen;
  items: StockGanaderoHubItem[];
  onNavigate: (id: string) => void;
  onVolverInicio: () => void;
}

export default function StockGanaderoHub({
  apiOnline,
  resumen,
  items,
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
  } = useStockGanaderoAsideSearch(items);

  const primaryIds = new Set(["ganadera", "importar", "sanidad", "salidas"]);
  const primaryItems = items.filter((i) => primaryIds.has(i.id));
  const secondaryItems = items.filter((i) => !primaryIds.has(i.id));

  return (
    <div className="sg-hub">
      <aside className="sg-hub-aside" aria-label="Navegación Stock Ganadero">
        <div className="sg-hub-aside-brand">
          <span className="sg-hub-aside-logo" aria-hidden>
            <StockGanaderoModuleIcon size={20} strokeWidth={1.75} />
          </span>
          <div>
            <p className="sg-hub-aside-kicker">SAG</p>
            <p className="sg-hub-aside-title">Stock Ganadero</p>
          </div>
        </div>

        <StockGanaderoHubAsideSearchField
          value={busquedaModulos}
          onChange={setBusquedaModulos}
          inputRef={busquedaInputRef}
        />

        <StockGanaderoHubNav
          items={itemsFiltrados}
          activeId="menu"
          onNavigate={onNavigate}
          onVolverDashboard={() => {}}
          showDashboard={mostrarDashboard}
          showSubtitles={consultaActiva}
          navLabel={consultaActiva ? `Resultados (${itemsFiltrados.length})` : "Principal"}
        />
        {consultaActiva && !mostrarDashboard && itemsFiltrados.length === 0 ? (
          <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
        ) : null}

        <div className="sg-hub-aside-foot">
          <button type="button" className="sg-hub-nav-item sg-hub-nav-item--muted" onClick={onVolverInicio}>
            ‹ Volver al inicio
          </button>
        </div>
      </aside>

      <main className="sg-hub-main">
        <header className="sg-hub-main-head">
          <div>
            <h1 className="sg-hub-main-title">Dashboard</h1>
            <p className="sg-hub-main-sub">
              Identificación electrónica (EID), stock activo, salidas y sanidad en un solo lugar.
            </p>
          </div>
          <div className="sg-hub-main-actions">
            <button type="button" className="sg-hub-icon-btn" aria-label="Notificaciones">
              <Bell size={18} />
            </button>
            <button type="button" className="sg-hub-cta" onClick={() => onNavigate("ganadera")}>
              Ver dispositivos
            </button>
          </div>
        </header>

        <section className="sg-hub-kpi-strip" aria-label="Indicadores">
          <SgHubKpi
            variant="dark"
            kicker="Dispositivos activos"
            value={apiOnline ? resumen.dispositivos : "—"}
            trend={apiOnline && resumen.dispositivos > 0 ? "En stock hoy" : undefined}
            hint="Caravanas electrónicas únicas registradas en la base."
            bars={<SgMiniBars highlight="last" />}
          />
          <SgHubKpi
            kicker="Lecturas importadas"
            value={apiOnline ? resumen.registros : "—"}
            hint="Registros acumulados desde archivos del lector RFID."
            bars={<SgMiniBars highlight="mid" />}
          />
          <SgHubKpi
            kicker="Lotes de importación"
            value={apiOnline ? resumen.lotes : "—"}
            hint="Archivos .txt procesados en el sistema."
            bars={<SgMiniBars />}
          />
        </section>

        <div className="sg-hub-panels">
          <section className="sg-hub-panel sg-hub-panel--modules" aria-labelledby="sg-hub-mod-title">
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Accesos rápidos</p>
                <h2 id="sg-hub-mod-title" className="sg-hub-panel-title">
                  Módulos principales
                </h2>
              </div>
            </div>
            <div className="sg-hub-module-grid sg-hub-module-grid--primary">
              {primaryItems.map((item) => {
                const theme = HUB_ICON_THEMES[item.icon];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="sg-hub-module-card sg-hub-module-card--featured"
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

          <section className="sg-hub-panel sg-hub-panel--flow" aria-labelledby="sg-hub-flow-title">
            <div className="sg-hub-panel-head">
              <div>
                <p className="sg-hub-panel-kicker">Flujo recomendado</p>
                <h2 id="sg-hub-flow-title" className="sg-hub-panel-title">
                  Cómo usar el módulo
                </h2>
              </div>
            </div>
            <ol className="sg-hub-flow-list">
              <li>
                <span className="sg-hub-flow-num">1</span>
                <div>
                  <strong>Alta de dispositivo</strong>
                  <p>Importá lecturas EID desde el bastón (.txt).</p>
                </div>
              </li>
              <li>
                <span className="sg-hub-flow-num">2</span>
                <div>
                  <strong>Stock Ganadero</strong>
                  <p>Revisá, filtrá y editá cada caravana.</p>
                </div>
              </li>
              <li>
                <span className="sg-hub-flow-num">3</span>
                <div>
                  <strong>Sanidad y salidas</strong>
                  <p>Controles sanitarios, bajas y ventas.</p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <section className="sg-hub-panel sg-hub-panel--secondary" aria-labelledby="sg-hub-sec-title">
          <div className="sg-hub-panel-head">
            <div>
              <p className="sg-hub-panel-kicker">Más herramientas</p>
              <h2 id="sg-hub-sec-title" className="sg-hub-panel-title">
                Operaciones complementarias
              </h2>
            </div>
          </div>
          <div className="sg-hub-module-grid">
            {secondaryItems.map((item) => {
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
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
