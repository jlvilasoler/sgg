import { useCallback, useEffect, useState } from "react";
import { fetchAuthActividad, fetchEmpresasCuenta, fetchUsuarios, fetchUsuariosOnline } from "../api";
import type { ActividadAmbito } from "../api";
import type { AuthActividadLog, AuthUser, EmpresaCuenta, UsuarioOnline } from "../types";
import {
  canAccessActividadSagTotal,
  canFiltrarActividadPorUsuario,
  canVerIpEnActividad,
  canVerUsuariosOnlineActividad,
} from "../utils/auth-permissions";
import { formatActividadDetalle } from "../utils/format-actividad-detalle";
import SgHubShell from "./hub/SgHubShell";
import { MenuAppIcon } from "./icons/MenuAppIcons";
import type { SgHubItem } from "./hub/SgHubTypes";
import TablePagination, { type PageSize } from "./TablePagination";
import UserAvatar from "./UserAvatar";

const ACTIVIDAD_HUB_ITEMS: SgHubItem[] = [
  {
    id: "actividad",
    label: "Historial",
    subtitle: "Accesos y acciones en el sistema",
    icon: "usuarios_permisos_rol",
  },
];

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
  currentUser: AuthUser;
  modo: ActividadAmbito | "propio";
  titulo: string;
  subtituloAmbito?: string;
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
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

