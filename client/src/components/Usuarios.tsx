import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarUsuario,
  crearUsuario,
  fetchUsuarios,
} from "../api";
import type { AuthUser, Rol, UserForm } from "../types";
import { ALL_ROLES, ROL_DESCRIPCION, ROL_LABELS_DETALLE } from "../types";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";

import UserAvatar from "./UserAvatar";

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const ROLES: Rol[] = ALL_ROLES;

function IconoOjo({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"
      />
    </svg>
  );
}

function fmtUltimoAcceso(iso: string | null): { fecha: string; hora: string } {
  if (!iso) return { fecha: "—", hora: "" };
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

const emptyForm = (): UserForm => ({
  email: "",
  nombre: "",
  rol: "editor",
  password: "",
  activo: true,
});

export default function Usuarios({
  apiOnline,
  currentUser,
  onVolver,
  volverLabel = "Volver al menú",
  onError,
  onSuccess,
}: Props) {
  const [rows, setRows] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroRol, setFiltroRol] = useState<"" | Rol>("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchUsuarios(undefined, { ambitoPropio: true }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const porRol = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Rol, number>;
    let activos = 0;
    let recientes = 0;
    const hace7d = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const u of rows) {
      porRol[u.rol] += 1;
      if (u.activo) activos += 1;
      if (u.ultimo_acceso) {
        const t = new Date(u.ultimo_acceso.replace(" ", "T")).getTime();
        if (!Number.isNaN(t) && t >= hace7d) recientes += 1;
      }
    }

    return {
      total: rows.length,
      activos,
      inactivos: rows.length - activos,
      recientes,
      porRol,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return rows.filter((u) => {
      if (filtroRol && u.rol !== filtroRol) return false;
      if (filtroEstado === "activo" && !u.activo) return false;
      if (filtroEstado === "inactivo" && u.activo) return false;
      if (!q) return true;
      return (
        u.nombre.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.usuario_numero.toLowerCase().includes(q) ||
        u.rol_label.toLowerCase().includes(q)
      );
    });
  }, [rows, filtroTexto, filtroRol, filtroEstado]);

  const hayFiltros = Boolean(filtroTexto.trim() || filtroRol || filtroEstado);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm());
    setShowPassword(false);
  };

  const openEdit = (u: AuthUser) => {
    setCreating(false);
    setEditing(u);
    setForm({
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      password: "",
    });
    setShowPassword(false);
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm());
    setShowPassword(false);
  };

  const save = async () => {
    if (!apiOnline) return;
    setSaving(true);
    try {
      if (creating) {
        if (!form.password) {
          onError("La contraseña es obligatoria");
          return;
        }
        const pwErr = validatePasswordStrength(form.password);
        if (pwErr) {
          onError(pwErr);
          return;
        }
        await crearUsuario(form);
        onSuccess("Usuario creado");
      } else if (editing) {
        const patch: Partial<UserForm> = {
          email: form.email,
          nombre: form.nombre,
          rol: form.rol,
          activo: form.activo,
        };
        if (form.password) {
          const pwErr = validatePasswordStrength(form.password);
          if (pwErr) {
            onError(pwErr);
            return;
          }
          patch.password = form.password;
        }
        await actualizarUsuario(editing.id, patch);
        onSuccess("Usuario actualizado");
      }
      closeForm();
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (u: AuthUser) => {
    if (u.id === currentUser.id && u.activo) {
      onError("No podés desactivar tu propia cuenta");
      return;
    }
    try {
      await actualizarUsuario(u.id, { activo: !u.activo });
      onSuccess(u.activo ? "Usuario desactivado" : "Usuario activado");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al actualizar");
    }
  };

  const limpiarFiltros = () => {
    setFiltroTexto("");
    setFiltroRol("");
    setFiltroEstado("");
  };

  const showForm = creating || editing !== null;

  const subtitulo = loading
    ? "Actualizando listado…"
    : !apiOnline
      ? "Sin conexión con la API"
      : hayFiltros
        ? `${filteredRows.length} de ${rows.length} usuario(s) en pantalla`
        : `${rows.length} usuario(s) registrado${rows.length === 1 ? "" : "s"}`;

  return (
    <div className="subseccion-panel usuarios-admin">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className="card usuarios-panel listado-pro-shell">
        <header className="listado-pro-head usuarios-admin-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">Administración de Usuarios</h2>
            <p className="listado-pro-head-sub">{subtitulo}</p>
          </div>
          <div className="usuarios-head-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!apiOnline || showForm}
              onClick={openCreate}
            >
              + Nuevo usuario
            </button>
          </div>
        </header>

        <section className="usuarios-admin-dashboard" aria-label="Resumen de usuarios">
          <div className="usuarios-admin-kpi-grid">
            <article className="usuarios-admin-kpi usuarios-admin-kpi--hero">
              <span className="usuarios-admin-kpi-label">Total registrados</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.total}
              </span>
              <span className="usuarios-admin-kpi-hint">Cuentas en el sistema</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--activos">
              <span className="usuarios-admin-kpi-label">Activos</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.activos}
              </span>
              <span className="usuarios-admin-kpi-hint">Pueden iniciar sesión</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--inactivos">
              <span className="usuarios-admin-kpi-label">Inactivos</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.inactivos}
              </span>
              <span className="usuarios-admin-kpi-hint">Cuentas deshabilitadas</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--recientes">
              <span className="usuarios-admin-kpi-label">Activos 7 días</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.recientes}
              </span>
              <span className="usuarios-admin-kpi-hint">Con ingreso reciente</span>
            </article>
          </div>

          <div className="usuarios-admin-roles" aria-label="Distribución por rol">
            <p className="usuarios-admin-roles-title">Por tipo de usuario</p>
            <div className="usuarios-admin-roles-grid">
              {ROLES.map((rol) => {
                const count = stats.porRol[rol];
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={rol} className={`usuarios-admin-rol-card usuarios-admin-rol-card--${rol}`}>
                    <div className="usuarios-admin-rol-top">
                      <span className={`usuarios-rol-badge usuarios-rol-badge--${rol}`}>
                        {ROL_LABELS_DETALLE[rol]}
                      </span>
                      <strong className="usuarios-admin-rol-count">
                        {loading || !apiOnline ? "—" : count}
                      </strong>
                    </div>
                    <div className="usuarios-admin-rol-bar" aria-hidden>
                      <span
                        className="usuarios-admin-rol-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="usuarios-admin-rol-pct muted">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {showForm && (
          <section className="usuarios-form-card">
            <h3>{creating ? "Nuevo usuario" : `Editar: ${editing?.nombre}`}</h3>
            <div className="usuarios-form-grid">
              <div className="field">
                <label htmlFor="usr-nombre">Nombre</label>
                <input
                  id="usr-nombre"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="usr-email">Email</label>
                <input
                  id="usr-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="usr-rol">Rol</label>
                <select
                  id="usr-rol"
                  value={form.rol}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rol: e.target.value as Rol }))
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROL_LABELS_DETALLE[r]}
                    </option>
                  ))}
                </select>
                <p className="usuarios-rol-hint">{ROL_DESCRIPCION[form.rol]}</p>
              </div>
              <div className="field">
                <label htmlFor="usr-pass">
                  Contraseña {creating ? "" : "(opcional)"}
                </label>
                <div className="usuarios-password-wrap">
                  <input
                    id="usr-pass"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    data-sin-mayusculas="true"
                    value={form.password ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={creating ? "Contraseña segura" : "Dejar vacío para no cambiar"}
                  />
                  <button
                    type="button"
                    className="usuarios-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <IconoOjo visible={showPassword} />
                  </button>
                </div>
                <p className="usuarios-rol-hint">{PASSWORD_POLICY_HINT}</p>
              </div>
              {!creating && (
                <label className="inline-check usuarios-activo-check">
                  <input
                    type="checkbox"
                    checked={form.activo !== false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, activo: e.target.checked }))
                    }
                  />
                  Usuario activo
                </label>
              )}
            </div>
            <div className="usuarios-form-actions">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !apiOnline}
                onClick={save}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </section>
        )}

        <div className="filters listado-pro-filters usuarios-admin-filters">
          <div className="field usuarios-admin-search">
            <label htmlFor="usr-filtro-texto">Buscar</label>
            <input
              id="usr-filtro-texto"
              type="search"
              placeholder="Nombre o email…"
              value={filtroTexto}
              disabled={loading || !apiOnline}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="usr-filtro-rol">Rol</label>
            <select
              id="usr-filtro-rol"
              value={filtroRol}
              disabled={loading || !apiOnline}
              onChange={(e) => setFiltroRol(e.target.value as "" | Rol)}
            >
              <option value="">Todos</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROL_LABELS_DETALLE[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="usr-filtro-estado">Estado</label>
            <select
              id="usr-filtro-estado"
              value={filtroEstado}
              disabled={loading || !apiOnline}
              onChange={(e) =>
                setFiltroEstado(e.target.value as "" | "activo" | "inactivo")
              }
            >
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
          <button
            type="button"
            className="btn listado-pro-reset-btn"
            disabled={!hayFiltros || loading}
            onClick={limpiarFiltros}
          >
            Limpiar
          </button>
        </div>

        <div className="table-wrap listado-pro-table-wrap usuarios-admin-table-wrap">
          <table className="data-table listado-pro-table usuarios-admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>ID_USUARIO</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th className="col-acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="usuarios-admin-empty-cell">
                    <div className="usuarios-admin-empty">Cargando usuarios…</div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="usuarios-admin-empty-cell">
                    <div className="usuarios-admin-empty" role="status">
                      {hayFiltros
                        ? "No hay usuarios que coincidan con los filtros"
                        : "Sin usuarios registrados"}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((u) => {
                  const acceso = fmtUltimoAcceso(u.ultimo_acceso);
                  return (
                    <tr
                      key={u.id}
                      className={`listado-pro-row usuarios-admin-row${
                        !u.activo ? " usuarios-row--inactivo" : ""
                      }${u.id === currentUser.id ? " usuarios-admin-row--self" : ""}`}
                    >
                      <td>
                        <div className="usuarios-table-user">
                          <UserAvatar nombre={u.nombre} avatar={u.avatar} variant="list" />
                          <div className="usuarios-table-user-text">
                            <strong>{u.nombre}</strong>
                            {u.id === currentUser.id && (
                              <span className="usuarios-badge-you">Tu cuenta</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="usuarios-id-badge">
                          ID_USUARIO {u.usuario_numero}
                        </span>
                      </td>
                      <td className="usuarios-admin-email">{u.email}</td>
                      <td>
                        <span className={`usuarios-rol-badge usuarios-rol-badge--${u.rol}`}>
                          {u.rol_label}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`usuarios-estado-pill ${
                            u.activo
                              ? "usuarios-estado-pill--activo"
                              : "usuarios-estado-pill--inactivo"
                          }`}
                        >
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="usuarios-admin-fecha">
                        <span className="usuarios-admin-fecha-dia">{acceso.fecha}</span>
                        {acceso.hora ? (
                          <span className="usuarios-admin-fecha-hora muted">{acceso.hora}</span>
                        ) : null}
                      </td>
                      <td className="actions-cell usuarios-admin-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEdit(u)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`btn btn-xs ${
                            u.activo ? "btn-ghost" : "btn-primary"
                          }`}
                          disabled={u.id === currentUser.id && u.activo}
                          onClick={() => void toggleActivo(u)}
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
