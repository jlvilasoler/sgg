import { Beef, Building2, Clock3, GripVertical, LayoutGrid, Plus, Search, Sprout, Wallet, X } from "lucide-react";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import type { Rol } from "../../types";
import type { TabId } from "../Header";
import { MenuAppIcon, MENU_APP_THEMES } from "../icons/MenuAppIcons";
import {
  DEFAULT_HOME_PANEL_ORDER,
  HOME_PANEL_META,
  moveHomePanelInOrder,
  orderPanelsInZone,
  type HomeLayoutMap,
  type HomePanelId,
} from "../../utils/home-layout-config";
import { HomeKpiStripBar } from "../home/HomeKpiStripBar";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  paneles: HomeLayoutMap;
  rol: Rol;
  rolLabel: string;
  accent: string;
  orden?: readonly HomePanelId[];
  /** Modo edición: cada bloque muestra una ✕ para quitarlo y un placeholder punteado para agregarlo. */
  interactive?: boolean;
  onTogglePanel?: (id: HomePanelId, next: boolean) => void;
  onReorder?: (orden: HomePanelId[]) => void;
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
  pizarron: "6rem",
  auto_pendientes: "4rem",
  actividad: "5.5rem",
  mapa_campo: "6rem",
  vencimientos: "3.6rem",
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
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragHandleStart,
  onDragHandleEnd,
  onDragOverSlot,
  onDropOnSlot,
  children,
}: {
  id: HomePanelId;
  label: string;
  on: boolean;
  lockedReason?: string;
  onToggle?: (id: HomePanelId, next: boolean) => void;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragHandleStart?: (id: HomePanelId) => void;
  onDragHandleEnd?: () => void;
  onDragOverSlot?: (id: HomePanelId, e: DragEvent) => void;
  onDropOnSlot?: (id: HomePanelId) => void;
  children: ReactNode;
}) {
  const minH = EMPTY_MIN_HEIGHT[id]
    ? ({ minHeight: EMPTY_MIN_HEIGHT[id] } as CSSProperties)
    : undefined;

  const slotClass = [
    "config-home-screen-slot",
    on ? "is-on" : "",
    isDragging ? "is-dragging" : "",
    isDropTarget ? "is-drop-target" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      <div
        className={slotClass}
        style={minH}
        onDragOver={(e) => onDragOverSlot?.(id, e)}
        onDrop={(e) => {
          e.preventDefault();
          onDropOnSlot?.(id);
        }}
      >
        {draggable ? (
          <button
            type="button"
            className="config-home-screen-slot-drag"
            draggable
            title={`Mover ${label}`}
            aria-label={`Mover ${label}`}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", id);
              onDragHandleStart?.(id);
            }}
            onDragEnd={() => onDragHandleEnd?.()}
          >
            <GripVertical size={14} aria-hidden />
          </button>
        ) : null}
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
      className={`config-home-screen-slot is-empty${isDropTarget ? " is-drop-target" : ""}`}
      style={minH}
      onClick={() => onToggle?.(id, true)}
      title={`Agregar ${label}`}
      aria-label={`Agregar ${label}`}
      onDragOver={(e) => onDragOverSlot?.(id, e)}
      onDrop={(e) => {
        e.preventDefault();
        onDropOnSlot?.(id);
      }}
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
  orden,
  interactive,
  lockedPanels,
  onToggle,
  onReorder,
  dragId,
  dropTargetId,
  setDragId,
  setDropTargetId,
}: {
  paneles: HomeLayoutMap;
  orden: readonly HomePanelId[];
  interactive: boolean;
  lockedPanels?: Partial<Record<HomePanelId, string>>;
  onToggle?: (id: HomePanelId, next: boolean) => void;
  onReorder?: (orden: HomePanelId[]) => void;
  dragId: HomePanelId | null;
  dropTargetId: HomePanelId | null;
  setDragId: (id: HomePanelId | null) => void;
  setDropTargetId: (id: HomePanelId | null) => void;
}) {
  const topOrder = orderPanelsInZone(orden, "top");
  const showOps = panelOn(paneles, "kpis_operativos");
  const showGastos = panelOn(paneles, "kpis_gastos");
  if (!interactive && !showOps && !showGastos) return null;

  const dragProps = (id: HomePanelId) => ({
    draggable: Boolean(interactive && onReorder),
    isDragging: dragId === id,
    isDropTarget: dropTargetId === id && dragId !== id,
    onDragHandleStart: setDragId,
    onDragHandleEnd: () => {
      setDragId(null);
      setDropTargetId(null);
    },
    onDragOverSlot: (slotId: HomePanelId, e: DragEvent) => {
      if (!dragId || dragId === slotId) return;
      e.preventDefault();
      setDropTargetId(slotId);
    },
    onDropOnSlot: (slotId: HomePanelId) => {
      if (!dragId || !onReorder) return;
      onReorder(moveHomePanelInOrder(orden, dragId, slotId));
      setDragId(null);
      setDropTargetId(null);
    },
  });

  const opsRow = (
    <div className="config-home-screen-kpi-row config-home-screen-kpi-row--ops">
      <div className="config-home-screen-kpi-card">
        <article className="home-ganado-dash home-ganado-dash--preview" aria-label="Vista previa ganado">
          <header className="home-ganado-dash__head">
            <div className="home-ganado-dash__brand">
              <span className="home-ganado-dash__icon" aria-hidden>
                <Beef size={15} strokeWidth={1.75} />
              </span>
              <p className="home-ganado-dash__title-row">
                <span className="home-ganado-dash__kicker">Ganado</span>
                <span className="home-ganado-dash__subtitle">1/7/2026 al 30/6/2027</span>
              </p>
            </div>
            <span className="home-ganado-dash__badge">525 cab.</span>
          </header>
          <div className="home-ganado-dash__strips is-split">
            <section className="home-ganado-dash__strip-group home-ganado-dash__strip-group--stock">
              <HomeKpiStripBar
                label="Stock en campo"
                cells={[
                  {
                    id: "stock",
                    label: "En stock",
                    value: "525",
                    trend: "25 lote(s)",
                    tone: "lime",
                  },
                  {
                    id: "machos",
                    label: "Machos",
                    value: "198",
                    valueAside: "38%",
                    sharePct: 38,
                    shareTone: "macho",
                    trend: "♂ En stock",
                    tone: "neutral",
                  },
                  {
                    id: "hembras",
                    label: "Hembras",
                    value: "327",
                    valueAside: "62%",
                    sharePct: 62,
                    shareTone: "hembra",
                    trend: "♀ En stock",
                    tone: "neutral",
                  },
                ]}
              />
            </section>
            <section className="home-ganado-dash__strip-group home-ganado-dash__strip-group--ventas">
              <HomeKpiStripBar
                label="Ventas y operaciones"
                cells={[
                  {
                    id: "vendidos",
                    label: "Vendidos",
                    value: "0",
                    trend: "Sin ventas en ej.",
                    tone: "neutral",
                  },
                  {
                    id: "por-vender",
                    label: "Por vender",
                    value: "0",
                    trend: "Sin operaciones abiertas",
                    tone: "neutral",
                  },
                ]}
              />
            </section>
          </div>
        </article>
      </div>
      <div className="config-home-screen-kpi-card config-home-screen-kpi-card--wide">
        <article className="sg-hub-kpi sg-hub-kpi--light home-por-cobrar-kpi">
          <div className="home-por-cobrar-kpi-head">
            <div className="home-por-cobrar-kpi-brand">
              <span className="home-por-cobrar-kpi-icon" aria-hidden>
                <Wallet size={18} strokeWidth={1.75} />
              </span>
              <div>
                <p className="home-por-cobrar-kpi-kicker">Por cobrar</p>
                <p className="home-por-cobrar-kpi-subtitle">2026/2027</p>
              </div>
            </div>
            <div className="home-por-cobrar-kpi-head-end">
              <span className="home-por-cobrar-kpi-head-total">US$ 7.150</span>
              <SgMiniBars highlight="mid" />
            </div>
          </div>
          <div className="home-por-cobrar-kpi-split is-count-3">
            <div className="home-por-cobrar-kpi-zone home-por-cobrar-kpi-zone--arrend">
              <span className="home-por-cobrar-kpi-zone-top">
                <Building2 size={13} strokeWidth={2} aria-hidden />
                <span className="home-por-cobrar-kpi-zone-eyebrow">Arrend.</span>
              </span>
              <span className="home-por-cobrar-kpi-zone-row">
                <span className="home-por-cobrar-kpi-zone-pair">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Pend.</span>
                  <span className="home-por-cobrar-kpi-zone-value">US$ 7.150</span>
                </span>
                <span className="home-por-cobrar-kpi-zone-pair home-por-cobrar-kpi-zone-pair--ej">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Cobr. ej.</span>
                  <span className="home-por-cobrar-kpi-zone-value home-por-cobrar-kpi-zone-value--ej">US$ 4.200</span>
                </span>
              </span>
              <span className="home-por-cobrar-kpi-zone-hint">1 contrato(s)</span>
            </div>
            <div className="home-por-cobrar-kpi-zone home-por-cobrar-kpi-zone--ganado">
              <span className="home-por-cobrar-kpi-zone-top">
                <Beef size={13} strokeWidth={2} aria-hidden />
                <span className="home-por-cobrar-kpi-zone-eyebrow">Ganado</span>
              </span>
              <span className="home-por-cobrar-kpi-zone-row">
                <span className="home-por-cobrar-kpi-zone-pair">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Pend.</span>
                  <span className="home-por-cobrar-kpi-zone-value">US$ 0</span>
                </span>
                <span className="home-por-cobrar-kpi-zone-pair home-por-cobrar-kpi-zone-pair--ej">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Cobr. ej.</span>
                  <span className="home-por-cobrar-kpi-zone-value home-por-cobrar-kpi-zone-value--ej">US$ 142.000</span>
                </span>
              </span>
              <span className="home-por-cobrar-kpi-zone-hint">Al día</span>
            </div>
            <div className="home-por-cobrar-kpi-zone home-por-cobrar-kpi-zone--agric">
              <span className="home-por-cobrar-kpi-zone-top">
                <Sprout size={13} strokeWidth={2} aria-hidden />
                <span className="home-por-cobrar-kpi-zone-eyebrow">Agric.</span>
              </span>
              <span className="home-por-cobrar-kpi-zone-row">
                <span className="home-por-cobrar-kpi-zone-pair">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Pend.</span>
                  <span className="home-por-cobrar-kpi-zone-value">US$ 0</span>
                </span>
                <span className="home-por-cobrar-kpi-zone-pair home-por-cobrar-kpi-zone-pair--ej">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Cobr. ej.</span>
                  <span className="home-por-cobrar-kpi-zone-value home-por-cobrar-kpi-zone-value--ej">US$ 40.300</span>
                </span>
              </span>
              <span className="home-por-cobrar-kpi-zone-hint">Al día</span>
            </div>
          </div>
        </article>
      </div>
      <div className="config-home-screen-kpi-card config-home-screen-kpi-card--wide">
        <article className="sg-hub-kpi sg-hub-kpi--dark home-resultado-ejercicio-kpi home-exec-kpi">
          <div className="home-ganado-stock-kpi-head">
            <div className="home-ganado-stock-kpi-brand">
              <span className="home-ganado-stock-kpi-icon" aria-hidden>📊</span>
              <div>
                <p className="home-ganado-stock-kpi-kicker">Resumen financiero</p>
                <p className="home-ganado-stock-kpi-subtitle">2026/2027 · acumulado</p>
              </div>
            </div>
          </div>
          <div className="home-ganado-stock-kpi-metrics is-count-3">
            <div className="home-ganado-stock-kpi-metric">
              <span className="home-ganado-stock-kpi-metric-eyebrow">Gastos del mes</span>
              <span className="home-ganado-stock-kpi-metric-value">US$ 12.400</span>
            </div>
            <div className="home-ganado-stock-kpi-metric">
              <span className="home-ganado-stock-kpi-metric-eyebrow">Gastos del año</span>
              <span className="home-ganado-stock-kpi-metric-value">US$ 98.200</span>
            </div>
            <div className="home-ganado-stock-kpi-metric home-ganado-stock-kpi-metric--ok">
              <span className="home-ganado-stock-kpi-metric-eyebrow">Ventas del año</span>
              <span className="home-ganado-stock-kpi-metric-value">US$ 186.500</span>
            </div>
          </div>
        </article>
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
    const nodes: ReactNode[] = [];
    for (const id of topOrder) {
      if (id === "kpis_operativos" && showOps) nodes.push(<div key={id}>{opsRow}</div>);
      if (id === "kpis_gastos" && showGastos) nodes.push(<div key={id}>{gastosRow}</div>);
    }
    return <div className="config-home-screen-kpis">{nodes}</div>;
  }

  return (
    <div className="config-home-screen-kpis">
      {topOrder.map((id) => {
        if (id === "kpis_operativos") {
          return (
            <EditableBlock
              key={id}
              id={id}
              label={PANEL_LABEL.kpis_operativos}
              on={showOps}
              lockedReason={lockedPanels?.kpis_operativos}
              onToggle={onToggle}
              {...dragProps(id)}
            >
              {opsRow}
            </EditableBlock>
          );
        }
        return (
          <EditableBlock
            key={id}
            id={id}
            label={PANEL_LABEL.kpis_gastos}
            on={showGastos}
            lockedReason={lockedPanels?.kpis_gastos}
            onToggle={onToggle}
            {...dragProps(id)}
          >
            {gastosRow}
          </EditableBlock>
        );
      })}
    </div>
  );
}

