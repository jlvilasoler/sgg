import { useCallback, useEffect, useMemo, useState, type CSSProperties, Fragment } from "react";
import { Beef, ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import { fetchHomeLayoutMonitorStockGanadero } from "../../api";
import type {
  CuentaStockGanaderoMonitorResumen,
  HomeLayoutMonitorStockGanaderoSnapshot,
  StockEspecieMonitorResumen,
} from "../../types";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";
import { HomeLayoutMonitorEspecieStockBlock } from "./HomeLayoutMonitorStockBlocks";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  /** Incrementar para forzar recarga (p.ej. botón Actualizar del monitor). */
  refreshKey?: number;
  /** Cuenta resaltada (p.ej. la del usuario seleccionado). */
  selectedCuentaId?: number | null;
  onSelectCuenta?: (cuentaId: number) => void;
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

const EMPTY_ESPECIE: StockEspecieMonitorResumen = {
  total: 0,
  machos: 0,
  hembras: 0,
  sin_definir: 0,
  categorias: [],
};

const EMPTY_TOTALES: HomeLayoutMonitorStockGanaderoSnapshot["totales"] = {
  total: 0,
  machos: 0,
  hembras: 0,
  sin_definir: 0,
  cuentas_con_stock: 0,
  categorias: [],
  equino: { ...EMPTY_ESPECIE, cuentas_con_stock: 0 },
  total_animales: 0,
};

export default function HomeLayoutMonitorStockSection({
  apiOnline,
  onError,
  refreshKey = 0,
  selectedCuentaId = null,
  onSelectCuenta,
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
      onError(e instanceof Error ? e.message : "Error al cargar stock de cuentas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (selectedCuentaId != null && selectedCuentaId > 0) {
      setExpandedId(selectedCuentaId);
    }
  }, [selectedCuentaId]);

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const base = data?.cuentas ?? [];
    return base.filter((row) => {
      if (filtroEstado === "activo" && !row.activo) return false;
      if (filtroEstado === "inactivo" && row.activo) return false;
      if (filtroConStock && row.total_animales <= 0) return false;
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
    if (row.total_animales <= 0) return;
    const next = expandedId === row.cuenta_id ? null : row.cuenta_id;
    setExpandedId(next);
    if (next != null) onSelectCuenta?.(next);
  };

  return (
    <section
      className="home-layout-monitor-stock"
      aria-labelledby="home-layout-monitor-stock-title"
    >
      <header className="home-layout-monitor-stock-head">
        <div>
          <p className="sg-hub-panel-kicker">Stock ganadero y equino · Plataforma</p>
          <h3 id="home-layout-monitor-stock-title" className="home-layout-monitor-stock-title">
            Stock de las cuentas
          </h3>
          <p className="muted home-layout-monitor-stock-lead">
            Animales activos por cuenta madre: ganadero y equino, con totales, macho / hembra y
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
        aria-label="Totales de stock"
        style={{ "--home-hub-kpi-cols": "5" } as CSSProperties}
      >
        <SgHubKpi
          variant="dark"
          kicker="Total activos"
          value={kpiPlaceholder ?? fmtEntero(totales.total_animales)}
          hint="Ganadero + equino en todas las cuentas"
          trend="Plataforma"
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          kicker="Ganadero"
          value={kpiPlaceholder ?? fmtEntero(totales.total)}
          hint={
            kpiPlaceholder
              ? "—"
              : totales.total_animales > 0
                ? `${Math.round((totales.total / totales.total_animales) * 100)}% del total`
                : "Sin stock"
          }
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          kicker="Equino"
          value={kpiPlaceholder ?? fmtEntero(totales.equino.total)}
          hint={
            kpiPlaceholder
              ? "—"
              : totales.total_animales > 0
                ? `${Math.round((totales.equino.total / totales.total_animales) * 100)}% del total`
                : "Sin stock"
          }
          bars={<SgMiniBars />}
        />
        <SgHubKpi
          kicker="Hembras"
          value={kpiPlaceholder ?? fmtEntero(totales.hembras + totales.equino.hembras)}
          hint="Ganadero + equino"
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
        <div className="home-layout-monitor-stock-cats" aria-label="Ganadero por categoría">
          <span className="home-layout-monitor-stock-cats-label muted">Ganadero:</span>
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

      {totales.equino.categorias.length > 0 && !loading ? (
        <div className="home-layout-monitor-stock-cats" aria-label="Equino por categoría">
          <span className="home-layout-monitor-stock-cats-label muted">Equino:</span>
          {totales.equino.categorias.map((cat) => (
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
          <p className="home-layout-users-monitor-empty muted">Cargando stock de cuentas…</p>
        ) : filas.length === 0 ? (
          <div className="home-layout-monitor-stock-empty">
            <Beef size={26} strokeWidth={1.5} aria-hidden />
            <p className="muted">
              {hayFiltros
                ? "Ninguna cuenta coincide con los filtros."
                : "No hay cuentas con stock cargado."}
            </p>
          </div>
        ) : (
          <table className="home-layout-monitor-stock-table">
            <thead>
              <tr>
                <th scope="col">Cuenta</th>
                <th scope="col">Estado</th>
                <th scope="col" className="is-num">
                  Ganadero
                </th>
                <th scope="col" className="is-num">
                  Equino
                </th>
                <th scope="col" className="is-num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((row) => {
                const open = expandedId === row.cuenta_id;
                const selected = selectedCuentaId === row.cuenta_id;
                return (
                  <Fragment key={row.cuenta_id}>
                    <tr
                      className={`${row.total_animales > 0 ? "is-clickable" : ""}${
                        !row.activo ? " is-off" : ""
                      }${open ? " is-open" : ""}${selected ? " is-selected" : ""}`}
                      onClick={() => toggleExpand(row)}
                    >
                      <th scope="row">
                        <span className="home-layout-monitor-stock-cuenta">
                          {row.total_animales > 0 ? (
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
                      <td className="is-num">{fmtEntero(row.total)}</td>
                      <td className="is-num">{fmtEntero(row.equino.total)}</td>
                      <td className="is-num is-total">{fmtEntero(row.total_animales)}</td>
                    </tr>
                    {open ? (
                      <tr className="home-layout-monitor-stock-detail-row">
                        <td colSpan={5}>
                          <div className="home-layout-monitor-cuenta-stock-grid home-layout-monitor-cuenta-stock-grid--inline">
                            <HomeLayoutMonitorEspecieStockBlock
                              kicker="Ganadero"
                              titulo={row.nombre}
                              especie={{
                                total: row.total,
                                machos: row.machos,
                                hembras: row.hembras,
                                sin_definir: row.sin_definir,
                                categorias: row.categorias,
                              }}
                            />
                            <HomeLayoutMonitorEspecieStockBlock
                              kicker="Equino"
                              titulo={row.nombre}
                              especie={row.equino}
                            />
                          </div>
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
                <td className="is-num">{fmtEntero(filas.reduce((s, r) => s + r.total, 0))}</td>
                <td className="is-num">
                  {fmtEntero(filas.reduce((s, r) => s + r.equino.total, 0))}
                </td>
                <td className="is-num is-total">
                  {fmtEntero(filas.reduce((s, r) => s + r.total_animales, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </section>
  );
}
