import { useCallback, useEffect, useState } from "react";
import { deleteResponsable, fetchResponsables } from "../../api";
import type { Responsable } from "../../types";
import { confirmAction } from "../../utils/confirm";

interface Props {
  apiOnline: boolean;
  onEdit: (r: Responsable) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function ResponsableListado({
  apiOnline,
  onEdit,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<Responsable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchResponsables(false));
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
      title: "Eliminar nombre",
      message:
        "¿Eliminar este nombre? Solo es posible si no tiene gastos asociados.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteResponsable(id);
      onSuccess("Nombre eliminado");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a PRESUPUESTO ASIGNADO
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Listado de presupuesto asignado</h2>
          <p className="muted">
            {loading
              ? "Cargando..."
              : `${rows.length} nombre(s). Los inactivos no aparecen al cargar gastos nuevos.`}
          </p>
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
                    No hay nombres. Agregá uno desde Ingresar nombre.
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
