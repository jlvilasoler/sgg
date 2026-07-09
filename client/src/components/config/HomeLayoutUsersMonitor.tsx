import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  LayoutGrid,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import {
  fetchHomeLayoutMonitorSnapshot,
  fetchHomeLayoutMonitorUsuario,
} from "../../api";
import type {
  HomeLayoutMonitorUsuarioDetalle,
  HomeLayoutMonitorUsuarioResumen,
  HomeLayoutMonitorSnapshot,
  Rol,
} from "../../types";
import {
  HOME_PANEL_META,
  normalizeHomeLayoutMap,
  normalizeHomePanelOrder,
  type HomePanelId,
} from "../../utils/home-layout-config";
import HomeLayoutScreenPreview from "./HomeLayoutScreenPreview";
import HomeLayoutMonitorActividadSection from "./HomeLayoutMonitorActividadSection";
import HomeLayoutMonitorCampoMapaSection from "./HomeLayoutMonitorCampoMapaSection";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
}

const ROL_ACCENT: Partial<Record<Rol, string>> = {
  admin: "#16a34a",
  editor: "#2563eb",
  gestor_n2: "#7c3aed",
  consulta: "#0f766e",
};

const ZONE_LABELS: Record<"top" | "main" | "side", string> = {
  top: "KPIs",
  main: "Columna principal",
  side: "Columna lateral",
};

const FUENTE_LABELS: Record<
  HomeLayoutMonitorUsuarioDetalle["paneles"][number]["fuente"],
  string
> = {
  rol: "Según perfil",
  usuario: "Personalizado",
  bloqueado_rol: "Oculto por perfil",
};

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

