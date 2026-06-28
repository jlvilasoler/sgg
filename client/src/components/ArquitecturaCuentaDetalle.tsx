import { useCallback, useEffect, useState } from "react";
import {
  actualizarEmpresaCuenta,
  asignarAdminCuenta,
  crearEmpresaOperativa,
  crearUsuarioEmpresa,
  fetchUsuarios,
} from "../api";
import type {
  AuthUser,
  EmpresaCuenta,
  EmpresaOperativaForm,
  Rol,
  UserForm,
} from "../types";
import { ALL_ROLES, ROL_LABELS_DETALLE } from "../types";
import {
  PASSWORD_POLICY_HINT,
  validatePasswordStrength,
} from "../utils/password-policy";
import UserAvatar from "./UserAvatar";
import {
  emptyOperativaForm,
  emptyUserForm,
  IconoOjo,
  iniciales,
} from "./arquitectura-sistema-shared";

export type CuentaDetallePanel = "none" | "user" | "operativa";

export type CuentaDetalleModo = "plataforma" | "cuentaPropia";

interface Props {
  cuenta: EmpresaCuenta;
  apiOnline: boolean;
  modo?: CuentaDetalleModo;
  volverLabel?: string;
  onVolver: () => void;
  onCuentaUpdated: (cuenta: EmpresaCuenta) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  initialPanel?: CuentaDetallePanel;
}

const ROLES_EMPRESA: Rol[] = ALL_ROLES;

