import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDivisas,
  importDivisasBcuUyu,
  importDivisasYahooBrl,
} from "../../api";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import type { DivisaIndicadores, TipoCambio } from "../../types";
import { PAR_DIVISA_LABELS, PAR_DIVISA_TC_LABEL } from "../../types";
import type { DivisasMonedaConfig } from "./divisas-config";
import {
  buildTcComparacionMaps,
  fmtDate,
  fmtDiaSemana,
  fmtSemanaAnio,
  fmtTcVariacionPct,
} from "./divisas-utils";
import TcValorConTendencia from "./TcValorConTendencia";
import DivisasChart from "./DivisasChart";
import DivisasKpiCards from "./DivisasKpiCards";

interface Props {
  config: DivisasMonedaConfig;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function DivisasHistorial({
  config,
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const { par } = config;
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [rows, setRows] = useState<TipoCambio[]>([]);
  const [indicadores, setIndicadores] = useState<DivisaIndicadores | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const { tendencia: tendenciaPorId, variacionPct: variacionPorId } = useMemo(
    () => buildTcComparacionMaps(rows),
    [rows]
  );

  useEffect(() => {
    setPage(1);
  }, [fechaDesde, fechaHasta, pageSize, par]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setIndicadores(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchDivisas({
        par,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setRows(data.data);
      setIndicadores(data.indicadores);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, par, fechaDesde, fechaHasta, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const importarAuto = useCallback(
    async (opts: {
      solo_nuevos: boolean;
      completo: boolean;
      fecha_desde?: string;
      fecha_hasta?: string;
    }) => {
      if (config.autoImport === "bcu") {
        return importDivisasBcuUyu(opts);
      }
      if (config.autoImport === "yahoo") {
        return importDivisasYahooBrl(opts);
      }
      throw new Error("Esta moneda no tiene importación automática configurada.");
    },
    [config.autoImport]
  );

  const sincronizarNuevos = useCallback(
    async (silent: boolean) => {
      if (!apiOnline || !config.autoImport) return;
      setSyncing(true);
      try {
        const res = await importarAuto({
          solo_nuevos: true,
          completo: false,
        });
        if (res.insertados > 0) {
          if (!silent) onSuccess(res.message);
          await load();
        } else if (!silent && res.ya_actualizado) {
          onSuccess(res.message);
        }
      } catch (e) {
        if (!silent) {
          onError(e instanceof Error ? e.message : "Error al sincronizar");
        }
      } finally {
        setSyncing(false);
      }
    },
    [apiOnline, config.autoImport, importarAuto, load, onError, onSuccess]
  );

  useEffect(() => {
    if (!apiOnline || !config.autoImport) return;
    sincronizarNuevos(true);
  }, [apiOnline, config.autoImport, sincronizarNuevos]);

  const importarManual = async () => {
    if (!apiOnline) {
      onError("Conectá la API para importar");
      return;
    }
    if (!config.autoImport) {
      onError("Usá importar archivo o ingresar TC manualmente.");
      return;
    }
    setImporting(true);
    try {
      const res = await importarAuto({
        solo_nuevos: true,
        completo: false,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      const rango = res.rango
        ? `\nRango: ${res.rango.desde} → ${res.rango.hasta}`
        : "";
      onSuccess(`${res.message}${rango}`);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Divisas
      </button>

      {indicadores?.ultimo && (
        <DivisasKpiCards
          config={config}
          indicadores={indicadores}
          rows={rows}
          refreshing={loading}
        />
      )}

      <DivisasChart key={config.id} rows={rows} config={config} refreshing={loading} />

      <div className="card">
        <div className="form-header">
          <h2>Histórico — {config.titulo}</h2>
          <p className="muted">{PAR_DIVISA_LABELS[par]}</p>
        </div>

        <div className="filters">
          <div className="field">
            <label htmlFor="div-desde">Desde</label>
            <input
              type="date"
              id="div-desde"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="div-hasta">Hasta</label>
            <input
              type="date"
              id="div-hasta"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
          {config.autoImport && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={importing || syncing || !apiOnline}
              onClick={importarManual}
            >
              {importing || syncing ? "Importando…" : config.importLabel}
            </button>
          )}
        </div>

        {config.autoImport && (
          <p className="hint-muted divisas-investing-hint">{config.importHint}</p>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Día</th>
                <th>Semana</th>
                <th className="num">
                  <span className="data-table-th-stack">
                    <span>Precio</span>
                    {PAR_DIVISA_TC_LABEL[par] ? (
                      <span className="data-table-th-stack-sub">{PAR_DIVISA_TC_LABEL[par]}</span>
                    ) : null}
                  </span>
                </th>
                <th className="num">% Var.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Cargando...
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={5} className="empty">
                    API no conectada
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    Sin registros. Importá un archivo o usá el botón de importación.
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => {
                  const tendencia = tendenciaPorId.get(r.id) ?? "none";
                  const variacion = variacionPorId.get(r.id);
                  const variacionClass =
                    tendencia === "up"
                      ? "tc-trend-up"
                      : tendencia === "down"
                        ? "tc-trend-down"
                        : tendencia === "equal"
                          ? "tc-trend-equal"
                          : "muted";

                  return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.fecha)}</td>
                    <td className="muted">{fmtDiaSemana(r.fecha)}</td>
                    <td className="muted" title="Semana del año (ISO)">
                      {fmtSemanaAnio(r.fecha)}
                    </td>
                    <td className="num">
                      <TcValorConTendencia
                        valor={r.valor}
                        tendencia={tendencia}
                      />
                    </td>
                    <td
                      className={`num ${variacionClass}`}
                      title="Variación vs. día anterior"
                    >
                      {variacion != null ? fmtTcVariacionPct(variacion) : "—"}
                    </td>
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
