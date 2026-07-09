import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  Shield,
  Users,
} from "lucide-react";
import {
  fetchGastosRubrosMonitorCuenta,
  fetchGastosRubrosMonitorSnapshot,
} from "../../api";
import type {
  RubrosMonitorCuentaDetalle,
  RubrosMonitorCuentaResumen,
  RubrosMonitorPermisos,
  RubrosMonitorSnapshot,
} from "../../types";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
}

type DetalleVista = "catalogo" | "usuarios";

const PERMISO_LABELS: { key: keyof RubrosMonitorPermisos; label: string; hint: string }[] = [
  { key: "ver_en_gastos", label: "Ver en gastos", hint: "Módulo presupuesto" },
  { key: "editar_catalogo", label: "Editar catálogo", hint: "Admin cuenta o superadmin" },
  { key: "crear_desde_gasto", label: "Crear al ingresar", hint: "Alta desde Ingresar gastos" },
  { key: "eliminar_catalogo", label: "Eliminar rubros", hint: "Solo superadmin" },
  { key: "eliminar_items", label: "Eliminar ítems", hint: "Admin cuenta o superadmin" },
];

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

function inicialesCuenta(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function PermisoChip({
  activo,
  label,
  hint,
}: {
  activo: boolean;
  label: string;
  hint: string;
}) {
  return (
    <span
      className={`rubros-sag-monitor-perm${activo ? " rubros-sag-monitor-perm--on" : ""}`}
      title={hint}
    >
      {label}
    </span>
  );
}

export default function RubrosSagMonitor({ apiOnline, onError }: Props) {
  const [snapshot, setSnapshot] = useState<RubrosMonitorSnapshot | null>(null);
  const [detalle, setDetalle] = useState<RubrosMonitorCuentaDetalle | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");
  const [filtroPropios, setFiltroPropios] = useState<"" | "con_propios" | "solo_sag">("");
  const [detalleVista, setDetalleVista] = useState<DetalleVista>("catalogo");
  const [gruposAbiertos, setGruposAbiertos] = useState<Set<string>>(new Set());
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const loadSnapshot = useCallback(async () => {
    if (!apiOnline) {
      setSnapshot(null);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    try {
      setSnapshot(await fetchGastosRubrosMonitorSnapshot());
      setUltimaActualizacion(new Date());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar monitor de rubros");
      setSnapshot(null);
    } finally {
      setLoadingList(false);
    }
  }, [apiOnline, onError]);

  const loadDetalle = useCallback(
    async (cuentaId: number) => {
      if (!apiOnline) return;
      setLoadingDetalle(true);
      try {
        const data = await fetchGastosRubrosMonitorCuenta(cuentaId);
        setDetalle(data);
        setGruposAbiertos(new Set(data.grupos_catalogo.slice(0, 3).map((g) => g.nombre)));
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al cargar detalle de cuenta");
        setDetalle(null);
      } finally {
        setLoadingDetalle(false);
      }
    },
    [apiOnline, onError]
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

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const base = snapshot?.cuentas ?? [];
    return base.filter((row) => {
      if (filtroEstado === "activo" && !row.activo) return false;
      if (filtroEstado === "inactivo" && row.activo) return false;
      if (filtroPropios === "con_propios" && row.sub_propios <= 0) return false;
      if (filtroPropios === "solo_sag" && row.sub_propios > 0) return false;
      if (!q) return true;
      return (
        row.nombre.toLowerCase().includes(q) ||
        row.codigo.toLowerCase().includes(q) ||
        row.cuenta_numero.toLowerCase().includes(q)
      );
    });
  }, [snapshot, filtroTexto, filtroEstado, filtroPropios]);

  const hayFiltros = Boolean(filtroTexto.trim() || filtroEstado || filtroPropios);
  const totales = snapshot?.totales;
  const kpiPlaceholder = loadingList || !apiOnline ? "—" : undefined;

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

  const openCuenta = (row: RubrosMonitorCuentaResumen) => {
    setSelectedId(row.id);
    setDetalleVista("catalogo");
  };

  const toggleGrupo = (nombre: string) => {
    setGruposAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const refreshAll = () => {
    void loadSnapshot();
    if (selectedId != null) void loadDetalle(selectedId);
  };

  return (
    <div className="rubros-sag-monitor">
      <section
        className="sg-hub-kpi-strip home-hub-kpi-strip rubros-sag-monitor-kpi-strip"
        aria-label="Resumen del monitor"
        style={{ "--home-hub-kpi-cols": "4" } as CSSProperties}
      >
        <SgHubKpi
          variant="dark"
          kicker="Cuentas"
          value={kpiPlaceholder ?? String(totales?.cuentas ?? 0)}
          hint={
            kpiPlaceholder
              ? "—"
              : `${totales?.cuentas_activas ?? 0} activa${(totales?.cuentas_activas ?? 0) === 1 ? "" : "s"}`
          }
          trend="Plataforma"
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          variant="dark"
          kicker="Sub-rubros SAG"
          value={kpiPlaceholder ?? fmtEntero(totales?.sub_rubros_sag ?? 0)}
          hint="Catálogo base compartido"
          bars={<SgMiniBars />}
        />
        <SgHubKpi
          variant="light"
          kicker="Sub-rubros propios"
          value={kpiPlaceholder ?? fmtEntero(totales?.sub_rubros_propios ?? 0)}
          hint="Creados por cuentas"
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          variant="light"
          kicker="En pantalla"
          value={kpiPlaceholder ?? fmtEntero(filas.length)}
          hint={hayFiltros ? "Con filtros aplicados" : "Todas las cuentas"}
          trend="Filtro"
          bars={<SgMiniBars />}
        />
      </section>

      <div className="rubros-sag-monitor-toolbar">
        <div className="rubros-sag-monitor-toolbar-filters">
          <label className="rubros-sag-monitor-search">
            <Search size={16} aria-hidden />
            <input
              type="search"
              placeholder="Buscar cuenta, código o número…"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              aria-label="Buscar cuenta"
            />
          </label>
          <label className="rubros-sag-monitor-select-wrap">
            <span className="muted">Estado</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "inactivo")}
            >
              <option value="">Todas</option>
              <option value="activo">Activas</option>
              <option value="inactivo">Inactivas</option>
            </select>
          </label>
          <label className="rubros-sag-monitor-select-wrap">
            <span className="muted">Catálogo</span>
            <select
              value={filtroPropios}
              onChange={(e) =>
                setFiltroPropios(e.target.value as "" | "con_propios" | "solo_sag")
              }
            >
              <option value="">Todas</option>
              <option value="con_propios">Con rubros propios</option>
              <option value="solo_sag">Solo catálogo SAG</option>
            </select>
          </label>
        </div>
        <div className="rubros-sag-monitor-toolbar-actions">
          <span className="rubros-sag-monitor-sync muted">{syncLabel}</span>
          <button
            type="button"
            className="btn btn-secondary rubros-sag-monitor-refresh"
            disabled={!apiOnline || loadingList}
            onClick={refreshAll}
          >
            <RefreshCw size={15} className={loadingList ? "is-spinning" : undefined} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      <div className="rubros-sag-monitor-split">
        <aside className="rubros-sag-monitor-list-panel" aria-label="Cuentas">
          <div className="rubros-sag-monitor-list-head">
            <h3>Cuentas madre</h3>
            <span className="muted">{filas.length} en listado</span>
          </div>
          <div className="rubros-sag-monitor-list-wrap">
            {loadingList ? (
              <p className="rubros-sag-monitor-empty muted">Cargando cuentas…</p>
            ) : filas.length === 0 ? (
              <p className="rubros-sag-monitor-empty muted">
                {hayFiltros ? "Sin cuentas con esos filtros." : "No hay cuentas registradas."}
              </p>
            ) : (
              <ul className="rubros-sag-monitor-cuenta-list">
                {filas.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={`rubros-sag-monitor-cuenta-item${
                        selectedId === row.id ? " is-active" : ""
                      }`}
                      onClick={() => openCuenta(row)}
                    >
                      <span className="rubros-sag-monitor-cuenta-avatar" aria-hidden>
                        {inicialesCuenta(row.nombre)}
                      </span>
                      <span className="rubros-sag-monitor-cuenta-copy">
                        <span className="rubros-sag-monitor-cuenta-name">{row.nombre}</span>
                        <span className="rubros-sag-monitor-cuenta-meta muted">
                          {row.codigo} · {row.cuenta_numero}
                        </span>
                        <span className="rubros-sag-monitor-cuenta-stats">
                          <span>{fmtEntero(row.sub_rubros)} sub-rubros</span>
                          {row.sub_propios > 0 ? (
                            <span className="rubros-sag-monitor-badge rubros-sag-monitor-badge--cuenta">
                              +{fmtEntero(row.sub_propios)} propios
                            </span>
                          ) : (
                            <span className="rubros-sag-monitor-badge rubros-sag-monitor-badge--sag">
                              Solo SAG
                            </span>
                          )}
                        </span>
                      </span>
                      <span
                        className={`rubros-sag-monitor-estado${
                          row.activo ? " is-activo" : " is-inactivo"
                        }`}
                      >
                        {row.activo ? "Activa" : "Inactiva"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="rubros-sag-monitor-detail-panel" aria-label="Detalle de cuenta">
          {selectedId == null ? (
            <div className="rubros-sag-monitor-placeholder">
              <Shield size={28} strokeWidth={1.5} aria-hidden />
              <h3>Monitor de visibilidad y permisos</h3>
              <p className="muted">
                Seleccioná una cuenta para ver qué rubros y sub-rubros tiene disponibles y qué
                puede hacer cada usuario con el catálogo de gastos.
              </p>
            </div>
          ) : loadingDetalle && !detalle ? (
            <div className="rubros-sag-monitor-placeholder">
              <p className="muted">Cargando detalle de la cuenta…</p>
            </div>
          ) : detalle ? (
            <>
              <header className="rubros-sag-monitor-detail-head">
                <div>
                  <p className="sg-hub-panel-kicker">Cuenta seleccionada</p>
                  <h3>{detalle.nombre}</h3>
                  <p className="muted">
                    {detalle.codigo} · {detalle.cuenta_numero} ·{" "}
                    {detalle.activo ? "Activa" : "Inactiva"}
                  </p>
                </div>
                <div className="rubros-sag-monitor-detail-kpis">
                  <span>
                    <strong>{fmtEntero(detalle.grupos)}</strong> grupos
                  </span>
                  <span>
                    <strong>{fmtEntero(detalle.sub_rubros)}</strong> sub-rubros
                  </span>
                  <span>
                    <strong>{fmtEntero(detalle.sub_propios)}</strong> propios
                  </span>
                  <span>
                    <strong>{fmtEntero(detalle.usuarios.length)}</strong> usuarios
                  </span>
                </div>
              </header>

              <nav className="rubros-sag-monitor-detail-tabs" aria-label="Vista de detalle">
                <button
                  type="button"
                  className={detalleVista === "catalogo" ? "is-active" : ""}
                  onClick={() => setDetalleVista("catalogo")}
                >
                  <Eye size={15} aria-hidden />
                  Catálogo visible
                </button>
                <button
                  type="button"
                  className={detalleVista === "usuarios" ? "is-active" : ""}
                  onClick={() => setDetalleVista("usuarios")}
                >
                  <Users size={15} aria-hidden />
                  Usuarios y permisos
                </button>
              </nav>

              {detalleVista === "catalogo" ? (
                <div className="rubros-sag-monitor-catalogo">
                  <p className="rubros-sag-monitor-catalogo-lead muted">
                    Rubros y sub-rubros que esta cuenta ve al ingresar gastos: catálogo base SAG más
                    los propios de la cuenta.
                  </p>
                  {detalle.grupos_catalogo.length === 0 ? (
                    <p className="muted">Sin sub-rubros en el catálogo visible.</p>
                  ) : (
                    <ul className="rubros-sag-monitor-grupos">
                      {detalle.grupos_catalogo.map((grupo) => {
                        const abierto = gruposAbiertos.has(grupo.nombre);
                        return (
                          <li key={grupo.nombre} className="rubros-sag-monitor-grupo">
                            <button
                              type="button"
                              className="rubros-sag-monitor-grupo-head"
                              onClick={() => toggleGrupo(grupo.nombre)}
                              aria-expanded={abierto}
                            >
                              {abierto ? (
                                <ChevronDown size={16} aria-hidden />
                              ) : (
                                <ChevronRight size={16} aria-hidden />
                              )}
                              <span className="rubros-sag-monitor-grupo-name">{grupo.nombre}</span>
                              <span className="rubros-sag-monitor-grupo-counts muted">
                                {grupo.sub_rubros.length} sub-rubro
                                {grupo.sub_rubros.length === 1 ? "" : "s"}
                                {grupo.sub_cuenta > 0
                                  ? ` · ${grupo.sub_cuenta} propio${grupo.sub_cuenta === 1 ? "" : "s"}`
                                  : ""}
                              </span>
                            </button>
                            {abierto ? (
                              <ul className="rubros-sag-monitor-sub-list">
                                {grupo.sub_rubros.map((sub) => (
                                  <li
                                    key={sub.id}
                                    className={`rubros-sag-monitor-sub-item${
                                      !sub.activo ? " is-inactivo" : ""
                                    }`}
                                  >
                                    <span>{sub.nombre}</span>
                                    <span
                                      className={`rubros-sag-monitor-badge rubros-sag-monitor-badge--${
                                        sub.origen === "sag" ? "sag" : "cuenta"
                                      }`}
                                    >
                                      {sub.origen === "sag" ? "SAG" : "Cuenta"}
                                    </span>
                                    {!sub.activo ? (
                                      <span className="rubros-sag-monitor-badge rubros-sag-monitor-badge--off">
                                        Inactivo
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="rubros-sag-monitor-usuarios-wrap">
                  <p className="rubros-sag-monitor-catalogo-lead muted">
                    Permisos efectivos sobre rubros y sub-rubros de gastos según rol, módulos y
                    escritura en presupuesto.
                  </p>
                  {detalle.usuarios.length === 0 ? (
                    <p className="muted">Sin usuarios en esta cuenta.</p>
                  ) : (
                    <div className="rubros-sag-monitor-usuarios-table-wrap">
                      <table className="rubros-sag-monitor-usuarios-table">
                        <thead>
                          <tr>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Permisos en rubros</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.usuarios.map((u) => (
                            <tr key={u.id} className={!u.activo ? "is-inactivo" : undefined}>
                              <td>
                                <span className="rubros-sag-monitor-user-name">{u.nombre}</span>
                                <span className="rubros-sag-monitor-user-email muted">
                                  {u.email}
                                </span>
                                {u.es_admin_cuenta ? (
                                  <span className="rubros-sag-monitor-badge rubros-sag-monitor-badge--admin">
                                    Admin cuenta
                                  </span>
                                ) : null}
                              </td>
                              <td>{u.rol_label}</td>
                              <td>
                                <div className="rubros-sag-monitor-perms">
                                  {PERMISO_LABELS.map((p) => (
                                    <PermisoChip
                                      key={p.key}
                                      activo={u.permisos[p.key]}
                                      label={p.label}
                                      hint={p.hint}
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="rubros-sag-monitor-placeholder">
              <p className="muted">No se pudo cargar el detalle de la cuenta.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
