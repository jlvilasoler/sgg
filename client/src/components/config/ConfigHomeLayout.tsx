import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Eye, EyeOff, Save, Sparkles } from "lucide-react";
import {
  actualizarHomeLayoutRol,
  actualizarRolePermissions,
  fetchHomeLayoutConfig,
  fetchRolePermissions,
} from "../../api";
import type { HomeLayoutConfigurableRol, HomeLayoutMap, HomePanelId } from "../../utils/home-layout-config";
import {
  HOME_LAYOUT_ROLES,
  HOME_PANEL_TOGGLE_META,
  applyHomePanelToggle,
  countVisibleHomeTogglePanels,
  isHomeLayoutConfigurableRol,
  normalizeHomeLayoutMap,
  normalizeHomePanelOrder,
  rolHomeLayoutLabel,
} from "../../utils/home-layout-config";
import type { RolPermisosInput } from "../../types";
import {
  countModulosHabilitados,
  desmarcarTodosModulosPermiso,
  marcarTodosModulosPermiso,
  rolPermisosToInput,
  setModoEdicionModulo,
  toggleModuloPermiso,
  type ModoEdicionModulo,
} from "../../utils/rol-modulos-config";
import ConfigRolAlcanceInfoButton from "./ConfigRolAlcanceInfoButton";
import ConfigRolModulosPanel from "./ConfigRolModulosPanel";
import HomeLayoutScreenPreview from "./HomeLayoutScreenPreview";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const ROL_ACCENT: Record<HomeLayoutConfigurableRol, string> = {
  admin: "#16a34a",
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
  const [permDrafts, setPermDrafts] = useState<
    Partial<Record<HomeLayoutConfigurableRol, RolPermisosInput>>
  >({});
  const [layoutDirty, setLayoutDirty] = useState(false);
  const [permDirty, setPermDirty] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [layoutData, permData] = await Promise.all([
        fetchHomeLayoutConfig(),
        fetchRolePermissions(),
      ]);
      const nextDrafts: Partial<Record<HomeLayoutConfigurableRol, HomeLayoutMap>> = {};
      const nextOrders: Partial<Record<HomeLayoutConfigurableRol, HomePanelId[]>> = {};
      for (const row of layoutData) {
        if (!isHomeLayoutConfigurableRol(row.rol)) continue;
        nextDrafts[row.rol] = normalizeHomeLayoutMap(row.paneles);
        nextOrders[row.rol] = normalizeHomePanelOrder(row.orden);
      }
      for (const rol of HOME_LAYOUT_ROLES) {
        if (!nextDrafts[rol]) nextDrafts[rol] = normalizeHomeLayoutMap(null);
        if (!nextOrders[rol]) nextOrders[rol] = normalizeHomePanelOrder(null);
      }
      const nextPerms: Partial<Record<HomeLayoutConfigurableRol, RolPermisosInput>> = {};
      for (const row of permData) {
        if (!isHomeLayoutConfigurableRol(row.rol)) continue;
        nextPerms[row.rol] = rolPermisosToInput(row);
      }
      if (!nextPerms.admin) {
        nextPerms.admin = {
          puede_escribir: true,
          modulos: { asistente: true },
          modulos_solo_lectura: {},
        };
      } else if (typeof nextPerms.admin.modulos.asistente !== "boolean") {
        nextPerms.admin = {
          ...nextPerms.admin,
          modulos: { ...nextPerms.admin.modulos, asistente: true },
        };
      }
      setDrafts(nextDrafts);
      setOrderDrafts(nextOrders);
      setPermDrafts(nextPerms);
      setLayoutDirty(false);
      setPermDirty(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
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

  const activePermDraft = permDrafts[activeRol] ?? null;

  const visibleBlocks = useMemo(
    () => countVisibleHomeTogglePanels(activeDraft),
    [activeDraft],
  );

  const dirty = layoutDirty || permDirty;

  const togglePanel = (panelId: HomePanelId) => {
    setDrafts((prev) => {
      const current = prev[activeRol] ?? normalizeHomeLayoutMap(null);
      const nextVisible = !(current[panelId] ?? true);
      return {
        ...prev,
        [activeRol]: applyHomePanelToggle(current, panelId, nextVisible),
      };
    });
    setLayoutDirty(true);
  };

  const setAllPanels = (visible: boolean) => {
    const next = normalizeHomeLayoutMap(null);
    for (const id of Object.keys(next) as HomePanelId[]) {
      next[id] = visible;
    }
    setDrafts((prev) => ({ ...prev, [activeRol]: next }));
    setLayoutDirty(true);
  };

  const updatePermDraft = (next: RolPermisosInput) => {
    setPermDrafts((prev) => ({ ...prev, [activeRol]: next }));
    setPermDirty(true);
  };

  const save = async () => {
    if (!apiOnline || !dirty) return;
    const draft = drafts[activeRol];
    const orden = orderDrafts[activeRol];
    const permDraft = permDrafts[activeRol];
    const puedeGuardarPermisos =
      permDirty &&
      Boolean(permDraft) &&
      (activeRol !== "admin" || typeof permDraft?.modulos.asistente === "boolean");
    if (!draft || !orden) return;
    if (puedeGuardarPermisos && !permDraft) return;
    if (
      puedeGuardarPermisos &&
      activeRol !== "admin" &&
      countModulosHabilitados(permDraft, activeRol) === 0
    ) {
      onError("Activá al menos un módulo para este tipo de cuenta.");
      return;
    }
    if (!layoutDirty && !puedeGuardarPermisos) return;

    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];
      if (layoutDirty) {
        tasks.push(
          actualizarHomeLayoutRol(activeRol, draft, orden).then((updated) => {
            setDrafts((prev) => ({
              ...prev,
              [activeRol]: normalizeHomeLayoutMap(updated.paneles),
            }));
            setOrderDrafts((prev) => ({
              ...prev,
              [activeRol]: normalizeHomePanelOrder(updated.orden),
            }));
          }),
        );
      }
      if (puedeGuardarPermisos && permDraft) {
        const payload: RolPermisosInput =
          activeRol === "admin"
            ? {
                puede_escribir: true,
                modulos: { asistente: Boolean(permDraft.modulos.asistente) },
                modulos_solo_lectura: {},
              }
            : permDraft;
        tasks.push(
          actualizarRolePermissions(activeRol, payload).then((updated) => {
            setPermDrafts((prev) => ({
              ...prev,
              [activeRol]: rolPermisosToInput(updated),
            }));
          }),
        );
      }
      await Promise.all(tasks);
      setLayoutDirty(false);
      setPermDirty(false);
      onSuccess(`Configuración actualizada para ${rolHomeLayoutLabel(activeRol)}`);
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
              Definí el <strong>alcance</strong>, los <strong>módulos del menú</strong> y los{" "}
              <strong>bloques del Inicio</strong> para Administrador, Gestor N1, Gestor N2 y Consulta.
              Arrastrá con el ícono <strong>⠿</strong> para reordenar los bloques del dashboard. En
              Administrador el resto de módulos es fijo; solo el <strong>Asistente</strong> se puede
              prender o apagar.
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
            const blocks =
              countVisibleHomeTogglePanels(drafts[rol] ?? normalizeHomeLayoutMap(null)) ||
              HOME_PANEL_TOGGLE_META.length;
            const modules = countModulosHabilitados(permDrafts[rol], rol);
            const rolLabel = rolHomeLayoutLabel(rol);
            return (
              <div
                key={rol}
                className={`config-home-layout-role-tab-wrap${isActive ? " is-active" : ""}`}
                style={{ "--role-tab-accent": accent } as CSSProperties}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`config-home-layout-role-tab${isActive ? " is-active" : ""}`}
                  onClick={() => setActiveRol(rol)}
                >
                  <span className="config-home-layout-role-tab-label">{rolLabel}</span>
                  <span className="config-home-layout-role-tab-meta">
                    {blocks} bloque{blocks === 1 ? "" : "s"} · {modules} módulo
                    {modules === 1 ? "" : "s"}
                  </span>
                </button>
                <ConfigRolAlcanceInfoButton rol={rol} accent={accent} rolLabel={rolLabel} />
              </div>
            );
          })}
        </div>

        {loading ? (
          <p className="config-home-layout-loading">Cargando configuración del inicio…</p>
        ) : (
          <div className="config-home-layout-workspace">
            <div className="config-home-layout-top">
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
                      [activeRol]: applyHomePanelToggle(
                        prev[activeRol] ?? normalizeHomeLayoutMap(null),
                        id,
                        next,
                      ),
                    }));
                    setLayoutDirty(true);
                  }}
                  onReorder={(next) => {
                    setOrderDrafts((prev) => ({ ...prev, [activeRol]: next }));
                    setLayoutDirty(true);
                  }}
                />
              </div>

              <div className="config-home-layout-sidebar">
                <section
                  className="config-home-layout-section config-home-layout-section--blocks"
                  aria-label="Bloques del inicio"
                >
                  <header className="config-home-layout-section-head config-home-layout-section-head--split">
                    <div>
                      <p className="config-home-layout-section-kicker">Dashboard Inicio</p>
                      <h3>Bloques visibles</h3>
                      <p className="config-home-layout-section-lead muted">
                        {visibleBlocks} de {HOME_PANEL_TOGGLE_META.length} bloques visibles en el
                        inicio.
                      </p>
                    </div>
                    <div className="config-home-layout-bulk">
                      <button
                        type="button"
                        className="home-hub-link"
                        onClick={() => setAllPanels(true)}
                      >
                        Mostrar todos
                      </button>
                      <button
                        type="button"
                        className="home-hub-link"
                        onClick={() => setAllPanels(false)}
                      >
                        Ocultar todos
                      </button>
                    </div>
                  </header>

                  <ul className="config-home-layout-toggle-list">
                    {HOME_PANEL_TOGGLE_META.map((panel) => {
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
                </section>
              </div>
            </div>

            <div className="config-home-layout-bottom">
              <ConfigRolModulosPanel
                rol={activeRol}
                draft={activePermDraft}
                onToggleModulo={(modulo, activo) => {
                  if (!activePermDraft) return;
                  updatePermDraft(toggleModuloPermiso(activePermDraft, activeRol, modulo, activo));
                }}
                onSetModo={(modulo, modo: ModoEdicionModulo) => {
                  if (!activePermDraft) return;
                  updatePermDraft(setModoEdicionModulo(activePermDraft, modulo, modo));
                }}
                onPuedeEscribirChange={(value) => {
                  if (!activePermDraft) return;
                  updatePermDraft({ ...activePermDraft, puede_escribir: value });
                }}
                onMarcarTodos={() => {
                  if (!activePermDraft) return;
                  updatePermDraft(marcarTodosModulosPermiso(activePermDraft, activeRol));
                }}
                onDesmarcarTodos={() => {
                  if (!activePermDraft) return;
                  updatePermDraft(desmarcarTodosModulosPermiso(activePermDraft));
                }}
              />

              <div className="config-home-layout-actions">
                <button
                  type="button"
                  className="sg-hub-cta"
                  disabled={!apiOnline || saving || !dirty}
                  onClick={() => void save()}
                >
                  <Save size={16} aria-hidden />
                  {saving ? "Guardando…" : `Guardar ${rolHomeLayoutLabel(activeRol)}`}
                </button>
                <p className="config-home-layout-foot muted">
                  Los usuarios verán módulos e inicio actualizados al refrescar la sesión.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