export default function ArquitecturaCuentaDetalle({
  cuenta,
  apiOnline,
  modo = "plataforma",
  volverLabel,
  onVolver,
  onCuentaUpdated,
  onError,
  onSuccess,
  initialPanel = "none",
}: Props) {
  const esCuentaPropia = modo === "cuentaPropia";
  const backLabel =
    volverLabel ?? (esCuentaPropia ? "Volver a Configuración" : "Volver a cuentas madre");
  const [cuentaActual, setCuentaActual] = useState(cuenta);
  const [usuarios, setUsuarios] = useState<AuthUser[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);

  const [showUserForm, setShowUserForm] = useState(initialPanel === "user");
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [savingUser, setSavingUser] = useState(false);
  const [showUserPassword, setShowUserPassword] = useState(false);

  const [showOperativaForm, setShowOperativaForm] = useState(
    initialPanel === "operativa"
  );
  const [operativaForm, setOperativaForm] = useState<EmpresaOperativaForm>(
    emptyOperativaForm
  );
  const [savingOperativa, setSavingOperativa] = useState(false);
  const [showEmpresasSection, setShowEmpresasSection] = useState(
    initialPanel === "operativa"
  );
  const [showUsuariosSection, setShowUsuariosSection] = useState(
    initialPanel === "user"
  );

  const [cuentaForm, setCuentaForm] = useState({
    nombre: cuenta.nombre,
    codigo: cuenta.codigo,
  });
  const [savingCuenta, setSavingCuenta] = useState(false);

  useEffect(() => {
    setCuentaForm({ nombre: cuenta.nombre, codigo: cuenta.codigo });
  }, [cuenta.nombre, cuenta.codigo]);

  useEffect(() => {
    if (initialPanel === "operativa") setShowEmpresasSection(true);
    if (initialPanel === "user") setShowUsuariosSection(true);
  }, [initialPanel]);

  useEffect(() => {
    setCuentaActual(cuenta);
  }, [cuenta]);

  const syncCuenta = useCallback(
    (updated: EmpresaCuenta) => {
      setCuentaActual(updated);
      onCuentaUpdated(updated);
    },
    [onCuentaUpdated]
  );

  const loadUsuarios = useCallback(async () => {
    if (!apiOnline) {
      setUsuarios([]);
      setLoadingUsuarios(false);
      return;
    }
    setLoadingUsuarios(true);
    try {
      setUsuarios(await fetchUsuarios(cuentaActual.id));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar usuarios de la cuenta");
    } finally {
      setLoadingUsuarios(false);
    }
  }, [apiOnline, cuentaActual.id, onError]);

  useEffect(() => {
    void loadUsuarios();
  }, [loadUsuarios]);

  const handleToggleActiva = async () => {
    try {
      const updated = await actualizarEmpresaCuenta(cuentaActual.id, {
        activo: !cuentaActual.activo,
      });
      syncCuenta(updated);
      onSuccess(
        updated.activo
          ? `${updated.nombre} activada`
          : `${updated.nombre} desactivada`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar cuenta");
    }
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email.trim() || !userForm.nombre.trim()) {
      onError("Email y nombre son obligatorios");
      return;
    }
    if (!userForm.password?.trim()) {
      onError("La contraseña es obligatoria");
      return;
    }
    const pwdErr = validatePasswordStrength(userForm.password);
    if (pwdErr) {
      onError(pwdErr);
      return;
    }
    setSavingUser(true);
    try {
      const { usuario: created, cuenta: cuentaResp } = await crearUsuarioEmpresa(
        cuentaActual.id,
        {
          ...userForm,
          email: userForm.email.trim(),
          nombre: userForm.nombre.trim(),
        }
      );
      setUsuarios((prev) =>
        [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      syncCuenta({
        ...cuentaActual,
        usuarios_count: cuentaActual.usuarios_count + 1,
        admin_user_id: cuentaResp?.admin_user_id ?? cuentaActual.admin_user_id,
        admin: cuentaResp?.admin ?? cuentaActual.admin,
      });
      setUserForm(emptyUserForm());
      setShowUserForm(false);
      setShowUserPassword(false);
      onSuccess(`Usuario ${created.email} creado`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al crear usuario");
    } finally {
      setSavingUser(false);
    }
  };

  const handleAsignarAdmin = async (userId: number | null) => {
    try {
      const updated = await asignarAdminCuenta(cuentaActual.id, userId);
      syncCuenta(updated);
      if (userId != null) {
        setUsuarios((prev) =>
          prev.map((u) =>
            u.id === userId && u.rol !== "admin"
              ? { ...u, rol: "admin", rol_label: "Administrador" }
              : u
          )
        );
      }
      onSuccess(
        updated.admin
          ? `Administrador de ${updated.nombre}: ${updated.admin.email}`
          : `Administrador de ${updated.nombre} quitado`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al asignar administrador");
    }
  };

  const handleCrearOperativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativaForm.nombre.trim() || !operativaForm.codigo.trim()) {
      onError("Completá nombre y código de la empresa interna");
      return;
    }
    setSavingOperativa(true);
    try {
      const created = await crearEmpresaOperativa(cuentaActual.id, {
        nombre: operativaForm.nombre.trim(),
        codigo: operativaForm.codigo.trim().toUpperCase(),
        activo: true,
      });
      syncCuenta({
        ...cuentaActual,
        empresas: [...cuentaActual.empresas, created].sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es")
        ),
        empresas_count: cuentaActual.empresas_count + 1,
      });
      setOperativaForm(emptyOperativaForm());
      setShowOperativaForm(false);
      onSuccess(`Empresa agregada: ${created.nombre}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al crear empresa interna");
    } finally {
      setSavingOperativa(false);
    }
  };

  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaForm.nombre.trim() || !cuentaForm.codigo.trim()) {
      onError("Completá nombre y código de la cuenta");
      return;
    }
    setSavingCuenta(true);
    try {
      const updated = await actualizarEmpresaCuenta(cuentaActual.id, {
        nombre: cuentaForm.nombre.trim(),
        codigo: cuentaForm.codigo.trim().toUpperCase(),
      });
      syncCuenta(updated);
      onSuccess("Datos de la cuenta actualizados");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar cuenta");
    } finally {
      setSavingCuenta(false);
    }
  };

  return (
    <div className="subseccion-panel arquitectura-sistema arquitectura-cuenta-detalle">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {backLabel}
      </button>

      <div className="card">
        <header className="arquitectura-cuenta-detalle-head">
          <div className="arquitectura-cuenta-detalle-identidad">
            <span className="arquitectura-sistema-empresa-avatar" aria-hidden="true">
              {iniciales(cuentaActual.nombre)}
            </span>
            <div>
              <h2>{cuentaActual.nombre}</h2>
              <div className="arquitectura-sistema-pills">
                <span className="arquitectura-sistema-pill arquitectura-sistema-pill--cuenta">
                  ID cuenta {cuentaActual.cuenta_numero}
                </span>
                <span className="arquitectura-sistema-pill">{cuentaActual.codigo}</span>
                <span className="arquitectura-sistema-pill">
                  {cuentaActual.empresas_count} empresa
                  {cuentaActual.empresas_count === 1 ? "" : "s"}
                </span>
                <span className="arquitectura-sistema-pill">
                  {cuentaActual.usuarios_count} usuario
                  {cuentaActual.usuarios_count === 1 ? "" : "s"}
                </span>
                {!cuentaActual.activo && (
                  <span className="arquitectura-sistema-badge arquitectura-sistema-badge--inactiva">
                    Inactiva
                  </span>
                )}
              </div>
              <span
                className={`arquitectura-sistema-admin-chip${cuentaActual.admin ? "" : " is-empty"}`}
              >
                {cuentaActual.admin ? (
                  <>
                    <span className="arquitectura-sistema-admin-dot" />
                    {cuentaActual.admin.nombre}
                    {cuentaActual.admin.es_super_admin ? " · admin SAG" : ""}
                  </>
                ) : (
                  "Sin administrador asignado"
                )}
              </span>
            </div>
          </div>
          <div className="arquitectura-cuenta-detalle-actions">
            {!esCuentaPropia && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleToggleActiva()}
              >
                {cuentaActual.activo ? "Desactivar" : "Activar"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowEmpresasSection(true);
                setShowOperativaForm(true);
                setShowUserForm(false);
                setOperativaForm(emptyOperativaForm());
              }}
            >
              + Empresa
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowUsuariosSection(true);
                setShowUserForm(true);
                setShowOperativaForm(false);
                setUserForm(emptyUserForm());
                setShowUserPassword(false);
              }}
            >
              + Usuario
            </button>
          </div>
        </header>

        <div className="arquitectura-cuenta-detalle-body">
          {esCuentaPropia && (
            <section className="usuarios-form-card">
              <h3>Datos de la cuenta</h3>
              <form className="usuarios-form-grid" onSubmit={(e) => void handleGuardarCuenta(e)}>
                <div className="field">
                  <label htmlFor="cuenta-nombre">Nombre de la cuenta</label>
                  <input
                    id="cuenta-nombre"
                    type="text"
                    value={cuentaForm.nombre}
                    onChange={(e) =>
                      setCuentaForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="cuenta-codigo">Código corto</label>
                  <input
                    id="cuenta-codigo"
                    type="text"
                    value={cuentaForm.codigo}
                    onChange={(e) =>
                      setCuentaForm((f) => ({
                        ...f,
                        codigo: e.target.value.toUpperCase(),
                      }))
                    }
                    required
                  />
                </div>
                <div className="usuarios-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={savingCuenta}>
                    {savingCuenta ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="arquitectura-sistema-usuarios arquitectura-sistema-admin-box">
            <h3>Administrador de la cuenta</h3>
            <p className="muted">
              {cuentaActual.admin
                ? `${cuentaActual.admin.nombre} · ${cuentaActual.admin.email}${cuentaActual.admin.es_super_admin ? " (también administrador del sistema SAG)" : ""}`
                : "Esta cuenta todavía no tiene un administrador asignado."}
            </p>
            <div className="arquitectura-sistema-admin-control">
              <label>
                <span>Asignar administrador</span>
                <select
                  value={cuentaActual.admin_user_id ?? ""}
                  onChange={(e) =>
                    void handleAsignarAdmin(
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                >
                  <option value="">— Sin administrador —</option>
                  {cuentaActual.admin?.es_super_admin && (
                    <option value={cuentaActual.admin.id}>
                      {cuentaActual.admin.nombre} ({cuentaActual.admin.email}) · admin SAG
                    </option>
                  )}
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <small className="muted">
                Elegí un usuario de esta cuenta. Quedará con rol Administrador y gestionará
                los usuarios de la cuenta.
              </small>
            </div>
          </section>

          <section
            className={`arquitectura-cuenta-seccion arquitectura-sistema-usuarios${
              showEmpresasSection ? " is-expanded" : ""
            }`}
          >
            <button
              type="button"
              className="arquitectura-cuenta-seccion-toggle"
              onClick={() => setShowEmpresasSection((v) => !v)}
              aria-expanded={showEmpresasSection}
            >
              <h3>Empresas dentro de {cuentaActual.nombre}</h3>
              <span className="arquitectura-cuenta-seccion-count">
                {cuentaActual.empresas_count}
              </span>
              <span className="arquitectura-sistema-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            {showEmpresasSection && (
              <div className="arquitectura-cuenta-seccion-body">
                {cuentaActual.empresas.length === 0 ? (
                  <p className="muted">Sin empresas internas todavía.</p>
                ) : (
                  <ul className="arquitectura-sistema-usuarios-list">
                    {cuentaActual.empresas.map((op) => (
                      <li key={op.id}>
                        <div className="arquitectura-sistema-usuario-info">
                          <strong>{op.nombre}</strong>
                          <span className="muted">Código {op.codigo}</span>
                        </div>
                        <span
                          className={
                            op.activo
                              ? "arquitectura-sistema-estado arquitectura-sistema-estado--activo"
                              : "arquitectura-sistema-estado"
                          }
                        >
                          {op.activo ? "Activa" : "Inactiva"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {showOperativaForm && showEmpresasSection && (
            <form
              className="arquitectura-sistema-user-form"
              onSubmit={(e) => void handleCrearOperativa(e)}
            >
              <h4>Nueva empresa dentro de {cuentaActual.nombre}</h4>
              <div className="arquitectura-sistema-form-grid">
                <label>
                  <span>Nombre de empresa</span>
                  <input
                    type="text"
                    value={operativaForm.nombre}
                    onChange={(e) =>
                      setOperativaForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    placeholder="Ej. GANADERA GUAVIYU"
                    required
                  />
                </label>
                <label>
                  <span>Código corto</span>
                  <input
                    type="text"
                    value={operativaForm.codigo}
                    onChange={(e) =>
                      setOperativaForm((f) => ({
                        ...f,
                        codigo: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ej. GUAVIYU"
                    required
                  />
                </label>
              </div>
              <div className="arquitectura-sistema-form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowOperativaForm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingOperativa}
                >
                  {savingOperativa ? "Guardando…" : "Agregar empresa"}
                </button>
              </div>
            </form>
          )}

          {showUserForm && showUsuariosSection && (
            <form
              className="arquitectura-sistema-user-form"
              onSubmit={(e) => void handleCrearUsuario(e)}
            >
              <h4>Nuevo usuario para {cuentaActual.nombre}</h4>
              <div className="arquitectura-sistema-form-grid">
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={userForm.nombre}
                    onChange={(e) =>
                      setUserForm((f) => ({ ...f, nombre: e.target.value }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Rol</span>
                  <select
                    value={userForm.rol}
                    onChange={(e) =>
                      setUserForm((f) => ({
                        ...f,
                        rol: e.target.value as Rol,
                      }))
                    }
                  >
                    {ROLES_EMPRESA.map((r) => (
                      <option key={r} value={r}>
                        {ROL_LABELS_DETALLE[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Contraseña</span>
                  <div className="arquitectura-sistema-password-wrap">
                    <input
                      type={showUserPassword ? "text" : "password"}
                      autoComplete="new-password"
                      data-sin-mayusculas="true"
                      value={userForm.password ?? ""}
                      onChange={(e) =>
                        setUserForm((f) => ({
                          ...f,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                    <button
                      type="button"
                      className="arquitectura-sistema-password-toggle"
                      onClick={() => setShowUserPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={
                        showUserPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      title={
                        showUserPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                    >
                      <IconoOjo visible={showUserPassword} />
                    </button>
                  </div>
                  <small className="muted">{PASSWORD_POLICY_HINT}</small>
                </label>
              </div>
              <div className="arquitectura-sistema-form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowUserForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingUser}>
                  {savingUser ? "Guardando…" : "Crear usuario"}
                </button>
              </div>
            </form>
          )}

          <section
            className={`arquitectura-cuenta-seccion arquitectura-sistema-usuarios${
              showUsuariosSection ? " is-expanded" : ""
            }`}
          >
            <button
              type="button"
              className="arquitectura-cuenta-seccion-toggle"
              onClick={() => setShowUsuariosSection((v) => !v)}
              aria-expanded={showUsuariosSection}
            >
              <h3>Usuarios de la cuenta</h3>
              <span className="arquitectura-cuenta-seccion-count">
                {cuentaActual.usuarios_count}
              </span>
              <span className="arquitectura-sistema-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            {showUsuariosSection && (
              <div className="arquitectura-cuenta-seccion-body">
                {loadingUsuarios ? (
                  <p className="muted">Cargando usuarios…</p>
                ) : usuarios.length === 0 ? (
                  <p className="muted">
                    Sin usuarios. Agregá el primero con el botón + Usuario.
                  </p>
                ) : (
                  <ul className="arquitectura-sistema-usuarios-list">
                    {usuarios.map((u) => (
                      <li key={u.id}>
                        <UserAvatar nombre={u.nombre} avatar={u.avatar} variant="list" />
                        <div className="arquitectura-sistema-usuario-info">
                          <strong>{u.nombre}</strong>
                          <span className="muted">{u.email}</span>
                          <span className="usuarios-id-badge">
                            ID_USUARIO {u.usuario_numero}
                          </span>
                          <span className="arquitectura-sistema-user-cuenta">
                            Cuenta {u.empresa_cuenta_numero ?? cuentaActual.cuenta_numero}
                          </span>
                        </div>
                        <span
                          className={`arquitectura-sistema-rol-badge arquitectura-sistema-rol-badge--${u.rol}`}
                        >
                          {u.rol_label}
                        </span>
                        <span
                          className={
                            u.activo
                              ? "arquitectura-sistema-estado arquitectura-sistema-estado--activo"
                              : "arquitectura-sistema-estado"
                          }
                        >
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
