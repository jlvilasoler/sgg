import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Building2, ChevronLeft, ChevronDown, ShieldCheck, Users } from "lucide-react";
import {
  actualizarEmpresaCuenta,
  actualizarEmpresaOperativa,
  actualizarUsuario,
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
import SelectColorEmpresaOperativa from "./SelectColorEmpresaOperativa";
import { hexColorCaravana } from "./stock/stock-dispositivo-color";
import UserAvatar from "./UserAvatar";
import { SgHubKpi, SgMiniBars } from "./stock/SgHubUi";
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
  currentUser?: AuthUser | null;
  volverLabel?: string;
  onVolver: () => void;
  onCuentaUpdated: (cuenta: EmpresaCuenta) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  initialPanel?: CuentaDetallePanel;
  /** Dentro del hub SAG (sin cabecera legacy duplicada). */
  embedded?: boolean;
}

const ROLES_EMPRESA: Rol[] = ALL_ROLES;

export default function ArquitecturaCuentaDetalle({
  cuenta,
  apiOnline,
  modo = "plataforma",
  currentUser = null,
  volverLabel,
  onVolver,
  onCuentaUpdated,
  onError,
  onSuccess,
  initialPanel = "none",
  embedded = false,
}: Props) {
  const esCuentaPropia = modo === "cuentaPropia";
  const puedeGestionarCuenta =
    !esCuentaPropia || Boolean(currentUser?.es_admin_cuenta);
  const puedeEditarDatosCuenta =
    (esCuentaPropia && Boolean(currentUser?.es_admin_cuenta)) ||
    Boolean(currentUser?.es_super_admin || currentUser?.es_admin_plataforma);
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
  const [editingOperativaId, setEditingOperativaId] = useState<number | null>(null);
  const [operativaEditForm, setOperativaEditForm] = useState<EmpresaOperativaForm>(
    emptyOperativaForm()
  );
  const [savingOperativaEdit, setSavingOperativaEdit] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userEditForm, setUserEditForm] = useState<UserForm>(emptyUserForm);
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [showUserEditPassword, setShowUserEditPassword] = useState(false);
  const [showEmpresasSection, setShowEmpresasSection] = useState(
    initialPanel === "operativa" || modo === "cuentaPropia"
  );
  const [showUsuariosSection, setShowUsuariosSection] = useState(
    initialPanel === "user" || modo === "cuentaPropia"
  );

  const [cuentaForm, setCuentaForm] = useState({
    nombre: cuenta.nombre,
  });
  const [savingCuenta, setSavingCuenta] = useState(false);
  const [showEditarCuentaModal, setShowEditarCuentaModal] = useState(false);

  useEffect(() => {
    setCuentaForm({ nombre: cuenta.nombre });
  }, [cuenta.nombre]);

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

  const coloresOcupadosCuenta = useMemo(
    () =>
      cuentaActual.empresas
        .filter((e) => e.id !== editingOperativaId)
        .map((e) => e.color)
        .filter(Boolean),
    [cuentaActual.empresas, editingOperativaId]
  );

  const handleCrearOperativa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operativaForm.nombre.trim()) {
      onError("Completá el nombre de la empresa interna");
      return;
    }
    if (!operativaForm.color?.trim()) {
      onError("Elegí un color para la empresa");
      return;
    }
    setSavingOperativa(true);
    try {
      const created = await crearEmpresaOperativa(cuentaActual.id, {
        nombre: operativaForm.nombre.trim(),
        color: operativaForm.color,
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

  const openEditOperativa = (op: (typeof cuentaActual.empresas)[number]) => {
    setEditingOperativaId(op.id);
    setOperativaEditForm({
      nombre: op.nombre,
      color: op.color ?? "",
      activo: op.activo,
    });
    setShowOperativaForm(false);
    closeEditUser();
  };

  const closeEditOperativa = () => {
    setEditingOperativaId(null);
    setOperativaEditForm(emptyOperativaForm());
  };

  const handleGuardarOperativa = async (e: React.FormEvent, empresaId: number) => {
    e.preventDefault();
    if (!operativaEditForm.nombre.trim()) {
      onError("Completá el nombre de la empresa");
      return;
    }
    if (!operativaEditForm.color?.trim()) {
      onError("Elegí un color para la empresa");
      return;
    }
    setSavingOperativaEdit(true);
    try {
      const updated = await actualizarEmpresaOperativa(cuentaActual.id, empresaId, {
        nombre: operativaEditForm.nombre.trim(),
        color: operativaEditForm.color,
        activo: operativaEditForm.activo,
      });
      syncCuenta({
        ...cuentaActual,
        empresas: cuentaActual.empresas
          .map((e) => (e.id === updated.id ? updated : e))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      });
      closeEditOperativa();
      onSuccess(`Empresa actualizada: ${updated.nombre}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar empresa");
    } finally {
      setSavingOperativaEdit(false);
    }
  };

  const openEditUser = (u: AuthUser) => {
    setEditingUserId(u.id);
    setUserEditForm({
      email: u.email,
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      password: "",
    });
    setShowUserForm(false);
    setShowUserEditPassword(false);
    closeEditOperativa();
  };

  const focusEditAdmin = (u: AuthUser) => {
    openEditUser(u);
    setShowUsuariosSection(true);
  };

  type AdminListItem = {
    id: number;
    nombre: string;
    email: string;
    esSuperAdmin: boolean;
    usuario?: AuthUser;
  };

  const administradoresDeCuenta = useMemo((): AdminListItem[] => {
    const map = new Map<number, AdminListItem>();
    for (const u of usuarios) {
      if (u.rol === "admin") {
        map.set(u.id, {
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          esSuperAdmin: u.es_super_admin,
          usuario: u,
        });
      }
    }
    const designado = cuentaActual.admin;
    if (designado && !map.has(designado.id)) {
      map.set(designado.id, {
        id: designado.id,
        nombre: designado.nombre,
        email: designado.email,
        esSuperAdmin: designado.es_super_admin,
      });
    }
    return [...map.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
    );
  }, [cuentaActual.admin, usuarios]);

  const closeEditUser = () => {
    setEditingUserId(null);
    setUserEditForm(emptyUserForm());
    setShowUserEditPassword(false);
  };

  const handleGuardarUsuarioEdit = async (e: React.FormEvent, userId: number) => {
    e.preventDefault();
    if (!userEditForm.email.trim() || !userEditForm.nombre.trim()) {
      onError("Email y nombre son obligatorios");
      return;
    }
    const patch: Partial<UserForm> = {
      email: userEditForm.email.trim(),
      nombre: userEditForm.nombre.trim(),
      rol: userEditForm.rol,
      activo: userEditForm.activo,
    };
    if (userEditForm.password?.trim()) {
      const pwdErr = validatePasswordStrength(userEditForm.password);
      if (pwdErr) {
        onError(pwdErr);
        return;
      }
      patch.password = userEditForm.password;
    }
    setSavingUserEdit(true);
    try {
      const updated = await actualizarUsuario(userId, patch);
      setUsuarios((prev) =>
        prev
          .map((u) => (u.id === updated.id ? updated : u))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      closeEditUser();
      onSuccess(`Usuario actualizado: ${updated.email}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar usuario");
    } finally {
      setSavingUserEdit(false);
    }
  };

  const handleToggleUsuarioActivo = async (u: AuthUser) => {
    if (currentUser?.id === u.id && u.activo) {
      onError("No podés desactivar tu propia cuenta");
      return;
    }
    try {
      const updated = await actualizarUsuario(u.id, { activo: !u.activo });
      setUsuarios((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      onSuccess(updated.activo ? `${updated.nombre} activado` : `${updated.nombre} desactivado`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar usuario");
    }
  };

  const handleGuardarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuentaForm.nombre.trim()) {
      onError("Completá el nombre de la cuenta");
      return;
    }
    setSavingCuenta(true);
    try {
      const updated = await actualizarEmpresaCuenta(cuentaActual.id, {
        nombre: cuentaForm.nombre.trim(),
      });
      syncCuenta(updated);
      onSuccess("Datos de la cuenta actualizados");
      setShowEditarCuentaModal(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar cuenta");
    } finally {
      setSavingCuenta(false);
    }
  };

  const openEditarCuentaModal = () => {
    setCuentaForm({ nombre: cuentaActual.nombre });
    setShowEditarCuentaModal(true);
  };

  const closeEditarCuentaModal = () => {
    if (savingCuenta) return;
    setShowEditarCuentaModal(false);
    setCuentaForm({ nombre: cuentaActual.nombre });
  };

  return (
    <div
      className={`arq-sistema-shell arq-sistema--hub arq-cuenta-detalle--hub${
        esCuentaPropia ? " is-cuenta-propia" : ""
      }${embedded ? " arq-sistema--embedded" : ""}`}
    >
      <button type="button" className="arq-cuenta-back" onClick={onVolver}>
        <ChevronLeft size={16} aria-hidden />
        {backLabel}
      </button>

      <section
        className="sg-hub-panel arq-sistema-panel arq-cuenta-panel"
        aria-labelledby="arq-cuenta-title"
      >
        <header className="arq-cuenta-head">
          <div className="arq-cuenta-head-main">
            <span className="arq-cuenta-avatar" aria-hidden="true">
              {iniciales(cuentaActual.nombre)}
            </span>
            <div className="arq-cuenta-head-copy">
              <p className="sg-hub-panel-kicker">
                {esCuentaPropia ? "Arquitectura del sistema" : "Administración de cuenta"}
              </p>
              <h2 id="arq-cuenta-title" className="sg-hub-panel-title arq-cuenta-title">
                {cuentaActual.nombre}
              </h2>
              {!esCuentaPropia ? (
                <div className="arq-cuenta-pills">
                  <span className="arq-cuenta-pill arq-cuenta-pill--id">
                    ID cuenta {cuentaActual.cuenta_numero}
                  </span>
                  <span className="arq-cuenta-pill arq-cuenta-pill--code">{cuentaActual.codigo}</span>
                  {!cuentaActual.activo ? (
                    <span className="arq-cuenta-pill arq-cuenta-pill--off">Inactiva</span>
                  ) : (
                    <span className="arq-cuenta-pill arq-cuenta-pill--ok">Activa</span>
                  )}
                </div>
              ) : null}
              {cuentaActual.admin ? (
                <span className="arq-cuenta-admin-chip">
                  <ShieldCheck size={13} aria-hidden />
                  {cuentaActual.admin.nombre}
                  {cuentaActual.admin.es_super_admin ? " · admin SAG" : ""}
                </span>
              ) : null}
            </div>
          </div>
          {(puedeEditarDatosCuenta || !esCuentaPropia) && (
            <div className="arq-cuenta-head-actions">
              {puedeEditarDatosCuenta ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={openEditarCuentaModal}>
                  Editar
                </button>
              ) : null}
              {!esCuentaPropia ? (
                <button
                  type="button"
                  className={`btn btn-sm${cuentaActual.activo ? " btn-ghost" : " btn-primary"}`}
                  onClick={() => void handleToggleActiva()}
                >
                  {cuentaActual.activo ? "Desactivar" : "Activar"}
                </button>
              ) : null}
            </div>
          )}
        </header>

        <section
          className="sg-hub-kpi-strip home-hub-kpi-strip arq-sistema-kpi-strip arq-cuenta-kpi-strip"
          aria-label="Resumen de la cuenta"
          style={{ "--home-hub-kpi-cols": "4" } as CSSProperties}
        >
          <SgHubKpi
            variant="dark"
            kicker="ID cuenta"
            value={cuentaActual.cuenta_numero}
            hint="Identificador numérico"
            trend="Cuenta madre"
            bars={<SgMiniBars highlight="mid" />}
          />
          <SgHubKpi
            variant="dark"
            kicker="Código"
            value={cuentaActual.codigo}
            hint="Referencia interna"
            trend="Plataforma"
            bars={<SgMiniBars />}
          />
          <SgHubKpi
            variant="light"
            kicker="Empresas"
            value={String(cuentaActual.empresas_count)}
            hint={`Operativa${cuentaActual.empresas_count === 1 ? "" : "s"} en la cuenta`}
            bars={<SgMiniBars highlight="last" />}
          />
          <SgHubKpi
            variant="light"
            kicker="Usuarios"
            value={String(cuentaActual.usuarios_count)}
            hint="Con acceso a la cuenta"
            trend="Accesos"
            bars={<SgMiniBars />}
          />
        </section>

        <div className="arq-cuenta-body arquitectura-cuenta-detalle-body">
          <section className="cuenta-panel cuenta-panel--admin arquitectura-sistema-admin-box arq-cuenta-section arq-cuenta-section--admin">
            <div className="cuenta-panel-head arq-cuenta-section-head">
              <span className="cuenta-panel-icon cuenta-panel-icon--admin arq-cuenta-section-icon" aria-hidden="true">
                <ShieldCheck size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3>Administrador de la cuenta</h3>
                <p className="muted">
                  {administradoresDeCuenta.length > 1
                    ? `${administradoresDeCuenta.length} administradores con acceso de gestión. El designado es el referente principal de la cuenta.`
                    : cuentaActual.admin
                      ? `${cuentaActual.admin.nombre} · ${cuentaActual.admin.email}${
                          cuentaActual.admin.es_super_admin
                            ? " (también administrador del sistema SAG)"
                            : ""
                        }`
                      : "Esta cuenta todavía no tiene un administrador asignado."}
                </p>
              </div>
            </div>
            {administradoresDeCuenta.length > 0 ? (
              <ul className="cuenta-administradores-list" aria-label="Administradores de la cuenta">
                {administradoresDeCuenta.map((a) => {
                  const esDesignado = cuentaActual.admin_user_id === a.id;
                  const editable = Boolean(a.usuario);
                  return (
                    <li
                      key={a.id}
                      className={`cuenta-administrador-card${
                        esDesignado ? " cuenta-administrador-card--designado" : ""
                      }${editingUserId === a.id ? " cuenta-administrador-card--editing" : ""}`}
                    >
                      <UserAvatar nombre={a.nombre} avatar={a.usuario?.avatar ?? null} variant="list" />
                      <div className="cuenta-administrador-card-copy">
                        <strong>{a.nombre}</strong>
                        <span className="muted">{a.email}</span>
                      </div>
                      {esDesignado ? (
                        <span className="cuenta-admin-designado-badge">Designado</span>
                      ) : null}
                      {editable && a.usuario ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => focusEditAdmin(a.usuario!)}
                        >
                          {editingUserId === a.id ? "Editando…" : "Editar"}
                        </button>
                      ) : (
                        <span className="muted cuenta-administrador-card-note">Admin SAG</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="arquitectura-sistema-admin-control">
              <label>
                <span>Administrador designado</span>
                <select
                  value={cuentaActual.admin_user_id ?? ""}
                  disabled={!puedeGestionarCuenta}
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
                Elegí el administrador principal de la cuenta. Podés tener más usuarios con rol
                Administrador (se listan arriba); solo uno queda como designado en el selector.
              </small>
            </div>
          </section>

          <section
            className={`cuenta-panel cuenta-panel--collapsible arquitectura-cuenta-seccion arq-cuenta-section${
              showEmpresasSection ? " is-expanded" : ""
            }`}
          >
            <button
              type="button"
              className="arquitectura-cuenta-seccion-toggle cuenta-panel-toggle arq-cuenta-section-toggle"
              onClick={() => setShowEmpresasSection((v) => !v)}
              aria-expanded={showEmpresasSection}
            >
              <span className="cuenta-panel-icon cuenta-panel-icon--empresas arq-cuenta-section-icon" aria-hidden="true">
                <Building2 size={20} strokeWidth={1.75} />
              </span>
              <span className="cuenta-panel-toggle-text">
                <strong>Empresas operativas</strong>
                <span className="muted">Unidades de negocio dentro de {cuentaActual.nombre}</span>
              </span>
              <span className="arquitectura-cuenta-seccion-count">
                {cuentaActual.empresas_count}
              </span>
              <span className="arquitectura-sistema-chevron arq-cuenta-chevron" aria-hidden="true">
                <ChevronDown size={18} />
              </span>
            </button>
            {showEmpresasSection && (
              <div className="arquitectura-cuenta-seccion-body">
                {cuentaActual.empresas.length === 0 ? (
                  <div className="cuenta-empty-state">
                    <span className="cuenta-empty-state-icon" aria-hidden="true">🏢</span>
                    <p>Todavía no hay empresas operativas.</p>
                    <span className="muted">Agregá la primera con el botón de abajo.</span>
                  </div>
                ) : (
                  <ul className="arquitectura-sistema-usuarios-list cuenta-entity-list">
                    {cuentaActual.empresas.map((op) => (
                      <li
                        key={op.id}
                        className={`cuenta-entity-card${
                          editingOperativaId === op.id ? " cuenta-entity-card--editing" : ""
                        }`}
                      >
                        {editingOperativaId === op.id ? (
                          <form
                            className="cuenta-entity-edit-form"
                            onSubmit={(e) => void handleGuardarOperativa(e, op.id)}
                          >
                            <div className="cuenta-entity-edit-form-head">
                              <strong>Editar empresa</strong>
                              <span className="arquitectura-sistema-pill arquitectura-sistema-pill--codigo">
                                {op.codigo}
                              </span>
                            </div>
                            <div className="arquitectura-sistema-form-grid cuenta-entity-edit-form-grid">
                              <label>
                                <span>Nombre de empresa</span>
                                <input
                                  type="text"
                                  value={operativaEditForm.nombre}
                                  onChange={(e) =>
                                    setOperativaEditForm((f) => ({
                                      ...f,
                                      nombre: e.target.value,
                                    }))
                                  }
                                  required
                                  autoFocus
                                />
                              </label>
                              <div className="cuenta-entity-edit-color cuenta-entity-edit-color--full">
                                <span className="cuenta-entity-edit-color-label">Color</span>
                                <SelectColorEmpresaOperativa
                                  value={operativaEditForm.color ?? ""}
                                  coloresOcupados={coloresOcupadosCuenta}
                                  onChange={(color) =>
                                    setOperativaEditForm((f) => ({ ...f, color }))
                                  }
                                />
                              </div>
                              <label className="cuenta-entity-edit-activo">
                                <input
                                  type="checkbox"
                                  checked={operativaEditForm.activo}
                                  onChange={(e) =>
                                    setOperativaEditForm((f) => ({
                                      ...f,
                                      activo: e.target.checked,
                                    }))
                                  }
                                />
                                <span>Empresa activa</span>
                              </label>
                            </div>
                            <div className="arquitectura-sistema-form-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={savingOperativaEdit}
                                onClick={closeEditOperativa}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={savingOperativaEdit}
                              >
                                {savingOperativaEdit ? "Guardando…" : "Guardar cambios"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <span
                              className="cuenta-entity-avatar cuenta-entity-avatar--empresa"
                              style={
                                op.color
                                  ? { background: hexColorCaravana(op.color) ?? undefined }
                                  : undefined
                              }
                              aria-hidden="true"
                            >
                              {iniciales(op.nombre)}
                            </span>
                            <div className="arquitectura-sistema-usuario-info">
                              <strong>{op.nombre}</strong>
                              <span className="muted">
                                Código{" "}
                                <span className="arquitectura-sistema-pill arquitectura-sistema-pill--codigo arquitectura-sistema-pill--inline">
                                  {op.codigo}
                                </span>
                              </span>
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
                            <div className="cuenta-entity-actions">
                              {puedeGestionarCuenta ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openEditOperativa(op)}
                                >
                                  Editar
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {showOperativaForm ? (
                  <form
                    className="arquitectura-sistema-user-form arquitectura-cuenta-seccion-form"
                    onSubmit={(e) => void handleCrearOperativa(e)}
                  >
                    <h4>Nueva empresa dentro de {cuentaActual.nombre}</h4>
                    <p className="muted arquitectura-cuenta-form-hint">
                      El código se asigna automáticamente (E00001, E00002…).
                    </p>
                    <div className="arquitectura-sistema-form-grid">
                      <label>
                        <span>Nombre de empresa</span>
                        <input
                          type="text"
                          value={operativaForm.nombre}
                          onChange={(e) =>
                            setOperativaForm((f) => ({ ...f, nombre: e.target.value }))
                          }
                          placeholder="INGRESAR NUEVA EMPRESA"
                          required
                        />
                      </label>
                    </div>
                    <div className="cuenta-entity-edit-color cuenta-entity-edit-color--full">
                      <span className="cuenta-entity-edit-color-label">Color</span>
                      <SelectColorEmpresaOperativa
                        value={operativaForm.color ?? ""}
                        coloresOcupados={coloresOcupadosCuenta}
                        onChange={(color) =>
                          setOperativaForm((f) => ({ ...f, color }))
                        }
                      />
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
                ) : puedeGestionarCuenta ? (
                  <div className="arquitectura-cuenta-seccion-actions">
                    <button
                      type="button"
                      className="btn cuenta-add-btn"
                      onClick={() => {
                        setShowOperativaForm(true);
                        setShowUserForm(false);
                        closeEditOperativa();
                        setOperativaForm(emptyOperativaForm());
                      }}
                    >
                      <span className="cuenta-add-btn-icon" aria-hidden="true">+</span>
                      Nueva empresa
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section
            className={`cuenta-panel cuenta-panel--collapsible arquitectura-cuenta-seccion arq-cuenta-section${
              showUsuariosSection ? " is-expanded" : ""
            }`}
          >
            <button
              type="button"
              className="arquitectura-cuenta-seccion-toggle cuenta-panel-toggle arq-cuenta-section-toggle"
              onClick={() => setShowUsuariosSection((v) => !v)}
              aria-expanded={showUsuariosSection}
            >
              <span className="cuenta-panel-icon cuenta-panel-icon--usuarios arq-cuenta-section-icon" aria-hidden="true">
                <Users size={20} strokeWidth={1.75} />
              </span>
              <span className="cuenta-panel-toggle-text">
                <strong>Usuarios de la cuenta</strong>
                <span className="muted">Personas con acceso a {cuentaActual.nombre}</span>
              </span>
              <span className="arquitectura-cuenta-seccion-count">
                {cuentaActual.usuarios_count}
              </span>
              <span className="arquitectura-sistema-chevron arq-cuenta-chevron" aria-hidden="true">
                <ChevronDown size={18} />
              </span>
            </button>
            {showUsuariosSection && (
              <div className="arquitectura-cuenta-seccion-body">
                {loadingUsuarios ? (
                  <div className="cuenta-loading-rows" aria-hidden="true">
                    <span /><span /><span />
                  </div>
                ) : usuarios.length === 0 ? (
                  <div className="cuenta-empty-state">
                    <span className="cuenta-empty-state-icon" aria-hidden="true">👤</span>
                    <p>Sin usuarios todavía.</p>
                    <span className="muted">Creá el primero con el botón de abajo.</span>
                  </div>
                ) : (
                  <ul className="arquitectura-sistema-usuarios-list cuenta-entity-list">
                    {usuarios.map((u) => (
                      <li
                        key={u.id}
                        className={`cuenta-entity-card${
                          editingUserId === u.id ? " cuenta-entity-card--editing" : ""
                        }`}
                      >
                        {editingUserId === u.id ? (
                          <form
                            className="cuenta-entity-edit-form"
                            onSubmit={(e) => void handleGuardarUsuarioEdit(e, u.id)}
                          >
                            <div className="cuenta-entity-edit-form-head">
                              <strong>Editar usuario</strong>
                              <span className="usuarios-id-badge">
                                ID_USUARIO {u.usuario_numero}
                              </span>
                            </div>
                            <div className="arquitectura-sistema-form-grid cuenta-entity-edit-form-grid">
                              <label>
                                <span>Email</span>
                                <input
                                  type="email"
                                  value={userEditForm.email}
                                  onChange={(e) =>
                                    setUserEditForm((f) => ({ ...f, email: e.target.value }))
                                  }
                                  required
                                  autoFocus
                                />
                              </label>
                              <label>
                                <span>Nombre</span>
                                <input
                                  type="text"
                                  value={userEditForm.nombre}
                                  onChange={(e) =>
                                    setUserEditForm((f) => ({ ...f, nombre: e.target.value }))
                                  }
                                  required
                                />
                              </label>
                              <label>
                                <span>Rol</span>
                                <select
                                  value={userEditForm.rol}
                                  onChange={(e) =>
                                    setUserEditForm((f) => ({
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
                                <span>Nueva contraseña (opcional)</span>
                                <div className="arquitectura-sistema-password-wrap">
                                  <input
                                    type={showUserEditPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    data-sin-mayusculas="true"
                                    value={userEditForm.password ?? ""}
                                    onChange={(e) =>
                                      setUserEditForm((f) => ({
                                        ...f,
                                        password: e.target.value,
                                      }))
                                    }
                                    placeholder="Dejar vacío para no cambiar"
                                  />
                                  <button
                                    type="button"
                                    className="arquitectura-sistema-password-toggle"
                                    onClick={() => setShowUserEditPassword((v) => !v)}
                                    tabIndex={-1}
                                    aria-label={
                                      showUserEditPassword
                                        ? "Ocultar contraseña"
                                        : "Mostrar contraseña"
                                    }
                                  >
                                    <IconoOjo visible={showUserEditPassword} />
                                  </button>
                                </div>
                                <small className="muted">{PASSWORD_POLICY_HINT}</small>
                              </label>
                              <label className="cuenta-entity-edit-activo">
                                <input
                                  type="checkbox"
                                  checked={userEditForm.activo ?? true}
                                  onChange={(e) =>
                                    setUserEditForm((f) => ({
                                      ...f,
                                      activo: e.target.checked,
                                    }))
                                  }
                                  disabled={
                                    currentUser?.id === u.id && userEditForm.activo === true
                                  }
                                />
                                <span>Usuario activo</span>
                              </label>
                            </div>
                            <div className="arquitectura-sistema-form-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={savingUserEdit}
                                onClick={closeEditUser}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={savingUserEdit}
                              >
                                {savingUserEdit ? "Guardando…" : "Guardar cambios"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
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
                            <div className="cuenta-entity-actions">
                              {puedeGestionarCuenta ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => openEditUser(u)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    disabled={currentUser?.id === u.id && u.activo}
                                    onClick={() => void handleToggleUsuarioActivo(u)}
                                  >
                                    {u.activo ? "Desactivar" : "Activar"}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {showUserForm ? (
                  <form
                    className="arquitectura-sistema-user-form arquitectura-cuenta-seccion-form"
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
                ) : puedeGestionarCuenta ? (
                  <div className="arquitectura-cuenta-seccion-actions">
                    <button
                      type="button"
                      className="btn cuenta-add-btn"
                      onClick={() => {
                        setShowUserForm(true);
                        setShowOperativaForm(false);
                        closeEditUser();
                        closeEditOperativa();
                        setUserForm(emptyUserForm());
                        setShowUserPassword(false);
                      }}
                    >
                      <span className="cuenta-add-btn-icon" aria-hidden="true">+</span>
                      Nuevo usuario
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </section>

      {showEditarCuentaModal &&
        puedeEditarDatosCuenta &&
        createPortal(
          <div
            className="pd-overlay usuarios-form-modal-overlay bn-ui"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cuenta-editar-modal-title"
            onClick={closeEditarCuentaModal}
          >
            <div
              className="pd-dialog usuarios-form-modal usuarios-form-modal--compact"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="usuarios-form-modal-head">
                <div className="usuarios-form-modal-head-main">
                  <p className="usuarios-form-modal-kicker">Administración de cuenta</p>
                  <h2 id="cuenta-editar-modal-title" className="usuarios-form-modal-title">
                    Datos de la cuenta
                  </h2>
                  <p className="usuarios-form-modal-sub">
                    {esCuentaPropia
                      ? "Nombre e identificador de su organización"
                      : "Nombre de la cuenta madre (organización)"}
                  </p>
                </div>
                <button
                  type="button"
                  className="usuarios-form-modal-close"
                  disabled={savingCuenta}
                  onClick={closeEditarCuentaModal}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>
              <form onSubmit={(e) => void handleGuardarCuenta(e)}>
                <div className="usuarios-form-modal-body">
                  <div className="usuarios-form-modal-panel">
                    <div className="cuenta-panel-form-grid">
                      <div className="field">
                        <label htmlFor="cuenta-nombre-modal">Nombre de la cuenta</label>
                        <input
                          id="cuenta-nombre-modal"
                          type="text"
                          value={cuentaForm.nombre}
                          autoFocus
                          onChange={(e) =>
                            setCuentaForm((f) => ({ ...f, nombre: e.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="field">
                        <span className="field-label">Código</span>
                        <p className="cuenta-panel-codigo-readonly">
                          <span className="arquitectura-sistema-pill arquitectura-sistema-pill--codigo">
                            {cuentaActual.codigo}
                          </span>
                        </p>
                        <p className="muted usuarios-rol-hint">
                          Asignado automáticamente al crear la cuenta (C00001, C00002…)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="usuarios-form-modal-footer">
                  <button
                    type="button"
                    className="btn btn-ghost usuarios-form-modal-cancel"
                    disabled={savingCuenta}
                    onClick={closeEditarCuentaModal}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={savingCuenta}>
                    {savingCuenta ? "Guardando…" : "Guardar cambios"}
                  </button>
                </footer>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
