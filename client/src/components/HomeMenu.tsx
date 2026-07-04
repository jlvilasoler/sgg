import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Clock3,
  LayoutGrid,
} from "lucide-react";
import type { TabId } from "./Header";
import type { AuthUser, Nota } from "../types";
import { canAccessScreen } from "../utils/auth-permissions";
import { buildHomeQuickApps, mergeRecentModuleLists, getRecentHomeModules } from "../utils/home-quick-modules";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";
import { SgHubAsideSearchField } from "./hub/SgHubAsideSearch";
import { normalizarBusquedaModulo } from "./hub/sg-hub-search";
import { SgHubKpi, SgMiniBars } from "./stock/SgHubUi";
import { prefetchVencimientosImpuestos } from "../utils/vencimientos-impuestos-cache";
import { useVencImpProximosBadge } from "../hooks/useVencImpProximosBadge";
import { buildExpectedHomeInsights, useHomeDashboard } from "../hooks/useHomeDashboard";
import {
  formatFechaRelativa,
  saludoPorHora,
} from "./home/home-dashboard-format";
import { formatActividadDetalle } from "../utils/format-actividad-detalle";
import HomeVencProximoBanner from "./home/HomeVencProximoBanner";
import HomeNotasBoard from "./home/HomeNotasBoard";
import HomeNotaModal from "./home/HomeNotaModal";

export type ScreenId = "home" | TabId;

export interface MenuApp {
  id: TabId;
  label: string;
  subtitle: string;
}

export const MENU_APPS: MenuApp[] = [
  {
    id: "registro",
    label: "Presupuesto y gastos",
    subtitle: "Ingresar, ver y editar gastos",
  },
  {
    id: "vencimientos_impuestos",
    label: "Vencimientos Impuestos",
    subtitle: "Cuotas y fechas de tributos",
  },
  {
    id: "configuracion",
    label: "Configuración",
    subtitle: "Rubros, presupuesto asignado y proveedores",
  },
  {
    id: "divisas",
    label: "Divisas",
    subtitle: "USD → pesos y reales",
  },
  {
    id: "precios_ganado",
    label: "Precios de Ganado",
    subtitle: "Gordo y reposición (USD/kg)",
  },
  {
    id: "ingresos_ventas",
    label: "Ingresos por ventas",
    subtitle: "Simulador, ingresos cerrados y rubros",
  },
  {
    id: "recursos_humanos",
    label: "Recursos Humanos",
    subtitle: "Funcionarios, sueldos y jornales",
  },
  {
    id: "stock_ganadero",
    label: "Stock Ganadero",
    subtitle: "Importar lecturas EID desde archivo o carga manual",
  },
  {
    id: "stock_equino",
    label: "Stock Equino",
    subtitle: "Importar lecturas EID de equinos desde archivo o carga manual",
  },
  {
    id: "registro_actividad",
    label: "Registro de actividad",
    subtitle: "Historial de accesos y acciones en el sistema",
  },
  {
    id: "notas",
    label: "Notas",
    subtitle: "Apuntes personales y notas compartidas con el equipo",
  },
  {
    id: "chat",
    label: "Chat",
    subtitle: "Mensajes con el equipo y mensajes directos",
  },
];

const SCREEN_TITLES: Record<TabId, string> = {
  registro: "Registrar gasto",
  listado: "Listado de gastos",
  vencimientos_impuestos: "Vencimientos Impuestos",
  resumen: "Resumen",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador de Ventas",
  recursos_humanos: "Recursos Humanos",
  ingresos_ventas: "Ingresos por ventas",
  stock_ganadero: "Stock Ganadero",
  stock_equino: "Stock Equino",
  stock_movimientos: "Movimientos de Dispositivos",
  registro_actividad: "Registro de actividad",
  notas: "Notas",
  usuarios: "Usuarios",
  panel_admin_sitio: "Administración del sitio",
  chat: "Chat",
  documentos_digitales: "Documentos Digitales",
};

export function getScreenTitle(id: TabId): string {
  return SCREEN_TITLES[id];
}

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onOpen: (id: TabId) => void;
}

function filtrarApps(apps: MenuApp[], consulta: string): MenuApp[] {
  const q = normalizarBusquedaModulo(consulta);
  if (!q) return apps;
  return apps.filter((app) =>
    normalizarBusquedaModulo(`${app.label} ${app.subtitle} ${app.id}`).includes(q)
  );
}

