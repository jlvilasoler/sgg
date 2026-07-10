import { useCallback, useEffect, useMemo, useState, type CSSProperties, Fragment } from "react";
import { Beef, ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import { fetchHomeLayoutMonitorStockGanadero } from "../../api";
import type {
  CuentaStockGanaderoMonitorResumen,
  HomeLayoutMonitorStockGanaderoSnapshot,
} from "../../types";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  /** Incrementar para forzar recarga (p.ej. botón Actualizar del monitor). */
  refreshKey?: number;
}

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

function inicialesCuenta(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const EMPTY_TOTALES: HomeLayoutMonitorStockGanaderoSnapshot["totales"] = {
  total: 0,
  machos: 0,
  hembras: 0,
  sin_definir: 0,
  cuentas_con_stock: 0,
  categorias: [],
};

export default function HomeLayoutMonitorStockSection({
  apiOnline,
  onError,
  refreshKey = 0,
}: Props) {
  const [data, setData] = useState<HomeLayoutMonitorStockGanaderoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "activo" | "inactivo">("");
  const [filtroConStock, setFiltroConStock] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchHomeLayoutMonitorStockGanadero());
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar stock ganadero de cuentas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const base = data?.cuentas ?? [];
    return base.filter((row) => {
      if (filtroEstado === "activo" && !row.activo) return false;
      if (filtroEstado === "inactivo" && row.activo) return false;
      if (filtroConStock && row.total <= 0) return false;
      if (!q) return true;
      return (
        row.nombre.toLowerCase().includes(q) ||
        row.codigo.toLowerCase().includes(q) ||
        row.cuenta_numero.toLowerCase().includes(q)
      );
    });
  }, [data, filtroTexto, filtroEstado, filtroConStock]);

  const totales = data?.totales ?? EMPTY_TOTALES;
  const kpiPlaceholder = loading || !apiOnline ? "—" : undefined;
  const hayFiltros = Boolean(filtroTexto.trim() || filtroEstado || filtroConStock);

  const toggleExpand = (row: CuentaStockGanaderoMonitorResumen) => {
    if (row.total <= 0) return;
    setExpandedId((prev) => (prev === row.cuenta_id ? null : row.cuenta_id));
  };

  return (
    <section
      className="home-layout-monitor-stock"
      aria-labelledby="home-layout-monitor-stock-title"
    >
      <header className="home-layout-monitor-stock-head">
        <div>
          <p className="sg-hub-panel-kicker">Stock ganadero · Plataforma</p>
          <h3 id="home-layout-monitor-stock-title" className="home-layout-monitor-stock-title">
            Stock de las cuentas
          </h3>
          <p className="muted home-layout-monitor-stock-lead">
            Animales activos (vivos, sin venta cerrada) por cuenta madre: totales, macho / hembra y
            categoría etaria. Solo visible para superadministrador.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary home-layout-users-monitor-refresh"
          onClick={() => void load()}
          disabled={!apiOnline || loading}
        >
          <RefreshCw size={15} aria-hidden />
          Actualizar stock
        </button>
      </header>

      <section
        className="sg-hub-kpi-strip home-hub-kpi-strip home-layout-monitor-stock-kpi"
        aria-label="Totales de stock ganadero"
        style={{ "--home-hub-kpi-cols": "4" } as CSSProperties}
      >
        <SgHubKpi
          variant="dark"
          kicker="Total activos"
          value={kpiPlaceholder ?? fmtEntero(totales.total)}
          hint="Ganado vivo en todas las cuentas"
          trend="Plataforma"
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          kicker="Machos"
          value={kpiPlaceholder ?? fmtEntero(totales.machos)}
          hint={
            kpiPlaceholder
              ? "—"
              : totales.total > 0
                ? `${Math.round((totales.machos / totales.total) * 100)}% del stock`
                : "Sin stock"
          }
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          kicker="Hembras"
          value={kpiPlaceholder ?? fmtEntero(totales.hembras)}
          hint={
            kpiPlaceholder
              ? "—"
              : totales.total > 0
                ? `${Math.round((totales.hembras / totales.total) * 100)}% del stock`
                : "Sin stock"
          }
          bars={<SgMiniBars />}
        />
        <SgHubKpi
          kicker="Cuentas con stock"
          value={kpiPlaceholder ?? fmtEntero(totales.cuentas_con_stock)}
          hint={
            kpiPlaceholder
              ? "—"
              : `De ${fmtEntero(data?.cuentas.length ?? 0)} cuentas madre`
          }
          bars={<SgMiniBars highlight="mid" />}
        />
      </section>

      {totales.categorias.length > 0 && !loading ? (
        <div className="home-layout-monitor-stock-cats" aria-label="Totales por categoría">
          {totales.categorias.map((cat) => (
            <span
              key={cat.key}
              className={`home-layout-monitor-stock-chip home-layout-monitor-stock-chip--${cat.grupo}`}
            >
              <strong>{cat.label}</strong>
              <span>{fmtEntero(cat.total)}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="home-layout-monitor-stock-toolbar">
        <label className="home-layout-users-monitor-search">
          <Search size={15} aria-hidden />
          <input
            type="search"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar cuenta, código o número…"
            aria-label="Buscar cuenta"
          />
        </label>
        <label className="home-layout-users-monitor-select-wrap">
          <span>Estado</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "inactivo")}
          >
            <option value="">Todas</option>
            <option value="activo">Activas</option>
            <option value="inactivo">Suspendidas</option>
          </select>
        </label>
        <label className="home-layout-monitor-stock-check">
          <input
            type="checkbox"
            checked={filtroConStock}
            onChange={(e) => setFiltroConStock(e.target.checked)}
          />
          Solo con stock
        </label>
      </div>

      <div className="home-layout-monitor-stock-table-wrap">
        {loading ? (
          <p className="home-layout-users-monitor-empty muted">Cargando stock ganadero…</p>
        ) : filas.length === 0 ? (
          <div className="home-layout-monitor-stock-empty">
            <Beef size={26} strokeWidth={1.5} aria-hidden />
            <p className="muted">
              {hayFiltros
                ? "Ninguna cuenta coincide con los filtros."
                : "No hay cuentas con stock ganadero cargado."}
            </p>
          </div>
        ) : (
          <table className="home-layout-monitor-stock-table">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Estado</th>
                <th scope="col" className="is-num">
                  Machos
                </th>
                <th scope="col" className="is-num">
                  Hembras
                </th>
                <th scope="col" className="is-num">
                  Sin def.
                </th>
                <th scope="col" className="is-num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((row) => {
                const open = expandedId === row.cuenta_id;
                return (
                  <Fragment key={row.cuenta_id}>
                    <tr
                      className={`${row.total > 0 ? "is-clickable" : ""}${
                        !row.activo ? " is-off" : ""
                      }${open ? " is-open" : ""}`}
                      onClick={() => toggleExpand(row)}
                    >
                      <th scope="row">
                        <span className="home-layout-monitor-stock-cuenta">
                          {row.total > 0 ? (
                            open ? (
                              <ChevronDown size={14} aria-hidden />
                            ) : (
                              <ChevronRight size={14} aria-hidden />
                            )
                          ) : (
                            <span className="home-layout-monitor-stock-chevron-spacer" />
                          )}
                          <span className="home-layout-monitor-stock-avatar" aria-hidden>
                            {inicialesCuenta(row.nombre)}
                          </span>
                          <span className="home-layout-monitor-stock-cuenta-copy">
                            <strong>{row.nombre}</strong>
                            <small className="muted">
                              {row.codigo} · Nº {row.cuenta_numero}
                            </small>
                          </span>
                        </span>
                      </th>
                      <td>
                        <span
                          className={`home-layout-users-monitor-badge${
                            row.activo ? "" : " home-layout-users-monitor-badge--off"
                          }`}
                        >
                          {row.activo ? "Activa" : "Suspendida"}
                        </span>
                      </td>
                      <td className="is-num">{fmtEntero(row.machos)}</td>
                      <td className="is-num">{fmtEntero(row.hembras)}</td>
                      <td className="is-num">
                        {row.sin_definir > 0 ? fmtEntero(row.sin_definir) : "—"}
                      </td>
                      <td className="is-num is-total">{fmtEntero(row.total)}</td>
                    </tr>
                    {open ? (
                      <tr className="home-layout-monitor-stock-detail-row">
                        <td colSpan={6}>
                          {row.categorias.length === 0 ? (
                            <p className="muted">Sin desglose por categoría.</p>
                          ) : (
                            <table className="home-layout-monitor-stock-cat-table">
                              <thead>
                                <tr>
                                  <th scope="col">Categoría</th>
                                  <th scope="col" className="is-num">
                                    Machos
                                  </th>
                                  <th scope="col" className="is-num">
                                    Hembras
                                  </th>
                                  <th scope="col" className="is-num">
                                    Total
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.categorias.map((cat) => (
                                  <tr key={cat.key}>
                                    <th scope="row">{cat.label}</th>
                                    <td className="is-num">
                                      {cat.machos > 0 ? fmtEntero(cat.machos) : "—"}
                                    </td>
                                    <td className="is-num">
                                      {cat.hembras > 0 ? fmtEntero(cat.hembras) : "—"}
                                    </td>
                                    <td className="is-num is-total">{fmtEntero(cat.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  Total{hayFiltros ? " (filtrado)" : ""}
                </th>
                <td className="is-num">
                  {fmtEntero(filas.reduce((s, r) => s + r.machos, 0))}
                </td>
                <td className="is-num">
                  {fmtEntero(filas.reduce((s, r) => s + r.hembras, 0))}
                </td>
                <td className="is-num">
                  {fmtEntero(filas.reduce((s, r) => s + r.sin_definir, 0))}
                </td>
                <td className="is-num is-total">
                  {fmtEntero(filas.reduce((s, r) => s + r.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </section>
  );
}
