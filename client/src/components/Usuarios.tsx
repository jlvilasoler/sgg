import { useCallback, useEffect, useState } from "react";
import {
  actualizarUsuario,
  crearUsuario,
  fetchUsuarios,
} from "../api";
import type { AuthUser, Rol, UserForm } from "../types";
import { ROL_DESCRIPCION, ROL_LABELS } from "../utils/auth-permissions";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";

import UsuariosRolesModal from "./UsuariosRolesModal";
import UsuariosActividad from "./UsuariosActividad";
import { canAccessUsuarioActividad } from "../utils/auth-permissions";

interface Props {
  apiOnline: boolean;
  currentUser: AuthUser;
  onVolver: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onPermissionsChanged?: () => void;
}

const ROLES: Rol[] = ["admin", "editor", "consulta"];

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
  onError,
  onSuccess,
  onPermissionsChanged,
}: Props) {
  const [rows, setRows] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [vista, setVista] = useState<"usuarios" | "actividad">("usuarios");

  const puedeVerActividad = canAccessUsuarioActividad(currentUser);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchUsuarios());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const showForm = creating || editing !== null;

  if (vista === "actividad" && puedeVerActividad) {
    return (
      <UsuariosActividad
        apiOnline={apiOnline}
        onError={onError}
        onVolver={() => setVista("usuarios")}
      />
    );
  }

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al menú
      </button>

      <div className="card usuarios-panel">
        <header className="usuarios-head">
          <div>
            <h2 className="usuarios-head-title">Usuarios y permisos</h2>
            <p className="usuarios-head-sub">
              {loading
                ? "Cargando…"
                : `${rows.length} usuario(s) · Solo administradores gestionan accesos`}
            </p>
          </div>
          <div className="usuarios-head-actions">
            {puedeVerActividad ? (
              <button
                type="button"
                className="btn btn-ghost usuarios-actividad-btn"
                disabled={!apiOnline || showForm}
                onClick={() => setVista("actividad")}
                title="Registro de actividad de usuarios"
              >
                <span className="usuarios-actividad-btn-icon" aria-hidden="true">
                  📋
                </span>
                Registro de actividad
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!apiOnline || showForm}
              onClick={() => setRolesModalOpen(true)}
            >
              Permisos por rol
            </button>
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
                      {ROL_LABELS[r]}
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

        <div className="table-wrap">
          <table className="data-table usuarios-table">
            <thead>
              <tr>
                <th>Usuario</th>
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
                  <td colSpan={6} className="empty">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Sin usuarios
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className={!u.activo ? "usuarios-row--inactivo" : ""}>
                    <td>
                      <strong>{u.nombre}</strong>
                      {u.id === currentUser.id && (
                        <span className="usuarios-badge-you">Tú</span>
                      )}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`usuarios-rol-badge usuarios-rol-badge--${u.rol}`}>
                        {u.rol_label}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`usuarios-estado ${u.activo ? "usuarios-estado--activo" : "usuarios-estado--inactivo"}`}
                      >
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="muted small-cell">
                      {u.ultimo_acceso
                        ? new Date(u.ultimo_acceso.replace(" ", "T")).toLocaleString("es-UY")
                        : "—"}
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => openEdit(u)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        disabled={u.id === currentUser.id && u.activo}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UsuariosRolesModal
        open={rolesModalOpen}
        apiOnline={apiOnline}
        onClose={() => setRolesModalOpen(false)}
        onError={onError}
        onSuccess={onSuccess}
        onSaved={onPermissionsChanged}
      />
    </div>
  );
}
