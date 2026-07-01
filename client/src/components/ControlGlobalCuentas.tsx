import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCuentasControlResumen } from "../api";
import type { CuentaControlResumen, CuentasControlPlataformaResumen } from "../types";
import { PageModuleHeadRow } from "./PageModuleHead";
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

  const load = useCallback(async () => {
    if (!apiOnline) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchCuentasControlResumen());
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

  const subtitulo = loading
    ? "Calculando totales por cuenta…"
    : !apiOnline
      ? "Sin conexión con la API"
      : hayFiltros
        ? `${filas.length} de ${data?.cuentas.length ?? 0} cuenta(s) en pantalla`
        : "Solo lectura · animales registrados y gastos cargados por cada cuenta madre";

  return (
    <div className="subseccion-panel usuarios-admin control-global-cuentas">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <div className="card usuarios-panel listado-pro-shell">
        <header className="listado-pro-head usuarios-admin-head">
          <div className="listado-pro-head-main">
            <PageModuleHeadRow
              icon={{ source: "app", id: "resumen" }}
              title="Control global de cuentas"
              subtitle={subtitulo}
              titleClassName="listado-pro-head-title"
              subClassName="listado-pro-head-sub"
              textClassName="listado-pro-head-text"
            />
          </div>
          <div className="usuarios-head-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!apiOnline || loading}
              onClick={() => void load()}
            >
              Actualizar
            </button>
          </div>
        </header>

        <section className="usuarios-admin-dashboard" aria-label="Totales de plataforma">
          <div className="usuarios-admin-kpi-grid">
            <article className="usuarios-admin-kpi usuarios-admin-kpi--hero">
              <span className="usuarios-admin-kpi-label">Animales totales</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : fmtEntero(totales.animales_total)}
              </span>
              <span className="usuarios-admin-kpi-hint">
                Ganadero {loading || !apiOnline ? "—" : fmtEntero(totales.animales_ganadero)} · Equino{" "}
                {loading || !apiOnline ? "—" : fmtEntero(totales.animales_equino)}
              </span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--activos">
              <span className="usuarios-admin-kpi-label">Gastos registrados</span>
              <span className="usuarios-admin-kpi-valor">
                {loading || !apiOnline ? "—" : fmtEntero(totales.gastos_registros)}
              </span>
              <span className="usuarios-admin-kpi-hint">Movimientos en presupuesto</span>
            </article>
            <article className="usuarios-admin-kpi usuarios-admin-kpi--inactivos">
              <span className="usuarios-admin-kpi-label">Monto en pesos</span>
              <span className="usuarios-admin-kpi-valor control-global-cuentas-kpi-monto">
                {loading || !apiOnline ? "—" : fmtPesos(totales.gastos_pesos)}
              </span>
              <span className="usuarios-admin-kpi-hint">Suma del campo pesos por cuenta</span>
            </article>
          </div>
        </section>

        <div className="listado-pro-filtros control-global-cuentas-filtros">
          <label className="listado-pro-filtro">
            <span>Buscar cuenta</span>
            <input
              type="search"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Nombre, código o nº de cuenta"
              disabled={!apiOnline || loading}
            />
          </label>
          <label className="listado-pro-filtro">
            <span>Estado</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as "" | "activo" | "inactivo")}
              disabled={!apiOnline || loading}
            >
              <option value="">Todas</option>
              <option value="activo">Activas</option>
              <option value="inactivo">Inactivas</option>
            </select>
          </label>
          {hayFiltros ? (
            <button
              type="button"
              className="btn btn-ghost listado-pro-filtros-clear"
              onClick={() => {
                setFiltroTexto("");
                setFiltroEstado("");
              }}
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <div className="listado-pro-table-wrap">
          <table className="listado-pro-table control-global-cuentas-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Nº cuenta</th>
                <th className="num">Ganadero</th>
                <th className="num">Equino</th>
                <th className="num">Animales</th>
                <th className="num">Gastos</th>
                <th className="num">Pesos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="listado-pro-empty">
                    Cargando resumen…
                  </td>
                </tr>
              ) : !apiOnline ? (
                <tr>
                  <td colSpan={8} className="listado-pro-empty">
                    Sin conexión con el servidor
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="listado-pro-empty">
                    No hay cuentas que coincidan con el filtro
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => <FilaCuenta key={row.cuenta_id} row={row} />)
              )}
            </tbody>
            {!loading && apiOnline && filas.length > 0 ? (
              <tfoot>
                <tr className="control-global-cuentas-total-row">
                  <td colSpan={2}>
                    <strong>Total plataforma</strong>
                  </td>
                  <td className="num">{fmtEntero(totales.animales_ganadero)}</td>
                  <td className="num">{fmtEntero(totales.animales_equino)}</td>
                  <td className="num">{fmtEntero(totales.animales_total)}</td>
                  <td className="num">{fmtEntero(totales.gastos_registros)}</td>
                  <td className="num">{fmtPesos(totales.gastos_pesos)}</td>
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
      </div>
    </div>
  );
}

function FilaCuenta({ row }: { row: CuentaControlResumen }) {
  return (
    <tr>
      <td>
        <div className="control-global-cuentas-nombre">{row.nombre}</div>
        <div className="control-global-cuentas-codigo">{row.codigo}</div>
      </td>
      <td>{row.cuenta_numero}</td>
      <td className="num">{fmtEntero(row.animales_ganadero)}</td>
      <td className="num">{fmtEntero(row.animales_equino)}</td>
      <td className="num">
        <strong>{fmtEntero(row.animales_total)}</strong>
      </td>
      <td className="num">{fmtEntero(row.gastos_registros)}</td>
      <td className="num">{fmtPesos(row.gastos_pesos)}</td>
      <td>
        <span
          className={`usuarios-estado-pill ${row.activo ? "usuarios-estado-pill--activo" : "usuarios-estado-pill--inactivo"}`}
        >
          {row.activo ? "Activa" : "Inactiva"}
        </span>
      </td>
    </tr>
  );
}
