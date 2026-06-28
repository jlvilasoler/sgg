import { useCallback, useEffect, useState } from "react";
import { fetchAuthActividad, fetchUsuarios, fetchUsuariosOnline } from "../api";
import type { AuthActividadLog, UsuarioOnline } from "../types";
import UserAvatar from "./UserAvatar";
import TablePagination, { type PageSize } from "./TablePagination";

const EVENTO_LABELS: Record<string, string> = {
  login_ok: "Inicio de sesión",
  login_fail: "Intento de login fallido",
  login_fail_unknown: "Login con email desconocido",
  login_blocked_locked: "Login bloqueado",
  account_locked: "Cuenta bloqueada",
  logout: "Cierre de sesión",
  user_created: "Usuario creado",
  user_updated: "Usuario actualizado",
  role_permissions_updated: "Permisos actualizados",
  password_changed: "Contraseña cambiada",
  navegacion: "Navegación",
  accion: "Acción",
};

const EVENTO_OPCIONES = [
  { value: "", label: "Todos los tipos" },
  { value: "login_ok", label: "Inicio de sesión" },
  { value: "logout", label: "Cierre de sesión" },
  { value: "navegacion", label: "Navegación" },
  { value: "accion", label: "Acciones en el sistema" },
  { value: "login_fail", label: "Intentos fallidos" },
  { value: "user_updated", label: "Usuarios modificados" },
  { value: "user_created", label: "Usuarios creados" },
];

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onVolver: () => void;
  volverLabel?: string;
}

function fmtFecha(iso: string): { fecha: string; hora: string } {
  try {
    const d = new Date(iso.replace(" ", "T"));
    return {
      fecha: d.toLocaleDateString("es-UY", { dateStyle: "short" }),
      hora: d.toLocaleTimeString("es-UY", { timeStyle: "short" }),
    };
  } catch {
    return { fecha: iso, hora: "" };
  }
}

function labelEvento(evento: string): string {
  return EVENTO_LABELS[evento] ?? evento.replace(/_/g, " ");
}

function tipoBadgeClass(evento: string): string {
  if (evento === "login_ok") return "usuarios-act-tipo--login";
  if (evento === "logout") return "usuarios-act-tipo--logout";
  if (evento.startsWith("login_fail") || evento === "account_locked")
    return "usuarios-act-tipo--fail";
  if (evento === "navegacion") return "usuarios-act-tipo--nav";
  if (evento === "accion") return "usuarios-act-tipo--accion";
  return "usuarios-act-tipo--otro";
}

function fmtHaceSegundos(seg: number): string {
  if (seg < 10) return "ahora";
  if (seg < 60) return `hace ${seg}s`;
  const min = Math.floor(seg / 60);
  return `hace ${min} min`;
}

