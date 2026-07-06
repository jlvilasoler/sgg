import type { Express, Request, Response } from "express";
import { getDb, empresasCuenta } from "./database.js";
import * as billingDb from "./billing-db.js";
import {
  createMercadoPagoPreapprovalCheckout,
  fetchMercadoPagoPreapproval,
  getMercadoPagoPublicKey,
  isBillingSandbox,
  isMercadoPagoConfigured,
  isPreapprovalWebhook,
  mpWebhookResourceId,
  suscripcionPatchFromMpResponse,
  type MpWebhookPayload,
} from "./mercadopago-billing.js";
import { clientSafeErrorDetail } from "./auth-security.js";

function requireBillingAdmin(req: Request, res: Response): boolean {
  const user = req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (user.es_admin_cuenta || user.es_super_admin || user.es_admin_plataforma) {
    return true;
  }
  res.status(403).json({
    ok: false,
    error: "Solo el administrador de la cuenta puede gestionar la suscripción",
  });
  return false;
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.user?.es_super_admin) {
    res.status(403).json({ ok: false, error: "Solo superadministrador de plataforma" });
    return false;
  }
  return true;
}

async function resolveActorCuentaId(req: Request): Promise<number | null> {
  if (!req.user) return null;
  return empresasCuenta.resolveCuentaMadreIdForUser(getDb(), req.user);
}

