import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  actualizarEmpresaCuenta,
  crearEmpresaCuenta,
  fetchEmpresasCuenta,
} from "../api";
import type { EmpresaCuenta, EmpresaCuentaForm } from "../types";
import ArquitecturaCuentaDetalle, {
  type CuentaDetallePanel,
} from "./ArquitecturaCuentaDetalle";
import {
  emptyEmpresaForm,
  emptyOperativaForm,
  iniciales,
} from "./arquitectura-sistema-shared";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  titulo?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function ArquitecturaSistema({
  apiOnline,
  onVolver,
  volverLabel = "Volver a Usuarios",
  titulo = "Arquitectura del sistema",
  onError,
  onSuccess,
}: Props) {
  const [empresas, setEmpresas] = useState<EmpresaCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [detallePanel, setDetallePanel] = useState<CuentaDetallePanel>("none");

  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<EmpresaCuentaForm>(emptyEmpresaForm);
  const [cuentaNombrePartes, setCuentaNombrePartes] = useState({
    nombre: "",
    primerApellido: "",
    segundoApellido: "",
  });
  const [operativaForm, setOperativaForm] = useState(emptyOperativaForm);
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");

  const loadEmpresas = useCallback(async () => {
    if (!apiOnline) {
      setEmpresas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEmpresas(await fetchEmpresasCuenta());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar cuentas de empresa");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void loadEmpresas();
  }, [loadEmpresas]);

  const stats = useMemo(() => {
    let activas = 0;
    let empresasOp = 0;
    let usuarios = 0;
    for (const e of empresas) {
      if (e.activo) activas += 1;
      empresasOp += e.empresas_count;
      usuarios += e.usuarios_count;
    }
    return {
      total: empresas.length,
      activas,
      inactivas: empresas.length - activas,
      empresasOp,
      usuarios,
    };
  }, [empresas]);

  const filteredRows = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return empresas.filter((e) => {
      if (filtroEstado === "activo" && !e.activo) return false;
      if (filtroEstado === "inactivo" && e.activo) return false;
      if (!q) return true;
      return (
        e.nombre.toLowerCase().includes(q) ||
        e.codigo.toLowerCase().includes(q) ||
        e.cuenta_numero.toLowerCase().includes(q) ||
        (e.admin?.nombre.toLowerCase().includes(q) ?? false) ||
        (e.admin?.email.toLowerCase().includes(q) ?? false)
      );
    });
  }, [empresas, filtroTexto, filtroEstado]);

  const hayFiltros = Boolean(filtroTexto.trim() || filtroEstado);

  const limpiarFiltros = () => {
    setFiltroTexto("");
    setFiltroEstado("");
  };

  const openNuevaEmpresa = () => {
    setEmpresaForm(emptyEmpresaForm());
    setCuentaNombrePartes({ nombre: "", primerApellido: "", segundoApellido: "" });
    setOperativaForm(emptyOperativaForm());
    setShowNuevaEmpresa(true);
  };

  const closeNuevaEmpresa = useCallback(() => {
    setShowNuevaEmpresa(false);
    setEmpresaForm(emptyEmpresaForm());
    setCuentaNombrePartes({ nombre: "", primerApellido: "", segundoApellido: "" });
    setOperativaForm(emptyOperativaForm());
  }, []);

  useEffect(() => {
    if (!showNuevaEmpresa) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !savingEmpresa) closeNuevaEmpresa();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [showNuevaEmpresa, savingEmpresa, closeNuevaEmpresa]);

  const openCuenta = (cuentaId: number, panel: CuentaDetallePanel = "none") => {
    setSelectedCuentaId(cuentaId);
    setDetallePanel(panel);
  };

  const handleCrearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreCompleto = [
      cuentaNombrePartes.nombre,
      cuentaNombrePartes.primerApellido,
      cuentaNombrePartes.segundoApellido,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ");

    if (!nombreCompleto) {
      onError("Completá nombre y apellidos de la cuenta");
      return;
    }
    const adminEmail = empresaForm.admin_email?.trim() ?? "";
    if (!adminEmail.includes("@")) {
      onError("Ingresá el email del administrador de la cuenta");
      return;
    }
    if (!operativaForm.nombre.trim()) {
      onError("Completá el nombre de la primera empresa operativa");
      return;
    }
    setSavingEmpresa(true);
    try {
      const opNombre = operativaForm.nombre.trim();
      const { cuenta: created, admin_password_temporal } = await crearEmpresaCuenta({
        nombre: nombreCompleto,
        activo: true,
        admin_email: adminEmail,
        empresa_operativa: {
          nombre: opNombre,
        },
      });
      setEmpresas((prev) =>
        [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      setEmpresaForm(emptyEmpresaForm());
      closeNuevaEmpresa();
      onSuccess(
        admin_password_temporal
          ? `Cuenta ${created.nombre} creada con empresa ${opNombre}. Admin ${adminEmail} — contraseña inicial: ${admin_password_temporal}`
          : `Cuenta ${created.nombre} creada con empresa ${opNombre} · administrador ${adminEmail}`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setSavingEmpresa(false);
    }
  };

  const handleToggleActiva = async (empresa: EmpresaCuenta) => {
    try {
      const updated = await actualizarEmpresaCuenta(empresa.id, {
        activo: !empresa.activo,
      });
      setEmpresas((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      onSuccess(
        updated.activo ? `${updated.nombre} activada` : `${updated.nombre} desactivada`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al actualizar cuenta");
    }
  };

  const selectedCuenta =
    selectedCuentaId != null
      ? empresas.find((e) => e.id === selectedCuentaId) ?? null
      : null;

  if (selectedCuenta) {
    return (
      <ArquitecturaCuentaDetalle
        cuenta={selectedCuenta}
        apiOnline={apiOnline}
        initialPanel={detallePanel}
        onVolver={() => {
          setSelectedCuentaId(null);
          setDetallePanel("none");
        }}
        onCuentaUpdated={(updated) => {
          setEmpresas((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        }}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  const subtitulo = loading
    ? "Actualizando listado…"
    : !apiOnline
      ? "Sin conexión con la API"
      : hayFiltros
        ? `${filteredRows.length} de ${empresas.length} cuenta(s) en pantalla`
        : `${empresas.length} cuenta(s) madre registrada${empresas.length === 1 ? "" : "s"}`;

  return (
    <div className="subseccion-panel usuarios-admin arquitectura-sistema">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className="card usuarios-panel listado-pro-shell">
        <header className="listado-pro-head usuarios-admin-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">{titulo}</h2>
            <p className="listado-pro-head-sub">{subtitulo}</p>
          </div>
          <div className="usuarios-head-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!apiOnline}
              onClick={openNuevaEmpresa}
            >
              + Nueva cuenta madre
            </button>
          </div>
        </header>

        <section className="usuarios-admin-dashboard" aria-label="Resumen de cuentas">
          <div className="usuarios-admin-kpi-grid">
            <article className="usuarios-admin-kpi usuarios-admin-kpi--hero">
              <span className="usuarios-admin-kpi-label">Cuentas madre</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.total}
              </span>
              <span className="usuarios-admin-kpi-hint">Total en el sistema</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--activos">
              <span className="usuarios-admin-kpi-label">Activas</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.activas}
              </span>
              <span className="usuarios-admin-kpi-hint">Operando normalmente</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--inactivos">
              <span className="usuarios-admin-kpi-label">Empresas internas</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.empresasOp}
              </span>
              <span className="usuarios-admin-kpi-hint">Empresas operativas</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--recientes">
              <span className="usuarios-admin-kpi-label">Usuarios</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : stats.usuarios}
              </span>
              <span className="usuarios-admin-kpi-hint">En todas las cuentas</span>
            </article>
          </div>
        </section>

        <div className="filters listado-pro-filters usuarios-admin-filters">
          <div className="field usuarios-admin-search">
            <label htmlFor="arq-filtro-texto">Buscar</label>
            <input
              id="arq-filtro-texto"
              type="search"
              placeholder="Nombre, código o ID…"
              value={filtroTexto}
              disabled={loading || !apiOnline}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="arq-filtro-estado">Estado</label>
            <select
              id="arq-filtro-estado"
              value={filtroEstado}
              disabled={loading || !apiOnline}
              onChange={(e) =>
                setFiltroEstado(e.target.value as "" | "activo" | "inactivo")
              }
            >
              <option value="">Todos</option>
              <option value="activo">Activas</option>
              <option value="inactivo">Inactivas</option>
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
                <th>Cuenta</th>
                <th>ID cuenta</th>
                <th>Código</th>
                <th>Empresas</th>
                <th>Usuarios</th>
                <th>Estado</th>
                <th className="col-acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="usuarios-admin-empty-cell">
                    <div className="usuarios-admin-empty">Cargando cuentas…</div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="usuarios-admin-empty-cell">
                    <div className="usuarios-admin-empty" role="status">
                      {hayFiltros
                        ? "No hay cuentas que coincidan con los filtros"
                        : "No hay cuentas de empresa registradas"}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((empresa) => (
                  <tr
                    key={empresa.id}
                    className={`listado-pro-row usuarios-admin-row arquitectura-sistema-tr${
                      !empresa.activo ? " usuarios-row--inactivo" : ""
                    }`}
                    onClick={() => openCuenta(empresa.id)}
                  >
                    <td>
                      <div className="usuarios-table-user">
                        <span
                          className="arquitectura-sistema-empresa-avatar arquitectura-sistema-empresa-avatar--sm"
                          aria-hidden="true"
                        >
                          {iniciales(empresa.nombre)}
                        </span>
                        <div className="usuarios-table-user-text">
                          <strong>{empresa.nombre}</strong>
                          <span
                            className={`arquitectura-sistema-admin-chip${empresa.admin ? "" : " is-empty"}`}
                          >
                            {empresa.admin ? (
                              <>
                                <span className="arquitectura-sistema-admin-dot" />
                                {empresa.admin.nombre}
                                {empresa.admin.es_super_admin ? " · admin SAG" : ""}
                              </>
                            ) : (
                              "Sin administrador asignado"
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="usuarios-admin-fecha">
                      <span className="arquitectura-sistema-pill arquitectura-sistema-pill--cuenta">
                        {empresa.cuenta_numero}
                      </span>
                    </td>
                    <td className="usuarios-admin-fecha">
                      <span className="arquitectura-sistema-pill arquitectura-sistema-pill--codigo">
                        {empresa.codigo}
                      </span>
                    </td>
                    <td>{empresa.empresas_count}</td>
                    <td>{empresa.usuarios_count}</td>
                    <td>
                      <span
                        className={`usuarios-estado-pill ${
                          empresa.activo
                            ? "usuarios-estado-pill--activo"
                            : "usuarios-estado-pill--inactivo"
                        }`}
                      >
                        {empresa.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="actions-cell usuarios-admin-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCuenta(empresa.id);
                        }}
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${empresa.activo ? "btn-ghost" : "btn-primary"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleActiva(empresa);
                        }}
                      >
                        {empresa.activo ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNuevaEmpresa &&
        createPortal(
          <div
            className="pd-overlay usuarios-form-modal-overlay bn-ui"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arq-nueva-cuenta-modal-title"
            onClick={() => {
              if (!savingEmpresa) closeNuevaEmpresa();
            }}
          >
            <div
              className="pd-dialog usuarios-form-modal usuarios-form-modal--compact"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="usuarios-form-modal-head">
                <div className="usuarios-form-modal-head-main">
                  <p className="usuarios-form-modal-kicker">Arquitectura del sistema</p>
                  <h2 id="arq-nueva-cuenta-modal-title" className="usuarios-form-modal-title">
                    Nueva cuenta madre
                  </h2>
                  <p className="usuarios-form-modal-sub">
                    Registre la cuenta madre, la primera empresa operativa y el email del
                    administrador; el sistema crea todo automáticamente
                  </p>
                </div>
                <button
                  type="button"
                  className="usuarios-form-modal-close"
                  disabled={savingEmpresa}
                  onClick={closeNuevaEmpresa}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </header>
              <form onSubmit={(e) => void handleCrearEmpresa(e)}>
                <div className="usuarios-form-modal-body">
                  <div className="usuarios-form-modal-panel">
                    <p className="usuarios-form-modal-section-title">Cuenta madre</p>
                    <p className="usuarios-form-modal-section-hint">
                      El código de cuenta (C00001, C00002…) y el ID se asignan automáticamente.
                    </p>
                    <div className="usuarios-form-grid usuarios-form-grid--cuenta-nombre">
                      <div className="field">
                        <label htmlFor="arq-nombre">Nombre completo</label>
                        <input
                          id="arq-nombre"
                          type="text"
                          value={cuentaNombrePartes.nombre}
                          autoFocus
                          onChange={(e) =>
                            setCuentaNombrePartes((f) => ({ ...f, nombre: e.target.value }))
                          }
                          placeholder="INGRESAR NOMBRE COMPLETO"
                          required
                        />
                      </div>
                      <div className="field usuarios-form-apellidos">
                        <div className="usuarios-form-apellidos-grid">
                          <div className="field">
                            <label htmlFor="arq-primer-apellido">Primer apellido</label>
                            <input
                              id="arq-primer-apellido"
                              type="text"
                              value={cuentaNombrePartes.primerApellido}
                              onChange={(e) =>
                                setCuentaNombrePartes((f) => ({
                                  ...f,
                                  primerApellido: e.target.value,
                                }))
                              }
                              placeholder="Primer apellido"
                              required
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="arq-segundo-apellido">Segundo apellido</label>
                            <input
                              id="arq-segundo-apellido"
                              type="text"
                              value={cuentaNombrePartes.segundoApellido}
                              onChange={(e) =>
                                setCuentaNombrePartes((f) => ({
                                  ...f,
                                  segundoApellido: e.target.value,
                                }))
                              }
                              placeholder="Segundo apellido"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="field usuarios-form-grid-span-full">
                        <label htmlFor="arq-admin-email">Email del administrador</label>
                        <input
                          id="arq-admin-email"
                          type="email"
                          value={empresaForm.admin_email ?? ""}
                          onChange={(e) =>
                            setEmpresaForm((f) => ({ ...f, admin_email: e.target.value }))
                          }
                          placeholder="mail@empresa.com"
                          autoComplete="email"
                          required
                        />
                        <p className="usuarios-rol-hint">
                          Se creará automáticamente la cuenta de administrador de esta cuenta madre
                          con este email
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="usuarios-form-modal-panel usuarios-form-modal-panel--secondary">
                    <p className="usuarios-form-modal-section-title">Agregar empresa</p>
                    <p className="usuarios-form-modal-section-hint">
                      Primera empresa operativa de la cuenta. El código (E00001, E00002…) se
                      asigna automáticamente. Podrá agregar más después desde el detalle de la
                      cuenta.
                    </p>
                    <div className="usuarios-form-grid usuarios-form-grid--single">
                      <div className="field usuarios-form-grid-span-full">
                        <label htmlFor="arq-op-nombre">Nombre de empresa</label>
                        <input
                          id="arq-op-nombre"
                          type="text"
                          value={operativaForm.nombre}
                          onChange={(e) =>
                            setOperativaForm((f) => ({ ...f, nombre: e.target.value }))
                          }
                          placeholder="INGRESAR NOMBRE DE EMPRESA"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <footer className="usuarios-form-modal-footer">
                  <button
                    type="button"
                    className="btn btn-ghost usuarios-form-modal-cancel"
                    disabled={savingEmpresa}
                    onClick={closeNuevaEmpresa}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingEmpresa || !apiOnline}
                  >
                    {savingEmpresa ? "Creando…" : "Crear cuenta y empresa"}
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
