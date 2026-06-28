import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteProveedor, fetchProveedores } from "../../api";
import type { Proveedor } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { HubMenuIcon } from "../icons/HubMenuIcons";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";

interface Props {
  apiOnline: boolean;
  onEdit: (p: Proveedor) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function ProveedorListado({
  apiOnline,
  onEdit,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [rows, setRows] = useState<Proveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [busqueda, pageSize]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchProveedores(busqueda));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const borrar = async (id: number) => {
    const ok = await confirmAction({
      title: "Eliminar proveedor",
      message: "¿Eliminar este proveedor?",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteProveedor(id);
      onSuccess("Proveedor eliminado");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  return (
    <div className="subseccion-panel responsable-module proveedores-module">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Proveedores
      </button>

      <div className="card responsable-module-shell">
        <header className="responsable-module-page-head">
          <div className="responsable-module-page-head-main">
            <div className="responsable-module-page-icon" aria-hidden>
              <HubMenuIcon id="prov_listado" className="menu-app-icon-svg" />
            </div>
            <div>
              <span className="responsable-module-kicker">Proveedores</span>
              <h2 className="responsable-module-page-title">Listado de proveedores</h2>
              <p className="responsable-module-page-sub">
                {loading
                  ? "Cargando catálogo…"
                  : `${rows.length} proveedor${rows.length === 1 ? "" : "es"} en su cuenta`}
              </p>
            </div>
          </div>
          {!loading && apiOnline ? (
            <span className="responsable-module-stat-pill" aria-live="polite">
              {rows.length} total
            </span>
          ) : null}
        </header>

        <div className="responsable-listado-toolbar">
          <div className="field responsable-listado-search">
            <label htmlFor="busq-prov">Buscar</label>
            <input
              id="busq-prov"
              type="search"
              placeholder="Código, razón social, RUT, ciudad…"
              value={busqueda}
              disabled={loading || !apiOnline}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table responsable-listado-table">
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Razón social</th>
                <th>RUT</th>
                <th>Dirección</th>
                <th>Ciudad</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    Cargando proveedores…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={6} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    {busqueda.trim()
                      ? "Ningún resultado coincide con la búsqueda."
                      : "No hay proveedores. Creá uno desde Ingresar proveedor."}
                  </td>
                </tr>
              ) : (
                rowsPagina.map((p) => (
                  <tr key={p.id}>
                    <td className="num">{p.cod}</td>
                    <td>
                      <strong>{p.razon_social}</strong>
                    </td>
                    <td>{p.rut || "—"}</td>
                    <td className="muted small-cell">{p.direccion || "—"}</td>
                    <td>{p.ciudad || "—"}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onEdit(p)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => borrar(p.id)}
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

        {!loading && apiOnline && rows.length > 0 && (
          <TablePagination
            total={rows.length}
            page={pageSafe}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
