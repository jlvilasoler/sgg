import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteFuncionario, fetchFuncionarios } from "../../api";
import type { Funcionario } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  onNuevo: () => void;
  onEdit: (f: Funcionario) => void;
  onVerPagos: (cedula: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function FuncionarioListado({
  apiOnline,
  onNuevo,
  onEdit,
  onVerPagos,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<Funcionario[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);
  const hasData = rows.length > 0;
  const initialLoading = refreshing && !hasData;

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    try {
      setRows(await fetchFuncionarios({ busqueda, soloActivos }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setRefreshing(false);
    }
  }, [apiOnline, busqueda, soloActivos, onError]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 280);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    const activos = rows.filter((r) => r.activo).length;
    return { total: rows.length, activos, inactivos: rows.length - activos };
  }, [rows]);

  const resetFiltros = () => {
    setBusqueda("");
    setSoloActivos(false);
  };

  const borrar = async (f: Funcionario) => {
    const ok = await confirmAction({
      title: "Eliminar funcionario",
      message: `¿Eliminar a ${f.apellido}, ${f.nombre} (${f.cedula})?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteFuncionario(f.id);
      onSuccess("Funcionario eliminado");
      void load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const subtitulo = initialLoading
    ? "Cargando…"
    : refreshing
      ? "Actualizando…"
      : !apiOnline
        ? "Sin conexión con la API"
        : soloActivos
          ? `${stats.total} funcionario${stats.total === 1 ? "" : "s"} que trabajan hoy`
          : `${stats.total} funcionario${stats.total === 1 ? "" : "s"} en el listado`;

  const emptyMsg = soloActivos
    ? "No hay funcionarios que trabajen hoy. Desmarcá el filtro o registrá uno nuevo."
    : busqueda.trim()
      ? "Ningún funcionario coincide con la búsqueda."
      : "No hay funcionarios registrados todavía.";

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Recursos Humanos
      </button>

      <div className="listado-pro rrhh-func-listado">
        <div className={`listado-pro-shell${refreshing && hasData ? " listado-pro-shell--refreshing" : ""}`}>
          <header className="rrhh-func-head">
            <div className="rrhh-func-head-main">
              <PageModuleHeadRow
                icon={{ source: "hub", id: "rrhh_funcionarios" }}
                title="Funcionarios"
                subtitle={
                  <>
                    {subtitulo}
                    {!initialLoading && apiOnline ? (
                      <span className="rrhh-func-head-hint">
                        {" "}
                        · Solo quienes trabajan hoy aparecen al cargar sueldos.
                      </span>
                    ) : null}
                  </>
                }
                titleClassName="listado-pro-head-title"
                subClassName="listado-pro-head-sub"
                textClassName="listado-pro-head-text"
              />
            </div>
            <div className="rrhh-func-head-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!apiOnline}
                onClick={onNuevo}
              >
                + Nuevo funcionario
              </button>
            </div>
          </header>

          <div className="filters listado-pro-filters rrhh-func-filters mayusculas-auto">
            <div className="field rrhh-func-search">
              <label htmlFor="busq-func">Buscar</label>
              <input
                id="busq-func"
                value={busqueda}
                disabled={!apiOnline || initialLoading}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Cédula, nombre, celular, email…"
              />
            </div>
            <label className="inline-check rrhh-func-check">
              <input
                type="checkbox"
                checked={soloActivos}
                disabled={!apiOnline || initialLoading}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo quienes trabajan hoy
            </label>
            <button
              type="button"
              className="btn listado-pro-reset-btn"
              disabled={!apiOnline || initialLoading || (!busqueda && !soloActivos)}
              onClick={resetFiltros}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn-primary listado-pro-search-btn"
              disabled={!apiOnline || initialLoading}
              onClick={() => void load()}
            >
              {refreshing && hasData ? "Actualizando…" : "Actualizar"}
            </button>
          </div>

          <section
            className="listado-indicadores listado-pro-indicadores rrhh-func-kpis"
            aria-label="Resumen de funcionarios"
          >
            <div className="rrhh-func-kpi-grid">
              <div className="rrhh-func-kpi">
                <span className="rrhh-func-kpi-label">Total listado</span>
                <span className="rrhh-func-kpi-valor">
                  {!apiOnline ? "—" : stats.total}
                </span>
              </div>
              <div className="rrhh-func-kpi rrhh-func-kpi--activo">
                <span className="rrhh-func-kpi-label">Trabajan hoy</span>
                <span className="rrhh-func-kpi-valor">
                  {!apiOnline ? "—" : stats.activos}
                </span>
              </div>
              <div className="rrhh-func-kpi rrhh-func-kpi--inactivo">
                <span className="rrhh-func-kpi-label">No activos</span>
                <span className="rrhh-func-kpi-valor">
                  {!apiOnline ? "—" : stats.inactivos}
                </span>
              </div>
            </div>
          </section>

          <div className="table-wrap listado-pro-table-wrap rrhh-func-table-wrap">
            <table className="data-table listado-pro-table rrhh-func-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre</th>
                  <th>Ciudad</th>
                  <th>Contacto</th>
                  <th>Banco / Cuenta</th>
                  <th>Estado</th>
                  <th className="col-acciones" />
                </tr>
              </thead>
              <tbody>
                {initialLoading ? (
                  <tr>
                    <td colSpan={7} className="rrhh-func-empty-cell">
                      <div className="rrhh-func-empty-msg">Cargando funcionarios…</div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="rrhh-func-empty-cell">
                      <div className="rrhh-func-empty" role="status">
                        <span className="rrhh-func-empty-icon" aria-hidden="true">
                          👤
                        </span>
                        <span>{emptyMsg}</span>
                        {!busqueda.trim() && !soloActivos ? (
                          <button
                            type="button"
                            className="btn btn-primary rrhh-func-empty-btn"
                            disabled={!apiOnline}
                            onClick={onNuevo}
                          >
                            + Nuevo funcionario
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((f) => (
                    <tr key={f.id} className={`listado-pro-row${!f.activo ? " rrhh-func-row--inactivo" : ""}`}>
                      <td className="listado-pro-num">
                        <strong>{f.cedula}</strong>
                      </td>
                      <td>
                        <span className="rrhh-func-nombre">
                          {f.apellido}, {f.nombre}
                        </span>
                      </td>
                      <td>
                        {f.ciudad || "—"}
                        {f.departamento ? (
                          <span className="muted rrhh-func-depto"> ({f.departamento})</span>
                        ) : null}
                      </td>
                      <td className="rrhh-func-contacto">
                        {f.celular ? <span>{f.celular}</span> : <span className="muted">—</span>}
                        {f.email ? (
                          <span className="muted rrhh-func-email">{f.email}</span>
                        ) : null}
                      </td>
                      <td className="muted small-cell rrhh-func-banco">
                        {f.banco || "—"}
                        {f.cuenta ? <span className="rrhh-func-cuenta"> · {f.cuenta}</span> : null}
                      </td>
                      <td>
                        <span
                          className={`rrhh-func-estado ${f.activo ? "rrhh-func-estado--activo" : "rrhh-func-estado--inactivo"}`}
                        >
                          {f.activo ? "Trabaja hoy" : "No activo"}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="actions-cell-inner rrhh-func-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => onVerPagos(f.cedula)}
                          >
                            Pagos
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => onEdit(f)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs rrhh-func-btn-danger"
                            onClick={() => void borrar(f)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
