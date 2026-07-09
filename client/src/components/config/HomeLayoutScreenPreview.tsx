import { Clock3, LayoutGrid, Plus, Search, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { Rol } from "../../types";
import type { TabId } from "../Header";
import { MenuAppIcon, MENU_APP_THEMES } from "../icons/MenuAppIcons";
import {
  HOME_PANEL_META,
  type HomeLayoutMap,
  type HomePanelId,
} from "../../utils/home-layout-config";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  paneles: HomeLayoutMap;
  rol: Rol;
  rolLabel: string;
  accent: string;
  /** Modo edición: cada bloque muestra una ✕ para quitarlo y un placeholder punteado para agregarlo. */
  interactive?: boolean;
  onTogglePanel?: (id: HomePanelId, next: boolean) => void;
  /** Bloques no disponibles (rol/permiso): se muestran bloqueados y no editables. */
  lockedPanels?: Partial<Record<HomePanelId, string>>;
}

const ROLE_PREVIEW: Record<
  Rol,
  { navItems: string[]; quickModules: TabId[]; readOnly?: boolean; cuentaHint: string }
> = {
  admin: {
    cuentaHint: "Acceso total a la cuenta y administración",
    navItems: ["Presupuesto", "Vencimientos", "Configuración", "Usuarios", "Stock ganadero"],
    quickModules: ["registro", "vencimientos_impuestos", "stock_ganadero", "chat"],
  },
  editor: {
    cuentaHint: "Gestión completa de sectores habilitados",
    navItems: ["Presupuesto", "Vencimientos", "Configuración", "Stock ganadero", "Chat"],
    quickModules: ["registro", "vencimientos_impuestos", "stock_ganadero", "chat"],
  },
  gestor_n2: {
    cuentaHint: "Operación diaria sin administración de usuarios",
    navItems: ["Presupuesto", "Vencimientos", "RRHH", "Stock ganadero", "Notas"],
    quickModules: ["registro", "recursos_humanos", "stock_ganadero", "notas"],
  },
  consulta: {
    cuentaHint: "Consulta y reportes en modo lectura",
    navItems: ["Presupuesto", "Resumen", "Ayuda"],
    quickModules: ["listado", "resumen", "ayuda", "vencimientos_impuestos"],
    readOnly: true,
  },
};

const PANEL_LABEL = HOME_PANEL_META.reduce(
  (acc, p) => {
    acc[p.id] = p.label;
    return acc;
  },
  {} as Record<HomePanelId, string>,
);

const EMPTY_MIN_HEIGHT: Partial<Record<HomePanelId, string>> = {
  kpis_operativos: "3.4rem",
  kpis_gastos: "3.4rem",
  pizarron: "5.5rem",
  auto_pendientes: "4rem",
  actividad: "5.5rem",
  mapa_campo: "6rem",
  vencimientos: "4.5rem",
  stock_potrero: "6.5rem",
  modulos_rapidos: "4.5rem",
};

function panelOn(paneles: HomeLayoutMap, id: HomePanelId): boolean {
  return paneles[id] !== false;
}

