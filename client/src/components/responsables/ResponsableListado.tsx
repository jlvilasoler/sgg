import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteResponsable, fetchResponsables } from "../../api";
import type { Responsable } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { PageModuleHeadRow } from "../PageModuleHead";

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
  const [busqueda, setBusqueda] = useState("");

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchResponsables(false, { ambitoCuenta: true }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.nombre.toLowerCase().includes(term) ||
        (r.observaciones ?? "").toLowerCase().includes(term)
    );
  }, [rows, busqueda]);

  const activos = rows.filter((r) => r.activo).length;

  const borrar = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar asignación",
      message:
        "¿Eliminar esta asignación? Solo es posible si no tiene gastos asociados.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteResponsable(id);
      onSuccess("Asignación eliminada");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel responsable-module">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Asignación de presupuesto
      </button>

      <div className="card responsable-module-shell listado-pro-shell">
        <header className="responsable-module-page-head listado-pro-head">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "resp_listado" }}
            kicker="Asignación de presupuesto"
            title="Listado completo"
            subtitle={
              loading
                ? "Cargando catálogo…"
                : `${rows.length} asignación${rows.length === 1 ? "" : "es"} · ${activos} activa${activos === 1 ? "" : "s"}`
            }
            titleClassName="responsable-module-page-title listado-pro-head-title"
            subClassName="responsable-module-page-sub listado-pro-head-sub"
          />
        </header>

        <div className="responsable-listado-toolbar">
          <div className="field responsable-listado-search">
            <label htmlFor="resp-listado-busqueda">Buscar</label>
            <input
              id="resp-listado-busqueda"
              type="search"
              placeholder="Nombre u observación…"
              value={busqueda}
              disabled={loading || !apiOnline}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap listado-pro-table-wrap">
          <table className="data-table listado-pro-table responsable-listado-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Observaciones</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Cargando asignaciones…
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    {rows.length === 0
                      ? "No hay asignaciones. Creá una desde Nueva asignación."
                      : "Ningún resultado coincide con la búsqueda."}
                  </td>
                </tr>
              ) : (
                filtradas.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.nombre}</strong>
                    </td>
                    <td className="muted small-cell">
                      {(r.observaciones ?? "").trim() || "—"}
                    </td>
                    <td>
                      <span
                        className={`responsable-estado-badge${r.activo ? " is-active" : ""}`}
                      >
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
