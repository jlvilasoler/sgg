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
    <div className="subseccion-panel billing-admin-settings-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Configuración SAG
      </button>

      <div className="card billing-admin-settings-card">
        <header className="billing-admin-settings-head">
          <div>
            <h2 className="billing-admin-settings-title">
              <CreditCard size={20} aria-hidden />
              Tema Mercado Pago
            </h2>
            <p className="muted billing-admin-settings-lead">
              Personalizá el checkout de suscripción que ven los administradores de cuenta.
            </p>
          </div>
          <div className="billing-admin-settings-badges">
            {sandbox ? <span className="billing-sandbox-badge">Modo test</span> : null}
            <span
              className={`billing-admin-mp-badge${mpConfigurado ? " is-ok" : ""}`}
            >
              {mpConfigurado ? "MP conectado" : "MP sin configurar"}
            </span>
          </div>
        </header>

        {loading ? (
          <p className="muted" aria-busy="true">
            Cargando…
          </p>
        ) : !apiOnline ? (
          <p className="muted">Sin conexión con la API.</p>
        ) : (
          <form
            className="billing-admin-settings-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <div className="billing-admin-settings-grid">
              <label className="billing-admin-field">
                <span>Marca en checkout</span>
                <input
                  type="text"
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                  maxLength={40}
                  placeholder="SAG"
                />
              </label>

              <label className="billing-admin-field">
                <span>Color de acento</span>
                <div className="billing-admin-color-row">
                  <input
                    type="color"
                    value={form.color_acento}
                    onChange={(e) => setForm((f) => ({ ...f, color_acento: e.target.value }))}
                    aria-label="Color de acento"
                  />
                  <input
                    type="text"
                    value={form.color_acento}
                    onChange={(e) => setForm((f) => ({ ...f, color_acento: e.target.value }))}
                    maxLength={16}
                  />
                </div>
              </label>

              <label className="billing-admin-field billing-admin-field--wide">
                <span>Plantilla del motivo (Mercado Pago)</span>
                <input
                  type="text"
                  value={form.motivo_plantilla}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, motivo_plantilla: e.target.value }))
                  }
                  maxLength={120}
                  placeholder="{marca} {plan} — {cuenta}"
                />
                <small className="muted">
                  Variables: <code>{"{marca}"}</code>, <code>{"{plan}"}</code>,{" "}
                  <code>{"{cuenta}"}</code>
                </small>
              </label>

              <label className="billing-admin-field billing-admin-field--wide">
                <span>URL de retorno tras el pago</span>
                <input
                  type="text"
                  value={form.url_retorno_path}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, url_retorno_path: e.target.value }))
                  }
                  placeholder="/?billing=ok"
                />
              </label>

              <label className="billing-admin-field billing-admin-field--wide">
                <span>Mensaje en pantalla de suscripción (cuenta)</span>
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

              <label className="billing-admin-field">
                <span>Días de prueba (nuevas cuentas)</span>
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
                <small className="muted">Vacío = usa BILLING_TRIAL_DAYS del servidor</small>
              </label>
            </div>

            <div className="billing-admin-preview" style={{ "--billing-accent": form.color_acento } as CSSProperties}>
              <p className="billing-admin-preview-kicker">Vista previa checkout</p>
              <strong>{previewMotivo}</strong>
              {form.mensaje_checkout ? <p>{form.mensaje_checkout}</p> : null}
              {publicKey ? (
                <small className="muted">Public key: {publicKey.slice(0, 18)}…</small>
              ) : null}
            </div>

            <div className="billing-admin-settings-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void load()}
                disabled={saving}
              >
                <RefreshCw size={15} aria-hidden />
                Recargar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={15} aria-hidden />
                {saving ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
