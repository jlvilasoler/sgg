import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteFuncionario, fetchFuncionarios } from "../../api";
import type { Funcionario } from "../../types";
import { fmtNum } from "../../utils";
import { confirmAction } from "../../utils/confirm";

interface Props {
  apiOnline: boolean;
  onNuevo: () => void;
  onEdit: (f: Funcionario) => void;
  onVerPagos: (cedula: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  embedded?: boolean;
}

export default function FuncionarioListado({
  apiOnline,
  onNuevo,
  onEdit,
  onVerPagos,
  onError,
  onSuccess,
  onVolver,
  embedded = false,
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

  const statusLine = initialLoading
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
    <div
      className={`rrhh-func-listado--hub rrhh-hub-workspace${embedded ? " sg-hub-embedded" : ""}${refreshing && hasData ? " rrhh-func-listado--refreshing" : ""}`}
    >
      {!embedded ? (
        <button type="button" className="subseccion-back" onClick={onVolver}>
          ‹ Volver a Recursos Humanos
        </button>
      ) : null}

      <div className="rrhh-func-toolbar">
        <p className="rrhh-func-status muted" role="status">
          {statusLine}
          {!initialLoading && apiOnline ? (
            <span className="rrhh-func-status-hint">
              {" "}
              · Solo quienes trabajan hoy aparecen al cargar sueldos.
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className="sg-hub-cta sg-hub-cta--compact"
          disabled={!apiOnline}
          onClick={onNuevo}
        >
          + Nuevo funcionario
        </button>
      </div>

      <section
        className="rrhh-hub-filters-box rrhh-func-filters-box mayusculas-auto"
        aria-label="Filtros de funcionarios"
      >
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
        <label className="rrhh-func-check inline-check">
          <input
            type="checkbox"
            checked={soloActivos}
            disabled={!apiOnline || initialLoading}
            onChange={(e) => setSoloActivos(e.target.checked)}
          />
          Solo quienes trabajan hoy
        </label>
        <div className="rrhh-hub-filters-actions">
          <button
            type="button"
            className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
            disabled={!apiOnline || initialLoading || (!busqueda && !soloActivos)}
            onClick={resetFiltros}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="sg-hub-cta sg-hub-cta--compact"
            disabled={!apiOnline || initialLoading}
            onClick={() => void load()}
          >
            {refreshing && hasData ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </section>

      <div className="sg-hub-kpi-strip rrhh-func-kpi-strip" aria-label="Resumen de funcionarios">
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Total listado</p>
          <p className="sg-hub-kpi-value">{!apiOnline ? "—" : fmtNum(stats.total, 0)}</p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">Trabajan hoy</p>
          <p className="sg-hub-kpi-value rrhh-func-kpi-value--activo">
            {!apiOnline ? "—" : fmtNum(stats.activos, 0)}
          </p>
        </article>
        <article className="sg-hub-kpi">
          <p className="sg-hub-kpi-kicker">No activos</p>
          <p className="sg-hub-kpi-value rrhh-func-kpi-value--inactivo">
            {!apiOnline ? "—" : fmtNum(stats.inactivos, 0)}
          </p>
        </article>
      </div>

      <section className="rrhh-func-table-box" aria-label="Listado de funcionarios">
        <div className="rrhh-func-table-wrap">
          <table className="data-table rrhh-func-table">
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
                          className="sg-hub-cta sg-hub-cta--compact rrhh-func-empty-btn"
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
                  <tr
                    key={f.id}
                    className={`rrhh-func-row${!f.activo ? " rrhh-func-row--inactivo" : ""}`}
                  >
                    <td className="rrhh-func-cedula">
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
                        className={`rrhh-func-estado-pill ${f.activo ? "rrhh-func-estado-pill--activo" : "rrhh-func-estado-pill--inactivo"}`}
                      >
                        {f.activo ? "Trabaja hoy" : "No activo"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="rrhh-func-actions">
                        <button
                          type="button"
                          className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                          onClick={() => onVerPagos(f.cedula)}
                        >
                          Pagos
                        </button>
                        <button
                          type="button"
                          className="sg-hub-cta sg-hub-cta--ghost sg-hub-cta--compact"
                          onClick={() => onEdit(f)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="sg-hub-cta sg-hub-cta--compact sg-hub-cta--danger"
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
      </section>
    </div>
  );
}
