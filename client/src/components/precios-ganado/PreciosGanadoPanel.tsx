import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPreciosGanado, importPreciosGanadoAcg } from "../../api";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import type { SemanaPreciosGanado } from "../../types";
import { fmtDate, fmtNum } from "../divisas/divisas-utils";
import type { PreciosGanadoSegmentoConfig } from "./precios-ganado-config";
import {
  getPreciosGanadoSegmentoCache,
  setPreciosGanadoSegmentoCache,
} from "./precios-ganado-cache";
import PreciosGanadoChart from "./PreciosGanadoChart";
import PreciosGanadoKpiCards from "./PreciosGanadoKpiCards";

interface Props {
  config: PreciosGanadoSegmentoConfig;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

function fmtSemanaRango(s: SemanaPreciosGanado): string {
  return `${fmtDate(s.fecha_desde)} → ${fmtDate(s.fecha_hasta)}`;
}

type SegmentoCache = {
  semanas: SemanaPreciosGanado[];
  ultima: SemanaPreciosGanado | null;
};

function initialSegmentState(configId: string): SegmentoCache {
  return (
    getPreciosGanadoSegmentoCache(configId) ?? { semanas: [], ultima: null }
  );
}

export default function PreciosGanadoPanel({
  config,
  apiOnline,
  onError,
  onSuccess,
}: Props) {
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [semanas, setSemanas] = useState<SemanaPreciosGanado[]>(
    () => initialSegmentState(config.id).semanas
  );
  const [ultima, setUltima] = useState<SemanaPreciosGanado | null>(
    () => initialSegmentState(config.id).ultima
  );
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  const cached = getPreciosGanadoSegmentoCache(config.id);
  const displayUltima = loading ? (ultima ?? cached?.ultima ?? null) : ultima;
  const displaySemanas = loading
    ? semanas.length > 0
      ? semanas
      : (cached?.semanas ?? [])
    : semanas;

  const totalPages = Math.max(1, Math.ceil(displaySemanas.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const semanasPagina = useMemo(
    () => paginateSlice(displaySemanas, pageSafe, pageSize),
    [displaySemanas, pageSafe, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [fechaDesde, fechaHasta, pageSize]);

  useEffect(() => {
    const c = initialSegmentState(config.id);
    setSemanas(c.semanas);
    setUltima(c.ultima);
  }, [config.id]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setSemanas([]);
      setUltima(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPreciosGanado({
        segmento: config.id,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setSemanas(data.semanas);
      setUltima(data.ultima);
      setPreciosGanadoSegmentoCache(config.id, {
        semanas: data.semanas,
        ultima: data.ultima,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar precios");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, config.id, fechaDesde, fechaHasta, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const sincronizarPrecios = useCallback(
    async (silent: boolean) => {
      if (!apiOnline) return;
      setSyncing(true);
      try {
        await importPreciosGanadoAcg({ segmento: config.id });
        await load();
      } catch (e) {
        if (!silent) {
          onError(e instanceof Error ? e.message : "Error al actualizar precios");
        }
      } finally {
        setSyncing(false);
      }
    },
    [apiOnline, config.id, load, onError]
  );

  useEffect(() => {
    if (!apiOnline) return;
    void sincronizarPrecios(true);
  }, [apiOnline, sincronizarPrecios]);

  const actualizarManual = async () => {
    if (!apiOnline) {
      onError("Conectá la API para actualizar");
      return;
    }
    setImporting(true);
    try {
      const res = await importPreciosGanadoAcg({ segmento: config.id });
      if (res.insertados > 0 || res.actualizados > 0) {
        onSuccess("Precios actualizados.");
      } else {
        onSuccess("Los precios ya están al día.");
      }
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al actualizar precios");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="subseccion-panel">
      <div className="card precios-ganado-ultimos">
        <PreciosGanadoKpiCards
          config={config}
          ultima={displayUltima}
          semanas={displaySemanas}
          refreshing={loading}
        />
        {!loading && !displayUltima && (
          <p className="muted precios-ganado-sin-datos-hint">
            Sin datos. Usá «Actualizar» para cargar la semana vigente.
          </p>
        )}
      </div>

      <div className="card precios-ganado-chart-panel">
        <PreciosGanadoChart
          semanas={displaySemanas}
          config={config}
          refreshing={loading && displaySemanas.length > 0}
        />
      </div>

      <div className="card">
        <div className="form-header">
          <h3>Histórico semanal</h3>
          <p className="muted">Promedios semanales registrados</p>
        </div>

        <div className="filters">
          <div className="field">
            <label htmlFor={`pg-desde-${config.id}`}>Desde</label>
            <input
              type="date"
              id={`pg-desde-${config.id}`}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`pg-hasta-${config.id}`}>Hasta</label>
            <input
              type="date"
              id={`pg-hasta-${config.id}`}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            Buscar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={importing || syncing || !apiOnline}
            onClick={() => void actualizarManual()}
          >
            {importing || syncing ? "Actualizando…" : "Actualizar"}
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Semana</th>
                <th>Período</th>
                {config.categorias.map((cat) => (
                  <th key={cat} className="num">
                    {config.labels[cat]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!apiOnline ? (
                <tr>
                  <td colSpan={2 + config.categorias.length} className="empty">
                    API desconectada
                  </td>
                </tr>
              ) : semanasPagina.length === 0 ? (
                <tr>
                  <td colSpan={2 + config.categorias.length} className="empty">
                    {loading ? "" : "Sin registros para el filtro"}
                  </td>
                </tr>
              ) : (
                semanasPagina.map((s) => (
                  <tr key={`${s.anio}-${s.semana}`}>
                    <td>
                      <strong>N°{s.semana}</strong>
                      <span className="muted"> / {s.anio}</span>
                    </td>
                    <td>{fmtSemanaRango(s)}</td>
                    {config.categorias.map((cat) => (
                      <td key={cat} className="num">
                        {s.precios[cat as keyof typeof s.precios] != null
                          ? fmtNum(s.precios[cat as keyof typeof s.precios]!, 2)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {apiOnline && displaySemanas.length > 0 && (
          <TablePagination
            total={displaySemanas.length}
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
