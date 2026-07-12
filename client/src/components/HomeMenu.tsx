import { useMemo, useRef, useState, type CSSProperties, Fragment } from "react";
import {
  ArrowRight,
  Clock3,
  LayoutGrid,
} from "lucide-react";
import type { TabId } from "./Header";
import type { AuthUser, GastoAutoPendiente, Nota } from "../types";
import { canAccessScreen, type ActividadVistaModo } from "../utils/auth-permissions";
import { canShowHomePanel, normalizeHomePanelOrder, orderPanelsInZone } from "../utils/home-layout-config";
import { buildHomeQuickApps, mergeRecentModuleLists, getRecentHomeModules } from "../utils/home-quick-modules";
import { MENU_APP_THEMES, MenuAppIcon } from "./icons/MenuAppIcons";
import { SgHubAsideSearchField } from "./hub/SgHubAsideSearch";
import { normalizarBusquedaModulo } from "./hub/sg-hub-search";
import { prefetchVencimientosImpuestos } from "../utils/vencimientos-impuestos-cache";
import { useVencImpProximosBadge } from "../hooks/useVencImpProximosBadge";
import { useHomeDashboard } from "../hooks/useHomeDashboard";
import {
  formatFechaRelativa,
  saludoPorHora,
} from "./home/home-dashboard-format";
import { formatActividadDetalle } from "../utils/format-actividad-detalle";
import { fmtDate } from "../utils/format";
import HomeAutoPendientesPanel from "./home/HomeAutoPendientesPanel";
import HomeAsistentePanel from "./home/HomeAsistentePanel";
import HomeVencProximoBanner from "./home/HomeVencProximoBanner";
import { useHomeAutoPendientes } from "../hooks/useHomeAutoPendientes";
import type { PresupuestoVista } from "./presupuesto/presupuesto-hub-items";
import {
  aprobarGastoAutoPendiente,
  rechazarGastoAutoPendiente,
} from "../api";
import { confirmAction } from "../utils/confirm";
import HomeHubDashboard from "./home/HomeHubDashboard";
import HomeCampoMapaPanel from "./home/HomeCampoMapaPanel";
import HomeStockPotreroPanel from "./home/HomeStockPotreroPanel";
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
    id: "notas",
    label: "Notas",
    subtitle: "Apuntes personales y notas compartidas con el equipo",
  },
  {
    id: "chat",
    label: "Chat",
    subtitle: "Mensajes con el equipo y mensajes directos",
  },
  {
    id: "ayuda",
    label: "Ayuda",
    subtitle: "Manual de uso y guía de cada módulo",
  },
  {
    id: "asistente",
    label: "Asistente",
    subtitle: "Consultas de tu cuenta y del mercado",
  },
];

export const MENU_SECTIONS: { id: string; label: string; appIds: TabId[] }[] = [
  {
    id: "principal",
    label: "Principal",
    appIds: [
      "registro",
      "vencimientos_impuestos",
      "configuracion",
      "divisas",
      "precios_ganado",
      "ingresos_ventas",
      "recursos_humanos",
      "stock_ganadero",
      "stock_equino",
      "notas",
      "chat",
      "ayuda",
      "asistente",
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    appIds: ["campo_mapa"],
  },
  {
    id: "tareas",
    label: "Tareas",
    appIds: ["tareas_operativas"],
  },
];

const MENU_APPS_EXTENDED: MenuApp[] = [
  ...MENU_APPS,
  {
    id: "campo_mapa",
    label: "Mapa del campo",
    subtitle: "Vista satelital y potreros dibujados en el mapa",
  },
  {
    id: "tareas_operativas",
    label: "Tareas operativas",
    subtitle: "Almanaque, asignaciones y registro de trabajo en el campo",
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
  campo_mapa: "Mapa del campo",
  tareas_operativas: "Tareas operativas",
  stock_equino: "Stock Equino",
  stock_movimientos: "Movimientos de Dispositivos",
  registro_actividad: "Registro de actividad",
  notas: "Notas",
  usuarios: "Usuarios",
  panel_admin_sitio: "Administración del sitio",
  chat: "Chat",
  ayuda: "Ayuda",
  asistente: "Asistente",
  documentos_digitales: "Documentos Digitales",
};

export function getScreenTitle(id: TabId): string {
  return SCREEN_TITLES[id];
}

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onOpen: (id: TabId, opts?: { actividadModo?: ActividadVistaModo }) => void;
  onOpenPresupuesto?: (vista: PresupuestoVista) => void;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string, title?: string) => void;
}

