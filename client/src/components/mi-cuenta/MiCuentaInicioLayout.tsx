import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { actualizarMiHomeLayout, fetchMiHomeLayout } from "../../api";
import type { AuthUser, Rol } from "../../types";
import {
  HOME_PANEL_TOGGLE_META,
  applyHomePanelToggle,
  homeLayoutAllVisible,
  normalizeHomePanelOrder,
  type HomeLayoutMap,
  type HomePanelId,
  type MyHomeLayoutConfig,
} from "../../utils/home-layout-config";
import {
  canAccessScreen,
  canAprobarGastosAutomatizacion,
  listHomeActividadPanels,
} from "../../utils/auth-permissions";
import HomeLayoutScreenPreview from "../config/HomeLayoutScreenPreview";

const ROL_ACCENT: Record<Rol, string> = {
  admin: "#166534",
  editor: "#2563eb",
  gestor_n2: "#7c3aed",
  consulta: "#0f766e",
};

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onUserUpdated: (user: AuthUser) => void;
  onError: (msg: string) => void;
}

/** Un bloque solo es configurable si el usuario tiene el permiso subyacente para verlo. */
function panelPermitidoPorPermisos(user: AuthUser, panelId: HomePanelId): boolean {
  switch (panelId) {
    case "pizarron":
      return canAccessScreen(user, "notas");
    case "auto_pendientes":
      return canAprobarGastosAutomatizacion(user);
    case "actividad":
      return listHomeActividadPanels(user).length > 0;
    case "mapa_campo":
      return canAccessScreen(user, "campo_mapa");
    case "vencimientos":
      return canAccessScreen(user, "vencimientos_impuestos");
    case "stock_potrero":
      return canAccessScreen(user, "stock_ganadero");
    case "stock_equino_potrero":
      return canAccessScreen(user, "stock_equino");
    default:
      return true;
  }
}

