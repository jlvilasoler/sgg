import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Eye, EyeOff, Save, Sparkles } from "lucide-react";
import {
  actualizarHomeLayoutRol,
  fetchHomeLayoutConfig,
} from "../../api";
import {
  HOME_LAYOUT_ROLES,
  HOME_PANEL_META,
  isHomeLayoutConfigurableRol,
  normalizeHomeLayoutMap,
  normalizeHomePanelOrder,
  rolHomeLayoutLabel,
  type HomeLayoutConfigurableRol,
  type HomeLayoutMap,
  type HomePanelId,
} from "../../utils/home-layout-config";
import HomeLayoutScreenPreview from "./HomeLayoutScreenPreview";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const ROL_ACCENT: Record<HomeLayoutConfigurableRol, string> = {
  editor: "#2563eb",
  gestor_n2: "#7c3aed",
  consulta: "#0f766e",
};

export default function ConfigHomeLayout({
  apiOnline,
  onVolver,
  volverLabel = "Volver a Configuración SAG",
  onError,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRol, setActiveRol] = useState<HomeLayoutConfigurableRol>(HOME_LAYOUT_ROLES[0]);
  const [drafts, setDrafts] = useState<Partial<Record<HomeLayoutConfigurableRol, HomeLayoutMap>>>({});
  const [orderDrafts, setOrderDrafts] = useState<
    Partial<Record<HomeLayoutConfigurableRol, HomePanelId[]>>
  >({});
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchHomeLayoutConfig();
      const nextDrafts: Partial<Record<HomeLayoutConfigurableRol, HomeLayoutMap>> = {};
      const nextOrders: Partial<Record<HomeLayoutConfigurableRol, HomePanelId[]>> = {};
      for (const row of data) {
        if (!isHomeLayoutConfigurableRol(row.rol)) continue;
        nextDrafts[row.rol] = normalizeHomeLayoutMap(row.paneles);
        nextOrders[row.rol] = normalizeHomePanelOrder(row.orden);
      }
      setDrafts(nextDrafts);
      setOrderDrafts(nextOrders);
      setDirty(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cargar la configuración del inicio");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeDraft = useMemo(
    () => drafts[activeRol] ?? normalizeHomeLayoutMap(null),
    [activeRol, drafts],
  );

  const activeOrder = useMemo(
    () => normalizeHomePanelOrder(orderDrafts[activeRol]),
    [activeRol, orderDrafts],
  );

  const visibleCount = useMemo(
    () => HOME_PANEL_META.filter((p) => activeDraft[p.id]).length,
    [activeDraft],
  );

  const togglePanel = (panelId: HomePanelId) => {
    setDrafts((prev) => ({
      ...prev,
      [activeRol]: {
        ...(prev[activeRol] ?? normalizeHomeLayoutMap(null)),
        [panelId]: !(prev[activeRol]?.[panelId] ?? true),
      },
    }));
    setDirty(true);
  };

  const setAll = (visible: boolean) => {
    const next = normalizeHomeLayoutMap(null);
    for (const id of Object.keys(next) as HomePanelId[]) {
      next[id] = visible;
    }
    setDrafts((prev) => ({ ...prev, [activeRol]: next }));
    setDirty(true);
  };

  const save = async () => {
    if (!apiOnline || !dirty) return;
    setSaving(true);
    try {
      const draft = drafts[activeRol];
      const orden = orderDrafts[activeRol];
      if (!draft || !orden) return;
      const updated = await actualizarHomeLayoutRol(activeRol, draft, orden);
      setDrafts((prev) => ({
        ...prev,
        [activeRol]: normalizeHomeLayoutMap(updated.paneles),
      }));
      setOrderDrafts((prev) => ({
        ...prev,
        [activeRol]: normalizeHomePanelOrder(updated.orden),
      }));
      setDirty(false);
      onSuccess(`Inicio actualizado para ${rolHomeLayoutLabel(activeRol)}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="subseccion-panel config-home-layout">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section className="sg-hub-panel config-home-layout-card" aria-labelledby="config-home-layout-title">
        <div className="sg-hub-panel-head config-home-layout-head">
          <div>
            <p className="sg-hub-panel-kicker">Plataforma SAG</p>
            <h2 id="config-home-layout-title" className="sg-hub-panel-title">
              Inicio por tipo de cuenta
            </h2>
            <p className="config-home-layout-lead muted">
              Definí qué bloques del dashboard <strong>Inicio</strong> ve cada perfil: Gestor N1,
              Gestor N2 y Consulta (lector). Arrastrá con el ícono <strong>⠿</strong> para cambiar el
              orden dentro de cada columna.
            </p>
          </div>
          <div className="config-home-layout-head-badge" aria-hidden>
            <Sparkles size={20} />
          </div>
        </div>

        <div className="config-home-layout-role-tabs" role="tablist" aria-label="Tipo de cuenta">
          {HOME_LAYOUT_ROLES.map((rol) => {
            const accent = ROL_ACCENT[rol];
            const isActive = activeRol === rol;
            const count =
              Object.values(drafts[rol] ?? {}).filter(Boolean).length ||
              HOME_PANEL_META.length;
            return (
              <button
                key={rol}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`config-home-layout-role-tab${isActive ? " is-active" : ""}`}
                style={{ "--role-tab-accent": accent } as CSSProperties}
                onClick={() => setActiveRol(rol)}
              >
                <span className="config-home-layout-role-tab-label">{rolHomeLayoutLabel(rol)}</span>
                <span className="config-home-layout-role-tab-meta">
                  {count} bloque{count === 1 ? "" : "s"} visibles
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="config-home-layout-loading">Cargando configuración del inicio…</p>
        ) : (
          <div className="config-home-layout-workspace">
            <div className="config-home-layout-preview-wrap">
              <HomeLayoutScreenPreview
                paneles={activeDraft}
                orden={activeOrder}
                rol={activeRol}
                rolLabel={rolHomeLayoutLabel(activeRol)}
                accent={ROL_ACCENT[activeRol]}
                interactive
                onTogglePanel={(id, next) => {
                  setDrafts((prev) => ({
                    ...prev,
                    [activeRol]: {
                      ...(prev[activeRol] ?? normalizeHomeLayoutMap(null)),
                      [id]: next,
                    },
                  }));
                  setDirty(true);
                }}
                onReorder={(next) => {
                  setOrderDrafts((prev) => ({ ...prev, [activeRol]: next }));
                  setDirty(true);
                }}
              />
            </div>

            <aside className="config-home-layout-controls" aria-label="Bloques del inicio">
              <div className="config-home-layout-controls-head">
                <div>
                  <p className="config-home-layout-controls-kicker">Configuración</p>
                  <h3>{rolHomeLayoutLabel(activeRol)}</h3>
                  <p className="muted">
                    {visibleCount} de {HOME_PANEL_META.length} bloques visibles
                  </p>
                </div>
                <div className="config-home-layout-bulk">
                  <button type="button" className="home-hub-link" onClick={() => setAll(true)}>
                    Mostrar todos
                  </button>
                  <button type="button" className="home-hub-link" onClick={() => setAll(false)}>
                    Ocultar todos
                  </button>
                </div>
              </div>

              <ul className="config-home-layout-toggle-list">
                {HOME_PANEL_META.map((panel) => {
                  const on = activeDraft[panel.id];
                  return (
                    <li key={panel.id}>
                      <button
                        type="button"
                        className={`config-home-layout-toggle${on ? " is-on" : ""}`}
                        onClick={() => togglePanel(panel.id)}
                        aria-pressed={on}
                      >
                        <span className="config-home-layout-toggle-icon" aria-hidden>
                          {on ? <Eye size={16} /> : <EyeOff size={16} />}
                        </span>
                        <span className="config-home-layout-toggle-copy">
                          <strong>{panel.label}</strong>
                          <small>{panel.hint}</small>
                        </span>
                        <span className={`config-home-layout-switch${on ? " is-on" : ""}`}>
                          <span className="config-home-layout-switch-thumb" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="config-home-layout-actions">
                <button
                  type="button"
                  className="sg-hub-cta"
                  disabled={!apiOnline || saving || !dirty}
                  onClick={() => void save()}
                >
                  <Save size={16} aria-hidden />
                  {saving ? "Guardando…" : "Guardar para este perfil"}
                </button>
                <p className="config-home-layout-foot muted">
                  Los usuarios verán los cambios al volver a iniciar sesión o al refrescar su sesión.
                </p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
