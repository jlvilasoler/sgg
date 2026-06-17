import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStockGanaderaDispositivos,
  fetchStockGanaderoEstadisticas,
} from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaBulkPanel from "./StockGanaderaBulkPanel";
import StockGanaderaDetalle from "./StockGanaderaDetalle";
import StockGanaderaEdadMiniTimeline from "./StockGanaderaEdadMiniTimeline";
import StockGanaderaEditarModal from "./StockGanaderaEditarModal";
import { fmtGrupo } from "./stock-ganadera-utils";

function fmtSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  return sexo || "—";
}

function fmtEmpresa(empresa: StockGanaderaDispositivo["empresa"]): string {
  return empresa || "—";
}

function claseCeldaSexo(sexo: StockGanaderaDispositivo["sexo"]): string {
  if (sexo === "MACHO") return "stock-td--sexo-macho";
  if (sexo === "HEMBRA") return "stock-td--sexo-hembra";
  return "stock-td--sexo-na";
}

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  refreshKey?: number;
}

export default function StockGanadera({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  refreshKey = 0,
}: Props) {
  const [rows, setRows] = useState<StockGanaderaDispositivo[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    activos: 0,
    repetidos: 0,
  });
  const [busqueda, setBusqueda] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [soloRepetidos, setSoloRepetidos] = useState(false);
  const [editarDispositivo, setEditarDispositivo] =
    useState<StockGanaderaDispositivo | null>(null);
  const [detalleClave, setDetalleClave] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set());

  const filtros = useMemo(
    () => ({
      busqueda: busqueda.trim() || undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      solo_repetidos: soloRepetidos,
    }),
    [busqueda, fechaDesde, fechaHasta, soloRepetidos]
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dispositivos, estadisticas] = await Promise.all([
        fetchStockGanaderaDispositivos(filtros),
        fetchStockGanaderoEstadisticas({
          busqueda: filtros.busqueda,
          fecha_desde: filtros.fecha_desde,
          fecha_hasta: filtros.fecha_hasta,
        }),
      ]);
      setRows(dispositivos);
      setStats({
        total: estadisticas.eids_activos + estadisticas.eids_repetidos,
        activos: estadisticas.eids_activos,
        repetidos: estadisticas.eids_repetidos,
      });
      if (soloRepetidos && dispositivos.length === 0) {
        setSoloRepetidos(false);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtros, soloRepetidos, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
    setSeleccion(new Set());
  }, [busqueda, fechaDesde, fechaHasta, pageSize, soloRepetidos]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const seleccionados = useMemo(
    () => rows.filter((r) => seleccion.has(r.clave)),
    [rows, seleccion]
  );

  const clavesPagina = useMemo(
    () => rowsPagina.map((r) => r.clave),
    [rowsPagina]
  );

  const paginaTodaSeleccionada =
    clavesPagina.length > 0 && clavesPagina.every((c) => seleccion.has(c));
  const paginaParcial =
    !paginaTodaSeleccionada && clavesPagina.some((c) => seleccion.has(c));

  const toggleClave = (clave: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  };

  const togglePagina = () => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (paginaTodaSeleccionada) {
        for (const c of clavesPagina) next.delete(c);
      } else {
        for (const c of clavesPagina) next.add(c);
      }
      return next;
    });
  };

  const seleccionarTodosFiltrados = () => {
    setSeleccion(new Set(rows.map((r) => r.clave)));
  };

  const limpiarSeleccion = () => setSeleccion(new Set());

  const sexoStats = useMemo(() => {
    let machos = 0;
    let hembras = 0;
    let sinDefinir = 0;
    for (const d of rows) {
      if (d.sexo === "MACHO") machos += 1;
      else if (d.sexo === "HEMBRA") hembras += 1;
      else sinDefinir += 1;
    }
    return { machos, hembras, sinDefinir };
  }, [rows]);

  const actualizarFila = (actualizado: StockGanaderaDispositivo) => {
    setRows((prev) =>
      prev.map((r) => (r.clave === actualizado.clave ? actualizado : r))
    );
  };

  if (detalleClave) {
    return (
      <StockGanaderaDetalle
        clave={detalleClave}
        apiOnline={apiOnline}
        onError={onError}
        onVolver={() => setDetalleClave(null)}
      />
    );
  }

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Ganadero
      </button>

      <div className="card">
        <div className="form-header">
          <h2>Stock Ganadero</h2>
          <p className="muted">
            {loading
              ? "Cargando…"
              : rows.length === 0
                ? "No hay dispositivos (EID) registrados. Importá lecturas para armar el stock."
                : `${rows.length} dispositivo(s) según los filtros aplicados`}
          </p>
        </div>

        {apiOnline && (
          <section className="stock-dash" aria-label="Resumen de dispositivos">
            <div className="stock-dash-head">
              <h3 className="stock-dash-title">Resumen</h3>
              <p className="stock-dash-sub">Caravanas electrónicas únicas en la base</p>
            </div>
            <div className="stock-dash-grid stock-dash-grid--sexo">
              <div className="stock-dash-card stock-dash-card--total">
                <span className="stock-dash-label">Dispositivos</span>
                <span className="stock-dash-valor">
                  {loading ? "—" : stats.total}
                </span>
                <span className="stock-dash-hint">EIDs distintos</span>
              </div>
              <div className="stock-dash-card stock-dash-card--activos">
                <span className="stock-dash-label">Activos</span>
                <span className="stock-dash-valor">
                  {loading ? "—" : stats.activos}
                </span>
                <span className="stock-dash-hint">Sin lecturas duplicadas</span>
              </div>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--repetidos${
                  soloRepetidos ? " is-active" : ""
                }`}
                onClick={() => stats.repetidos > 0 && setSoloRepetidos((v) => !v)}
                disabled={loading || stats.repetidos === 0}
                title={
                  stats.repetidos > 0
                    ? "Clic para ver solo dispositivos con EID repetido"
                    : "Sin duplicados"
                }
              >
                <span className="stock-dash-label">Con repetición</span>
                <span className="stock-dash-valor stock-dash-valor--alerta">
                  {loading ? "—" : stats.repetidos}
                </span>
                <span className="stock-dash-hint">
                  {stats.repetidos > 0 ? "Clic para filtrar" : "Todo en orden"}
                </span>
              </button>
              <div className="stock-dash-card stock-dash-card--macho">
                <span className="stock-dash-label">Total machos</span>
                <span className="stock-dash-valor stock-dash-valor--macho">
                  {loading ? "—" : sexoStats.machos}
                </span>
                <span className="stock-dash-hint">Sexo MACHO</span>
              </div>
              <div className="stock-dash-card stock-dash-card--hembra">
                <span className="stock-dash-label">Total hembras</span>
                <span className="stock-dash-valor stock-dash-valor--hembra">
                  {loading ? "—" : sexoStats.hembras}
                </span>
                <span className="stock-dash-hint">Sexo HEMBRA</span>
              </div>
              <div className="stock-dash-card stock-dash-card--sin-sexo">
                <span className="stock-dash-label">Sin definir</span>
                <span className="stock-dash-valor stock-dash-valor--sin-sexo">
                  {loading ? "—" : sexoStats.sinDefinir}
                </span>
                <span className="stock-dash-hint">Sin sexo asignado</span>
              </div>
            </div>
            {soloRepetidos && (
              <div className="stock-dash-filtro">
                <span>Mostrando solo dispositivos con lecturas repetidas</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSoloRepetidos(false)}
                >
                  Ver todos
                </button>
              </div>
            )}
          </section>
        )}

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="ganadera-f-desde">Desde</label>
            <input
              id="ganadera-f-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ganadera-f-hasta">Hasta</label>
            <input
              id="ganadera-f-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="field flex-grow">
            <label htmlFor="ganadera-busq">Buscar EID / VID</label>
            <input
              id="ganadera-busq"
              type="search"
              placeholder="EID, caravana visual…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
        </div>

        <StockGanaderaBulkPanel
          seleccionados={seleccionados}
          totalFiltrados={rows.length}
          apiOnline={apiOnline}
          onSeleccionarTodosFiltrados={seleccionarTodosFiltrados}
          onLimpiar={limpiarSeleccion}
          onAplicado={() => {
            limpiarSeleccion();
            void load();
          }}
          onError={onError}
          onSuccess={(msg) => onSuccess?.(msg)}
        />

        <div className="table-wrap table-wrap-stock-pro">
          <table className="data-table stock-ganadera-table stock-table-pro">
            <thead>
              <tr>
                <th className="stock-th stock-th--sel" aria-label="Seleccionar">
                  <input
                    type="checkbox"
                    className="stock-row-check"
                    checked={paginaTodaSeleccionada}
                    ref={(el) => {
                      if (el) el.indeterminate = paginaParcial;
                    }}
                    onChange={togglePagina}
                    disabled={loading || rowsPagina.length === 0}
                    title="Seleccionar página"
                  />
                </th>
                <th className="stock-th stock-th--num">EID</th>
                <th className="stock-th">VID</th>
                <th className="stock-th">Empresa</th>
                <th className="stock-th">Grupo</th>
                <th className="stock-th">Sexo</th>
                <th className="stock-th stock-th--edad">Edad</th>
                <th className="stock-th stock-th--time">Última lectura</th>
                <th className="stock-th">Condición</th>
                <th className="stock-th stock-th--num">Lecturas</th>
                <th className="stock-th stock-th--estado">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={11} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    Sin dispositivos para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                rowsPagina.map((d) => (
                  <tr
                    key={d.clave}
                    className={`stock-ganadera-row stock-table-pro-row${
                      seleccion.has(d.clave) ? " stock-table-pro-row--selected" : ""
                    }`}
                  >
                    <td className="stock-td stock-td--sel">
                      <input
                        type="checkbox"
                        className="stock-row-check"
                        checked={seleccion.has(d.clave)}
                        onChange={() => toggleClave(d.clave)}
                        aria-label={`Seleccionar ${d.vid || d.eid}`}
                      />
                    </td>
                    <td className="stock-td stock-td--num stock-td--eid">
                      {d.eid || "—"}
                    </td>
                    <td className="stock-td stock-td--vid">
                      <span className="stock-ganadera-row-eid">
                        <IconoDispositivoWifi className="stock-ganadera-row-icon" />
                        <button
                          type="button"
                          className="stock-ganadera-link stock-table-pro-link"
                          onClick={() => setEditarDispositivo(d)}
                          title="Editar caravana"
                        >
                          {d.vid || "—"}
                        </button>
                      </span>
                    </td>
                    <td className="stock-td stock-td--muted">
                      {fmtEmpresa(d.empresa)}
                    </td>
                    <td className="stock-td stock-td--muted">{fmtGrupo(d.grupo)}</td>
                    <td className={`stock-td stock-td--sexo ${claseCeldaSexo(d.sexo)}`}>
                      {fmtSexo(d.sexo)}
                    </td>
                    <td className="stock-td stock-td--edad">
                      <StockGanaderaEdadMiniTimeline
                        sexo={d.sexo}
                        nacimientoMes={d.nacimiento_mes}
                        nacimientoAnio={d.nacimiento_anio}
                        estado={d.estado}
                        bajaMes={d.baja_mes}
                        bajaAnio={d.baja_anio}
                      />
                    </td>
                    <td className="stock-td stock-td--time">
                      <span className="stock-td-time-date">{fmtDate(d.ultima_fecha)}</span>
                      {d.ultima_hora ? (
                        <span className="stock-td-time-hour">{d.ultima_hora}</span>
                      ) : null}
                    </td>
                    <td className="stock-td stock-td--muted">
                      {d.ultima_condicion || "—"}
                    </td>
                    <td className="stock-td stock-td--num stock-td--lecturas">
                      {d.total_lecturas}
                    </td>
                    <td className="stock-td stock-td--estado">
                      <BadgeEstadoDispositivo estado={d.estado} />
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

      {editarDispositivo && (
        <StockGanaderaEditarModal
          dispositivo={editarDispositivo}
          apiOnline={apiOnline}
          onClose={() => setEditarDispositivo(null)}
          onSaved={actualizarFila}
          onVerHistorial={() => {
            setDetalleClave(editarDispositivo.clave);
            setEditarDispositivo(null);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}
