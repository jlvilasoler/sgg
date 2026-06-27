import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarEmpresaCuenta,
  crearEmpresaCuenta,
  fetchEmpresasCuenta,
} from "../api";
import type { EmpresaCuenta, EmpresaCuentaForm } from "../types";
import ArquitecturaCuentaDetalle, {
  type CuentaDetallePanel,
} from "./ArquitecturaCuentaDetalle";
import { emptyEmpresaForm, iniciales } from "./arquitectura-sistema-shared";

interface Props {
  apiOnline: boolean;
  onVolver: () => void;
  volverLabel?: string;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function ArquitecturaSistema({
  apiOnline,
  onVolver,
  volverLabel = "Volver a Usuarios",
  onError,
  onSuccess,
}: Props) {
  const [empresas, setEmpresas] = useState<EmpresaCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCuentaId, setSelectedCuentaId] = useState<number | null>(null);
  const [detallePanel, setDetallePanel] = useState<CuentaDetallePanel>("none");

  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<EmpresaCuentaForm>(emptyEmpresaForm);
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

  const openCuenta = (cuentaId: number, panel: CuentaDetallePanel = "none") => {
    setSelectedCuentaId(cuentaId);
    setDetallePanel(panel);
  };

  const handleCrearEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaForm.nombre.trim() || !empresaForm.codigo.trim()) {
      onError("Completá nombre y código de la empresa");
      return;
    }
    setSavingEmpresa(true);
    try {
      const created = await crearEmpresaCuenta({
        nombre: empresaForm.nombre.trim(),
        codigo: empresaForm.codigo.trim().toUpperCase(),
        activo: true,
      });
      setEmpresas((prev) =>
        [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      setEmpresaForm(emptyEmpresaForm());
      setShowNuevaEmpresa(false);
      onSuccess(`Cuenta creada: ${created.nombre}`);
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
            <h2 className="listado-pro-head-title">Arquitectura del sistema</h2>
            <p className="listado-pro-head-sub">{subtitulo}</p>
          </div>
          <div className="usuarios-head-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!apiOnline}
              onClick={() => setShowNuevaEmpresa((v) => !v)}
            >
              {showNuevaEmpresa ? "Cancelar" : "+ Nueva cuenta madre"}
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

        {showNuevaEmpresa && (
          <section className="usuarios-form-card">
            <h3>Nueva cuenta madre</h3>
            <form className="usuarios-form-grid" onSubmit={(e) => void handleCrearEmpresa(e)}>
              <div className="field">
                <label htmlFor="arq-nombre">Nombre completo</label>
                <input
                  id="arq-nombre"
                  type="text"
                  value={empresaForm.nombre}
                  onChange={(e) =>
                    setEmpresaForm((f) => ({ ...f, nombre: e.target.value }))
                  }
                  placeholder="Ej. VILA DIAZ"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="arq-codigo">Código corto</label>
                <input
                  id="arq-codigo"
                  type="text"
                  value={empresaForm.codigo}
                  onChange={(e) =>
                    setEmpresaForm((f) => ({
                      ...f,
                      codigo: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Ej. NUEVA"
                  required
                />
                <p className="usuarios-rol-hint">Código de la cuenta madre</p>
              </div>
              <div className="usuarios-form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowNuevaEmpresa(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEmpresa}>
                  {savingEmpresa ? "Creando…" : "Crear cuenta"}
                </button>
              </div>
            </form>
          </section>
        )}

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
                    <td className="usuarios-admin-email">{empresa.codigo}</td>
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
    </div>
  );
}
