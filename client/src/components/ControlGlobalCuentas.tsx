import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Landmark, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { fetchCuentasControlResumen } from "../api";
import type { CuentaControlResumen, CuentasControlPlataformaResumen } from "../types";
import { SgHubKpi, SgMiniBars } from "./stock/SgHubUi";
import TablePagination, { type PageSize } from "./TablePagination";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onVolver: () => void;
  volverLabel?: string;
}

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

function fmtPesos(n: number): string {
  return n.toLocaleString("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  });
}

function fmtPct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function inicialesCuenta(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const EMPTY_TOTALES: CuentasControlPlataformaResumen["totales"] = {
  animales_ganadero: 0,
  animales_equino: 0,
  animales_total: 0,
  gastos_registros: 0,
  gastos_pesos: 0,
};

export default function ControlGlobalCuentas({
  apiOnline,
  onError,
  onVolver,
  volverLabel = "Volver a Configuración SAG",
}: Props) {
  const [data, setData] = useState<CuentasControlPlataformaResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchCuentasControlResumen());
      setUltimaActualizacion(new Date());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar control de cuentas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const base = data?.cuentas ?? [];
    return base.filter((row) => {
      if (filtroEstado === "activo" && !row.activo) return false;
      if (filtroEstado === "inactivo" && row.activo) return false;
      if (!q) return true;
      return (
        row.nombre.toLowerCase().includes(q) ||
        row.codigo.toLowerCase().includes(q) ||
        row.cuenta_numero.toLowerCase().includes(q)
      );
    });
  }, [data, filtroTexto, filtroEstado]);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, filtroEstado, pageSize]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filas.slice(start, start + pageSize);
  }, [filas, page, pageSize]);

  const totales = data?.totales ?? EMPTY_TOTALES;
  const hayFiltros = Boolean(filtroTexto.trim() || filtroEstado);
  const cuentasActivas = useMemo(
    () => (data?.cuentas ?? []).filter((c) => c.activo).length,
    [data?.cuentas],
  );
  const cuentasSuspendidas = useMemo(
    () => (data?.cuentas ?? []).filter((c) => !c.activo).length,
    [data?.cuentas],
  );

  const syncLabel = loading
    ? "Sincronizando libro mayor…"
    : !apiOnline
      ? "Sin enlace al servidor (API)"
      : ultimaActualizacion
        ? `Última sincronización ${ultimaActualizacion.toLocaleString("es-UY", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "Libro mayor listo";

  const kpiPlaceholder = loading || !apiOnline ? "—" : undefined;

  return (
    <div className="subseccion-panel bank-control-shell">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section className="sg-hub-panel bank-control-panel" aria-labelledby="bank-control-title">
        <header className="sg-hub-panel-head bank-control-head">
          <div className="bank-control-head-copy">
            <p className="sg-hub-panel-kicker">Plataforma SAG · Supervisión</p>
            <h2 id="bank-control-title" className="sg-hub-panel-title">
              Centro de control de cuentas
            </h2>
            <p className="bank-control-lead muted">
              Monitoreo consolidado de cuentas madre: activos productivos, movimientos contables y
              exposición en pesos. Vista de auditoría en solo lectura.
            </p>
            <p className="bank-control-sync-meta muted">{syncLabel}</p>
          </div>
          <div className="bank-control-head-side">
            <span className="bank-control-head-icon" aria-hidden>
              <Landmark size={20} strokeWidth={1.75} />
            </span>
            <div className="bank-control-head-actions">
              <span className="bank-control-compliance">
                <ShieldCheck size={14} aria-hidden />
                Modo auditoría
              </span>
              <button
                type="button"
                className="sg-hub-cta bank-control-sync-btn"
                disabled={!apiOnline || loading}
                onClick={() => void load()}
              >
                <RefreshCw
                  size={15}
                  className={loading ? "bank-control-spin" : undefined}
                  aria-hidden
                />
                Sincronizar
              </button>
            </div>
          </div>
        </header>

        <section
          className="sg-hub-kpi-strip home-hub-kpi-strip bank-control-kpi-strip"
          aria-label="Indicadores consolidados"
          style={{ "--home-hub-kpi-cols": "4" } as CSSProperties}
        >
          <SgHubKpi
            variant="dark"
            kicker="Cartera de cuentas"
            value={kpiPlaceholder ?? fmtEntero(data?.cuentas.length ?? 0)}
            hint={
              kpiPlaceholder
                ? "—"
                : `${cuentasActivas} operativas · ${cuentasSuspendidas} suspendidas`
            }
            trend="Cuentas madre"
            bars={<SgMiniBars highlight="mid" />}
          />
          <SgHubKpi
            variant="dark"
            kicker="Activos productivos"
            value={kpiPlaceholder ?? fmtEntero(totales.animales_total)}
            hint={
              kpiPlaceholder
                ? "—"
                : `Ganadero ${fmtEntero(totales.animales_ganadero)} · Equino ${fmtEntero(totales.animales_equino)}`
            }
            trend="Stock vivo"
            bars={<SgMiniBars />}
          />
          <SgHubKpi
            variant="light"
            kicker="Movimientos contables"
            value={kpiPlaceholder ?? fmtEntero(totales.gastos_registros)}
            hint="Registros en presupuesto / gastos"
            bars={<SgMiniBars highlight="last" />}
          />
          <SgHubKpi
            variant="light"
            kicker="Exposición consolidada"
            value={kpiPlaceholder ?? fmtPesos(totales.gastos_pesos)}
            hint="Suma de montos en pesos por cuenta"
            trend="UYU"
            bars={<SgMiniBars />}
          />
        </section>

        <section className="bank-control-data" aria-labelledby="bank-control-table-title">
          <header className="bank-control-data-head">
            <div>
              <p className="bank-control-data-kicker">Libro mayor</p>
              <h3 id="bank-control-table-title" className="bank-control-data-title">
                Cuentas cliente
              </h3>
              <p className="bank-control-data-sub muted">
                {hayFiltros
                  ? `${filas.length} de ${data?.cuentas.length ?? 0} cuentas en pantalla`
                  : "Detalle por titular, clasificación operativa y saldos agregados"}
              </p>
            </div>
          </header>

          <div className="bank-control-filtros">
            <label className="bank-control-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Buscar cuenta cliente</span>
              <input
                type="search"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Titular, código interno o nº de cuenta…"
                disabled={!apiOnline || loading}
              />
            </label>
            <label className="bank-control-select-wrap">
              <span className="bank-control-field-label">Estado operativo</span>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "inactivo")}
                disabled={!apiOnline || loading}
              >
                <option value="">Todas</option>
                <option value="activo">Operativas</option>
                <option value="inactivo">Suspendidas</option>
              </select>
            </label>
            {hayFiltros ? (
              <button
                type="button"
                className="home-hub-link bank-control-clear"
                onClick={() => {
                  setFiltroTexto("");
                  setFiltroEstado("");
                }}
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <div className="bank-control-table-wrap">
            <table className="bank-control-table">
              <thead>
                <tr>
                  <th>Titular / cuenta</th>
                  <th>Nº cuenta</th>
                  <th className="num">Ganadero</th>
                  <th className="num">Equino</th>
                  <th className="num">Activos</th>
                  <th className="num">Movimientos</th>
                  <th className="num">Exposición</th>
                  <th>Participación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="bank-control-empty">
                      Consultando datos…
                    </td>
                  </tr>
                ) : !apiOnline ? (
                  <tr>
                    <td colSpan={9} className="bank-control-empty">
                      Sin enlace al servidor · reintente sincronizar
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="bank-control-empty">
                      No hay cuentas que coincidan con los criterios de búsqueda
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <FilaCuenta
                      key={row.cuenta_id}
                      row={row}
                      totalActivos={totales.animales_total}
                    />
                  ))
                )}
              </tbody>
              {!loading && apiOnline && filas.length > 0 ? (
                <tfoot>
                  <tr className="bank-control-total-row">
                    <td colSpan={2}>
                      <strong>Total consolidado plataforma</strong>
                    </td>
                    <td className="num">{fmtEntero(totales.animales_ganadero)}</td>
                    <td className="num">{fmtEntero(totales.animales_equino)}</td>
                    <td className="num">{fmtEntero(totales.animales_total)}</td>
                    <td className="num">{fmtEntero(totales.gastos_registros)}</td>
                    <td className="num">{fmtPesos(totales.gastos_pesos)}</td>
                    <td className="num">100%</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <TablePagination
            total={filas.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>
      </section>
    </div>
  );
}

function FilaCuenta({
  row,
  totalActivos,
}: {
  row: CuentaControlResumen;
  totalActivos: number;
}) {
  const share = totalActivos > 0 ? (row.animales_total / totalActivos) * 100 : 0;

  return (
    <tr className={row.activo ? "bank-control-row--activa" : "bank-control-row--suspendida"}>
      <td>
        <div className="bank-control-account-cell">
          <span className="bank-control-account-avatar" aria-hidden>
            {inicialesCuenta(row.nombre)}
          </span>
          <div>
            <div className="bank-control-account-name">{row.nombre}</div>
            <div className="bank-control-account-meta">
              <span className="bank-control-account-code">{row.codigo}</span>
              <span className="bank-control-account-sep">·</span>
              <span>Cuenta madre</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        <span className="bank-control-account-num">{row.cuenta_numero}</span>
      </td>
      <td className="num">{fmtEntero(row.animales_ganadero)}</td>
      <td className="num">{fmtEntero(row.animales_equino)}</td>
      <td className="num">
        <strong>{fmtEntero(row.animales_total)}</strong>
      </td>
      <td className="num">{fmtEntero(row.gastos_registros)}</td>
      <td className="num bank-control-money">{fmtPesos(row.gastos_pesos)}</td>
      <td className="num">
        <div className="bank-control-share">
          <span className="bank-control-share-val">{fmtPct(row.animales_total, totalActivos)}</span>
          <span
            className="bank-control-share-bar"
            role="presentation"
            style={{ width: `${Math.min(100, share)}%` }}
          />
        </div>
      </td>
      <td>
        <span
          className={`bank-control-status ${
            row.activo ? "bank-control-status--ok" : "bank-control-status--off"
          }`}
        >
          {row.activo ? "Operativa" : "Suspendida"}
        </span>
      </td>
    </tr>
  );
}
