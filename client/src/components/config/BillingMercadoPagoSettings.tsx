import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { CreditCard, RefreshCw, Save } from "lucide-react";
import {
  fetchBillingAdminSettings,
  updateBillingAdminSettings,
  type BillingSettings,
} from "../../api";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
}

const DEFAULT_FORM: BillingSettings = {
  marca: "SAG",
  motivo_plantilla: "{marca} {plan} — {cuenta}",
  url_retorno_path: "/?billing=ok",
  mensaje_checkout: "",
  color_acento: "#7cb342",
  trial_dias: null,
  actualizado_en: null,
};

export default function BillingMercadoPagoSettings({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<BillingSettings>(DEFAULT_FORM);
  const [mpConfigurado, setMpConfigurado] = useState(false);
  const [sandbox, setSandbox] = useState(true);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchBillingAdminSettings();
      setForm(data.settings);
      setMpConfigurado(data.mercadopago_configurado);
      setSandbox(data.sandbox);
      setPublicKey(data.public_key);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar configuración");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const previewMotivo = useMemo(() => {
    return form.motivo_plantilla
      .replaceAll("{marca}", form.marca || "SAG")
      .replaceAll("{plan}", "Pro")
      .replaceAll("{cuenta}", "Estancia Ejemplo");
  }, [form.marca, form.motivo_plantilla]);

  const handleSave = async () => {
    if (!apiOnline) return;
    setSaving(true);
    try {
      const settings = await updateBillingAdminSettings({
        marca: form.marca,
        motivo_plantilla: form.motivo_plantilla,
        url_retorno_path: form.url_retorno_path,
        mensaje_checkout: form.mensaje_checkout,
        color_acento: form.color_acento,
        trial_dias: form.trial_dias,
      });
      setForm(settings);
      onSuccess("Configuración de Mercado Pago guardada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="subseccion-panel billing-mp-settings">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración SAG
      </button>

      <section className="sg-hub-panel billing-mp-settings-panel" aria-labelledby="billing-mp-settings-title">
        <header className="sg-hub-panel-head billing-mp-settings-head">
          <div className="billing-mp-settings-head-copy">
            <p className="sg-hub-panel-kicker">Suscripciones</p>
            <h2 id="billing-mp-settings-title" className="sg-hub-panel-title">
              Checkout Mercado Pago
            </h2>
            <p className="billing-mp-settings-lead muted">
              Personalizá el texto y la apariencia del checkout que ven los administradores de
              cuenta al suscribirse.
            </p>
          </div>
          <div className="billing-mp-settings-head-side">
            <span className="billing-mp-settings-head-icon" aria-hidden>
              <CreditCard size={20} strokeWidth={1.75} />
            </span>
            <div className="billing-mp-settings-badges">
              {sandbox ? <span className="billing-sandbox-badge">Modo test</span> : null}
              <span className={`billing-admin-mp-badge${mpConfigurado ? " is-ok" : ""}`}>
                {mpConfigurado ? "MP conectado" : "MP sin configurar"}
              </span>
            </div>
          </div>
        </header>

        {loading ? (
          <p className="billing-mp-settings-loading muted" aria-busy="true">
            Cargando…
          </p>
        ) : !apiOnline ? (
          <p className="billing-mp-settings-loading muted">Sin conexión con la API.</p>
        ) : (
          <form
            className="billing-mp-settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="billing-mp-settings-body">
              <div className="billing-mp-settings-fields">
                <div className="billing-mp-settings-inline">
                  <label className="billing-mp-settings-field">
                    <span className="billing-mp-settings-label">Marca en checkout</span>
                    <input
                      type="text"
                      value={form.marca}
                      onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                      maxLength={40}
                      placeholder="SAG"
                    />
                  </label>

                  <label className="billing-mp-settings-field billing-mp-settings-field--color">
                    <span className="billing-mp-settings-label">Color de acento</span>
                    <div className="billing-mp-settings-color">
                      <input
                        type="color"
                        value={form.color_acento}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, color_acento: e.target.value }))
                        }
                        aria-label="Color de acento"
                      />
                      <input
                        type="text"
                        value={form.color_acento}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, color_acento: e.target.value }))
                        }
                        maxLength={16}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                </div>

                <label className="billing-mp-settings-field">
                  <span className="billing-mp-settings-label">Plantilla del motivo (Mercado Pago)</span>
                  <input
                    type="text"
                    value={form.motivo_plantilla}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, motivo_plantilla: e.target.value }))
                    }
                    maxLength={120}
                    placeholder="{marca} {plan} — {cuenta}"
                  />
                  <small className="billing-mp-settings-hint muted">
                    Variables: <code>{"{marca}"}</code>, <code>{"{plan}"}</code>,{" "}
                    <code>{"{cuenta}"}</code>
                  </small>
                </label>

                <label className="billing-mp-settings-field">
                  <span className="billing-mp-settings-label">URL de retorno tras el pago</span>
                  <input
                    type="text"
                    value={form.url_retorno_path}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, url_retorno_path: e.target.value }))
                    }
                    placeholder="/?billing=ok"
                    spellCheck={false}
                  />
                </label>

                <label className="billing-mp-settings-field">
                  <span className="billing-mp-settings-label">
                    Mensaje en pantalla de suscripción (cuenta)
                  </span>
                  <textarea
                    rows={3}
                    value={form.mensaje_checkout}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mensaje_checkout: e.target.value }))
                    }
                    maxLength={280}
                    placeholder="Ej.: Pagos seguros con Mercado Pago. En modo test no hay cobros reales."
                  />
                </label>

                <label className="billing-mp-settings-field billing-mp-settings-field--trial">
                  <span className="billing-mp-settings-label">Días de prueba (nuevas cuentas)</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.trial_dias ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setForm((f) => ({
                        ...f,
                        trial_dias: raw === "" ? null : Number(raw),
                      }));
                    }}
                    placeholder="14 (env)"
                  />
                  <small className="billing-mp-settings-hint muted">
                    Vacío = usa BILLING_TRIAL_DAYS del servidor
                  </small>
                </label>
              </div>

              <aside
                className="billing-mp-settings-preview"
                style={{ "--billing-accent": form.color_acento } as CSSProperties}
                aria-label="Vista previa del checkout"
              >
                <p className="billing-mp-settings-preview-kicker">Vista previa checkout</p>
                <strong className="billing-mp-settings-preview-title">{previewMotivo}</strong>
                {form.mensaje_checkout ? (
                  <p className="billing-mp-settings-preview-msg">{form.mensaje_checkout}</p>
                ) : (
                  <p className="billing-mp-settings-preview-msg muted">
                    El mensaje de suscripción aparecerá aquí.
                  </p>
                )}
                {publicKey ? (
                  <small className="billing-mp-settings-preview-meta muted">
                    Public key: {publicKey.slice(0, 18)}…
                  </small>
                ) : null}
              </aside>
            </div>

            <footer className="billing-mp-settings-footer">
              <button
                type="button"
                className="btn btn-secondary billing-mp-settings-btn"
                onClick={() => void load()}
                disabled={saving}
              >
                <RefreshCw size={15} aria-hidden />
                Recargar
              </button>
              <button type="submit" className="btn btn-primary billing-mp-settings-btn" disabled={saving}>
                <Save size={15} aria-hidden />
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
