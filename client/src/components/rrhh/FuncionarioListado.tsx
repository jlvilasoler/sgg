import { useCallback, useEffect, useState } from "react";
import { deleteFuncionario, fetchFuncionarios } from "../../api";
import type { Funcionario } from "../../types";
import { confirmAction } from "../../utils/confirm";
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
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchFuncionarios({ busqueda, soloActivos }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, busqueda, soloActivos, onError]);

  useEffect(() => {
    const t = setTimeout(load, 280);
    return () => clearTimeout(t);
  }, [load]);

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
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Recursos Humanos
      </button>
      <div className="card">
        <div className="form-header">
          <h2>Funcionarios</h2>
          <p className="muted">
            {loading
              ? "Cargando…"
              : `${rows.length} registro(s)${soloActivos ? " (solo quienes trabajan hoy)" : ""}. Solo quienes trabajan hoy aparecen al registrar gastos de sueldos.`}
          </p>
        </div>

        <div className="listado-toolbar">
          <div className="filters filters-inline mayusculas-auto">
            <div className="field">
              <label htmlFor="busq-func">Buscar</label>
              <input
                id="busq-func"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Cédula, nombre, celular, email…"
              />
            </div>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo quienes trabajan hoy
            </label>
          </div>
          <button
            type="button"
            className="btn btn-accent"
            disabled={!apiOnline}
            onClick={onNuevo}
          >
            + Nuevo funcionario
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Contacto</th>
                <th>Banco / Cuenta</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="muted">
                    Cargando…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    {soloActivos
                      ? "No hay funcionarios que trabajen hoy en la empresa. Desmarcá el filtro para ver quienes ya no trabajan, o registrá uno nuevo."
                      : busqueda.trim()
                        ? "Ningún funcionario coincide con la búsqueda."
                        : "No hay funcionarios. Usá «Nuevo funcionario» para empezar."}
                  </td>
                </tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.cedula}</strong>
                    </td>
                    <td>
                      {f.apellido}, {f.nombre}
                    </td>
                    <td>
                      {f.ciudad}
                      {f.departamento ? ` (${f.departamento})` : ""}
                    </td>
                    <td className="muted small-cell">
                      {f.celular || "—"}
                      {f.email ? (
                        <>
                          <br />
                          <span className="rrhh-email-cell">{f.email}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="muted small-cell">
                      {f.banco || "—"}
                      {f.cuenta ? ` · ${f.cuenta}` : ""}
                    </td>
                    <td>
                      <span className={f.activo ? "badge-ok" : "badge-muted"}>
                        {f.activo ? "ACTIVO" : "NO ACTIVO"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="actions-cell-inner">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => onVerPagos(f.cedula)}
                        >
                          Pagos
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => onEdit(f)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => borrar(f)}
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
  );
}