function fmtEtiquetaPresencia(texto: string): string {
  const t = texto.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function fmtTiempoConectado(seg: number, enLinea: boolean): string {
  if (enLinea && seg < 15) return "Recién conectado";
  const prefijo = enLinea ? "Conectado" : "Estuvo";
  if (seg < 60) return `${prefijo} ${seg} s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `${prefijo} ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${prefijo} ${h} h`;
  return `${prefijo} ${h} h ${m} min`;
}

function TarjetaUsuarioPresencia({
  u,
  estado = "online",
  mostrarIp = false,
}: {
  u: UsuarioOnline;
  estado?: "online" | "reciente-offline" | "stale-offline";
  mostrarIp?: boolean;
}) {
  const claseEstado =
    estado === "reciente-offline"
      ? " usuarios-online-item--reciente-offline"
      : estado === "stale-offline"
        ? " usuarios-online-item--stale-offline"
        : "";
  const tag =
    estado === "stale-offline"
      ? "Inactivo"
      : estado === "reciente-offline"
        ? "Desconectado"
        : null;
  const enLinea = estado === "online";
  const conectadoSeg = u.conectado_segundos ?? 0;
  return (
    <li className={`usuarios-online-item${claseEstado}`}>
      <UserAvatar nombre={u.nombre} avatar={u.avatar} variant="list" />
      <div className="usuarios-online-body">
        <div className="usuarios-online-main">
          <strong>{u.nombre}</strong>
          <div className="usuarios-online-status-row">
            <span className="usuarios-online-conectado">
              {fmtTiempoConectado(conectadoSeg, enLinea)}
            </span>
            {!enLinea ? (
              <span className="usuarios-online-hace">{fmtHaceSegundos(u.hace_segundos)}</span>
            ) : null}
          </div>
          <span className="usuarios-act-email usuarios-online-email" title={u.email}>
            {u.email}
          </span>
          {u.pantalla || tag ? (
            <div className="usuarios-online-estado-row">
              {u.pantalla ? (
                <span className="usuarios-online-pantalla">{fmtEtiquetaPresencia(u.pantalla)}</span>
              ) : null}
              {tag ? (
                <span className="usuarios-online-offline-tag">{fmtEtiquetaPresencia(tag)}</span>
              ) : null}
            </div>
          ) : null}
          {mostrarIp && u.ip ? (
            <span className="usuarios-online-ip muted">{u.ip}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function UsuariosActividad({
  apiOnline,
  currentUser,
  modo,
  titulo,
  subtituloAmbito,
  onError,
  onVolver,
  volverLabel = "Volver al menú",
}: Props) {
  const puedeVerIp = canVerIpEnActividad(currentUser);
  const esActividadTotalPlataforma =
    modo === "total" && canAccessActividadSagTotal(currentUser);
  const puedeFiltrarCuenta = esActividadTotalPlataforma;
  const puedeFiltrarUsuario = canFiltrarActividadPorUsuario(currentUser) && modo !== "propio";
  const puedeVerOnline =
    esActividadTotalPlataforma ||
    (canVerUsuariosOnlineActividad(currentUser) && modo === "cuenta");
  const ambitoApi: ActividadAmbito | undefined =
    modo === "propio" ? undefined : modo;
  const cuentaIdFiltro =
    modo === "cuenta"
      ? currentUser.cuenta_actividad_id ?? currentUser.empresa_id ?? undefined
      : undefined;
  const [rows, setRows] = useState<AuthActividadLog[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState({
    total: 0,
    logins: 0,
    navegacion: 0,
    acciones: 0,
  });
  const [online, setOnline] = useState<UsuarioOnline[]>([]);
  const [recentlyOffline, setRecentlyOffline] = useState<UsuarioOnline[]>([]);
  const [staleOffline, setStaleOffline] = useState<UsuarioOnline[]>([]);
  const [usuarios, setUsuarios] = useState<{ email: string; nombre: string }[]>([]);
  const [cuentas, setCuentas] = useState<EmpresaCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOnline, setLoadingOnline] = useState(true);
  const [filtroCuentaId, setFiltroCuentaId] = useState("");
  const [filtroEmail, setFiltroEmail] = useState("");
  const [filtroEvento, setFiltroEvento] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const filtroCuentaIdNum =
    filtroCuentaId !== "" && Number.isFinite(Number(filtroCuentaId))
      ? Number(filtroCuentaId)
      : undefined;

  useEffect(() => {
    if (!apiOnline || !puedeFiltrarCuenta) {
      setCuentas([]);
      return;
    }
    void fetchEmpresasCuenta()
      .then(setCuentas)
      .catch(() => setCuentas([]));
  }, [apiOnline, puedeFiltrarCuenta]);

  useEffect(() => {
    if (!apiOnline || !puedeFiltrarUsuario) {
      setUsuarios([]);
      return;
    }
    const fetchOpts =
      modo === "total"
        ? {
            ambitoActividadTotal: true as const,
            cuentaId: filtroCuentaIdNum,
          }
        : undefined;
    void fetchUsuarios(cuentaIdFiltro, fetchOpts)
      .then((list) => setUsuarios(list.map((u) => ({ email: u.email, nombre: u.nombre }))))
      .catch(() => setUsuarios([]));
  }, [apiOnline, puedeFiltrarUsuario, cuentaIdFiltro, modo, filtroCuentaIdNum]);

  useEffect(() => {
    setFiltroEmail("");
  }, [filtroCuentaId]);

  useEffect(() => {
    setPage(1);
  }, [filtroEmail, filtroEvento, filtroCuentaId, pageSize]);

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
        ambito: ambitoApi,
        cuentaId: filtroCuentaIdNum,
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
  }, [apiOnline, filtroEmail, filtroEvento, filtroCuentaIdNum, page, pageSize, onError, ambitoApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOnline = useCallback(async () => {
    if (!apiOnline || !puedeVerOnline) {
      setOnline([]);
      setRecentlyOffline([]);
      setStaleOffline([]);
      setLoadingOnline(false);
      return;
    }
    try {
      // En vista total de plataforma: siempre todos los usuarios online (todas las cuentas).
      const cuentaIdOnline = esActividadTotalPlataforma ? undefined : filtroCuentaIdNum;
      const snapshot = await fetchUsuariosOnline(ambitoApi, cuentaIdOnline);
      setOnline(snapshot.online);
      setRecentlyOffline(snapshot.recently_offline);
      setStaleOffline(snapshot.stale_offline);
    } catch {
      /* no interrumpir la vista principal */
    } finally {
      setLoadingOnline(false);
    }
  }, [
    apiOnline,
    puedeVerOnline,
    ambitoApi,
    esActividadTotalPlataforma,
    filtroCuentaIdNum,
  ]);

  useEffect(() => {
    if (!puedeVerOnline) {
      setOnline([]);
      setRecentlyOffline([]);
      setStaleOffline([]);
      setStaleOffline([]);
      setLoadingOnline(false);
      return;
    }
    void loadOnline();
    if (!apiOnline) return;
    const id = window.setInterval(() => void loadOnline(), 12_000);
    return () => window.clearInterval(id);
  }, [apiOnline, loadOnline, puedeVerOnline]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const subtitulo = loading
    ? "Actualizando…"
    : !apiOnline
      ? "Sin conexión con la API"
      : total === 0
        ? "Sin registros de actividad todavía"
        : `${total} registro${total === 1 ? "" : "s"} en el historial`;

  const onlineHint =
    "En línea: últimos 3 min · Amarillo (desconectado): 3–10 min · Rojo (inactivo): 10–15 min · se actualiza cada 12 s";

  const totalPresencia = online.length + recentlyOffline.length + staleOffline.length;

  const seccionOnline = puedeVerOnline ? (
    <section
      className="usuarios-actividad-hub-box usuarios-actividad-hub-box--online"
      aria-label="Usuarios en línea y desconectados recientes"
    >
      <header className="usuarios-actividad-hub-head-box usuarios-actividad-hub-head-box--inline">
        <div>
          <p className="sg-hub-panel-kicker">Presencia</p>
          <h2 className="usuarios-actividad-hub-title">
            <span className="usuarios-online-pulse" aria-hidden />
            En línea ahora
            <span className="usuarios-actividad-online-count">
              {loadingOnline || !apiOnline ? "—" : online.length}
            </span>
            {!loadingOnline && apiOnline && recentlyOffline.length > 0 ? (
              <>
                <span className="usuarios-actividad-online-sep" aria-hidden>
                  ·
                </span>
                <span className="usuarios-actividad-online-recientes-label">Desconectados</span>
                <span className="usuarios-actividad-online-count usuarios-actividad-online-count--reciente">
                  {recentlyOffline.length}
                </span>
              </>
            ) : null}
            {!loadingOnline && apiOnline && staleOffline.length > 0 ? (
              <>
                <span className="usuarios-actividad-online-sep" aria-hidden>
                  ·
                </span>
                <span className="usuarios-actividad-online-recientes-label usuarios-actividad-online-recientes-label--stale">
                  Inactivos
                </span>
                <span className="usuarios-actividad-online-count usuarios-actividad-online-count--stale">
                  {staleOffline.length}
                </span>
              </>
            ) : null}
          </h2>
        </div>
        <span className="usuarios-actividad-hub-sub">{onlineHint}</span>
      </header>
      <div className="usuarios-actividad-online">
        {!apiOnline ? (
          <p className="usuarios-actividad-online-empty muted">Sin conexión con la API</p>
        ) : loadingOnline ? (
          <p className="usuarios-actividad-online-empty muted">Consultando usuarios activos…</p>
        ) : totalPresencia === 0 ? (
          <p className="usuarios-actividad-online-empty muted">
            Nadie está usando la app en este momento
          </p>
        ) : (
          <ul className="usuarios-online-list">
            {online.map((u) => (
              <TarjetaUsuarioPresencia key={`on-${u.email}`} u={u} mostrarIp={puedeVerIp} />
            ))}
            {recentlyOffline.map((u) => (
              <TarjetaUsuarioPresencia
                key={`off-${u.email}`}
                u={u}
                estado="reciente-offline"
                mostrarIp={puedeVerIp}
              />
            ))}
            {staleOffline.map((u) => (
              <TarjetaUsuarioPresencia
                key={`stale-${u.email}`}
                u={u}
                estado="stale-offline"
                mostrarIp={puedeVerIp}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  ) : null;

  const hubKpiStrip = (
    <section className="sg-hub-kpi-strip usuarios-actividad-kpi-strip" aria-label="Resumen de actividad">
      {puedeVerOnline ? (
        <article className="sg-hub-kpi sg-hub-kpi--light">
          <div className="sg-hub-kpi-top">
            <div>
              <p className="sg-hub-kpi-kicker">En línea</p>
              <p className="sg-hub-kpi-value">
                {loadingOnline || !apiOnline ? "—" : online.length}
              </p>
            </div>
          </div>
          <p className="sg-hub-kpi-hint">Usuarios activos ahora</p>
        </article>
      ) : null}
      <article className="sg-hub-kpi sg-hub-kpi--dark">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Registros</p>
            <p className="sg-hub-kpi-value">{loading || !apiOnline ? "—" : resumen.total}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Total en el historial</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Logins</p>
            <p className="sg-hub-kpi-value">{loading || !apiOnline ? "—" : resumen.logins}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Inicios de sesión</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Navegación</p>
            <p className="sg-hub-kpi-value">{loading || !apiOnline ? "—" : resumen.navegacion}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Cambios de pantalla</p>
      </article>
      <article className="sg-hub-kpi sg-hub-kpi--light">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Acciones</p>
            <p className="sg-hub-kpi-value">{loading || !apiOnline ? "—" : resumen.acciones}</p>
          </div>
        </div>
        <p className="sg-hub-kpi-hint">Operaciones en el sistema</p>
      </article>
    </section>
  );

  const filtersBar = (
    <div className="usuarios-actividad-hub-filters-box">
      {puedeFiltrarCuenta ? (
        <div className="field">
          <label htmlFor="ua-filtro-cuenta">Cuenta</label>
          <select
            id="ua-filtro-cuenta"
            value={filtroCuentaId}
            disabled={!apiOnline || loading}
            onChange={(e) => setFiltroCuentaId(e.target.value)}
          >
            <option value="">Todas las cuentas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {puedeFiltrarUsuario ? (
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
      ) : null}
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
      <div className="usuarios-actividad-hub-filters-actions">
        <button
          type="button"
          className="sg-hub-cta sg-hub-cta--ghost"
          disabled={!apiOnline || loading || (!filtroEmail && !filtroEvento && !filtroCuentaId)}
          onClick={() => {
            setFiltroCuentaId("");
            setFiltroEmail("");
            setFiltroEvento("");
          }}
        >
          Limpiar
        </button>
        <button
          type="button"
          className="sg-hub-cta"
          disabled={!apiOnline || loading}
          onClick={() => void load()}
        >
          Actualizar
        </button>
      </div>
    </div>
  );

  const dataTable = (
    <div className="table-wrap usuarios-actividad-hub-table-box">
      <table className="data-table listado-pro-table usuarios-actividad-table">
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Usuario</th>
            <th>Tipo</th>
            <th>Actividad</th>
            {puedeVerIp ? <th>IP</th> : null}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={puedeVerIp ? 5 : 4} className="empty">
                Cargando actividad…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={puedeVerIp ? 5 : 4} className="empty">
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
                  <td className="usuarios-act-detalle">
                    {formatActividadDetalle(row.detalle, row.evento)}
                  </td>
                  {puedeVerIp ? (
                    <td className="muted small-cell">{row.ip || "—"}</td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const pagination =
    !loading && apiOnline && total > 0 ? (
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
    ) : null;

  if (modo === "total" && !canAccessActividadSagTotal(currentUser)) {
    return (
      <div className="subseccion-panel usuarios-actividad usuarios-actividad--hub">
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ {volverLabel}
        </button>
        <div className="usuarios-actividad-hub-workspace">
          <div className="usuarios-actividad-hub-box usuarios-actividad-restricted-box">
            <header className="usuarios-actividad-hub-head-box">
              <p className="sg-hub-panel-kicker">Acceso</p>
              <h2 className="usuarios-actividad-hub-title">Acceso restringido</h2>
              <p className="usuarios-actividad-hub-sub">
                El registro de actividad global solo está disponible para el superadministrador
                de plataforma.
              </p>
            </header>
            <button type="button" className="sg-hub-cta sg-hub-cta--ghost" onClick={onVolver}>
              {volverLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sg-module-page actividad-module-page">
      <SgHubShell
        activeId="actividad"
        items={ACTIVIDAD_HUB_ITEMS}
        onNavigate={() => undefined}
        onVolverDashboard={() => undefined}
        onVolverInicio={onVolver}
        apiOnline={apiOnline}
        title={titulo}
        subtitle={subtituloAmbito ? `${subtituloAmbito} · ${subtitulo}` : subtitulo}
        asideKicker="SGG · Auditoría"
        asideTitle="Registro de actividad"
        asideLogo={<MenuAppIcon id="registro_actividad" />}
        navAriaLabel="Registro de actividad"
        showDashboardInNav={false}
      >
        <div className="sg-hub-embedded usuarios-actividad usuarios-actividad--hub">
          <div className="usuarios-actividad-hub-workspace">
            {hubKpiStrip}

            <p className="usuarios-actividad-hub-status muted" role="status">
              {subtituloAmbito ? `${subtituloAmbito} · ` : ""}
              {subtitulo}
            </p>

            {seccionOnline}

            <section
              className="usuarios-actividad-hub-box usuarios-actividad-hub-box--listado"
              aria-label="Historial de actividad"
            >
              <header className="usuarios-actividad-hub-head-box">
                <p className="sg-hub-panel-kicker">Historial</p>
                <h2 className="usuarios-actividad-hub-title">Registro de actividad</h2>
                <p className="usuarios-actividad-hub-sub muted">
                  Filtrá por usuario, tipo de evento o cuenta y consultá el detalle de cada acción.
                </p>
              </header>

              {filtersBar}
              {dataTable}
              {pagination}
            </section>
          </div>
        </div>
      </SgHubShell>
    </div>
  );
}
