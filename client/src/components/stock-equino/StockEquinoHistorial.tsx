import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteStockEquinoLote,
  fetchStockEquinoLotes,
} from "../../api";
import type { StockEquinoLote } from "../../types";
import { confirmAction } from "../../utils/confirm";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onVerLecturas: (loteId: number) => void;
  refreshKey?: number;
  embedded?: boolean;
}

function fmtImportado(iso: string): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10);
  const t = iso.slice(11, 16);
  if (t) return `${d} ${t}`;
  return d;
}

export default function StockEquinoHistorial({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  onVerLecturas,
  refreshKey = 0,
  embedded = false,
}: Props) {
  const [lotes, setLotes] = useState<StockEquinoLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchStockEquinoLotes();
      setLotes(list);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setLotes([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const totalFilas = useMemo(
    () => lotes.reduce((sum, l) => sum + l.filas, 0),
    [lotes]
  );

  const totalPages = Math.max(1, Math.ceil(lotes.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const lotesPagina = useMemo(
    () => paginateSlice(lotes, pageSafe, pageSize),
    [lotes, pageSafe, pageSize]
  );

  const borrarLote = async (id: number, nombre: string) => {
    const ok = await confirmAction({
      title: "Eliminar importación",
      message: `¿Eliminar el lote «${nombre}» y todas sus lecturas?`,
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await deleteStockEquinoLote(id);
      onSuccess("Importación eliminada");
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  const panel = (
      <div className={`${embedded ? "sg-hub-panel sg-module-panel" : "card"}`}>
        {!embedded && (
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_lecturas" }}
            title="Historial de importaciones"
            subtitle={
              loading
                ? "Cargando…"
                : lotes.length === 0
                  ? "Aún no hay archivos importados."
                  : `${lotes.length} archivo(s) — ${totalFilas} lectura(s) en total`
            }
          />
        </div>
        )}
        {embedded && (
          <p className="sg-module-panel-meta" role="status">
            {loading
              ? "Cargando…"
              : lotes.length === 0
                ? "Aún no hay archivos importados."
                : `${lotes.length} archivo(s) — ${totalFilas} lectura(s) en total`}
          </p>
        )}

        <div className="table-wrap">
          <table className="data-table stock-historial-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Filas</th>
                <th>Importado</th>
                <th className="col-acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={4} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : lotes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Sin importaciones. Cargá un archivo desde «Alta de Dispositivo».
                  </td>
                </tr>
              ) : (
                lotesPagina.map((l) => (
                  <tr key={l.id}>
                    <td className="stock-historial-archivo">{l.nombre_archivo}</td>
                    <td className="num">{l.filas}</td>
                    <td>{fmtImportado(l.importado_en)}</td>
                    <td className="col-acciones">
                      <div className="stock-historial-acciones">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => onVerLecturas(l.id)}
                        >
                          Ver lecturas
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-delete"
                          onClick={() => void borrarLote(l.id, l.nombre_archivo)}
                        >
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && apiOnline && lotes.length > 0 && (
          <TablePagination
            total={lotes.length}
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
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a lecturas importadas
      </button>
      {panel}
    </div>
  );
}
