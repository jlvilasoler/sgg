import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchStockMovimientosAuditoria, fetchUsuarios } from "../../api";
import type {
  AuthUser,
  StockMovimientoAuditoria,
  StockMovimientoBajaDispositivo,
  StockMovimientoTipo,
} from "../../types";

const TIPO_LABELS: Record<StockMovimientoTipo, string> = {
  ALTA: "Alta",
  BAJA: "Baja",
  MODIFICACION: "Modificación",
};

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onVolver: () => void;
}

function fmtFecha(iso: string): { fecha: string; hora: string } {
  try {
    const d = new Date(iso.replace(" ", "T"));
    return {
      fecha: d.toLocaleDateString("es-UY", { dateStyle: "short" }),
      hora: d.toLocaleTimeString("es-UY", { timeStyle: "short" }),
    };
  } catch {
    return { fecha: iso, hora: "" };
  }
}

function fmtFechaSolo(iso: string): string {
  if (!iso?.trim()) return "—";
  try {
    const d = new Date(`${iso.trim().slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-UY", { dateStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtTiempoEnSistema(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || Number.isNaN(dias)) return "—";
  if (dias < 30) return `${dias} día${dias === 1 ? "" : "s"}`;
  const meses = Math.floor(dias / 30.44);
  if (meses < 12) return `${meses} mes${meses === 1 ? "" : "es"}`;
  const anios = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  if (mesesRest === 0) return `${anios} año${anios === 1 ? "" : "s"}`;
  return `${anios} año${anios === 1 ? "" : "s"} ${mesesRest} mes${mesesRest === 1 ? "" : "es"}`;
}

function bajaDispositivoDeFila(
  row: StockMovimientoAuditoria
): StockMovimientoBajaDispositivo | null {
  if (row.baja_dispositivo) return row.baja_dispositivo;
  if (!row.detalle?.trim()) return null;
  try {
    const json = JSON.parse(row.detalle) as { dispositivo?: StockMovimientoBajaDispositivo };
    if (json.dispositivo?.numero) return json.dispositivo;
  } catch {
    /* detalle no JSON */
  }
  return null;
}

export default function StockMovimientosAuditoria({
  apiOnline,
  onError,
  onVolver: _onVolver,
}: Props) {
  const [usuarios, setUsuarios] = useState<AuthUser[]>([]);
  const [rows, setRows] = useState<StockMovimientoAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<"" | StockMovimientoTipo>("");
  const [filtroUserId, setFiltroUserId] = useState("");

  useEffect(() => {
    if (!apiOnline) {
      setUsuarios([]);
      return;
    }
    void fetchUsuarios()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, [apiOnline]);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const user_id = filtroUserId ? Number(filtroUserId) : undefined;
      const data = await fetchStockMovimientosAuditoria({
        tipo: filtroTipo || undefined,
        user_id: Number.isFinite(user_id) ? user_id : undefined,
        limite: 100,
      });
      setRows(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar movimientos");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, filtroTipo, filtroUserId, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetFiltros = () => {
    setFiltroTipo("");
    setFiltroUserId("");
  };

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        if (row.tipo === "ALTA") acc.altas += 1;
        else if (row.tipo === "BAJA") acc.bajas += 1;
        else acc.modificaciones += 1;
        return acc;
      },
      { total: 0, altas: 0, bajas: 0, modificaciones: 0 }
    );
  }, [rows]);

  const vistaBajas = filtroTipo === "BAJA" || rows.some((r) => r.tipo === "BAJA");
  const colCount = vistaBajas ? 8 : 5;

  const subtitulo = loading
    ? "Actualizando…"
    : !apiOnline
      ? "Sin conexión con la API"
      : rows.length === 0
        ? "Sin movimientos registrados — las altas, bajas y ediciones aparecerán aquí automáticamente"
        : `${stats.total} movimiento${stats.total === 1 ? "" : "s"} en el listado filtrado (últimos 100)`;

  return (
    <div className="listado-pro stock-mov-auditoria">
      <div className="listado-pro-shell">
        <header className="listado-pro-head">
          <div className="listado-pro-head-main">
            <h2 className="listado-pro-head-title">Movimientos de Dispositivos</h2>
            <p className="listado-pro-head-sub">{subtitulo}</p>
          </div>
        </header>

        <div className="filters listado-pro-filters stock-mov-auditoria-filters">
          <div className="field">
            <label htmlFor="sm-filtro-tipo">Tipo</label>
            <select
              id="sm-filtro-tipo"
              value={filtroTipo}
              disabled={!apiOnline || loading}
              onChange={(e) => setFiltroTipo(e.target.value as "" | StockMovimientoTipo)}
            >
              <option value="">Todos</option>
              <option value="ALTA">Altas</option>
              <option value="BAJA">Bajas</option>
              <option value="MODIFICACION">Modificaciones</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sm-filtro-usuario">Usuario</label>
            <select
              id="sm-filtro-usuario"
              value={filtroUserId}
              disabled={!apiOnline || loading}
              onChange={(e) => setFiltroUserId(e.target.value)}
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn listado-pro-reset-btn"
            disabled={!apiOnline || loading || (!filtroTipo && !filtroUserId)}
            onClick={resetFiltros}
          >
            Limpiar
          </button>
          <button
            type="button"
            className="btn btn-primary listado-pro-search-btn"
            disabled={!apiOnline || loading}
            onClick={() => void load()}
          >
            Actualizar
          </button>
        </div>

        <section
          className="listado-indicadores listado-pro-indicadores stock-mov-auditoria-kpis"
          aria-label="Resumen de movimientos"
        >
          <div className="stock-mov-auditoria-kpi-grid">
            <div className="stock-mov-auditoria-kpi stock-mov-auditoria-kpi--total">
              <span className="stock-mov-auditoria-kpi-label">Movimientos</span>
              <span className="stock-mov-auditoria-kpi-valor">
                {loading || !apiOnline ? "—" : stats.total}
              </span>
            </div>
            <div className="stock-mov-auditoria-kpi stock-mov-auditoria-kpi--alta">
              <span className="stock-mov-auditoria-kpi-label">Altas</span>
              <span className="stock-mov-auditoria-kpi-valor">
                {loading || !apiOnline ? "—" : stats.altas}
              </span>
            </div>
            <div className="stock-mov-auditoria-kpi stock-mov-auditoria-kpi--baja">
              <span className="stock-mov-auditoria-kpi-label">Bajas</span>
              <span className="stock-mov-auditoria-kpi-valor">
                {loading || !apiOnline ? "—" : stats.bajas}
              </span>
            </div>
            <div className="stock-mov-auditoria-kpi stock-mov-auditoria-kpi--mod">
              <span className="stock-mov-auditoria-kpi-label">Modificaciones</span>
              <span className="stock-mov-auditoria-kpi-valor">
                {loading || !apiOnline ? "—" : stats.modificaciones}
              </span>
            </div>
          </div>
        </section>

        <div className="table-wrap listado-pro-table-wrap stock-mov-auditoria-table-wrap">
          <table className="data-table listado-pro-table stock-mov-auditoria-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                {vistaBajas ? (
                  <>
                    <th>Tipo</th>
                    <th>Dispositivo</th>
                    <th>Alta</th>
                    <th>Baja</th>
                    <th>Tiempo en sistema</th>
                    <th>Categoría al salir</th>
                  </>
                ) : (
                  <>
                    <th>Tipo</th>
                    <th className="num">Cant.</th>
                    <th>Resumen</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="stock-mov-auditoria-empty-cell">
                    <div className="stock-mov-auditoria-empty-msg">Cargando movimientos…</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="stock-mov-auditoria-empty-cell">
                    <div className="stock-mov-auditoria-empty" role="status">
                      <span className="stock-mov-auditoria-empty-icon" aria-hidden="true">
                        📒
                      </span>
                      <span>Sin movimientos registrados todavía</span>
                      <span className="muted">
                        Las altas, bajas y ediciones de caravanas aparecerán aquí automáticamente.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const { fecha, hora } = fmtFecha(row.creado_en);
                  const baja = row.tipo === "BAJA" ? bajaDispositivoDeFila(row) : null;

                  return (
                    <tr key={row.id} className="listado-pro-row">
                      <td className="td-fecha stock-mov-auditoria-fecha">
                        <span className="stock-mov-auditoria-fecha-dia">{fecha}</span>
                        {hora ? (
                          <span className="stock-mov-auditoria-fecha-hora muted">{hora}</span>
                        ) : null}
                      </td>
                      <td className="stock-mov-auditoria-usuario">
                        <strong>{row.user_nombre || "—"}</strong>
                        {row.user_email ? (
                          <span className="stock-mov-auditoria-email muted">{row.user_email}</span>
                        ) : null}
                      </td>
                      {vistaBajas ? (
                        <>
                          <td>
                            <span
                              className={`stock-mov-auditoria-tipo stock-mov-auditoria-tipo--${row.tipo.toLowerCase()}`}
                            >
                              {TIPO_LABELS[row.tipo]}
                            </span>
                          </td>
                          {row.tipo === "BAJA" ? (
                            <>
                              <td className="stock-mov-auditoria-dispositivo num">
                                <strong>{baja?.numero || row.clave || "—"}</strong>
                                {baja?.eid ? (
                                  <span className="muted stock-mov-auditoria-eid">
                                    EID {baja.eid}
                                  </span>
                                ) : null}
                              </td>
                              <td>{fmtFechaSolo(baja?.primera_fecha ?? "")}</td>
                              <td>{fmtFechaSolo(baja?.fecha_baja ?? "")}</td>
                              <td>{fmtTiempoEnSistema(baja?.dias_en_sistema)}</td>
                              <td>{baja?.categoria || "—"}</td>
                            </>
                          ) : (
                            <td colSpan={5} className="stock-mov-auditoria-resumen">
                              <span className="stock-mov-auditoria-resumen-text">{row.resumen}</span>
                            </td>
                          )}
                        </>
                      ) : (
                        <>
                          <td>
                            <span
                              className={`stock-mov-auditoria-tipo stock-mov-auditoria-tipo--${row.tipo.toLowerCase()}`}
                            >
                              {TIPO_LABELS[row.tipo]}
                            </span>
                          </td>
                          <td className="num listado-pro-num">{row.cantidad}</td>
                          <td className="stock-mov-auditoria-resumen">
                            <span className="stock-mov-auditoria-resumen-text">{row.resumen}</span>
                            {row.clave ? (
                              <span className="stock-mov-auditoria-clave muted num">{row.clave}</span>
                            ) : null}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
