import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchVentasGanadoCerradas, updateVentaGanadoCerradaDestino } from "../../api";
import type { SimuladorVentaGanadoRow, SimuladorVentaTipo } from "../../types";
import { fmtDate, fmtNum } from "../../utils";
import { SIMULADOR_VENTA_TIPO_MAP } from "../simulador-venta/simulador-venta-config";
import { fmtUsd } from "../simulador-venta/simulador-venta-real-utils";
import TablePagination, {
  paginateSlice,
  type PageSize,
} from "../TablePagination";
import { PageModuleHeadRow } from "../PageModuleHead";

const DESTINO_SUGERENCIAS = [
  "Frigorífico",
  "Escritorio Rural",
  "Feria",
  "Remate",
] as const;

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess?: (msg: string) => void;
  onVolver: () => void;
  puedeEditar?: boolean;
}

function categoriaLabel(row: SimuladorVentaGanadoRow): string {
  const cfg = SIMULADOR_VENTA_TIPO_MAP[row.tipo];
  return cfg?.labels[row.categoria] ?? row.categoria;
}

function tipoLabel(tipo: SimuladorVentaTipo): string {
  return SIMULADOR_VENTA_TIPO_MAP[tipo]?.titulo ?? tipo;
}

function formatCabezas(row: SimuladorVentaGanadoRow): string {
  if (row.modo_kg !== "CABEZAS") return "—";
  return row.real_cantidad_animales != null ? fmtNum(row.real_cantidad_animales, 0) : "—";
}

