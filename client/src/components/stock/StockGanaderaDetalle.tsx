import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockGanaderaDispositivo } from "../../api";
import type { StockGanaderaDispositivoDetalle } from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import StockGanaderaHistorialCambiosModal from "./StockGanaderaHistorialCambiosModal";
import { fmtEdadMeses, fmtNacimiento } from "./stock-ganadera-utils";

interface Props {
  clave: string;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onVolver: () => void;
}

export default function StockGanaderaDetalle({
  clave,
  apiOnline,
  onError,
  onVolver,
}: Props) {
  const [detalle, setDetalle] = useState<StockGanaderaDispositivoDetalle | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [verHistorialCambios, setVerHistorialCambios] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setDetalle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStockGanaderaDispositivo(clave);
      setDetalle(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, clave, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const lecturas = detalle?.lecturas ?? [];
  const totalPages = Math.max(1, Math.ceil(lecturas.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const lecturasPagina = useMemo(
    () => paginateSlice(lecturas, pageSafe, pageSize),
    [lecturas, pageSafe, pageSize]
  );

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al listado de dispositivos
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Detalle del dispositivo</h2>
          <p className="muted">
            {loading
              ? "Cargando…"
              : detalle
                ? `VID ${detalle.vid || "—"} (EID ${detalle.eid})`
                : "Dispositivo no encontrado"}
          </p>
        </div>

        {loading ? (
          <p className="empty">Cargando detalle…</p>
        ) : !detalle ? (
          <p className="empty">No se encontró el dispositivo.</p>
        ) : (
          <>
            <section className="stock-ganadera-detalle-resumen">
              <div className="stock-ganadera-detalle-grid">
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">EID</span>
                  <span className="stock-ganadera-detalle-valor num">
                    {detalle.eid}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">VID</span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.vid || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">Empresa</span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.empresa || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">Grupo</span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.grupo || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">Sexo</span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.sexo || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">Edad</span>
                  <span className="stock-ganadera-detalle-valor">
                    {fmtEdadMeses(detalle.nacimiento_mes, detalle.nacimiento_anio)}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Fecha de nacimiento
                  </span>
                  <span className="stock-ganadera-detalle-valor">
                    {fmtNacimiento(detalle.nacimiento_mes, detalle.nacimiento_anio)}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item stock-ganadera-detalle-item--full">
                  <span className="stock-ganadera-detalle-label">Observaciones</span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.observaciones?.trim() || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">Estado</span>
                  <span className="stock-ganadera-detalle-valor">
                    <BadgeEstadoDispositivo estado={detalle.estado} />
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Total lecturas
                  </span>
                  <span className="stock-ganadera-detalle-valor num">
                    {detalle.total_lecturas}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Primera lectura
                  </span>
                  <span className="stock-ganadera-detalle-valor">
                    {fmtDate(detalle.primera_fecha)}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Última lectura
                  </span>
                  <span className="stock-ganadera-detalle-valor">
                    {fmtDate(detalle.ultima_fecha)}
                    {detalle.ultima_hora ? ` ${detalle.ultima_hora}` : ""}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Última condición
                  </span>
                  <span className="stock-ganadera-detalle-valor">
                    {detalle.ultima_condicion || "—"}
                  </span>
                </div>
                <div className="stock-ganadera-detalle-item">
                  <span className="stock-ganadera-detalle-label">
                    Importaciones
                  </span>
                  <span className="stock-ganadera-detalle-valor num">
                    {detalle.lotes_distintos}
                  </span>
                </div>
              </div>
            </section>

            <div className="stock-ganadera-detalle-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setVerHistorialCambios(true)}
              >
                Historial de cambios
              </button>
            </div>

            <h3 className="stock-ganadera-detalle-titulo">Historial de lecturas</h3>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Condición</th>
                    <th>Archivo importado</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        Sin lecturas
                      </td>
                    </tr>
                  ) : (
                    lecturasPagina.map((l) => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.fecha)}</td>
                        <td>{l.hora || "—"}</td>
                        <td>{l.condicion || "—"}</td>
                        <td>{l.nombre_archivo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {lecturas.length > 0 && (
              <TablePagination
                total={lecturas.length}
                page={pageSafe}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </>
        )}
      </div>

      {verHistorialCambios && detalle && (
        <StockGanaderaHistorialCambiosModal
          clave={detalle.clave}
          vid={detalle.vid}
          eid={detalle.eid}
          apiOnline={apiOnline}
          onClose={() => setVerHistorialCambios(false)}
          onError={onError}
        />
      )}
    </div>
  );
}