function inicialesUsuario(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtUltimoAcceso(value: string | null): string {
  if (!value) return "Sin registro";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Sin registro";
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HomeLayoutUsersMonitor({ apiOnline, onError }: Props) {
  const [snapshot, setSnapshot] = useState<HomeLayoutMonitorSnapshot | null>(null);
  const [detalle, setDetalle] = useState<HomeLayoutMonitorUsuarioDetalle | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");
  const [filtroPersonalizado, setFiltroPersonalizado] = useState<"" | "si" | "no">("");
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!apiOnline) {
      setSnapshot(null);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      setSnapshot(await fetchHomeLayoutMonitorSnapshot());
      setUltimaActualizacion(new Date());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar monitor de usuarios");
      setSnapshot(null);
    } finally {
      setLoadingList(false);
    }
  }, [apiOnline, onError]);

  const loadDetalle = useCallback(
    async (userId: number) => {
      if (!apiOnline) return;
      setLoadingDetalle(true);
      try {
        setDetalle(await fetchHomeLayoutMonitorUsuario(userId));
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al cargar detalle del usuario");
        setDetalle(null);
      } finally {
        setLoadingDetalle(false);
      }
    },
    [apiOnline, onError],
  );

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (selectedId == null) {
      setDetalle(null);
      return;
    }
    void loadDetalle(selectedId);
  }, [selectedId, loadDetalle]);

  const rolesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const row of snapshot?.usuarios ?? []) set.add(row.rol);
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [snapshot]);

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const base = snapshot?.usuarios ?? [];
    return base.filter((row) => {
      if (filtroEstado === "activo" && !row.activo) return false;
      if (filtroEstado === "inactivo" && row.activo) return false;
      if (filtroRol && row.rol !== filtroRol) return false;
      if (filtroPersonalizado === "si" && !row.tiene_personalizacion) return false;
      if (filtroPersonalizado === "no" && row.tiene_personalizacion) return false;
      if (!q) return true;
      return (
        row.nombre.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.cuenta_nombre ?? "").toLowerCase().includes(q) ||
        (row.cuenta_codigo ?? "").toLowerCase().includes(q) ||
        row.rol_label.toLowerCase().includes(q)
      );
    });
  }, [snapshot, filtroTexto, filtroRol, filtroEstado, filtroPersonalizado]);

  const totales = snapshot?.totales;
  const kpiPlaceholder = loadingList || !apiOnline ? "—" : undefined;
  const hayFiltros = Boolean(
    filtroTexto.trim() || filtroRol || filtroEstado || filtroPersonalizado,
  );

  const syncLabel = loadingList
    ? "Actualizando monitor…"
    : !apiOnline
      ? "Sin conexión con la API"
      : ultimaActualizacion
        ? `Actualizado ${ultimaActualizacion.toLocaleString("es-UY", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "Monitor listo";

  const refreshAll = () => {
    void loadSnapshot();
    if (selectedId != null) void loadDetalle(selectedId);
  };

  const openUsuario = (row: HomeLayoutMonitorUsuarioResumen) => {
    setSelectedId(row.id);
  };

  const previewPaneles = useMemo(
    () => normalizeHomeLayoutMap(detalle?.efectivo),
    [detalle],
  );
  const previewOrden = useMemo(
    () => normalizeHomePanelOrder(detalle?.orden),
    [detalle],
  );

  const panelesPorZona = useMemo(() => {
    const empty: Record<
      "top" | "main" | "side",
      HomeLayoutMonitorUsuarioDetalle["paneles"]
    > = { top: [], main: [], side: [] };
    if (!detalle) return empty;
    const buckets: Record<
      "top" | "main" | "side",
      HomeLayoutMonitorUsuarioDetalle["paneles"]
    > = { top: [], main: [], side: [] };
    const order = previewOrden;
    const byId = new Map(detalle.paneles.map((p) => [p.id, p]));
    for (const id of order) {
      const panel = byId.get(id as HomePanelId);
      if (!panel) continue;
      buckets[panel.zone].push(panel);
    }
    return buckets;
  }, [detalle, previewOrden]);

  return (
    <div className="home-layout-users-monitor">
      <section
        className="sg-hub-kpi-strip home-hub-kpi-strip home-layout-users-monitor-kpi-strip"
        aria-label="Resumen del monitor"
      >
        <SgHubKpi
          kicker="Usuarios"
          value={kpiPlaceholder ?? fmtEntero(totales?.usuarios ?? 0)}
          hint="Total en plataforma con acceso a SAG"
          trend="Cuentas"
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          kicker="Activos"
          value={kpiPlaceholder ?? fmtEntero(totales?.usuarios_activos ?? 0)}
          hint="Usuarios que pueden iniciar sesión"
          trend="En línea"
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          kicker="Personalización"
          value={kpiPlaceholder ?? fmtEntero(totales?.con_personalizacion ?? 0)}
          hint="Ajustaron bloques u orden del Inicio"
          bars={<SgMiniBars />}
        />
      </section>

      <div className="home-layout-users-monitor-toolbar">
        <div className="home-layout-users-monitor-toolbar-filters">
          <label className="home-layout-users-monitor-search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, email o cuenta…"
              aria-label="Buscar usuario"
            />
          </label>
          <label className="home-layout-users-monitor-select-wrap">
            <span>Perfil</span>
            <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
              <option value="">Todos</option>
              {rolesDisponibles.map((rol) => (
                <option key={rol} value={rol}>
                  {snapshot?.usuarios.find((u) => u.rol === rol)?.rol_label ?? rol}
                </option>
              ))}
            </select>
          </label>
          <label className="home-layout-users-monitor-select-wrap">
            <span>Estado</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "inactivo")}
            >
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </label>
          <label className="home-layout-users-monitor-select-wrap">
            <span>Inicio</span>
            <select
              value={filtroPersonalizado}
              onChange={(e) => setFiltroPersonalizado(e.target.value as "" | "si" | "no")}
            >
              <option value="">Todos</option>
              <option value="si">Personalizado</option>
              <option value="no">Solo perfil</option>
            </select>
          </label>
        </div>
        <div className="home-layout-users-monitor-toolbar-actions">
          <span className="home-layout-users-monitor-sync muted">{syncLabel}</span>
          <button
            type="button"
            className="btn btn-secondary home-layout-users-monitor-refresh"
            onClick={refreshAll}
            disabled={!apiOnline || loadingList}
          >
            <RefreshCw size={15} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      <div className="home-layout-users-monitor-split">
        <aside className="home-layout-users-monitor-list-panel" aria-label="Usuarios">
          <div className="home-layout-users-monitor-list-head">
            <h3>
              <Users size={16} aria-hidden />
              Usuarios
            </h3>
            <span className="muted">
              {filas.length} de {snapshot?.usuarios.length ?? 0}
              {hayFiltros ? " (filtrado)" : ""}
            </span>
          </div>
          <div className="home-layout-users-monitor-list-wrap">
            {loadingList ? (
              <p className="home-layout-users-monitor-empty muted">Cargando usuarios…</p>
            ) : filas.length === 0 ? (
              <p className="home-layout-users-monitor-empty muted">
                No hay usuarios que coincidan con los filtros.
              </p>
            ) : (
              <ul className="home-layout-users-monitor-user-list">
                {filas.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`home-layout-users-monitor-user-item${
                        selectedId === row.id ? " is-active" : ""
                      }`}
                      onClick={() => openUsuario(row)}
                    >
                      <span className="home-layout-users-monitor-user-avatar" aria-hidden>
                        {inicialesUsuario(row.nombre)}
                      </span>
                      <span className="home-layout-users-monitor-user-copy">
                        <span className="home-layout-users-monitor-user-name">{row.nombre}</span>
                        <span className="home-layout-users-monitor-user-meta muted">
                          {row.rol_label}
                          {row.cuenta_nombre ? ` · ${row.cuenta_nombre}` : ""}
                        </span>
                        <span className="home-layout-users-monitor-user-stats">
                          <span>
                            {row.paneles_visibles}/{row.paneles_total} bloques
                          </span>
                          {row.tiene_personalizacion ? (
                            <span className="home-layout-users-monitor-badge home-layout-users-monitor-badge--custom">
                              Personalizado
                            </span>
                          ) : (
                            <span className="home-layout-users-monitor-badge">Perfil</span>
                          )}
                          {!row.activo ? (
                            <span className="home-layout-users-monitor-badge home-layout-users-monitor-badge--off">
                              Inactivo
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="home-layout-users-monitor-detail" aria-label="Detalle del usuario">
          {!selectedId ? (
            <div className="home-layout-users-monitor-detail-empty">
              <LayoutGrid size={28} aria-hidden />
              <h3>Monitor de control</h3>
              <p className="muted">
                Elegí un usuario de la lista para ver exactamente qué bloques tiene visibles en su
                Inicio y en qué orden los ve.
              </p>
            </div>
          ) : loadingDetalle || !detalle ? (
            <p className="home-layout-users-monitor-empty muted">Cargando configuración…</p>
          ) : (
            <>
              <header className="home-layout-users-monitor-detail-head">
                <div>
                  <p className="sg-hub-panel-kicker">Usuario seleccionado</p>
                  <h3>{detalle.nombre}</h3>
                  <p className="muted">
                    {detalle.email} · {detalle.rol_label}
                    {detalle.cuenta_nombre ? ` · ${detalle.cuenta_nombre}` : ""}
                  </p>
                </div>
                <div className="home-layout-users-monitor-detail-badges">
                  <span
                    className={`home-layout-users-monitor-status${
                      detalle.activo ? " is-on" : " is-off"
                    }`}
                  >
                    {detalle.activo ? "Activo" : "Inactivo"}
                  </span>
                  {detalle.tiene_personalizacion ? (
                    <span className="home-layout-users-monitor-status is-custom">
                      Inicio personalizado
                    </span>
                  ) : (
                    <span className="home-layout-users-monitor-status">Solo perfil del rol</span>
                  )}
                </div>
              </header>

              <div className="home-layout-users-monitor-detail-meta muted">
                <span>
                  <UserRound size={14} aria-hidden /> Último acceso:{" "}
                  {fmtUltimoAcceso(detalle.ultimo_acceso)}
                </span>
                <span>
                  <Eye size={14} aria-hidden /> Ve {detalle.paneles_visibles} de{" "}
                  {detalle.paneles_total} bloques
                </span>
                {detalle.orden_personalizado ? (
                  <span>Orden distinto al del perfil</span>
                ) : null}
              </div>

              <div className="home-layout-users-monitor-workspace">
                <div className="home-layout-users-monitor-preview-wrap">
                  <p className="home-layout-users-monitor-preview-label">
                    Vista real del Inicio de este usuario
                  </p>
                  <HomeLayoutScreenPreview
                    paneles={previewPaneles}
                    orden={previewOrden}
                    rol={detalle.rol as Rol}
                    rolLabel={detalle.rol_label}
                    accent={ROL_ACCENT[detalle.rol as Rol] ?? "#2563eb"}
                  />
                </div>

                <aside className="home-layout-users-monitor-panels" aria-label="Bloques del inicio">
                  <div className="home-layout-users-monitor-panels-head">
                    <h4>Control por bloque</h4>
                    <p className="muted">
                      Qué ve realmente, qué permite su perfil y si lo personalizó.
                    </p>
                  </div>

                  {(["top", "main", "side"] as const).map((zone) => {
                    const items = panelesPorZona[zone];
                    if (items.length === 0) return null;
                    return (
                      <div key={zone} className="home-layout-users-monitor-zone">
                        <p className="home-layout-users-monitor-zone-label">{ZONE_LABELS[zone]}</p>
                        <ul className="home-layout-users-monitor-panel-list">
                          {items.map((panel) => {
                            const meta = HOME_PANEL_META.find((p) => p.id === panel.id);
                            return (
                              <li
                                key={panel.id}
                                className={`home-layout-users-monitor-panel-item${
                                  panel.visible_efectivo ? " is-on" : " is-off"
                                }`}
                              >
                                <span className="home-layout-users-monitor-panel-icon" aria-hidden>
                                  {panel.visible_efectivo ? (
                                    <Eye size={15} />
                                  ) : (
                                    <EyeOff size={15} />
                                  )}
                                </span>
                                <span className="home-layout-users-monitor-panel-copy">
                                  <strong>{meta?.label ?? panel.label}</strong>
                                  <small>{meta?.hint ?? panel.label}</small>
                                </span>
                                <span
                                  className={`home-layout-users-monitor-panel-fuente home-layout-users-monitor-panel-fuente--${panel.fuente}`}
                                >
                                  {FUENTE_LABELS[panel.fuente]}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </aside>
              </div>

              <div className="home-layout-users-monitor-extra-stack">
                <HomeLayoutMonitorActividadSection
                  apiOnline={apiOnline}
                  email={detalle.email}
                  onError={onError}
                />
                <HomeLayoutMonitorCampoMapaSection
                  apiOnline={apiOnline}
                  userId={detalle.id}
                  cuentaNombre={detalle.cuenta_nombre}
                  onError={onError}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