export default function VentasGanadoCerradas({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  puedeEditar = true,
}: Props) {
  const [rows, setRows] = useState<SimuladorVentaGanadoRow[]>([]);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<"" | SimuladorVentaTipo>("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [savingDestinoId, setSavingDestinoId] = useState<number | null>(null);
  const [destinoDrafts, setDestinoDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(
        await fetchVentasGanadoCerradas({
          tipo: tipo || undefined,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          busqueda: busqueda.trim() || undefined,
        })
      );
      setDestinoDrafts({});
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar ventas de ganado");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, fechaDesde, fechaHasta, busqueda, tipo, onError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [fechaDesde, fechaHasta, busqueda, tipo, pageSize]);

  const saveDestino = useCallback(
    async (row: SimuladorVentaGanadoRow, value: string) => {
      if (!puedeEditar) return;
      const normalized = value.trim() || null;
      const current = row.destino?.trim() || null;
      if (normalized === current) return;

      setSavingDestinoId(row.id);
      try {
        const updated = await updateVentaGanadoCerradaDestino(row.id, normalized);
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, destino: updated.destino } : r))
        );
        setDestinoDrafts((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        onSuccess?.("Destino guardado");
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al guardar destino");
      } finally {
        setSavingDestinoId(null);
      }
    },
    [onError, onSuccess, puedeEditar]
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageSafe = Math.min(page, totalPages);

  const rowsPagina = useMemo(
    () => paginateSlice(rows, pageSafe, pageSize),
    [rows, pageSafe, pageSize]
  );

  const totales = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        cabezas:
          acc.cabezas +
          (r.modo_kg === "CABEZAS" && r.real_cantidad_animales != null
            ? r.real_cantidad_animales
            : 0),
        kg: acc.kg + (r.real_kg_total ?? 0),
        totalUsd: acc.totalUsd + (r.real_total_usd ?? 0),
      }),
      { cabezas: 0, kg: 0, totalUsd: 0 }
    );
  }, [rows]);

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>

      {!puedeEditar && (
        <div className="sim-historial-editing-banner sim-calc-editing-banner" role="status">
          <span>Tu rol solo permite consultar ingresos por ventas</span>
        </div>
      )}

      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "ventas_ganado_cerradas" }}
            title="Ventas de ganado cerradas"
            subtitle={
              loading
                ? "Cargando..."
                : `${rows.length} venta(s) cerrada(s) desde el simulador — Total USD: ${fmtUsd(totales.totalUsd)}`
            }
          />
        </div>

        <div className="filters mayusculas-auto">
          <div className="field">
            <label htmlFor="vg-f-desde">Embarque desde</label>
            <input
              id="vg-f-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="vg-f-hasta">Embarque hasta</label>
            <input
              id="vg-f-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="vg-tipo">Tipo</label>
            <select
              id="vg-tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "" | SimuladorVentaTipo)}
            >
              <option value="">Todos</option>
              <option value="EN_PIE">Venta en pie</option>
              <option value="CUARTA_BALANZA">Venta en cuarta balanza</option>
            </select>
          </div>
          <div className="field flex-grow">
            <label htmlFor="vg-busq">Buscar</label>
            <input
              id="vg-busq"
              type="search"
              placeholder="N° operación, categoría, destino, usuario…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={load}>
            Buscar
          </button>
        </div>

        {!loading && apiOnline && rows.length > 0 && (
          <div className="ventas-ganado-totales" aria-label="Totales de ventas cerradas">
            <span>
              <strong>{rows.length}</strong> ventas
            </span>
            <span>
              <strong>{fmtNum(totales.cabezas, 0)}</strong> cabezas
            </span>
            <span>
              <strong>{fmtNum(totales.kg, 1)}</strong> kg
            </span>
            <span className="ventas-ganado-totales-usd">
              <strong>{fmtUsd(totales.totalUsd)}</strong> USD
            </span>
          </div>
        )}

        <datalist id="vg-destino-sugerencias">
          {DESTINO_SUGERENCIAS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <div className="table-wrap">
          <table className="data-table ventas-ganado-table">
            <thead>
              <tr>
                <th>N° oper.</th>
                <th>Fecha embarque</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Destino</th>
                <th className="num">Cabezas</th>
                <th className="num">Kg</th>
                <th className="num">USD/kg</th>
                <th className="num">Total USD</th>
                <th className="num">USD/cab.</th>
                <th className="num">Disp.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="empty">
                    Cargando...
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
                    Sin ventas cerradas con esos filtros
                  </td>
                </tr>
              ) : (
                rowsPagina.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.numero_operacion || "—"}</td>
                    <td>{r.venta_realizada_en ? fmtDate(r.venta_realizada_en) : "—"}</td>
                    <td>{tipoLabel(r.tipo)}</td>
                    <td>{categoriaLabel(r)}</td>
                    <td className="ventas-ganado-destino-cell">
                      {puedeEditar ? (
                        <input
                          type="text"
                          className="ventas-ganado-destino-input"
                          list="vg-destino-sugerencias"
                          value={destinoDrafts[r.id] ?? r.destino ?? ""}
                          placeholder="Frigorífico, productor, feria…"
                          disabled={!apiOnline || savingDestinoId === r.id}
                          onChange={(e) => {
                            setDestinoDrafts((prev) => ({ ...prev, [r.id]: e.target.value }));
                          }}
                          onBlur={(e) => saveDestino(r, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.currentTarget.blur();
                            }
                          }}
                          aria-label={`Destino de ${r.numero_operacion || "operación"}`}
                        />
                      ) : (
                        <span>{r.destino?.trim() || "—"}</span>
                      )}
                    </td>
                    <td className="num">{formatCabezas(r)}</td>
                    <td className="num">
                      {r.real_kg_total != null ? fmtNum(r.real_kg_total, 1) : "—"}
                    </td>
                    <td className="num">
                      {r.real_precio_usd_kg != null ? fmtNum(r.real_precio_usd_kg, 2) : "—"}
                    </td>
                    <td className="num">
                      <strong>{r.real_total_usd != null ? fmtUsd(r.real_total_usd) : "—"}</strong>
                    </td>
                    <td className="num">
                      {r.real_total_usd_por_cabeza != null
                        ? fmtUsd(r.real_total_usd_por_cabeza)
                        : "—"}
                    </td>
                    <td className="num">{r.dispositivos_count > 0 ? r.dispositivos_count : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && apiOnline && rows.length > 0 && (
              <tfoot>
                <tr className="data-table-totals">
                  <td colSpan={5}>
                    <strong>Totales ({rows.length})</strong>
                  </td>
                  <td className="num">
                    <strong>{fmtNum(totales.cabezas, 0)}</strong>
                  </td>
                  <td className="num">
                    <strong>{fmtNum(totales.kg, 1)}</strong>
                  </td>
                  <td />
                  <td className="num">
                    <strong>{fmtUsd(totales.totalUsd)}</strong>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
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