export default function UsuariosActividad({
  apiOnline,
  onError,
  onVolver,
  volverLabel = "Volver al menú",
}: Props) {
  const [rows, setRows] = useState<AuthActividadLog[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({
    total: 0,
    logins: 0,
    navegacion: 0,
    acciones: 0,
  });
  const [online, setOnline] = useState<UsuarioOnline[]>([]);
  const [usuarios, setUsuarios] = useState<{ email: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOnline, setLoadingOnline] = useState(true);
  const [filtroEmail, setFiltroEmail] = useState("");
  const [filtroEvento, setFiltroEvento] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  useEffect(() => {
    if (!apiOnline) {
      setUsuarios([]);
      return;
    }
    void fetchUsuarios()
      .then((list) => setUsuarios(list.map((u) => ({ email: u.email, nombre: u.nombre }))))
      .catch(() => setUsuarios([]));
  }, [apiOnline]);

  useEffect(() => {
    setPage(1);
  }, [filtroEmail, filtroEvento, pageSize]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [total, pageSize, page]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setTotal(0);
      setResumen({ total: 0, logins: 0, navegacion: 0, acciones: 0 });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const offset = (page - 1) * pageSize;
      const result = await fetchAuthActividad({
        email: filtroEmail || undefined,
        evento: filtroEvento || undefined,
        limite: pageSize,
        offset,
      });
      setRows(result.items);
      setTotal(result.total);
      setResumen(result.resumen);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar actividad");
      setRows([]);
      setTotal(0);
      setResumen({ total: 0, logins: 0, navegacion: 0, acciones: 0 });
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtroEmail, filtroEvento, page, pageSize, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOnline = useCallback(async () => {
    if (!apiOnline) {
      setOnline([]);
      setLoadingOnline(false);
      return;
    }
    try {
      setOnline(await fetchUsuariosOnline());
    } catch {
      /* no interrumpir la vista principal */
    } finally {
      setLoadingOnline(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void loadOnline();
    if (!apiOnline) return;
    const id = window.setInterval(() => void loadOnline(), 12_000);
    return () => window.clearInterval(id);
  }, [apiOnline, loadOnline]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const subtitulo = loading
    ? "Actualizando…"
    : !apiOnline
      ? "Sin conexión con la API"
      : total === 0
        ? "Sin registros de actividad todavía"
        : `${total} registro${total === 1 ? "" : "s"} en el historial`;

  return (
    <div className="subseccion-panel usuarios-actividad">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className="card usuarios-panel listado-pro-shell">
        <header className="listado-pro-head usuarios-actividad-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">Registro de actividad</h2>
            <p className="listado-pro-head-sub">{subtitulo}</p>
          </div>
        </header>

        <div className="filters listado-pro-filters usuarios-actividad-filters">
          <div className="listado-pro-filters-row listado-pro-filters-row--unica">
            <div className="field">
              <label htmlFor="ua-filtro-usuario">Usuario</label>
              <select
                id="ua-filtro-usuario"
                value={filtroEmail}
                disabled={!apiOnline || loading}
                onChange={(e) => setFiltroEmail(e.target.value)}
              >
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ua-filtro-evento">Tipo</label>
              <select
                id="ua-filtro-evento"
                value={filtroEvento}
                disabled={!apiOnline || loading}
                onChange={(e) => setFiltroEvento(e.target.value)}
              >
                {EVENTO_OPCIONES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="listado-pro-filters-actions">
              <button
                type="button"
                className="btn listado-pro-reset-btn"
                disabled={!apiOnline || loading || (!filtroEmail && !filtroEvento)}
                onClick={() => {
                  setFiltroEmail("");
                  setFiltroEvento("");
                }}
              >
                Limpiar
              </button>
              <button
                type="button"
                className="btn btn-primary listado-pro-search-btn"
                disabled={!apiOnline || loading}
                onClick={() => void load()}
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>

        <section className="usuarios-actividad-online" aria-label="Usuarios en línea">
          <div className="usuarios-actividad-online-head">
            <h3 className="usuarios-actividad-online-title">
              <span className="usuarios-online-pulse" aria-hidden />
              En línea ahora
              <span className="usuarios-actividad-online-count">
                {loadingOnline || !apiOnline ? "—" : online.length}
              </span>
            </h3>
            <span className="usuarios-actividad-online-hint">
              Actividad en los últimos 3 min · se actualiza cada 12 s
            </span>
          </div>
          {!apiOnline ? (
            <p className="usuarios-actividad-online-empty muted">Sin conexión con la API</p>
          ) : loadingOnline ? (
            <p className="usuarios-actividad-online-empty muted">Consultando usuarios activos…</p>
          ) : online.length === 0 ? (
            <p className="usuarios-actividad-online-empty muted">
              Nadie está usando la app en este momento
            </p>
          ) : (
            <ul className="usuarios-online-list">
              {online.map((u) => (
                <li key={u.email} className="usuarios-online-item">
                  <UserAvatar nombre={u.nombre} avatar={u.avatar} variant="list" />
                  <div className="usuarios-online-main">
                    <strong>{u.nombre}</strong>
                    <span className="muted usuarios-act-email">{u.email}</span>
                  </div>
                  <div className="usuarios-online-meta">
                    {u.pantalla ? (
                      <span className="usuarios-online-pantalla">{u.pantalla}</span>
                    ) : null}
                    <span className="usuarios-online-hace">{fmtHaceSegundos(u.hace_segundos)}</span>
                    {u.ip ? <span className="usuarios-online-ip muted">{u.ip}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="usuarios-actividad-kpis" aria-label="Resumen">
          <div className="usuarios-actividad-kpi-grid">
            <div className="usuarios-actividad-kpi usuarios-actividad-kpi--online">
              <span className="usuarios-actividad-kpi-label">En línea</span>
              <span className="usuarios-actividad-kpi-valor">
                {loadingOnline || !apiOnline ? "—" : online.length}
              </span>
            </div>
            <div className="usuarios-actividad-kpi">
              <span className="usuarios-actividad-kpi-label">Registros</span>
              <span className="usuarios-actividad-kpi-valor">
                {loading || !apiOnline ? "—" : resumen.total}
              </span>
            </div>
            <div className="usuarios-actividad-kpi usuarios-actividad-kpi--login">
              <span className="usuarios-actividad-kpi-label">Logins</span>
              <span className="usuarios-actividad-kpi-valor">
                {loading || !apiOnline ? "—" : resumen.logins}
              </span>
            </div>
            <div className="usuarios-actividad-kpi usuarios-actividad-kpi--nav">
              <span className="usuarios-actividad-kpi-label">Navegación</span>
              <span className="usuarios-actividad-kpi-valor">
                {loading || !apiOnline ? "—" : resumen.navegacion}
              </span>
            </div>
            <div className="usuarios-actividad-kpi usuarios-actividad-kpi--accion">
              <span className="usuarios-actividad-kpi-label">Acciones</span>
              <span className="usuarios-actividad-kpi-valor">
                {loading || !apiOnline ? "—" : resumen.acciones}
              </span>
            </div>
          </div>
        </section>

        <div className="table-wrap listado-pro-table-wrap">
          <table className="data-table listado-pro-table usuarios-actividad-table">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Tipo</th>
                <th>Actividad</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Cargando actividad…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Sin registros de actividad
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { fecha, hora } = fmtFecha(row.creado_en);
                  return (
                    <tr key={row.id}>
                      <td className="usuarios-act-fecha">
                        <span>{fecha}</span>
                        {hora ? <span className="muted">{hora}</span> : null}
                      </td>
                      <td>
                        <strong>{row.user_nombre || row.email || "—"}</strong>
                        {row.email ? (
                          <span className="muted usuarios-act-email">{row.email}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={`usuarios-act-tipo ${tipoBadgeClass(row.evento)}`}>
                          {labelEvento(row.evento)}
                        </span>
                      </td>
                      <td className="usuarios-act-detalle">{row.detalle || "—"}</td>
                      <td className="muted small-cell">{row.ip || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && apiOnline && total > 0 && (
          <TablePagination
            total={total}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
