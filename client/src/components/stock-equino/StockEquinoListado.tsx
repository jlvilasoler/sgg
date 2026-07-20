import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchStockEquinoEstadisticas,
  fetchStockEquinoLotes,
  fetchStockEquinoRegistros,
} from "../../api";
import type {
  StockEquinoEstadisticas,
  StockEquinoLote,
  StockEquinoRegistro,
} from "../../types";
import { fmtDate } from "../../utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import { dispositivoClave } from "./stock-equina-utils";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  onVerHistorial: () => void;
  initialLoteId?: string;
  refreshKey?: number;
  embedded?: boolean;
}

function formatEquinoIdDisplay(clave: string): string {
  const digits = clave.replace(/\D/g, "");
  if (digits.length <= 3) return digits || "—";
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function labelOrigenAlta(origen: string | undefined): string {
  const o = String(origen ?? "").trim().toLowerCase();
  if (o === "generico") return "Genérico";
  if (o === "cabana") return "Cabaña";
  return origen?.trim() || "—";
}

function labelSexo(sexo: string | undefined): string {
  const s = String(sexo ?? "").trim().toUpperCase();
  if (s === "MACHO") return "Macho";
  if (s === "HEMBRA") return "Hembra";
  return "—";
}

function formatNacimiento(
  mes: number | null | undefined,
  anio: number | null | undefined
): string {
  if (!anio) return "—";
  if (mes && mes >= 1 && mes <= 12) {
    return `${String(mes).padStart(2, "0")}/${anio}`;
  }
  return String(anio);
}

function labelCategoria(cat: string | undefined, condicion?: string): string {
  const c = String(cat ?? "").trim();
  if (c) {
    const map: Record<string, string> = {
      POTRANCA: "Potranca",
      POTRA: "Potra",
      YEGUA: "Yegua",
      POTRILLO: "Potrillo",
      POTRO: "Potro",
      CABALLO: "Caballo",
      PADRILLO: "Padrillo",
    };
    return map[c.toUpperCase()] ?? c;
  }
  return condicion?.trim() || "—";
}

export default function StockEquinoListado({
  apiOnline,
  onError,
  onSuccess: _onSuccess,
  onVolver,
  onVerHistorial,
  initialLoteId = "",
  refreshKey = 0,
  embedded = false,
}: Props) {
  const [lotes, setLotes] = useState<StockEquinoLote[]>([]);
  const [rows, setRows] = useState<StockEquinoRegistro[]>([]);
  const [stats, setStats] = useState<StockEquinoEstadisticas | null>(null);
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
        fetchStockEquinoLotes(),
        fetchStockEquinoRegistros({
          ...filtros,
          solo_repetidos: soloRepetidos,
        }),
        fetchStockEquinoEstadisticas(filtros),
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

  const colCount = soloRepetidos ? 12 : 11;

  const hubLecturasStatus = loading
    ? "Cargando…"
    : soloRepetidos
      ? `${rows.length} lectura(s) con EID repetido — ${lotes.length} importación(es)`
      : `${stats?.total_lecturas ?? rows.length} lectura(s) — ${lotes.length} importación(es)`;

  const historialBtn = (
    <button
      type="button"
      className={embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-secondary"}
      onClick={onVerHistorial}
    >
      Historial de importaciones
      {lotes.length > 0 && (
        <span className="stock-historial-badge">{lotes.length}</span>
      )}
    </button>
  );

  const hubKpiStrip =
    embedded && apiOnline ? (
      <section
        className="sg-hub-kpi-strip stock-lecturas-kpi-strip sg-module-kpi-strip"
        aria-label="Resumen de lecturas"
      >
        <article className="sg-hub-kpi sg-hub-kpi--dark">
          <div className="sg-hub-kpi-top">
            <div>
              <p className="sg-hub-kpi-kicker">Total en base</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : (stats?.total_lecturas ?? 0)}</p>
            </div>
          </div>
          <p className="sg-hub-kpi-hint">Todas las lecturas</p>
        </article>
        <article className="sg-hub-kpi sg-hub-kpi--light">
          <div className="sg-hub-kpi-top">
            <div>
              <p className="sg-hub-kpi-kicker">Activos</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : (stats?.eids_activos ?? 0)}</p>
            </div>
          </div>
          <p className="sg-hub-kpi-hint">EID sin repetición</p>
        </article>
        <button
          type="button"
          className={`sg-hub-kpi stock-lecturas-kpi-btn stock-lecturas-kpi-btn--repetidos${
            soloRepetidos ? " is-active" : ""
          }`}
          disabled={loading || !stats || stats.eids_repetidos === 0}
          title={
            stats && stats.eids_repetidos > 0
              ? "Clic para ver las lecturas con EID repetido"
              : "Sin EIDs repetidos"
          }
          onClick={toggleRepetidos}
        >
          <div className="sg-hub-kpi-top">
            <div>
              <p className="sg-hub-kpi-kicker">Repetidos</p>
              <p className="sg-hub-kpi-value">{loading ? "—" : (stats?.eids_repetidos ?? 0)}</p>
            </div>
          </div>
          <p className="sg-hub-kpi-hint">
            {stats && stats.eids_repetidos > 0
              ? `${stats.lecturas_en_repetidos} lectura(s) · clic para filtrar`
              : "Sin duplicados detectados"}
          </p>
        </button>
      </section>
    ) : null;

  const resumenCards = (
    <div className="stock-dash-grid">
      <div className="stock-dash-card stock-dash-card--total">
        <span className="stock-dash-label">Total en base</span>
        <span className="stock-dash-valor">{loading ? "—" : (stats?.total_lecturas ?? 0)}</span>
        <span className="stock-dash-hint">Todas las lecturas</span>
      </div>
      <div className="stock-dash-card stock-dash-card--activos">
        <span className="stock-dash-label">Activos</span>
        <span className="stock-dash-valor">{loading ? "—" : (stats?.eids_activos ?? 0)}</span>
        <span className="stock-dash-hint">EID sin repetición</span>
      </div>
      <button
        type="button"
        className={`stock-dash-card stock-dash-card--repetidos${soloRepetidos ? " is-active" : ""}`}
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
  );

  const repetidosDetalle =
    soloRepetidos && stats && stats.detalle_repetidos.length > 0 ? (
      <>
        <div
          className={`stock-dash-filtro${embedded ? " stock-lecturas-repetidos-filtro--hub" : ""}`}
        >
          <span>
            Mostrando solo lecturas con EID repetido ({stats.eids_repetidos} número
            {stats.eids_repetidos === 1 ? "" : "s"})
          </span>
          <button
            type="button"
            className={embedded ? "sg-hub-cta sg-hub-cta--ghost" : "btn btn-sm"}
            onClick={() => setSoloRepetidos(false)}
          >
            Ver todas
          </button>
        </div>
        <ul
          className={`stock-dash-detalle${embedded ? " stock-lecturas-repetidos-detalle--hub" : ""}`}
          aria-label="EIDs repetidos"
        >
          {stats.detalle_repetidos.map((item) => (
            <li key={item.clave}>
              <span className="stock-dash-detalle-eid">
                {item.eid}
                {item.vid ? ` · ${item.vid}` : ""}
              </span>
              <span className="stock-dash-detalle-cant">×{item.cantidad} lecturas</span>
            </li>
          ))}
        </ul>
      </>
    ) : null;

  const filtersBar = (
    <div className={`filters mayusculas-auto${embedded ? " stock-lecturas-filters-box" : ""}`}>
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
        <label htmlFor="stock-busq">Buscar</label>
        <input
          id="stock-busq"
          type="search"
          placeholder="ID, RP, nombre, categoría, potrero…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>
      <button
        type="button"
        className={embedded ? "sg-hub-cta" : "btn btn-primary"}
        onClick={load}
      >
        Buscar
      </button>
    </div>
  );

  const dataTable = (
    <div className={`table-wrap${embedded ? " stock-lecturas-table-box" : ""}`}>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Sexo</th>
            <th>Categoría</th>
            <th>Origen</th>
            <th>RP</th>
            <th>Nombre</th>
            <th>Registro</th>
            <th>Nacimiento</th>
            <th>Empresa</th>
            <th>Potrero</th>
            <th>Fecha alta</th>
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
                  : "Sin altas registradas. Usá Alta genérica o Cabaña."}
              </td>
            </tr>
          ) : (
            rowsPagina.map((r) => {
              const clave = r.clave || dispositivoClave(r.eid, r.vid);
              const veces = repetidosPorClave.get(clave);
              const esDuplicado = veces !== undefined && veces > 1;
              return (
                <tr
                  key={r.id}
                  className={esDuplicado ? "stock-row--duplicado" : undefined}
                >
                  <td className="num stock-eid" title={clave}>
                    {formatEquinoIdDisplay(clave)}
                    {esDuplicado && !soloRepetidos && (
                      <span className="stock-badge-rep">×{veces}</span>
                    )}
                  </td>
                  <td>{labelSexo(r.sexo)}</td>
                  <td>{labelCategoria(r.categoria, r.condicion)}</td>
                  <td>{labelOrigenAlta(r.origen_alta)}</td>
                  <td>{r.rp?.trim() || "—"}</td>
                  <td>{r.nombre_animal?.trim() || "—"}</td>
                  <td>{r.registro?.trim() || "—"}</td>
                  <td>{formatNacimiento(r.nacimiento_mes, r.nacimiento_anio)}</td>
                  <td>{r.empresa?.trim() || "—"}</td>
                  <td>{r.potrero?.trim() || "—"}</td>
                  <td>{fmtDate(r.fecha)}</td>
                  {soloRepetidos && <td className="num">{veces ?? "—"}</td>}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const pagination =
    !loading && apiOnline && rows.length > 0 ? (
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
    ) : null;

  const panel = embedded ? (
    <div className="stock-lecturas-hub-workspace">
      {!apiOnline ? (
        <div className="stock-import-offline" role="status">
          Conectá la API (puerto 3001) para consultar lecturas importadas.
        </div>
      ) : null}

      {hubKpiStrip}

      {apiOnline ? (
        <p className="stock-lecturas-hub-status muted" role="status">
          {hubLecturasStatus}
        </p>
      ) : null}

      <section
        className="stock-lecturas-hub-box stock-lecturas-hub-box--listado"
        aria-label="Listado de lecturas"
      >
        <header className="stock-lecturas-hub-head-box stock-lecturas-hub-head-box--panel">
          <div className="stock-lecturas-hub-head-main">
            <p className="sg-hub-panel-kicker">Listado</p>
            <h2 className="stock-lecturas-hub-title">Lecturas importadas</h2>
            <p className="stock-lecturas-hub-sub muted">
              Altas equinas de la cuenta: ID, categoría, origen, RP y ficha.
            </p>
          </div>
          {historialBtn}
        </header>

        {repetidosDetalle}
        {filtersBar}
        {dataTable}
        {pagination}
      </section>
    </div>
  ) : (
    <div className="card">
      <div className="listado-toolbar">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "stock_lecturas" }}
            title="Lecturas importadas"
            subtitle={hubLecturasStatus}
          />
        </div>
        <div className="listado-toolbar-actions">{historialBtn}</div>
      </div>

      {apiOnline && (
        <section className="stock-dash" aria-label="Resumen de lecturas">
          <div className="stock-dash-head">
            <h3 className="stock-dash-title">Dashboard</h3>
            <p className="stock-dash-sub">
              {loading ? "Calculando…" : "Animales únicos según los filtros actuales"}
            </p>
          </div>
          {resumenCards}
          {repetidosDetalle}
        </section>
      )}

      {filtersBar}
      {dataTable}
      {pagination}
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Stock Equino
      </button>
      {panel}
    </div>
  );
}