function diasRestantesTrial(trialHasta: string | null): number | null {
  if (!trialHasta) return null;
  const end = new Date(`${trialHasta}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function suscripcionActiva(estado: billingDb.SuscripcionEstado): boolean {
  return estado === "trial" || estado === "authorized" || estado === "pending";
}

async function syncSuscripcionFromMp(
  cuentaId: number,
  mpPreapprovalId: string
): Promise<billingDb.CuentaSuscripcion> {
  const mp = await fetchMercadoPagoPreapproval(mpPreapprovalId);
  const patch = suscripcionPatchFromMpResponse(mp);
  return billingDb.updateSuscripcionFromMp(getDb(), cuentaId, patch);
}

export function registerBillingRoutes(app: Express): void {
  app.get("/api/billing/config", async (req, res) => {
    if (!requireBillingAdmin(req, res)) return;
    const settings = await billingDb.getBillingSettings(getDb());
    res.json({
      ok: true,
      mercadopago_configurado: isMercadoPagoConfigured(),
      sandbox: isBillingSandbox(),
      public_key: getMercadoPagoPublicKey(),
      tema: {
        marca: settings.marca,
        mensaje_checkout: settings.mensaje_checkout,
        color_acento: settings.color_acento,
      },
    });
  });

  app.get("/api/billing/plans", async (req, res) => {
    if (!requireBillingAdmin(req, res)) return;
    const plans = await billingDb.listBillingPlans(getDb());
    res.json({ ok: true, plans, sandbox: isBillingSandbox() });
  });

  app.get("/api/billing/suscripcion", async (req, res) => {
    if (!requireBillingAdmin(req, res)) return;
    const cuentaId = await resolveActorCuentaId(req);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo resolver la cuenta" });
      return;
    }

    const suscripcion = await billingDb.ensureSuscripcionTrial(getDb(), cuentaId);
    const plan = suscripcion.plan_codigo
      ? await billingDb.getBillingPlanByCodigo(getDb(), suscripcion.plan_codigo)
      : null;

    res.json({
      ok: true,
      suscripcion,
      plan,
      activa: suscripcionActiva(suscripcion.estado),
      trial_dias_restantes: diasRestantesTrial(suscripcion.trial_hasta),
      sandbox: isBillingSandbox(),
      mercadopago_configurado: isMercadoPagoConfigured(),
    });
  });

  app.post("/api/billing/suscripcion/sync", async (req, res) => {
    if (!requireBillingAdmin(req, res)) return;
    if (!isMercadoPagoConfigured()) {
      res.status(503).json({
        ok: false,
        error: "Mercado Pago no está configurado en el servidor",
      });
      return;
    }

    const cuentaId = await resolveActorCuentaId(req);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo resolver la cuenta" });
      return;
    }

    const suscripcion = await billingDb.ensureSuscripcionTrial(getDb(), cuentaId);
    if (!suscripcion.mp_preapproval_id) {
      res.json({ ok: true, suscripcion, sin_cambios: true });
      return;
    }

    try {
      const actualizada = await syncSuscripcionFromMp(
        cuentaId,
        suscripcion.mp_preapproval_id
      );
      const plan = actualizada.plan_codigo
        ? await billingDb.getBillingPlanByCodigo(getDb(), actualizada.plan_codigo)
        : null;
      res.json({
        ok: true,
        suscripcion: actualizada,
        plan,
        activa: suscripcionActiva(actualizada.estado),
        trial_dias_restantes: diasRestantesTrial(actualizada.trial_hasta),
      });
    } catch (err) {
      console.error("[SGG Billing] sync:", err);
      res.status(502).json({
        ok: false,
        error: "No se pudo consultar el estado en Mercado Pago",
        ...(clientSafeErrorDetail(err instanceof Error ? err.message : String(err))
          ? { detail: clientSafeErrorDetail(err instanceof Error ? err.message : String(err)) }
          : {}),
      });
    }
  });

  app.post("/api/billing/checkout", async (req, res) => {
    if (!requireBillingAdmin(req, res)) return;
    if (!isMercadoPagoConfigured()) {
      res.status(503).json({
        ok: false,
        error:
          "Configurá MP_ACCESS_TOKEN (credencial TEST) en server/.env para probar Mercado Pago",
      });
      return;
    }

    const cuentaId = await resolveActorCuentaId(req);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo resolver la cuenta" });
      return;
    }

    const planCodigo = String(req.body?.plan_codigo ?? "").trim().toLowerCase();
    if (!planCodigo) {
      res.status(400).json({ ok: false, error: "plan_codigo requerido" });
      return;
    }

    const plan = await billingDb.getBillingPlanByCodigo(getDb(), planCodigo);
    if (!plan) {
      res.status(404).json({ ok: false, error: "Plan no encontrado" });
      return;
    }

    const cuenta = await empresasCuenta.getEmpresaCuentaById(getDb(), cuentaId);
    const payerEmail = req.user?.email?.trim();
    if (!payerEmail) {
      res.status(400).json({
        ok: false,
        error: "Tu usuario debe tener email para suscribirse con Mercado Pago",
      });
      return;
    }

    try {
      const settings = await billingDb.getBillingSettings(getDb());
      const checkout = await createMercadoPagoPreapprovalCheckout({
        cuentaId,
        plan,
        payerEmail,
        cuentaNombre: cuenta?.nombre ?? `Cuenta ${cuentaId}`,
        settings,
      });

      await billingDb.setSuscripcionPendingCheckout(
        getDb(),
        cuentaId,
        plan.codigo,
        checkout.preapprovalId
      );

      res.json({
        ok: true,
        init_point: checkout.initPoint,
        preapproval_id: checkout.preapprovalId,
        sandbox: checkout.sandbox,
      });
    } catch (err) {
      console.error("[SGG Billing] checkout:", err);
      res.status(502).json({
        ok: false,
        error: "No se pudo iniciar el checkout en Mercado Pago",
        ...(clientSafeErrorDetail(err instanceof Error ? err.message : String(err))
          ? { detail: clientSafeErrorDetail(err instanceof Error ? err.message : String(err)) }
          : {}),
      });
    }
  });

  app.post("/api/billing/mercadopago/webhook", async (req, res) => {
    const body = (req.body ?? {}) as MpWebhookPayload;
    const resourceId = mpWebhookResourceId(body);

    await billingDb.logBillingEvent(getDb(), {
      tipo: String(body.type ?? "unknown"),
      mp_resource_id: resourceId,
      payload_json: JSON.stringify(body),
    });

    if (!resourceId || !isPreapprovalWebhook(body)) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    if (!isMercadoPagoConfigured()) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }

    try {
      const mp = await fetchMercadoPagoPreapproval(resourceId);
      const cuentaId =
        (await billingDb.findCuentaIdByMpPreapprovalId(getDb(), resourceId)) ??
        billingDb.parseCuentaIdFromExternalReference(mp.external_reference);

      if (cuentaId != null) {
        const patch = suscripcionPatchFromMpResponse(mp);
        await billingDb.updateSuscripcionFromMp(getDb(), cuentaId, patch);
        await billingDb.logBillingEvent(getDb(), {
          cuenta_id: cuentaId,
          tipo: "webhook_applied",
          mp_resource_id: resourceId,
          payload_json: JSON.stringify({ status: mp.status }),
        });
      }
    } catch (err) {
      console.error("[SGG Billing] webhook:", err);
    }

    res.status(200).json({ ok: true });
  });

  app.get("/api/billing/admin/settings", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const settings = await billingDb.getBillingSettings(getDb());
    res.json({
      ok: true,
      settings,
      mercadopago_configurado: isMercadoPagoConfigured(),
      sandbox: isBillingSandbox(),
      public_key: getMercadoPagoPublicKey(),
    });
  });

  app.patch("/api/billing/admin/settings", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const body = req.body ?? {};
    try {
      const settings = await billingDb.updateBillingSettings(getDb(), {
        marca: body.marca != null ? String(body.marca) : undefined,
        motivo_plantilla:
          body.motivo_plantilla != null ? String(body.motivo_plantilla) : undefined,
        url_retorno_path:
          body.url_retorno_path != null ? String(body.url_retorno_path) : undefined,
        mensaje_checkout:
          body.mensaje_checkout != null ? String(body.mensaje_checkout) : undefined,
        color_acento: body.color_acento != null ? String(body.color_acento) : undefined,
        trial_dias:
          body.trial_dias === null
            ? null
            : body.trial_dias != null
              ? Number(body.trial_dias)
              : undefined,
      });
      res.json({ ok: true, settings });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : "No se pudo guardar la configuración",
      });
    }
  });

  app.get("/api/billing/admin/overview", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const db = getDb();
    const cuentas = await billingDb.listSuscripcionesAdmin(db);
    const resumen = billingDb.summarizeSuscripcionesAdmin(cuentas);
    const eventos = await billingDb.listRecentBillingEventos(db, 25);
    const settings = await billingDb.getBillingSettings(db);
    res.json({
      ok: true,
      resumen,
      cuentas,
      eventos,
      settings,
      mercadopago_configurado: isMercadoPagoConfigured(),
      sandbox: isBillingSandbox(),
      actualizado_en: new Date().toISOString(),
    });
  });

  app.post("/api/billing/admin/sync-all", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    if (!isMercadoPagoConfigured()) {
      res.status(503).json({ ok: false, error: "Mercado Pago no configurado" });
      return;
    }

    const db = getDb();
    const rows = await billingDb.listCuentasConMpPreapproval(db);
    let actualizadas = 0;
    const errores: string[] = [];

    for (const row of rows) {
      try {
        await syncSuscripcionFromMp(row.cuenta_id, row.mp_preapproval_id);
        actualizadas += 1;
      } catch (err) {
        errores.push(
          `Cuenta ${row.cuenta_id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    res.json({
      ok: true,
      procesadas: rows.length,
      actualizadas,
      errores,
      actualizado_en: new Date().toISOString(),
    });
  });
}