function PreviewPizarron() {
  return (
    <section className="config-home-screen-panel config-home-screen-panel--notes-full">
      <div className="home-hub-notes-shell">
        <header className="home-hub-notes-head">
          <div className="home-hub-notes-head-main">
            <p className="home-hub-notes-head-kicker">Recordatorios</p>
            <h2 className="home-hub-notes-head-title">Pizarrón</h2>
          </div>
          <span className="home-hub-notes-head-link">Ver todas</span>
        </header>
        <div className="home-hub-notes-board">
          <div className="home-hub-notes-carousel">
            <div className="home-hub-notes-carousel-fade">
              <div className="home-hub-notes-carousel-viewport">
                <ul className="home-hub-notes-list">
                  <li>
                    <div className="home-hub-note-card home-hub-note-card--yellow" style={{ transform: "rotate(-1.4deg)" }}>
                      <span className="home-hub-note-tape" aria-hidden />
                      <span className="home-hub-note-body">
                        <span className="home-hub-note-head">
                          <span className="home-hub-note-title">Vacunación potrero 3</span>
                        </span>
                        <span className="home-hub-note-preview">Mié 15 · equipo campo</span>
                      </span>
                    </div>
                  </li>
                  <li>
                    <div className="home-hub-note-card home-hub-note-card--blue" style={{ transform: "rotate(1deg)" }}>
                      <span className="home-hub-note-tape" aria-hidden />
                      <span className="home-hub-note-body">
                        <span className="home-hub-note-head">
                          <span className="home-hub-note-title">Revisar DGI abril</span>
                        </span>
                        <span className="home-hub-note-preview">Ayer · administración</span>
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
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
    <section className="config-home-screen-panel config-home-screen-panel--venc-full">
      <div className="home-hub-venc-shell">
        <header className="home-hub-venc-head">
          <div className="home-hub-venc-head-main">
            <p className="home-hub-venc-head-kicker">Próximos vencimientos</p>
          </div>
          <span className="home-hub-venc-head-link">Abrir</span>
        </header>
        <div className="home-hub-venc-body">
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
  asistente: "Asistente",
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
  orden = DEFAULT_HOME_PANEL_ORDER,
  interactive = false,
  onTogglePanel,
  onReorder,
  lockedPanels,
}: Props) {
  const [dragId, setDragId] = useState<HomePanelId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<HomePanelId | null>(null);
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

  const dragProps = (id: HomePanelId) => ({
    draggable: Boolean(interactive && onReorder),
    isDragging: dragId === id,
    isDropTarget: dropTargetId === id && dragId !== id,
    onDragHandleStart: setDragId,
    onDragHandleEnd: () => {
      setDragId(null);
      setDropTargetId(null);
    },
    onDragOverSlot: (slotId: HomePanelId, e: DragEvent) => {
      if (!dragId || dragId === slotId) return;
      e.preventDefault();
      setDropTargetId(slotId);
    },
    onDropOnSlot: (slotId: HomePanelId) => {
      if (!dragId || !onReorder) return;
      onReorder(moveHomePanelInOrder(orden, dragId, slotId));
      setDragId(null);
      setDropTargetId(null);
    },
  });

  const sortPanels = (panels: { id: HomePanelId; node: ReactNode }[], zone: "main" | "side") => {
    const zoneOrder = orderPanelsInZone(orden, zone);
    const map = new Map(panels.map((p) => [p.id, p]));
    return zoneOrder.map((id) => map.get(id)).filter(Boolean) as {
      id: HomePanelId;
      node: ReactNode;
    }[];
  };

  const renderColumn = (
    panels: { id: HomePanelId; node: ReactNode }[],
    zone: "main" | "side",
  ) => {
    const sorted = sortPanels(panels, zone);
    return interactive
      ? sorted.map((p) => (
          <EditableBlock
            key={p.id}
            id={p.id}
            label={PANEL_LABEL[p.id]}
            on={panelOn(paneles, p.id)}
            lockedReason={lockedPanels?.[p.id]}
            onToggle={onTogglePanel}
            {...dragProps(p.id)}
          >
            {p.node}
          </EditableBlock>
        ))
      : sorted
          .filter((p) => panelOn(paneles, p.id))
          .map((p) => <div key={p.id}>{p.node}</div>);
  };

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
            orden={orden}
            interactive={interactive}
            lockedPanels={lockedPanels}
            onToggle={onTogglePanel}
            onReorder={onReorder}
            dragId={dragId}
            dropTargetId={dropTargetId}
            setDragId={setDragId}
            setDropTargetId={setDropTargetId}
          />

          <div className="config-home-screen-panels">
            <div className="config-home-screen-panels-main">
              {renderColumn(mainPanels, "main")}
            </div>
            <div className="config-home-screen-panels-side">
              {renderColumn(sidePanels, "side")}
            </div>
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