export default function HomeMenu({ user, apiOnline, onOpen }: Props) {
  const apps = MENU_APPS.filter((app) => canAccessScreen(user, app.id));
  const vencProximosCount = useVencImpProximosBadge();
  const [busquedaModulos, setBusquedaModulos] = useState("");
  const busquedaInputRef = useRef<HTMLInputElement>(null);
  const appsFiltrados = useMemo(
    () => filtrarApps(apps, busquedaModulos),
    [apps, busquedaModulos]
  );
  const consultaActiva = busquedaModulos.trim().length > 0;
  const [notaModal, setNotaModal] = useState<Nota | null | undefined>(undefined);

  const {
    loadingInsights,
    loadingNotas,
    loadingVenc,
    loadingActividad,
    notasDestacadas,
    applyNotaHome,
    removeNotaHome,
    proximosVenc,
    actividad,
    insights,
    recentScreens,
    puedeNotas,
    puedeVencimientos,
    puedeActividad,
  } = useHomeDashboard(user, apiOnline);

  const recentMerged = useMemo(
    () => mergeRecentModuleLists(getRecentHomeModules(user.id), recentScreens),
    [user.id, recentScreens]
  );

  const quickApps = useMemo(
    () => buildHomeQuickApps(apps, user, recentMerged),
    [apps, user, recentMerged]
  );

  const nombreCorto = user.nombre?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "equipo";
  const cuentaLabel =
    user.cuenta_actividad_nombre?.trim() || user.empresa_nombre?.trim() || "tu cuenta";

  const kpis = insights;

  const expectedKpiSlots = useMemo(() => buildExpectedHomeInsights(user).length, [user]);

  const kpiStripCols = expectedKpiSlots;

  const kpiVariant = (item: (typeof insights)[number], index: number): "dark" | "light" => {
    if (item.id === "stock-ganado-activo" || item.id === "ganado-por-vender") {
      return index <= 1 ? "dark" : "light";
    }
    if (item.id === "gastos-mes" || item.id === "gastos-anio") return "dark";
    return "light";
  };

  const kpiTrend = (item: (typeof insights)[number]): string | undefined => {
    if (item.id === "stock-ganado-activo") return "En stock";
    if (item.id === "ganado-por-vender") return "Pendiente de venta";
    if (item.id === "arrendamientos-por-recibir") return "Por cobrar";
    if (item.id === "agricultura-por-recibir") return "Por cobrar";
    if (item.id === "gastos-mes") return "Mes actual";
    if (item.id === "gastos-anio") return "Ejercicio en curso";
    return undefined;
  };

  return (
    <div className="sg-module-page home-module-page">
      <div className="sg-hub sg-hub--module home--hub">
        <aside className="sg-hub-aside sg-hub-aside--module" aria-label="Navegación principal">
          <div className="sg-hub-aside-brand">
            <span className="sg-hub-aside-logo" aria-hidden>
              <LayoutGrid size={20} strokeWidth={1.75} />
            </span>
            <div>
              <p className="sg-hub-aside-kicker">SGG · Sistema</p>
              <p className="sg-hub-aside-title">Inicio</p>
            </div>
          </div>

          <SgHubAsideSearchField
            value={busquedaModulos}
            onChange={setBusquedaModulos}
            inputRef={busquedaInputRef}
          />

          <nav className="sg-hub-aside-nav" aria-label="Módulos">
            <p className="sg-hub-aside-nav-label">
              {consultaActiva ? `Resultados (${appsFiltrados.length})` : "Principal"}
            </p>
            <button type="button" className="sg-hub-nav-item is-active">
              <LayoutGrid size={18} aria-hidden />
              Inicio
            </button>
            {appsFiltrados.map((app) => (
              <button
                key={app.id}
                type="button"
                className="sg-hub-nav-item"
                onClick={() => onOpen(app.id)}
                onMouseEnter={
                  app.id === "vencimientos_impuestos" ? prefetchVencimientosImpuestos : undefined
                }
                onFocus={
                  app.id === "vencimientos_impuestos" ? prefetchVencimientosImpuestos : undefined
                }
              >
                <span className="sg-hub-nav-icon home-hub-nav-icon" aria-hidden>
                  <MenuAppIcon id={app.id} className="menu-app-icon-svg" />
                </span>
                <span className="sg-hub-nav-copy">
                  <span>{app.label}</span>
                  {consultaActiva ? <small className="sg-hub-nav-sub">{app.subtitle}</small> : null}
                </span>
                {app.id === "vencimientos_impuestos" && vencProximosCount > 0 ? (
                  <span className="home-hub-nav-badge" aria-hidden>
                    {vencProximosCount > 99 ? "99+" : vencProximosCount}
                  </span>
                ) : null}
              </button>
            ))}
            {consultaActiva && appsFiltrados.length === 0 ? (
              <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
            ) : null}
          </nav>
        </aside>

        <main className="sg-hub-main sg-hub-main--module">
          <header className="sg-hub-main-head">
            <div>
              <h1 className="sg-hub-main-title">Inicio</h1>
              <p className="sg-hub-main-sub">
                {saludoPorHora()}, {nombreCorto}. Resumen de {cuentaLabel} para arrancar con lo
                esencial.
              </p>
            </div>
            <div className="sg-hub-main-actions">
              <span
                className={`sg-hub-status${apiOnline ? " sg-hub-status--online" : ""}`}
                role="status"
              >
                {apiOnline ? "API conectada" : "Sin conexión API"}
              </span>
            </div>
          </header>

          {expectedKpiSlots > 0 ? (
            <section
              className="sg-hub-kpi-strip home-hub-kpi-strip"
              aria-label="Indicadores"
              aria-busy={loadingInsights}
              style={
                {
                  "--home-hub-kpi-cols": String(kpiStripCols),
                } as CSSProperties
              }
            >
              {kpis.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="home-hub-kpi-btn"
                  onClick={() => onOpen(item.tab)}
                  aria-label={`${item.label}: ${item.value}. ${item.hint}`}
                >
                  <SgHubKpi
                    variant={kpiVariant(item, index)}
                    kicker={item.label}
                    value={item.value}
                    hint={item.hint}
                    trend={kpiTrend(item)}
                    bars={<SgMiniBars highlight={index === kpis.length - 1 ? "last" : "mid"} />}
                  />
                </button>
              ))}
            </section>
          ) : null}

          <div className="sg-hub-panels home-hub-panels">
            <div className="home-hub-col">
              {puedeNotas ? (
                <section
                  className="sg-hub-panel home-hub-panel--notes"
                  aria-label="Notas principales"
                >
                  <div className="sg-hub-panel-head home-hub-panel-head-row">
                    <div>
                      <p className="sg-hub-panel-kicker">Recordatorios</p>
                      <h2 className="sg-hub-panel-title">Notas principales</h2>
                      <p className="home-hub-modules-hint muted">Pizarrón con apuntes pegados</p>
                    </div>
                    <button type="button" className="home-hub-link" onClick={() => onOpen("notas")}>
                      Ver todas
                    </button>
                  </div>
                  <HomeNotasBoard
                    notas={notasDestacadas}
                    loading={loadingNotas}
                    currentUserId={user.id}
                    onOpenNota={(nota) => setNotaModal(nota)}
                    onNewNota={() => setNotaModal(null)}
                  />
                  <HomeNotaModal
                    open={notaModal !== undefined}
                    nota={notaModal ?? null}
                    currentUser={user}
                    apiOnline={apiOnline}
                    onClose={() => setNotaModal(undefined)}
                    onSaved={applyNotaHome}
                    onDeleted={removeNotaHome}
                  />
                </section>
              ) : null}

              {puedeActividad ? (
                <section className="sg-hub-panel" aria-label="Últimos guardados en la cuenta">
                  <div className="sg-hub-panel-head home-hub-panel-head-row">
                    <div>
                      <p className="sg-hub-panel-kicker">Actividad de cuenta</p>
                      <h2 className="sg-hub-panel-title">Últimos guardados</h2>
                    </div>
                    <button
                      type="button"
                      className="home-hub-link"
                      onClick={() => onOpen("registro_actividad")}
                    >
                      Ver todo
                      <ArrowRight size={14} aria-hidden />
                    </button>
                  </div>
                  {loadingActividad && actividad.length === 0 ? (
                    <ul
                      className="home-hub-activity-skeleton-list"
                      aria-busy="true"
                      aria-label="Cargando actividad"
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <li key={`act-skeleton-${i}`}>
                          <div className="home-hub-activity-skeleton" aria-hidden>
                            <span className="home-hub-activity-skeleton-icon" />
                            <span className="home-hub-activity-skeleton-lines">
                              <span />
                              <span />
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : actividad.length === 0 ? (
                    <p className="home-hub-empty">
                      Todavía no hay cargas recientes del equipo (gastos, stock, RRHH, ventas o notas
                      compartidas).
                    </p>
                  ) : (
                    <ul className="home-cmd-activity-list">
                      {actividad.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="home-cmd-activity-item"
                            onClick={() => onOpen("registro_actividad")}
                          >
                            <span className="home-cmd-activity-icon" aria-hidden>
                              <Clock3 size={15} />
                            </span>
                            <span className="home-cmd-activity-body">
                              <span className="home-cmd-activity-text">
                                {formatActividadDetalle(item.detalle, item.evento)}
                              </span>
                              <span className="home-cmd-activity-meta">
                                {item.user_nombre || item.email || "Usuario"} ·{" "}
                                {formatFechaRelativa(item.creado_en)}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </div>

            <div className="home-hub-col home-hub-col--side">
              {puedeVencimientos ? (
                <section
                  className="sg-hub-panel home-hub-panel--venc"
                  aria-label="Próximos vencimientos"
                >
                  <div className="sg-hub-panel-head home-hub-panel-head-row">
                    <div>
                      <p className="sg-hub-panel-kicker">Calendario tributario</p>
                      <h2 className="sg-hub-panel-title">Próximos vencimientos</h2>
                    </div>
                    <button
                      type="button"
                      className="home-hub-link"
                      onClick={() => onOpen("vencimientos_impuestos")}
                    >
                      Abrir
                    </button>
                  </div>
                  {loadingVenc ? (
                    <p className="home-hub-empty">Cargando vencimientos…</p>
                  ) : proximosVenc.length === 0 ? (
                    <p className="home-hub-empty">
                      No hay vencimientos urgentes en los próximos días.
                    </p>
                  ) : (
                    <div className="home-hub-venc-proximos vencimientos-impuestos-page">
                      <div className="venc-imp-user-banner-proximos-wrap">
                        {proximosVenc.map((item) => (
                          <div key={item.key} className="venc-imp-user-banner-proximo-box">
                            <HomeVencProximoBanner
                              item={item}
                              onClick={() => onOpen("vencimientos_impuestos")}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}

              <section
                className="sg-hub-panel sg-hub-panel--modules home-hub-panel--quick"
                aria-labelledby="home-hub-mod-title"
              >
                <div className="sg-hub-panel-head">
                  <div>
                    <p className="sg-hub-panel-kicker">Accesos rápidos</p>
                    <h2 id="home-hub-mod-title" className="sg-hub-panel-title">
                      Módulos
                    </h2>
                    <p className="home-hub-modules-hint muted">
                      Según tu perfil y lo que usaste últimamente
                    </p>
                  </div>
                </div>
                <div className="sg-hub-module-grid sg-hub-module-grid--primary">
                  {quickApps.map((app) => {
                    const theme = MENU_APP_THEMES[app.id];
                    return (
                      <button
                        key={app.id}
                        type="button"
                        className="sg-hub-module-card sg-hub-module-card--featured"
                        onClick={() => onOpen(app.id)}
                        onMouseEnter={
                          app.id === "vencimientos_impuestos"
                            ? prefetchVencimientosImpuestos
                            : undefined
                        }
                        onFocus={
                          app.id === "vencimientos_impuestos"
                            ? prefetchVencimientosImpuestos
                            : undefined
                        }
                      >
                        <span
                          className="sg-hub-module-icon"
                          style={
                            {
                              "--sg-hub-icon-bg": theme.accentSoft,
                              "--sg-hub-icon-fg": theme.accent,
                            } as CSSProperties
                          }
                        >
                          <MenuAppIcon id={app.id} className="menu-app-icon-svg" />
                        </span>
                        <span className="sg-hub-module-copy">
                          <strong>{app.label}</strong>
                          <small>{app.subtitle}</small>
                        </span>
                        {app.id === "vencimientos_impuestos" && vencProximosCount > 0 ? (
                          <span className="home-hub-module-badge" aria-hidden>
                            {vencProximosCount > 99 ? "99+" : vencProximosCount}
                          </span>
                        ) : null}
                        <span className="sg-hub-module-arrow" aria-hidden>
                          →
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
