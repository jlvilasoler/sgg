import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  fetchBillingAdminOverview,
  syncBillingAdminAll,
  type BillingAdminResumen,
  type BillingEventoRow,
  type SuscripcionAdminRow,
} from "../../api";
import TablePagination, { type PageSize } from "../TablePagination";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const EMPTY_RESUMEN: BillingAdminResumen = {
  total_cuentas: 0,
  con_suscripcion: 0,
  trial: 0,
  pending: 0,
  authorized: 0,
  paused: 0,
  cancelled: 0,
  sin_registro: 0,
  mrr_estimado_uyu: 0,
};

const REFRESH_MS = 30_000;

function fmtPesos(n: number): string {
  return n.toLocaleString("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  });
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estadoLabel(estado: SuscripcionAdminRow["estado"]): string {
  const map: Record<SuscripcionAdminRow["estado"], string> = {
    sin_registro: "Sin registro",
    trial: "Prueba",
    pending: "Pendiente",
    authorized: "Activa",
    paused: "Pausada",
    cancelled: "Cancelada",
  };
  return map[estado] ?? estado;
}

function estadoClass(estado: SuscripcionAdminRow["estado"]): string {
  if (estado === "authorized") return "billing-admin-estado--ok";
  if (estado === "trial") return "billing-admin-estado--trial";
  if (estado === "pending") return "billing-admin-estado--pending";
  if (estado === "cancelled") return "billing-admin-estado--cancelled";
  if (estado === "sin_registro") return "billing-admin-estado--muted";
  return "";
}

export default function BillingAdminSuscripciones({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [resumen, setResumen] = useState<BillingAdminResumen>(EMPTY_RESUMEN);
  const [cuentas, setCuentas] = useState<SuscripcionAdminRow[]>([]);
  const [eventos, setEventos] = useState<BillingEventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [mpConfigurado, setMpConfigurado] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | SuscripcionAdminRow["estado"]>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchBillingAdminOverview();
      setResumen(data.resumen);
      setCuentas(data.cuentas);
      setEventos(data.eventos);
      setSandbox(data.sandbox);
      setMpConfigurado(data.mercadopago_configurado);
      setUltimaActualizacion(new Date(data.actualizado_en));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar suscripciones");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!apiOnline) return;
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [apiOnline, load]);

  const filas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return cuentas.filter((row) => {
      if (filtroEstado && row.estado !== filtroEstado) return false;
      if (!q) return true;
      return (
        row.cuenta_nombre.toLowerCase().includes(q) ||
        row.cuenta_codigo.toLowerCase().includes(q) ||
        (row.plan_nombre ?? "").toLowerCase().includes(q) ||
        (row.mp_preapproval_id ?? "").toLowerCase().includes(q)
      );
    });
  }, [cuentas, filtroTexto, filtroEstado]);

  useEffect(() => {
    setPage(1);
  }, [filtroTexto, filtroEstado, pageSize]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filas.slice(start, start + pageSize);
  }, [filas, page, pageSize]);

  const handleSyncAll = async () => {
    if (!apiOnline || !mpConfigurado) return;
    setSyncing(true);
    try {
      const result = await syncBillingAdminAll();
      await load();
      onSuccess(
        `Sincronizadas ${result.actualizadas} de ${result.procesadas} suscripciones con Mercado Pago`
      );
      if (result.errores.length > 0) {
        onError(`${result.errores.length} cuenta(s) con error al sincronizar`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="subseccion-panel billing-admin-overview-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración SAG
      </button>

      <div className="billing-admin-overview-head">
        <div>
          <h2 className="billing-admin-overview-title">
            <CreditCard size={20} aria-hidden />
            Suscripciones en tiempo real
          </h2>
          <p className="muted billing-admin-overview-lead">
            Estado de todas las cuentas · actualización automática cada 30 s
          </p>
        </div>
        <div className="billing-admin-overview-actions">
          {sandbox ? <span className="billing-sandbox-badge">Modo test</span> : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            disabled={loading || !apiOnline}
          >
            <RefreshCw size={15} aria-hidden />
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSyncAll()}
            disabled={syncing || !apiOnline || !mpConfigurado}
          >
            {syncing ? "Sincronizando…" : "Sync Mercado Pago"}
          </button>
        </div>
      </div>

      {ultimaActualizacion ? (
        <p className="billing-admin-updated muted">
          Última actualización: {fmtFecha(ultimaActualizacion.toISOString())}
        </p>
      ) : null}

      <section className="billing-admin-kpi-strip" aria-label="Resumen de suscripciones">
        <article className="billing-admin-kpi billing-admin-kpi--dark">
          <Users size={16} aria-hidden />
          <span className="billing-admin-kpi-label">Cuentas</span>
          <strong>{resumen.total_cuentas}</strong>
        </article>
        <article className="billing-admin-kpi billing-admin-kpi--dark">
          <ShieldCheck size={16} aria-hidden />
          <span className="billing-admin-kpi-label">Activas</span>
          <strong>{resumen.authorized}</strong>
        </article>
        <article className="billing-admin-kpi">
          <Activity size={16} aria-hidden />
          <span className="billing-admin-kpi-label">En prueba</span>
          <strong>{resumen.trial}</strong>
        </article>
        <article className="billing-admin-kpi">
          <TrendingUp size={16} aria-hidden />
          <span className="billing-admin-kpi-label">MRR estimado</span>
          <strong>{fmtPesos(resumen.mrr_estimado_uyu)}</strong>
        </article>
      </section>

      <div className="billing-admin-filters">
        <label className="billing-admin-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Buscar cuenta, plan o ID MP…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </label>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as "" | SuscripcionAdminRow["estado"])}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="authorized">Activas</option>
          <option value="trial">En prueba</option>
          <option value="pending">Pendientes</option>
          <option value="paused">Pausadas</option>
          <option value="cancelled">Canceladas</option>
          <option value="sin_registro">Sin registro</option>
        </select>
      </div>

      <div className="card billing-admin-table-card">
        {loading && cuentas.length === 0 ? (
          <p className="muted" aria-busy="true">
            Cargando suscripciones…
          </p>
        ) : !apiOnline ? (
          <p className="muted">Sin conexión con la API.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data-table billing-admin-table">
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Plan</th>
                    <th>Estado</th>
                    <th>Prueba / cobro</th>
                    <th>MP ID</th>
                    <th>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.cuenta_id}>
                      <td>
                        <strong>{row.cuenta_nombre}</strong>
                        <div className="muted billing-admin-sub">
                          {row.cuenta_codigo}
                          {!row.cuenta_activa ? " · inactiva" : ""}
                        </div>
                      </td>
                      <td>
                        {row.plan_nombre ?? "—"}
                        {row.precio_mensual != null ? (
                          <div className="muted billing-admin-sub">
                            {fmtPesos(row.precio_mensual)}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={`billing-admin-estado ${estadoClass(row.estado)}`}>
                          {estadoLabel(row.estado)}
                        </span>
                      </td>
                      <td>
                        {row.estado === "trial" && row.trial_dias_restantes != null
                          ? `${row.trial_dias_restantes} d restantes`
                          : row.proximo_cobro ?? row.trial_hasta ?? "—"}
                      </td>
                      <td className="billing-admin-mp-cell">
                        {row.mp_preapproval_id ? (
                          <code>{row.mp_preapproval_id}</code>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{fmtFecha(row.actualizado_en)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={filas.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>

      <section className="card billing-admin-events-card">
        <h3 className="billing-admin-events-title">Eventos recientes</h3>
        {eventos.length === 0 ? (
          <p className="muted">Sin eventos de billing todavía.</p>
        ) : (
          <ul className="billing-admin-events-list">
            {eventos.map((ev) => (
              <li key={ev.id}>
                <span className="billing-admin-event-time">{fmtFecha(ev.creado_en)}</span>
                <span className="billing-admin-event-tipo">{ev.tipo}</span>
                <span className="billing-admin-event-cuenta">
                  {ev.cuenta_nombre ?? (ev.cuenta_id != null ? `Cuenta ${ev.cuenta_id}` : "—")}
                </span>
                {ev.mp_resource_id ? (
                  <code className="billing-admin-event-id">{ev.mp_resource_id}</code>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
