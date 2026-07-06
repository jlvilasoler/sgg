import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  fetchBillingConfig,
  fetchBillingPlans,
  fetchBillingSuscripcion,
  startBillingCheckout,
  syncBillingSuscripcion,
  type BillingPlan,
  type BillingSuscripcionResponse,
} from "../api";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

function formatPrecio(plan: BillingPlan): string {
  const n = new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: plan.moneda || "UYU",
    maximumFractionDigits: 0,
  }).format(plan.precio_mensual);
  return `${n} / mes`;
}

function estadoLabel(estado: string): string {
  const map: Record<string, string> = {
    trial: "Período de prueba",
    pending: "Pendiente de autorización",
    authorized: "Activa",
    paused: "Pausada",
    cancelled: "Cancelada",
  };
  return map[estado] ?? estado;
}

function estadoClass(estado: string): string {
  if (estado === "authorized") return "billing-estado--ok";
  if (estado === "trial") return "billing-estado--trial";
  if (estado === "pending") return "billing-estado--pending";
  if (estado === "cancelled") return "billing-estado--cancelled";
  return "";
}

export default function SuscripcionCuenta({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [data, setData] = useState<BillingSuscripcionResponse | null>(null);
  const [mpConfigurado, setMpConfigurado] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [mensajeCheckout, setMensajeCheckout] = useState("");
  const [colorAcento, setColorAcento] = useState("#7cb342");

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [config, planList, suscripcion] = await Promise.all([
        fetchBillingConfig(),
        fetchBillingPlans(),
        fetchBillingSuscripcion(),
      ]);
      setMpConfigurado(config.mercadopago_configurado);
      setSandbox(config.sandbox);
      setMensajeCheckout(config.tema?.mensaje_checkout ?? "");
      setColorAcento(config.tema?.color_acento ?? "#7cb342");
      setPlans(planList);
      setData(suscripcion);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar suscripción");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  const runSync = useCallback(async () => {
    if (!apiOnline) return;
    setSyncing(true);
    try {
      const result = await syncBillingSuscripcion();
      setData((prev) =>
        prev
          ? {
              ...prev,
              suscripcion: result.suscripcion,
              plan: result.plan,
              activa: result.activa,
              trial_dias_restantes: result.trial_dias_restantes,
            }
          : prev
      );
      if (!result.sin_cambios) {
        onSuccess("Estado de suscripción actualizado desde Mercado Pago");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [apiOnline, onError, onSuccess]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "ok") return;
    void runSync().finally(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    });
  }, [runSync]);

  const handleCheckout = async (planCodigo: string) => {
    if (!apiOnline) return;
    setCheckoutPlan(planCodigo);
    try {
      const { init_point } = await startBillingCheckout(planCodigo);
      window.location.href = init_point;
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo iniciar el pago");
      setCheckoutPlan(null);
    }
  };

  const suscripcion = data?.suscripcion;
  const planActual = data?.plan;

  return (
    <div
      className="subseccion-panel billing-suscripcion-panel"
      style={{ "--billing-accent": colorAcento } as CSSProperties}
    >
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración
      </button>

      <div className="card billing-suscripcion-card">
        <div className="billing-suscripcion-header">
          <div>
            <h2 className="billing-suscripcion-title">Suscripción</h2>
            <p className="muted billing-suscripcion-lead">
              {mensajeCheckout ||
                "Pagos con tarjeta vía Mercado Pago. En modo test no hay cobros reales."}
            </p>
          </div>
          {sandbox && (
            <span className="billing-sandbox-badge" title="Credenciales TEST de Mercado Pago">
              Modo test
            </span>
          )}
        </div>

        {loading ? (
          <p className="muted" aria-busy="true">
            Cargando…
          </p>
        ) : !apiOnline ? (
          <p className="muted">Sin conexión con la API.</p>
        ) : (
          <>
            {suscripcion && (
              <div className={`billing-estado-resumen ${estadoClass(suscripcion.estado)}`}>
                <div>
                  <span className="billing-estado-label">Estado</span>
                  <strong>{estadoLabel(suscripcion.estado)}</strong>
                </div>
                {planActual && (
                  <div>
                    <span className="billing-estado-label">Plan</span>
                    <strong>{planActual.nombre}</strong>
                  </div>
                )}
                {suscripcion.estado === "trial" && data?.trial_dias_restantes != null && (
                  <div>
                    <span className="billing-estado-label">Prueba</span>
                    <strong>{data.trial_dias_restantes} días restantes</strong>
                  </div>
                )}
                {suscripcion.proximo_cobro && (
                  <div>
                    <span className="billing-estado-label">Próximo cobro</span>
                    <strong>{suscripcion.proximo_cobro}</strong>
                  </div>
                )}
              </div>
            )}

            {!mpConfigurado && (
              <div className="billing-mp-hint billing-mp-hint--warn">
                <strong>Mercado Pago no configurado en el servidor.</strong>
                <p>
                  Agregá <code>MP_ACCESS_TOKEN</code> y <code>MP_PUBLIC_KEY</code> (prefijo{" "}
                  <code>TEST-</code>) en <code>server/.env</code>. Ver{" "}
                  <code>server/.env.example</code>.
                </p>
              </div>
            )}

            <div className="billing-plans-grid">
              {plans.map((plan) => {
                const esActual = suscripcion?.plan_codigo === plan.codigo;
                const enCheckout = checkoutPlan === plan.codigo;
                return (
                  <article
                    key={plan.codigo}
                    className={`billing-plan-card${esActual ? " is-current" : ""}`}
                  >
                    <h3>{plan.nombre}</h3>
                    <p className="billing-plan-precio">{formatPrecio(plan)}</p>
                    <p className="muted billing-plan-desc">{plan.descripcion}</p>
                    <button
                      type="button"
                      className="btn btn-primary billing-plan-cta"
                      disabled={!mpConfigurado || enCheckout || esActual}
                      onClick={() => void handleCheckout(plan.codigo)}
                    >
                      {esActual
                        ? "Plan actual"
                        : enCheckout
                          ? "Redirigiendo…"
                          : "Suscribirse con Mercado Pago"}
                    </button>
                  </article>
                );
              })}
            </div>

            {mpConfigurado && (
              <div className="billing-mp-hint">
                <strong>Cómo probar sin cobros reales</strong>
                <ul>
                  <li>
                    Usá un usuario de prueba de Mercado Pago (panel de desarrolladores → Cuentas de
                    prueba).
                  </li>
                  <li>
                    Tarjeta de prueba: <code>5031 4332 1540 6351</code> · CVV <code>123</code> ·
                    vencimiento futuro.
                  </li>
                  <li>
                    Al volver de Mercado Pago, el estado se sincroniza automáticamente. También podés
                    usar el botón de abajo.
                  </li>
                </ul>
                <button
                  type="button"
                  className="btn btn-secondary billing-sync-btn"
                  disabled={syncing || !suscripcion?.mp_preapproval_id}
                  onClick={() => void runSync()}
                >
                  {syncing ? "Sincronizando…" : "Sincronizar con Mercado Pago"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