/** Envoltorio editable de un bloque en modo interactivo. */
function EditableBlock({
  id,
  label,
  on,
  lockedReason,
  onToggle,
  children,
}: {
  id: HomePanelId;
  label: string;
  on: boolean;
  lockedReason?: string;
  onToggle?: (id: HomePanelId, next: boolean) => void;
  children: ReactNode;
}) {
  const minH = EMPTY_MIN_HEIGHT[id]
    ? ({ minHeight: EMPTY_MIN_HEIGHT[id] } as CSSProperties)
    : undefined;

  if (lockedReason) {
    return (
      <div className="config-home-screen-slot is-locked" style={minH}>
        <span className="config-home-screen-slot-lock-label">{label}</span>
        <span className="config-home-screen-slot-lock-reason">{lockedReason}</span>
      </div>
    );
  }

  if (on) {
    return (
      <div className="config-home-screen-slot is-on">
        <button
          type="button"
          className="config-home-screen-slot-remove"
          onClick={() => onToggle?.(id, false)}
          title={`Quitar ${label}`}
          aria-label={`Quitar ${label}`}
        >
          <X size={13} aria-hidden />
        </button>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="config-home-screen-slot is-empty"
      style={minH}
      onClick={() => onToggle?.(id, true)}
      title={`Agregar ${label}`}
      aria-label={`Agregar ${label}`}
    >
      <span className="config-home-screen-slot-add-icon" aria-hidden>
        <Plus size={16} />
      </span>
      <span className="config-home-screen-slot-empty-label">{label}</span>
      <span className="config-home-screen-slot-empty-hint">Tocar para agregar</span>
    </button>
  );
}

function PreviewKpiStrip({
  paneles,
  interactive,
  lockedPanels,
  onToggle,
}: {
  paneles: HomeLayoutMap;
  interactive: boolean;
  lockedPanels?: Partial<Record<HomePanelId, string>>;
  onToggle?: (id: HomePanelId, next: boolean) => void;
}) {
  const showOps = panelOn(paneles, "kpis_operativos");
  const showGastos = panelOn(paneles, "kpis_gastos");
  if (!interactive && !showOps && !showGastos) return null;

  const opsRow = (
    <div className="config-home-screen-kpi-row config-home-screen-kpi-row--ops">
      <div className="config-home-screen-kpi-card">
        <SgHubKpi
          variant="dark"
          kicker="Ganado activo"
          value="1.240"
          hint="Cabezas en stock"
          trend="En stock"
          bars={<SgMiniBars highlight="mid" />}
        />
      </div>
      <div className="config-home-screen-kpi-card">
        <SgHubKpi
          variant="dark"
          kicker="Por vender"
          value="86"
          hint="Pendiente de cierre"
          trend="Pendiente de venta"
          bars={<SgMiniBars highlight="last" />}
        />
      </div>
      <div className="config-home-screen-kpi-card">
        <SgHubKpi
          variant="light"
          kicker="Arrendamientos"
          value="USD 4.200"
          hint="Por cobrar"
          trend="Por cobrar"
          bars={<SgMiniBars />}
        />
      </div>
    </div>
  );

  const gastosRow = (
    <div className="config-home-screen-kpi-row config-home-screen-kpi-row--gastos">
      <div className="config-home-screen-kpi-card">
        <SgHubKpi
          variant="dark"
          kicker="Gastos del mes"
          value="USD 12.400"
          hint="Mes actual"
          trend="Mes actual"
          bars={<SgMiniBars highlight="last" />}
        />
      </div>
      <div className="config-home-screen-kpi-card">
        <SgHubKpi
          variant="dark"
          kicker="Gastos del ejercicio"
          value="USD 98.200"
          hint="Ejercicio en curso"
          trend="Ejercicio en curso"
          bars={<SgMiniBars />}
        />
      </div>
    </div>
  );

  if (!interactive) {
    return (
      <div className="config-home-screen-kpis">
        {showOps ? opsRow : null}
        {showGastos ? gastosRow : null}
      </div>
    );
  }

  return (
    <div className="config-home-screen-kpis">
      <EditableBlock
        id="kpis_operativos"
        label={PANEL_LABEL.kpis_operativos}
        on={showOps}
        lockedReason={lockedPanels?.kpis_operativos}
        onToggle={onToggle}
      >
        {opsRow}
      </EditableBlock>
      <EditableBlock
        id="kpis_gastos"
        label={PANEL_LABEL.kpis_gastos}
        on={showGastos}
        lockedReason={lockedPanels?.kpis_gastos}
        onToggle={onToggle}
      >
        {gastosRow}
      </EditableBlock>
    </div>
  );
}

function PreviewPizarron() {
  return (
    <section className="config-home-screen-panel">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Recordatorios</p>
          <h4>Pizarrón</h4>
        </div>
        <span className="config-home-screen-panel-link">Ver todas</span>
      </header>
      <div className="config-home-screen-notes">
        <div className="config-home-screen-note is-pin" style={{ "--note-hue": "48" } as CSSProperties}>
          <strong>Vacunación potrero 3</strong>
          <span>Mié 15 · equipo campo</span>
        </div>
        <div className="config-home-screen-note" style={{ "--note-hue": "210" } as CSSProperties}>
          <strong>Revisar DGI abril</strong>
          <span>Ayer · administración</span>
        </div>
      </div>
    </section>
  );
}

function PreviewAutoPendientes() {
  return (
    <section className="config-home-screen-panel config-home-screen-panel--auto">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Automatización</p>
          <h4>Pagos pendientes</h4>
        </div>
      </header>
      <div className="config-home-screen-auto-card">
        <div>
          <strong>Arrendamiento Estancia Norte</strong>
          <span>Vence 08/07 · USD 2.850</span>
        </div>
        <span className="config-home-screen-auto-pill">Aprobar</span>
      </div>
    </section>
  );
}

function PreviewActividad() {
  return (
    <section className="config-home-screen-panel">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Actividad</p>
          <h4>Últimos guardados</h4>
        </div>
        <span className="config-home-screen-panel-link">Ver todo</span>
      </header>
      <ul className="config-home-screen-activity">
        {[
          "Gasto registrado — Combustible",
          "Stock actualizado — Potrero Sur",
          "Nota compartida — Reunión mensual",
        ].map((text) => (
          <li key={text}>
            <Clock3 size={11} aria-hidden />
            <span>
              <strong>{text}</strong>
              <small>hace 2 h · Gestor</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PreviewMapa() {
  return (
    <section className="config-home-screen-panel config-home-screen-panel--mapa">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Campo</p>
          <h4>Mapa de potreros</h4>
        </div>
        <span className="config-home-screen-panel-link">Abrir mapa</span>
      </header>
      <div className="config-home-screen-mapa" aria-hidden>
        <span className="config-home-screen-mapa-potrero is-a" />
        <span className="config-home-screen-mapa-potrero is-b" />
        <span className="config-home-screen-mapa-potrero is-c" />
      </div>
    </section>
  );
}

function PreviewVencimientos() {
  return (
    <section className="config-home-screen-panel">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Calendario tributario</p>
          <h4>Próximos vencimientos</h4>
        </div>
        <span className="config-home-screen-panel-link">Abrir</span>
      </header>
      <div className="config-home-screen-venc">
        <div className="config-home-screen-venc-item is-urgent">
          <strong>DGI · IVA</strong>
          <span>En 3 días</span>
        </div>
        <div className="config-home-screen-venc-item">
          <strong>BPS · Aportes</strong>
          <span>En 11 días</span>
        </div>
      </div>
    </section>
  );
}

function PreviewStockPotrero() {
  return (
    <section className="config-home-screen-panel">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Stock</p>
          <h4>Animales por potrero</h4>
        </div>
      </header>
      <table className="config-home-screen-stock-table">
        <thead>
          <tr>
            <th>Potrero</th>
            <th>Total</th>
            <th>Ocupación</th>
            <th>UG/ha</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>La Tapera</td>
            <td>420</td>
            <td className="is-ok">82%</td>
            <td className="is-ok">0,82</td>
          </tr>
          <tr>
            <td>El Ceibal</td>
            <td>318</td>
            <td>105%</td>
            <td>1,05</td>
          </tr>
          <tr className="is-muted">
            <td>SIN POTRERO</td>
            <td>12</td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

const QUICK_MODULE_LABELS: Partial<Record<TabId, string>> = {
  registro: "Presupuesto",
  listado: "Listado",
  resumen: "Resumen",
  vencimientos_impuestos: "Vencimientos",
  stock_ganadero: "Stock",
  recursos_humanos: "RRHH",
  notas: "Notas",
  chat: "Chat",
  ayuda: "Ayuda",
};

function PreviewModulos({ quickModules }: { quickModules: TabId[] }) {
  return (
    <section className="config-home-screen-panel">
      <header className="config-home-screen-panel-head">
        <div>
          <p className="config-home-screen-panel-kicker">Accesos rápidos</p>
          <h4>Módulos</h4>
        </div>
      </header>
      <div className="config-home-screen-modules">
        {quickModules.map((id) => {
          const theme = MENU_APP_THEMES[id];
          return (
            <div
              key={id}
              className="config-home-screen-module"
              style={{ "--mod-accent": theme.accentSoft } as CSSProperties}
            >
              <span className="config-home-screen-module-icon" aria-hidden>
                <MenuAppIcon id={id} className="menu-app-icon-svg" />
              </span>
              <span>{QUICK_MODULE_LABELS[id] ?? id}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function HomeLayoutScreenPreview({
  paneles,
  rol,
  rolLabel,
  accent,
  interactive = false,
  onTogglePanel,
  lockedPanels,
}: Props) {
  const roleMeta = ROLE_PREVIEW[rol];
  const visibleCount = HOME_PANEL_META.filter((p) => panelOn(paneles, p.id)).length;

  const mainPanels: { id: HomePanelId; node: ReactNode }[] = [
    { id: "pizarron", node: <PreviewPizarron /> },
    { id: "auto_pendientes", node: <PreviewAutoPendientes /> },
    { id: "actividad", node: <PreviewActividad /> },
  ];

  const sidePanels: { id: HomePanelId; node: ReactNode }[] = [
    { id: "mapa_campo", node: <PreviewMapa /> },
    { id: "vencimientos", node: <PreviewVencimientos /> },
    { id: "stock_potrero", node: <PreviewStockPotrero /> },
    {
      id: "modulos_rapidos",
      node: <PreviewModulos quickModules={roleMeta.quickModules} />,
    },
  ];

  const renderColumn = (panels: { id: HomePanelId; node: ReactNode }[]) =>
    interactive
      ? panels.map((p) => (
          <EditableBlock
            key={p.id}
            id={p.id}
            label={PANEL_LABEL[p.id]}
            on={panelOn(paneles, p.id)}
            lockedReason={lockedPanels?.[p.id]}
            onToggle={onTogglePanel}
          >
            {p.node}
          </EditableBlock>
        ))
      : panels
          .filter((p) => panelOn(paneles, p.id))
          .map((p) => <div key={p.id}>{p.node}</div>);

  return (
    <div
      className={`config-home-screen-preview${
        interactive ? " config-home-screen-preview--interactive" : ""
      }`}
      style={{ "--preview-role-accent": accent } as CSSProperties}
      aria-label={`Simulación del inicio para ${rolLabel}`}
    >
      <div className="config-home-screen-preview-chrome">
        <span className="config-home-screen-preview-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="config-home-screen-preview-title">
          SAG · Inicio — {rolLabel}
        </span>
        <span className="config-home-screen-preview-badge">
          {visibleCount} bloque{visibleCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="config-home-screen-preview-app">
        <aside className="config-home-screen-aside" aria-hidden>
          <div className="config-home-screen-aside-brand">
            <LayoutGrid size={14} />
            <div>
              <p>SAG</p>
              <strong>Página principal</strong>
            </div>
          </div>
          <div className="config-home-screen-aside-search">
            <Search size={11} aria-hidden />
            <span>Buscar módulo…</span>
          </div>
          <nav>
            <p className="config-home-screen-aside-label">Principal</p>
            <div className="config-home-screen-nav-item is-active">
              <LayoutGrid size={12} aria-hidden />
              Inicio
            </div>
            {roleMeta.navItems.map((label) => (
              <div key={label} className="config-home-screen-nav-item">
                {label}
              </div>
            ))}
          </nav>
        </aside>

        <main className="config-home-screen-main">
          <header className="config-home-screen-main-head">
            <div>
              <h3>Inicio</h3>
              <p>
                Buenas tardes, equipo. Resumen de la cuenta para arrancar con lo esencial.
              </p>
              <span className="config-home-screen-role-chip">{roleMeta.cuentaHint}</span>
              {roleMeta.readOnly ? (
                <span className="config-home-screen-readonly-chip">Solo lectura</span>
              ) : null}
            </div>
          </header>

          <PreviewKpiStrip
            paneles={paneles}
            interactive={interactive}
            lockedPanels={lockedPanels}
            onToggle={onTogglePanel}
          />

          <div className="config-home-screen-panels">
            <div className="config-home-screen-panels-main">{renderColumn(mainPanels)}</div>
            <div className="config-home-screen-panels-side">{renderColumn(sidePanels)}</div>
          </div>

          {!interactive && visibleCount === 0 ? (
            <p className="config-home-screen-empty">
              Sin bloques visibles: el usuario vería solo el encabezado y la barra lateral.
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}
