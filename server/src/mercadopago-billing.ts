import { MercadoPagoConfig, PreApproval } from "mercadopago";
import {
  mapMpStatusToSuscripcionEstado,
  parseCuentaIdFromExternalReference,
  parsePlanCodigoFromExternalReference,
  type BillingPlan,
  type BillingSettings,
  type CuentaSuscripcion,
} from "./billing-db.js";

type MpPreapproval = Awaited<ReturnType<PreApproval["get"]>>;

export function isMercadoPagoConfigured(): boolean {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  return Boolean(token && token.length > 8);
}

export function isBillingSandbox(): boolean {
  if (process.env.BILLING_SANDBOX === "0") return false;
  const token = process.env.MP_ACCESS_TOKEN?.trim() ?? "";
  if (token.startsWith("TEST-")) return true;
  return process.env.BILLING_SANDBOX !== "0";
}

export function getMercadoPagoPublicKey(): string | null {
  const key = process.env.MP_PUBLIC_KEY?.trim();
  return key || null;
}

function clientOrigin(): string {
  const raw =
    process.env.SCG_CLIENT_ORIGIN?.trim() ||
    process.env.APP_PUBLIC_URL?.trim() ||
    "http://127.0.0.1:5173";
  return raw.replace(/\/$/, "");
}

function mpConfig(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN no configurado");
  }
  return new MercadoPagoConfig({ accessToken });
}

export function billingBackUrl(path = "/?billing=ok"): string {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${clientOrigin()}${safePath}`;
}

export function formatCheckoutReason(
  settings: BillingSettings,
  input: { planNombre: string; cuentaNombre: string }
): string {
  const marca = settings.marca.trim() || "SAG";
  const template = settings.motivo_plantilla.trim() || "{marca} {plan} — {cuenta}";
  return template
    .replaceAll("{marca}", marca)
    .replaceAll("{plan}", input.planNombre)
    .replaceAll("{cuenta}", input.cuentaNombre)
    .slice(0, 120);
}

export function externalReferenceForCheckout(
  cuentaId: number,
  planCodigo: string
): string {
  return `scg:cuenta:${cuentaId}:plan:${planCodigo}`;
}

export async function createMercadoPagoPreapprovalCheckout(input: {
  cuentaId: number;
  plan: BillingPlan;
  payerEmail: string;
  cuentaNombre: string;
  settings: BillingSettings;
}): Promise<{ preapprovalId: string; initPoint: string; sandbox: boolean }> {
  const preApproval = new PreApproval(mpConfig());
  const reason = formatCheckoutReason(input.settings, {
    planNombre: input.plan.nombre,
    cuentaNombre: input.cuentaNombre,
  });

  const body = {
    reason,
    external_reference: externalReferenceForCheckout(input.cuentaId, input.plan.codigo),
    payer_email: input.payerEmail,
    back_url: billingBackUrl(input.settings.url_retorno_path),
    status: "pending",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: input.plan.precio_mensual,
      currency_id: input.plan.moneda || "UYU",
    },
  };

  const response = (await preApproval.create({ body })) as MpPreapproval;
  const preapprovalId = response.id;
  const initPoint =
    response.init_point ||
    (response as { sandbox_init_point?: string }).sandbox_init_point;

  if (!preapprovalId || !initPoint) {
    throw new Error("Mercado Pago no devolvió init_point para la suscripción");
  }

  return {
    preapprovalId,
    initPoint,
    sandbox: isBillingSandbox(),
  };
}

export async function fetchMercadoPagoPreapproval(
  mpPreapprovalId: string
): Promise<MpPreapproval> {
  const preApproval = new PreApproval(mpConfig());
  return preApproval.get({ id: mpPreapprovalId });
}

export function suscripcionPatchFromMpResponse(
  mp: MpPreapproval
): Pick<CuentaSuscripcion, "estado" | "plan_codigo" | "mp_preapproval_id" | "proximo_cobro"> {
  const planFromRef = parsePlanCodigoFromExternalReference(mp.external_reference);
  return {
    estado: mapMpStatusToSuscripcionEstado(mp.status),
    plan_codigo: planFromRef,
    mp_preapproval_id: mp.id ?? null,
    proximo_cobro: mp.next_payment_date ? mp.next_payment_date.slice(0, 10) : null,
  };
}

export function cuentaIdFromMpResponse(mp: MpPreapproval): number | null {
  return parseCuentaIdFromExternalReference(mp.external_reference);
}

export type MpWebhookPayload = {
  type?: string;
  action?: string;
  data?: { id?: string };
};

export function mpWebhookResourceId(body: MpWebhookPayload): string | null {
  const id = body.data?.id;
  return id ? String(id) : null;
}

export function isPreapprovalWebhook(body: MpWebhookPayload): boolean {
  const type = (body.type ?? "").toLowerCase();
  return type === "subscription_preapproval" || type === "preapproval";
}
