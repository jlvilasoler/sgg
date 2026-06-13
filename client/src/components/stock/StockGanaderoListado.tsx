import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStockGanaderoEstadisticas,
  fetchStockGanaderoLotes,
  fetchStockGanaderoRegistros,
} from "../../api";
import type {
  StockGanaderoEstadisticas,
  StockGanaderoLote,
  StockGanaderoRegistro,
} from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import { dispositivoClave } from "./stock-ganadera-utils";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onVerHistorial: () => void;
  initialLoteId?: string;
  refreshKey?: number;
}

export default function StockGanaderoListado({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  onVerHistorial,
  initialLoteId = "",
  refreshKey = 0,
}: Props) {
  const [lotes, setLotes] = useState<StockGanaderoLote[]>([]);
  const [rows, setRows] = useState<StockGanaderoRegistro[]>([]);
  const [stats, setStats] = useState<StockGanaderoEstadisticas | null>(null);
  const [loteId, setLoteId] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [soloRepetidos, setSoloRepetidos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const filtros = useMemo(
    () => ({
      lote_id: loteId ? Number(loteId) : undefined,
      busqueda: busqueda.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
    }),
    [loteId, busqueda, fechaDesde, fechaHasta]
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLotes([]);
      setRows([]);
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [lotList, regs, estadisticas] = await Promise.all([
        fetchStockGanaderoLotes(),
        fetchStockGanaderoRegistros({
          ...filtros,
          solo_repetidos: soloRepetidos,
        }),
        fetchStockGanaderoEstadisticas(filtros),
      ]);
      setLotes(lotList);
      setRows(regs);
      setStats(estadisticas);
      if (soloRepetidos && estadisticas.eids_repetidos === 0) {
        setSoloRepetidos(false);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtros, soloRepetidos, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (initialLoteId) setLoteId(initialLoteId);
  }, [initialLoteId]);

  useEffect(() => {
    setPage(1);
  }, [loteId, busqueda, fechaDesde, fechaHasta, pageSize, soloRepetidos]);

  const repetidosPorClave = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stats?.detalle_repetidos ?? []) {
      map.set(item.clave, item.cantidad);
    }
    return map;
  }, [stats]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const toggleRepetidos = () => {
    if (!stats || stats.eids_repetidos === 0) return;
    setSoloRepetidos((v) => !v);
  };

  const colCount = soloRepetidos ? 6 : 5;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card">
        <div className="listado-toolbar">
          <div className="form-header">
            <h2>Lecturas importadas</h2>
            <p className="muted">
              {loading
                ? "Cargando…"
                : soloRepetidos
                  ? `${rows.length} lectura(s) con EID repetido — ${lotes.length} importación(es)`
                  : `${stats?.total_lecturas ?? rows.length} lectura(s) — ${lotes.length} importación(es)`}
            </p>
          </div>
          <div className="listado-toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onVerHistorial}
            >
              Historial de importaciones
              {lotes.length > 0 && (
                <span className="stock-historial-badge">{lotes.length}</span>
              )}
            </button>
          </div>
        </div>

        {apiOnline && (
          <section className="stock-dash" aria-label="Resumen de lecturas">
            <div className="stock-dash-head">
              <h3 className="stock-dash-title">Dashboard</h3>
              <p className="stock-dash-sub">
                {loading
                  ? "Calculando…"
                  : "EIDs únicos según los filtros actuales"}
              </p>
            </div>
            <div className="stock-dash-grid">
              <div className="stock-dash-card stock-dash-card--total">
                <span className="stock-dash-label">Total en base</span>
                <span className="stock-dash-valor">
                  {loading ? "—" : (stats?.total_lecturas ?? 0)}
                </span>
                <span className="stock-dash-hint">Todas las lecturas</span>
              </div>
              <div className="stock-dash-card stock-dash-card--activos">
                <span className="stock-dash-label">Activos</span>
                <span className="stock-dash-valor">
                  {loading ? "—" : (stats?.eids_activos ?? 0)}
                </span>
                <span className="stock-dash-hint">EID sin repetición</span>
              </div>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--repetidos${
                  soloRepetidos ? " is-active" : ""
                }`}
                onClick={toggleRepetidos}
                disabled={loading || !stats || stats.eids_repetidos === 0}
                title={
                  stats && stats.eids_repetidos > 0
                    ? "Clic para ver las lecturas con EID repetido"
                    : "Sin EIDs repetidos"
                }
              >
                <span className="stock-dash-label">Repetidos</span>
                <span className="stock-dash-valor stock-dash-valor--alerta">
                  {loading ? "—" : (stats?.eids_repetidos ?? 0)}
                </span>
                <span className="stock-dash-hint">
                  {stats && stats.eids_repetidos > 0
                    ? `${stats.lecturas_en_repetidos} lectura(s) · clic para filtrar`
                    : "Sin duplicados detectados"}
                </span>
              </button>
            </div>

            {soloRepetidos && stats && stats.detalle_repetidos.length > 0 && (
              <>
                <div className="stock-dash-filtro">
                  <span>
                    Mostrando solo lecturas con EID repetido (
                    {stats.eids_repetidos} número
                    {stats.eids_repetidos === 1 ? "" : "s"})
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setSoloRepetidos(false)}
                  >
                    Ver todas
                  </button>
                </div>
                <ul className="stock-dash-detalle" aria-label="EIDs repetidos">
                  {stats.detalle_repetidos.map((item) => (
                    <li key={item.clave}>
                      <span className="stock-dash-detalle-eid">
                        {item.eid}
                        {item.vid ? ` · ${item.vid}` : ""}
                      </span>
                      <span className="stock-dash-detalle-cant">
                        ×{item.cantidad} lecturas
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        <div className="filters mayusculas-auto">
          {lotes.length > 0 && (
            <div className="field">
              <label htmlFor="stock-f-lote">Importación</label>
              <select
                id="stock-f-lote"
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
              >
                <option value="">Todas</option>
                {lotes.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {l.nombre_archivo} ({l.filas} filas)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="stock-f-desde">Desde</label>
            <input
              id="stock-f-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="stock-f-hasta">Hasta</label>
            <input
              id="stock-f-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="field flex-grow">
            <label htmlFor="stock-busq">Buscar EID / VID / condición</label>
            <input
              id="stock-busq"
              type="search"
              placeholder="EID, caravana visual, condición…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>EID</th>
                <th>VID</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Condición</th>
                {soloRepetidos && <th>Lecturas</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="empty">
                    {soloRepetidos
                      ? "No hay lecturas repetidas con los filtros actuales."
                      : "Sin lecturas. Importá un archivo .txt desde el menú anterior."}
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => {
                  const clave = dispositivoClave(r.eid, r.vid);
                  const veces = repetidosPorClave.get(clave);
                  const esDuplicado = veces !== undefined && veces > 1;
                  return (
                    <tr
                      key={r.id}
                      className={esDuplicado ? "stock-row--duplicado" : undefined}
                    >
                      <td className="num stock-eid">
                        {r.eid}
                        {esDuplicado && !soloRepetidos && (
                          <span className="stock-badge-rep">×{veces}</span>
                        )}
                      </td>
                      <td>{r.vid || "—"}</td>
                      <td>{fmtDate(r.fecha)}</td>
                      <td>{r.hora || "—"}</td>
                      <td>{r.condicion || "—"}</td>
                      {soloRepetidos && (
                        <td className="num">{veces ?? "—"}</td>
                      )}
                    </tr>
                  );
                })
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