export default function MiCuentaInicioLayout({
  user,
  apiOnline,
  onUserUpdated,
  onError,
}: Props) {
  const [config, setConfig] = useState<MyHomeLayoutConfig | null>(null);
  const [draft, setDraft] = useState<Record<HomePanelId, boolean> | null>(null);
  const [orderDraft, setOrderDraft] = useState<HomePanelId[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMiHomeLayout();
      setConfig(data);
      setDraft({ ...data.overrides });
      setOrderDraft(normalizeHomePanelOrder(data.orden));
      setDirty(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo cargar tu configuración de inicio");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const panelState = useMemo(() => {
    return HOME_PANEL_TOGGLE_META.map((panel) => {
      const permitidoRol = config ? config.ceiling[panel.id] !== false : true;
      const permitidoPermiso = panelPermitidoPorPermisos(user, panel.id);
      const disponible = permitidoRol && permitidoPermiso;
      const on = disponible && (draft ? draft[panel.id] !== false : true);
      const motivoBloqueo = !permitidoRol
        ? "Deshabilitado por el administrador"
        : !permitidoPermiso
          ? "No disponible con tus permisos"
          : null;
      return { panel, disponible, on, motivoBloqueo };
    });
  }, [config, draft, user]);

  const visibles = useMemo(
    () => panelState.filter((p) => p.disponible && p.on).length,
    [panelState],
  );
  const configurables = useMemo(
    () => panelState.filter((p) => p.disponible).length,
    [panelState],
  );

  const previewPaneles = useMemo<HomeLayoutMap>(() => {
    const map = homeLayoutAllVisible();
    for (const { panel, disponible, on } of panelState) {
      map[panel.id] = disponible && on;
    }
    return map;
  }, [panelState]);

  const lockedPanels = useMemo<Partial<Record<HomePanelId, string>>>(() => {
    const m: Partial<Record<HomePanelId, string>> = {};
    for (const { panel, disponible, motivoBloqueo } of panelState) {
      if (!disponible && motivoBloqueo) m[panel.id] = motivoBloqueo;
    }
    return m;
  }, [panelState]);

  const setPanelVisible = (panelId: HomePanelId, next: boolean) => {
    if (lockedPanels[panelId]) return;
    setDraft((prev) =>
      prev ? applyHomePanelToggle(prev, panelId, next) : prev,
    );
    setDirty(true);
    setGuardadoOk(false);
  };

  const setAll = (visible: boolean) => {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const { panel, disponible } of panelState) {
        if (disponible) next[panel.id] = visible;
      }
      return next;
    });
    setDirty(true);
    setGuardadoOk(false);
  };

  const save = async () => {
    if (!apiOnline || !dirty || !draft || !orderDraft) return;
    setSaving(true);
    try {
      const { config: nextConfig, user: nextUser } = await actualizarMiHomeLayout(
        draft,
        orderDraft,
      );
      setConfig(nextConfig);
      setDraft({ ...nextConfig.overrides });
      setOrderDraft(normalizeHomePanelOrder(nextConfig.orden));
      setDirty(false);
      setGuardadoOk(true);
      if (nextUser) onUserUpdated(nextUser);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar tu inicio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="sg-hub-panel mi-cuenta-panel mi-cuenta-inicio-panel"
      aria-labelledby="mi-cuenta-inicio-title"
    >
      <header className="mi-cuenta-block-head">
        <h3 id="mi-cuenta-inicio-title" className="mi-cuenta-block-title">
          Bloques de tu inicio
        </h3>
        <p className="mi-cuenta-block-desc muted">
          Elegí qué mostrar en tu dashboard <strong>Inicio</strong>. Solo podés activar bloques
          habilitados para tu rol ({user.rol_label}) y tus permisos. No podés ver bloques que el
          administrador restringió.
        </p>
      </header>

      {loading ? (
        <p className="mi-cuenta-inicio-loading muted">Cargando tu configuración…</p>
      ) : !config || !draft || !orderDraft ? (
        <p className="mi-cuenta-inicio-loading muted">
          {apiOnline ? "No se pudo cargar tu configuración." : "Sin conexión con el servidor."}
        </p>
      ) : (
        <div className="mi-cuenta-inicio-editor">
          <div className="mi-cuenta-inicio-toolbar">
            <p className="mi-cuenta-inicio-toolbar-count muted">
              {visibles} de {configurables} bloque{configurables === 1 ? "" : "s"} visibles
            </p>
            <div className="mi-cuenta-inicio-toolbar-actions">
              <button type="button" className="home-hub-link" onClick={() => setAll(true)}>
                Mostrar todos
              </button>
              <button type="button" className="home-hub-link" onClick={() => setAll(false)}>
                Ocultar todos
              </button>
              <button
                type="button"
                className="sg-hub-cta"
                disabled={!apiOnline || saving || !dirty}
                onClick={() => void save()}
              >
                <Save size={16} aria-hidden />
                {saving ? "Guardando…" : "Guardar mi inicio"}
              </button>
            </div>
          </div>

          <p className="mi-cuenta-inicio-hint muted">
            Arrastrá con el ícono <strong>⠿</strong> para cambiar el orden de los bloques dentro de
            cada columna. Tocá la <strong>✕</strong> para quitar un bloque. Los espacios punteados
            permiten volver a agregarlo.
            {guardadoOk ? " Cambios guardados." : ""}
          </p>

          <div className="mi-cuenta-inicio-canvas">
            <HomeLayoutScreenPreview
              paneles={previewPaneles}
              orden={orderDraft ?? undefined}
              rol={user.rol}
              rolLabel={user.rol_label}
              accent={ROL_ACCENT[user.rol] ?? ROL_ACCENT.editor}
              interactive
              onTogglePanel={setPanelVisible}
              onReorder={(next) => {
                setOrderDraft(next);
                setDirty(true);
                setGuardadoOk(false);
              }}
              lockedPanels={lockedPanels}
            />
          </div>
        </div>
      )}
    </section>
  );
}
