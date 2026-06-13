import { useCallback, useEffect, useState } from "react";
import { deleteRubro, fetchRubros } from "../../api";
import type { Rubro } from "../../types";
import { confirmAction } from "../../utils/confirm";

interface Props {
  apiOnline: boolean;
  onEdit: (r: Rubro) => void;
  onNuevoRubro: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function RubroListado({
  apiOnline,
  onEdit,
  onNuevoRubro,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchRubros(false));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const borrar = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar rubro",
      message:
        "¿Eliminar este rubro? Solo es posible si no tiene gastos asociados.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteRubro(id);
      onSuccess("Rubro eliminado");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Rubros
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Listado de rubros</h2>
          <p className="muted">
            {loading
              ? "Cargando..."
              : `${rows.length} rubro(s). Los inactivos no aparecen al cargar gastos nuevos.`}
          </p>
        </div>

        <div className="listado-toolbar listado-toolbar--end">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!apiOnline}
            onClick={onNuevoRubro}
          >
            + Nuevo rubro
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Cargando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No hay rubros. Usá «Nuevo rubro» para agregar uno.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td>
                      <span className={r.activo ? "badge-ok" : "badge-muted"}>
                        {r.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onEdit(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => borrar(r.id)}
                      >
                        Eliminar
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