function filtrarApps(apps: MenuApp[], consulta: string): MenuApp[] {
  const q = normalizarBusquedaModulo(consulta);
  if (!q) return apps;
  return apps.filter((app) =>
    normalizarBusquedaModulo(`${app.label} ${app.subtitle} ${app.id}`).includes(q)
  );
}

export default function HomeMenu({
  user,
  apiOnline,
  onOpen,
  onOpenPresupuesto,
  onError,
  onSuccess,
}: Props) {
  const appsById = useMemo(
    () => new Map(MENU_APPS_EXTENDED.map((app) => [app.id, app])),
    [],
  );
  const apps = MENU_APPS_EXTENDED.filter((app) => canAccessScreen(user, app.id));
  const vencProximosCount = useVencImpProximosBadge();
  const [busquedaModulos, setBusquedaModulos] = useState("");
  const busquedaInputRef = useRef<HTMLInputElement>(null);
  const appsFiltrados = useMemo(
    () => filtrarApps(apps, busquedaModulos),
    [apps, busquedaModulos]
  );
  const consultaActiva = busquedaModulos.trim().length > 0;
  const [notaModal, setNotaModal] = useState<Nota | null | undefined>(undefined);
  const [autoBusyId, setAutoBusyId] = useState<number | null>(null);

  const {
    pendientes: autoPendientes,
    loading: loadingAutoPendientes,
    puedeAprobar: puedeAprobarAuto,
    recargar: recargarAutoPendientes,
  } = useHomeAutoPendientes(user, apiOnline);

  const formatUsdAuto = (n: number) =>
    new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const aprobarAutoDesdeHome = async (p: GastoAutoPendiente) => {
    const ok = await confirmAction({
      title: "Aprobar pago automático",
      message: `Se registrará el pago «${p.plantilla.nombre}» con fecha ${fmtDate(p.fecha_programada)} y monto ${formatUsdAuto(p.plantilla.saldo_usd)}.`,
      confirmText: "Aprobar pago",
    });
    if (!ok) return;
    setAutoBusyId(p.id);
    try {
      const result = await aprobarGastoAutoPendiente(p.id);
      onSuccess?.(
        `Pago registrado — operación #${result.presupuesto.nro_registro}`,
        "Pago automático"
      );
      await recargarAutoPendientes();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "No se pudo aprobar");
    } finally {
      setAutoBusyId(null);
    }
  };

  const rechazarAutoDesdeHome = async (p: GastoAutoPendiente) => {
    const ok = await confirmAction({
      title: "Omitir este mes",
      message: `No se registrará el pago «${p.plantilla.nombre}» en ${p.periodo}.`,
      confirmText: "Omitir mes",
      variant: "danger",
    });
    if (!ok) return;
    setAutoBusyId(p.id);
    try {
      await rechazarGastoAutoPendiente(p.id);
      onSuccess?.("Pago omitido para este mes");
      await recargarAutoPendientes();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "No se pudo omitir");
    } finally {
      setAutoBusyId(null);
    }
  };

  const irAutomatizacion = () => {
    if (onOpenPresupuesto) {
      onOpenPresupuesto("automatizacion");
      return;
    }
    onOpen("registro");
  };

  const {
    loadingInsights,
    insightsReady,
    loadingNotas,
    loadingVenc,
    notasDestacadas,
    applyNotaHome,
    removeNotaHome,
    proximosVenc,
    actividadPanels,
    insights,
    recentScreens,
    puedeNotas,
    puedeVencimientos,
  } = useHomeDashboard(user, apiOnline);

  const puedeMapaCampo =
    canAccessScreen(user, "campo_mapa") && canShowHomePanel(user, "mapa_campo");
  const puedeStockGanadero =
    canAccessScreen(user, "stock_ganadero") && canShowHomePanel(user, "stock_potrero");
  const showModulosRapidos = canShowHomePanel(user, "modulos_rapidos");
  const showKpisOperativos = canShowHomePanel(user, "kpis_operativos");
  const showKpisGastos = canShowHomePanel(user, "kpis_gastos");
  /** Acceso directo al Asistente: solo Administrador y Gestor N1, si el módulo está habilitado. */
  const showAsistenteHome =
    (user.rol === "admin" || user.rol === "editor") && canAccessScreen(user, "asistente");

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
  const showKpiSkeleton = loadingInsights && !insightsReady;

  const showKpiDashboard = showKpisOperativos || showKpisGastos;
  const showKpiDashboardSkeleton = showKpiDashboard && showKpiSkeleton;

  const panelOrder = useMemo(
    () => normalizeHomePanelOrder(user.home_panel_orden),
    [user.home_panel_orden],
  );
  const topPanelOrder = useMemo(() => orderPanelsInZone(panelOrder, "top"), [panelOrder]);
  const mainPanelOrder = useMemo(() => orderPanelsInZone(panelOrder, "main"), [panelOrder]);
  const sidePanelOrder = useMemo(() => orderPanelsInZone(panelOrder, "side"), [panelOrder]);

  const showAutoPendientes =
    canShowHomePanel(user, "auto_pendientes") &&
    puedeAprobarAuto &&
    (loadingAutoPendientes || autoPendientes.length > 0);

  const showKpiDashboardPanel = useMemo(
    () =>
      showKpiDashboard &&
      topPanelOrder.some((panelId) => panelId === "kpis_operativos" || panelId === "kpis_gastos"),
    [showKpiDashboard, topPanelOrder],
  );

  const renderKpiDashboard = () => (
    <HomeHubDashboard
      insights={kpis}
      loading={showKpiDashboardSkeleton}
      onOpen={onOpen}
    />
  );

  const renderNavApp = (app: MenuApp) => (
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
  );

  const sectionApps = (section: (typeof MENU_SECTIONS)[number]): MenuApp[] => {
    const allowed = new Set(appsFiltrados.map((a) => a.id));
    return section.appIds
      .map((id) => appsById.get(id))
      .filter((app): app is MenuApp => !!app && allowed.has(app.id));
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
              <p className="sg-hub-aside-kicker">SAG</p>
              <p className="sg-hub-aside-title">Pagina Principal</p>
            </div>
          </div>

          <SgHubAsideSearchField
            value={busquedaModulos}
            onChange={setBusquedaModulos}
            inputRef={busquedaInputRef}
          />

          <nav className="sg-hub-aside-nav" aria-label="Módulos">
            {consultaActiva ? (
              <>
                <p className="sg-hub-aside-nav-label">Resultados ({appsFiltrados.length})</p>
                <button type="button" className="sg-hub-nav-item is-active">
                  <LayoutGrid size={18} aria-hidden />
                  Inicio
                </button>
                {appsFiltrados.map(renderNavApp)}
                {appsFiltrados.length === 0 ? (
                  <p className="sg-hub-aside-nav-empty">Ningún módulo coincide con la búsqueda.</p>
                ) : null}
              </>
            ) : (
              <>
                <p className="sg-hub-aside-nav-label">Principal</p>
                <button type="button" className="sg-hub-nav-item is-active">
                  <LayoutGrid size={18} aria-hidden />
                  Inicio
                </button>
                {sectionApps(MENU_SECTIONS[0]).map(renderNavApp)}
                {MENU_SECTIONS.slice(1).map((section) => {
                  const items = sectionApps(section);
                  if (items.length === 0) return null;
                  return (
                    <Fragment key={section.id}>
                      <p className="sg-hub-aside-nav-label sg-hub-aside-nav-label--section">
                        {section.label}
                      </p>
                      {items.map(renderNavApp)}
                    </Fragment>
                  );
                })}
              </>
            )}
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
          </header>

          {showKpiDashboardPanel ? (
            <div key="home-hub-dashboard" aria-busy={loadingInsights}>
              {renderKpiDashboard()}
            </div>
          ) : null}

          <div className="sg-hub-panels home-hub-panels">
            <div className="home-hub-col">
              {mainPanelOrder.map((panelId) => {
                if (panelId === "pizarron") {
                  if (!puedeNotas && !showAsistenteHome) return null;
                  return (
                    <Fragment key="pizarron">
                      {puedeNotas ? (
                        <section
                          className="sg-hub-panel home-hub-panel--notes"
                          aria-label="Notas principales"
                        >
                          <div className="sg-hub-panel-head home-hub-panel-head-row">
                            <div>
                              <p className="sg-hub-panel-kicker">Recordatorios</p>
                              <h2 className="sg-hub-panel-title">Pizarrón</h2>
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

                      {showAsistenteHome ? (
                        <HomeAsistentePanel
                          apiOnline={apiOnline}
                          onError={onError}
                          onOpenFull={() => onOpen("asistente")}
                        />
                      ) : null}
                    </Fragment>
                  );
                }
                if (panelId === "auto_pendientes" && showAutoPendientes) {
                  return (
                    <section
                      key="auto_pendientes"
                      className="home-auto-pendientes-section"
                      aria-label="Pendientes de aprobación"
                    >
                      <HomeAutoPendientesPanel
                        pendientes={autoPendientes}
                        loading={loadingAutoPendientes}
                        busyId={autoBusyId}
                        onAprobar={(p) => void aprobarAutoDesdeHome(p)}
                        onRechazar={(p) => void rechazarAutoDesdeHome(p)}
                        onVerTodos={irAutomatizacion}
                      />
                    </section>
                  );
                }
                if (panelId === "actividad" && canShowHomePanel(user, "actividad")) {
                  return (
                    <Fragment key="actividad">
                      {actividadPanels.map((panel) => (
                        <section
                          key={panel.id}
                          className={
                            panel.variant === "global"
                              ? "sg-hub-panel sg-hub-panel--actividad-global"
                              : "sg-hub-panel"
                          }
                          aria-label={panel.title}
                        >
                          <div className="sg-hub-panel-head home-hub-panel-head-row">
                            <div>
                              <p className="sg-hub-panel-kicker">{panel.kicker}</p>
                              <h2 className="sg-hub-panel-title">{panel.title}</h2>
                            </div>
                            <button
                              type="button"
                              className="home-hub-link"
                              onClick={() =>
                                onOpen("registro_actividad", { actividadModo: panel.verTodoModo })
                              }
                            >
                              Ver todo
                              <ArrowRight size={14} aria-hidden />
                            </button>
                          </div>
                          {panel.loading && panel.items.length === 0 ? (
                            <ul
                              className="home-hub-activity-skeleton-list"
                              aria-busy="true"
                              aria-label="Cargando actividad"
                            >
                              {Array.from({ length: 4 }).map((_, i) => (
                                <li key={`act-skeleton-${panel.id}-${i}`}>
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
                          ) : panel.items.length === 0 ? (
                            <p className="home-hub-empty">{panel.emptyText}</p>
                          ) : (
                            <ul className="home-cmd-activity-list">
                              {panel.items.map((item) => (
                                <li key={item.id}>
                                  <button
                                    type="button"
                                    className="home-cmd-activity-item"
                                    onClick={() =>
                                      onOpen("registro_actividad", { actividadModo: panel.verTodoModo })
                                    }
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
                      ))}
                    </Fragment>
                  );
                }
                return null;
              })}
            </div>

            <div className="home-hub-col home-hub-col--side">
              {sidePanelOrder.map((panelId) => {
                if (panelId === "mapa_campo" && puedeMapaCampo) {
                  return (
                    <HomeCampoMapaPanel
                      key="mapa_campo"
                      apiOnline={apiOnline}
                      onOpenMapa={() => onOpen("campo_mapa")}
                    />
                  );
                }
                if (panelId === "vencimientos" && puedeVencimientos) {
                  return (
                    <section
                      key="vencimientos"
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
                  );
                }
                if (panelId === "stock_potrero" && puedeStockGanadero) {
                  return (
                    <HomeStockPotreroPanel
                      key="stock_potrero"
                      apiOnline={apiOnline}
                      onOpenStock={() => onOpen("stock_ganadero")}
                      onOpenMapa={puedeMapaCampo ? () => onOpen("campo_mapa") : undefined}
                    />
                  );
                }
                if (panelId === "modulos_rapidos" && showModulosRapidos) {
                  return (
                    <section
                      key="modulos_rapidos"
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
                  );
                }
                return null;
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
