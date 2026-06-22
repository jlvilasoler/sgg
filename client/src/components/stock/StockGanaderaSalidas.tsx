import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockGanaderaSalidas } from "../../api";
import type { StockGanaderaDispositivo } from "../../types";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import BadgeEstadoDispositivo from "./BadgeEstadoDispositivo";
import IconoDispositivoWifi from "./IconoDispositivoWifi";
import StockGanaderaEdadMiniTimeline from "./StockGanaderaEdadMiniTimeline";
import StockGanaderaEditarPanel from "./StockGanaderaEditarModal";
import {
  calcularMesesEntreFechas,
  etiquetaFechaBaja,
  fmtGrupo,
  fmtGrupoLibre,
  fmtNacimiento,
  listAniosNacimiento,
  MESES_NACIMIENTO,
} from "./stock-ganadera-utils";

type FiltroEstado = "" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

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
  onVolver: () => void;
  refreshKey?: number;
}

export default function StockGanaderaSalidas({
  apiOnline,
  onError,
  onVolver,
  refreshKey = 0,
}: Props) {
  const [rows, setRows] = useState<StockGanaderaDispositivo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("");
  const [bajaMes, setBajaMes] = useState<number | "">("");
  const [bajaAnio, setBajaAnio] = useState<number | "">("");
  const [editarDispositivo, setEditarDispositivo] =
    useState<StockGanaderaDispositivo | null>(null);
  const [bajasReparadas, setBajasReparadas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const aniosBaja = useMemo(() => listAniosNacimiento(), []);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { dispositivos, bajasReparadas: reparadas } = await fetchStockGanaderaSalidas({
        busqueda: busqueda.trim() || undefined,
      });
      setRows(dispositivos);
      setBajasReparadas(reparadas);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar salidas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, busqueda, onError]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, filtroEstado, bajaMes, bajaAnio, pageSize]);

  const rowsFiltradas = useMemo(() => {
    return rows.filter((d) => {
      if (filtroEstado && d.estado !== filtroEstado) return false;
      if (bajaMes !== "" && d.baja_mes !== bajaMes) return false;
      if (bajaAnio !== "" && d.baja_anio !== bajaAnio) return false;
      return true;
    });
  }, [rows, filtroEstado, bajaMes, bajaAnio]);

  const stats = useMemo(() => {
    let muertos = 0;
    let vendidos = 0;
    let frigorifico = 0;
    let perdidos = 0;
    for (const d of rows) {
      if (d.estado === "MUERTO") muertos += 1;
      else if (d.estado === "VENDIDO") vendidos += 1;
      else if (d.estado === "FRIGORIFICO") frigorifico += 1;
      else if (d.estado === "PERDIDO") perdidos += 1;
    }
    return {
      total: rows.length,
      muertos,
      vendidos,
      frigorifico,
      perdidos,
    };
  }, [rows]);

  const mostrarCargaVacia = loading && rows.length === 0;

  const totalPages = Math.max(1, Math.ceil(rowsFiltradas.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const rowsPagina = useMemo(
    () => paginateSlice(rowsFiltradas, pageSafe, pageSize),
    [rowsFiltradas, pageSafe, pageSize]
  );

  const actualizarFila = (actualizado: StockGanaderaDispositivo) => {
    if (
      actualizado.estado === "VIVO" ||
      (filtroEstado && actualizado.estado !== filtroEstado)
    ) {
      setRows((prev) => prev.filter((r) => r.clave !== actualizado.clave));
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.clave === actualizado.clave ? actualizado : r))
    );
  };

  if (editarDispositivo) {
    return (
      <StockGanaderaEditarPanel
        dispositivo={editarDispositivo}
        apiOnline={apiOnline}
        onVolver={() => setEditarDispositivo(null)}
        volverLabel="Volver a Salidas del sistema"
        onSaved={(actualizado) => {
          actualizarFila(actualizado);
          setEditarDispositivo(null);
        }}
        onVerHistorial={() => setEditarDispositivo(null)}
        onError={onError}
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
          <h2>Salidas del sistema</h2>
          <p className="muted">
            Dispositivos dados de baja: muertes, ventas, frigorífico y extraviados.
            {mostrarCargaVacia
              ? " Cargando…"
              : loading
                ? ` ${rowsFiltradas.length} salida(s) según los filtros · actualizando…`
                : rowsFiltradas.length === 0
                  ? " No hay salidas registradas."
                  : ` ${rowsFiltradas.length} salida(s) según los filtros.`}
            {!mostrarCargaVacia && bajasReparadas > 0
              ? ` Se sincronizaron ${bajasReparadas} baja(s) pendiente(s) desde ventas cerradas.`
              : ""}
          </p>
        </div>

        {apiOnline && (
          <section
            className="stock-dash stock-dash--salidas"
            aria-label="Resumen de salidas"
          >
            <div className="stock-dash-head">
              <h3 className="stock-dash-title">Resumen</h3>
              <p className="stock-dash-sub">Bajas registradas en el stock ganadero</p>
            </div>
            <div className="stock-dash-grid stock-dash-grid--salidas">
              <div className="stock-dash-card stock-dash-card--total">
                <span className="stock-dash-label">Total salidas</span>
                <span className="stock-dash-valor">
                  {mostrarCargaVacia ? "—" : stats.total}
                </span>
                <span className="stock-dash-hint">Fuera del stock activo</span>
              </div>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--muerto${
                  filtroEstado === "MUERTO" ? " is-active" : ""
                }`}
                onClick={() =>
                  setFiltroEstado((v) => (v === "MUERTO" ? "" : "MUERTO"))
                }
                disabled={mostrarCargaVacia || stats.muertos === 0}
              >
                <span className="stock-dash-label">Muertes</span>
                <span className="stock-dash-valor stock-dash-valor--muerto">
                  {mostrarCargaVacia ? "—" : stats.muertos}
                </span>
                <span className="stock-dash-hint">Clic para filtrar</span>
              </button>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--vendido${
                  filtroEstado === "VENDIDO" ? " is-active" : ""
                }`}
                onClick={() =>
                  setFiltroEstado((v) => (v === "VENDIDO" ? "" : "VENDIDO"))
                }
                disabled={mostrarCargaVacia || stats.vendidos === 0}
              >
                <span className="stock-dash-label">Ventas</span>
                <span className="stock-dash-valor stock-dash-valor--vendido">
                  {mostrarCargaVacia ? "—" : stats.vendidos}
                </span>
                <span className="stock-dash-hint">Clic para filtrar</span>
              </button>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--frigorifico${
                  filtroEstado === "FRIGORIFICO" ? " is-active" : ""
                }`}
                onClick={() =>
                  setFiltroEstado((v) =>
                    v === "FRIGORIFICO" ? "" : "FRIGORIFICO"
                  )
                }
                disabled={mostrarCargaVacia || stats.frigorifico === 0}
              >
                <span className="stock-dash-label">Frigorífico</span>
                <span className="stock-dash-valor stock-dash-valor--frigorifico">
                  {mostrarCargaVacia ? "—" : stats.frigorifico}
                </span>
                <span className="stock-dash-hint">Clic para filtrar</span>
              </button>
              <button
                type="button"
                className={`stock-dash-card stock-dash-card--perdido${
                  filtroEstado === "PERDIDO" ? " is-active" : ""
                }`}
                onClick={() =>
                  setFiltroEstado((v) => (v === "PERDIDO" ? "" : "PERDIDO"))
                }
                disabled={mostrarCargaVacia || stats.perdidos === 0}
              >
                <span className="stock-dash-label">Extraviados</span>
                <span className="stock-dash-valor stock-dash-valor--perdido">
                  {mostrarCargaVacia ? "—" : stats.perdidos}
                </span>
                <span className="stock-dash-hint">Clic para filtrar</span>
              </button>
            </div>
          </section>
        )}

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="salidas-estado">Motivo</label>
            <select
              id="salidas-estado"
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(e.target.value as FiltroEstado)
              }
            >
              <option value="">Todos</option>
              <option value="MUERTO">Muerte</option>
              <option value="VENDIDO">Venta</option>
              <option value="FRIGORIFICO">Frigorífico</option>
              <option value="PERDIDO">Extraviado</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="salidas-baja-mes">Mes baja</label>
            <select
              id="salidas-baja-mes"
              value={bajaMes}
              onChange={(e) =>
                setBajaMes(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Todos</option>
              {MESES_NACIMIENTO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="salidas-baja-anio">Año baja</label>
            <select
              id="salidas-baja-anio"
              value={bajaAnio}
              onChange={(e) =>
                setBajaAnio(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Todos</option>
              {aniosBaja.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="field flex-grow">
            <label htmlFor="salidas-busq">Buscar EID / VID</label>
            <input
              id="salidas-busq"
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

        <div className="table-wrap table-wrap-stock-pro">
          <table className="data-table stock-ganadera-table stock-table-pro stock-salidas-table">
            <thead>
              <tr>
                <th className="stock-th stock-th--num">EID</th>
                <th className="stock-th">VID</th>
                <th className="stock-th">Empresa</th>
                <th className="stock-th">Generación</th>
                <th className="stock-th">Grupo</th>
                <th className="stock-th">Sexo</th>
                <th className="stock-th stock-th--estado">Motivo</th>
                <th className="stock-th stock-th--baja">Fecha baja</th>
                <th className="stock-th stock-th--edad">Edad a la baja</th>
              </tr>
            </thead>
            <tbody>
              {mostrarCargaVacia ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Cargando…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={9} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rowsPagina.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Sin salidas para los filtros aplicados.
                  </td>
                </tr>
              ) : (
                rowsPagina.map((d) => {
                  const mesesBaja = calcularMesesEntreFechas(
                    d.nacimiento_mes,
                    d.nacimiento_anio,
                    d.baja_mes,
                    d.baja_anio
                  );
                  return (
                    <tr
                      key={d.clave}
                      className="stock-ganadera-row stock-table-pro-row stock-salidas-row"
                    >
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
                            title="Ver / editar caravana"
                          >
                            {d.vid || "—"}
                          </button>
                        </span>
                      </td>
                      <td className="stock-td stock-td--muted">
                        {fmtEmpresa(d.empresa)}
                      </td>
                      <td className="stock-td stock-td--muted">
                        {fmtGrupo(d.grupo)}
                      </td>
                      <td className="stock-td stock-td--muted">
                        {fmtGrupoLibre(d.grupo_libre)}
                      </td>
                      <td
                        className={`stock-td stock-td--sexo ${claseCeldaSexo(d.sexo)}`}
                      >
                        {fmtSexo(d.sexo)}
                      </td>
                      <td className="stock-td stock-td--estado">
                        <BadgeEstadoDispositivo estado={d.estado} />
                      </td>
                      <td className="stock-td stock-td--baja">
                        <span className="stock-salidas-baja-label">
                          {etiquetaFechaBaja(d.estado)}:
                        </span>{" "}
                        <strong>{fmtNacimiento(d.baja_mes, d.baja_anio)}</strong>
                      </td>
                      <td className="stock-td stock-td--edad">
                        {mesesBaja !== null ? (
                          <>
                            <StockGanaderaEdadMiniTimeline
                              sexo={d.sexo}
                              nacimientoMes={d.nacimiento_mes}
                              nacimientoAnio={d.nacimiento_anio}
                              estado={d.estado}
                              bajaMes={d.baja_mes}
                              bajaAnio={d.baja_anio}
                            />
                            <span className="stock-salidas-edad-meses">
                              {mesesBaja} m
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!mostrarCargaVacia && apiOnline && rowsFiltradas.length > 0 && (
          <TablePagination
            total={rowsFiltradas.length}
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
