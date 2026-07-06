import type { Db } from "./db/pg-client.js";

export type BillingPlan = {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_mensual: number;
  moneda: string;
  activo: boolean;
  orden: number;
};

export type SuscripcionEstado =
  | "trial"
  | "pending"
  | "authorized"
  | "paused"
  | "cancelled";

export type CuentaSuscripcion = {
  cuenta_id: number;
  plan_codigo: string | null;
  estado: SuscripcionEstado;
  mp_preapproval_id: string | null;
  trial_hasta: string | null;
  proximo_cobro: string | null;
  actualizado_en: string | null;
};

export type BillingSettings = {
  marca: string;
  motivo_plantilla: string;
  url_retorno_path: string;
  mensaje_checkout: string;
  color_acento: string;
  trial_dias: number | null;
  actualizado_en: string | null;
};

export type SuscripcionAdminRow = {
  cuenta_id: number;
  cuenta_nombre: string;
  cuenta_codigo: string;
  cuenta_activa: boolean;
  plan_codigo: string | null;
  plan_nombre: string | null;
  precio_mensual: number | null;
  moneda: string | null;
  estado: SuscripcionEstado | "sin_registro";
  mp_preapproval_id: string | null;
  trial_hasta: string | null;
  proximo_cobro: string | null;
  actualizado_en: string | null;
  trial_dias_restantes: number | null;
  activa: boolean;
};

export type BillingEventoRow = {
  id: number;
  cuenta_id: number | null;
  cuenta_nombre: string | null;
  tipo: string;
  mp_resource_id: string | null;
  creado_en: string;
};

export type BillingAdminResumen = {
  total_cuentas: number;
  con_suscripcion: number;
  trial: number;
  pending: number;
  authorized: number;
  paused: number;
  cancelled: number;
  sin_registro: number;
  mrr_estimado_uyu: number;
};

const DEFAULT_PLANS: Array<Omit<BillingPlan, "activo"> & { activo: number }> = [
  {
    codigo: "basico",
    nombre: "Básico",
    descripcion: "Operación diaria, stock y presupuesto.",
    precio_mensual: 990,
    moneda: "UYU",
    activo: 1,
    orden: 1,
  },
  {
    codigo: "pro",
    nombre: "Pro",
    descripcion: "Todo el Básico más mapa de campo y reportes avanzados.",
    precio_mensual: 1990,
    moneda: "UYU",
    activo: 1,
    orden: 2,
  },
];

function trialDays(): number {
  const raw = Number(process.env.BILLING_TRIAL_DAYS ?? "14");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 14;
}

function isoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function rowToPlan(row: Record<string, unknown>): BillingPlan {
  return {
    codigo: String(row.codigo),
    nombre: String(row.nombre),
    descripcion: String(row.descripcion ?? ""),
    precio_mensual: Number(row.precio_mensual),
    moneda: String(row.moneda ?? "UYU"),
    activo: Number(row.activo) === 1,
    orden: Number(row.orden ?? 0),
  };
}

function rowToSuscripcion(row: Record<string, unknown>): CuentaSuscripcion {
  return {
    cuenta_id: Number(row.cuenta_id),
    plan_codigo: row.plan_codigo != null ? String(row.plan_codigo) : null,
    estado: String(row.estado) as SuscripcionEstado,
    mp_preapproval_id:
      row.mp_preapproval_id != null ? String(row.mp_preapproval_id) : null,
    trial_hasta: row.trial_hasta != null ? String(row.trial_hasta).slice(0, 10) : null,
    proximo_cobro:
      row.proximo_cobro != null ? String(row.proximo_cobro).slice(0, 10) : null,
    actualizado_en: row.actualizado_en != null ? String(row.actualizado_en) : null,
  };
}

export async function initBillingTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS BILLING_PLANS (
        id SERIAL PRIMARY KEY,
        codigo TEXT NOT NULL UNIQUE,
        nombre TEXT NOT NULL,
        descripcion TEXT NOT NULL DEFAULT '',
        precio_mensual NUMERIC(12,2) NOT NULL,
        moneda TEXT NOT NULL DEFAULT 'UYU',
        activo INTEGER NOT NULL DEFAULT 1,
        orden INTEGER NOT NULL DEFAULT 0,
        creado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS CUENTA_SUSCRIPCIONES (
        id SERIAL PRIMARY KEY,
        cuenta_id INTEGER NOT NULL UNIQUE REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
        plan_codigo TEXT REFERENCES BILLING_PLANS(codigo),
        estado TEXT NOT NULL DEFAULT 'trial',
        mp_preapproval_id TEXT,
        trial_hasta DATE,
        proximo_cobro DATE,
        creado_en TIMESTAMPTZ DEFAULT NOW(),
        actualizado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS BILLING_EVENTOS (
        id SERIAL PRIMARY KEY,
        cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id) ON DELETE SET NULL,
        tipo TEXT NOT NULL,
        mp_resource_id TEXT,
        payload_json TEXT,
        creado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  for (const plan of DEFAULT_PLANS) {
    await db
      .prepare(
        `INSERT INTO BILLING_PLANS (codigo, nombre, descripcion, precio_mensual, moneda, activo, orden)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (codigo) DO NOTHING`
      )
      .run(
        plan.codigo,
        plan.nombre,
        plan.descripcion,
        plan.precio_mensual,
        plan.moneda,
        plan.activo,
        plan.orden
      );
  }

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS BILLING_SETTINGS (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        marca TEXT NOT NULL DEFAULT 'SAG',
        motivo_plantilla TEXT NOT NULL DEFAULT '{marca} {plan} — {cuenta}',
        url_retorno_path TEXT NOT NULL DEFAULT '/?billing=ok',
        mensaje_checkout TEXT NOT NULL DEFAULT '',
        color_acento TEXT NOT NULL DEFAULT '#7cb342',
        trial_dias INTEGER,
        actualizado_en TIMESTAMPTZ DEFAULT NOW()
      )`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO BILLING_SETTINGS (id, marca, motivo_plantilla, url_retorno_path, mensaje_checkout, color_acento)
       VALUES (1, 'SAG', '{marca} {plan} — {cuenta}', '/?billing=ok', '', '#7cb342')
       ON CONFLICT (id) DO NOTHING`
    )
    .run();
}

export async function listBillingPlans(db: Db): Promise<BillingPlan[]> {
  const rows = (await db
    .prepare(
      `SELECT codigo, nombre, descripcion, precio_mensual, moneda, activo, orden
       FROM BILLING_PLANS
       WHERE activo = 1
       ORDER BY orden ASC, LOWER(nombre) ASC`
    )
    .all()) as Record<string, unknown>[];
  return rows.map(rowToPlan);
}

export async function getBillingPlanByCodigo(
  db: Db,
  codigo: string
): Promise<BillingPlan | null> {
  const row = (await db
    .prepare(
      `SELECT codigo, nombre, descripcion, precio_mensual, moneda, activo, orden
       FROM BILLING_PLANS
       WHERE codigo = ? AND activo = 1`
    )
    .get(codigo)) as Record<string, unknown> | undefined;
  return row ? rowToPlan(row) : null;
}

export async function getSuscripcionByCuentaId(
  db: Db,
  cuentaId: number
): Promise<CuentaSuscripcion | null> {
  const row = (await db
    .prepare(
      `SELECT cuenta_id, plan_codigo, estado, mp_preapproval_id, trial_hasta, proximo_cobro, actualizado_en
       FROM CUENTA_SUSCRIPCIONES
       WHERE cuenta_id = ?`
    )
    .get(cuentaId)) as Record<string, unknown> | undefined;
  return row ? rowToSuscripcion(row) : null;
}

export async function ensureSuscripcionTrial(
  db: Db,
  cuentaId: number
): Promise<CuentaSuscripcion> {
  const existing = await getSuscripcionByCuentaId(db, cuentaId);
  if (existing) return existing;

  const settings = await getBillingSettings(db);
  const days =
    settings.trial_dias != null && settings.trial_dias > 0
      ? settings.trial_dias
      : trialDays();
  const trialHasta = isoDateOnly(addDays(new Date(), days));
  await db
    .prepare(
      `INSERT INTO CUENTA_SUSCRIPCIONES (cuenta_id, estado, trial_hasta)
       VALUES (?, 'trial', ?)`
    )
    .run(cuentaId, trialHasta);

  const created = await getSuscripcionByCuentaId(db, cuentaId);
  if (!created) throw new Error("No se pudo crear la suscripción de prueba");
  return created;
}

export async function setSuscripcionPendingCheckout(
  db: Db,
  cuentaId: number,
  planCodigo: string,
  mpPreapprovalId: string
): Promise<CuentaSuscripcion> {
  await db
    .prepare(
      `INSERT INTO CUENTA_SUSCRIPCIONES (cuenta_id, plan_codigo, estado, mp_preapproval_id)
       VALUES (?, ?, 'pending', ?)
       ON CONFLICT (cuenta_id) DO UPDATE SET
         plan_codigo = EXCLUDED.plan_codigo,
         estado = 'pending',
         mp_preapproval_id = EXCLUDED.mp_preapproval_id,
         actualizado_en = NOW()`
    )
    .run(cuentaId, planCodigo, mpPreapprovalId);

  const row = await getSuscripcionByCuentaId(db, cuentaId);
  if (!row) throw new Error("Suscripción no encontrada tras checkout");
  return row;
}

export async function updateSuscripcionFromMp(
  db: Db,
  cuentaId: number,
  patch: {
    estado: SuscripcionEstado;
    plan_codigo?: string | null;
    mp_preapproval_id?: string | null;
    proximo_cobro?: string | null;
  }
): Promise<CuentaSuscripcion> {
  await db
    .prepare(
      `UPDATE CUENTA_SUSCRIPCIONES SET
         estado = ?,
         plan_codigo = COALESCE(?, plan_codigo),
         mp_preapproval_id = COALESCE(?, mp_preapproval_id),
         proximo_cobro = COALESCE(?, proximo_cobro),
         actualizado_en = NOW()
       WHERE cuenta_id = ?`
    )
    .run(
      patch.estado,
      patch.plan_codigo ?? null,
      patch.mp_preapproval_id ?? null,
      patch.proximo_cobro ?? null,
      cuentaId
    );

  const row = await getSuscripcionByCuentaId(db, cuentaId);
  if (!row) throw new Error("Suscripción no encontrada");
  return row;
}

export async function findCuentaIdByMpPreapprovalId(
  db: Db,
  mpId: string
): Promise<number | null> {
  const row = (await db
    .prepare(
      `SELECT cuenta_id FROM CUENTA_SUSCRIPCIONES WHERE mp_preapproval_id = ? LIMIT 1`
    )
    .get(mpId)) as { cuenta_id: number } | undefined;
  return row ? Number(row.cuenta_id) : null;
}

export function parseCuentaIdFromExternalReference(
  externalReference: string | undefined | null
): number | null {
  if (!externalReference) return null;
  const match = /scg:cuenta:(\d+)/i.exec(externalReference);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

export function parsePlanCodigoFromExternalReference(
  externalReference: string | undefined | null
): string | null {
  if (!externalReference) return null;
  const match = /plan:([a-z0-9_-]+)/i.exec(externalReference);
  return match ? match[1] : null;
}

export async function logBillingEvent(
  db: Db,
  event: {
    cuenta_id?: number | null;
    tipo: string;
    mp_resource_id?: string | null;
    payload_json?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO BILLING_EVENTOS (cuenta_id, tipo, mp_resource_id, payload_json)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      event.cuenta_id ?? null,
      event.tipo,
      event.mp_resource_id ?? null,
      event.payload_json ?? null
    );
}

export function mapMpStatusToSuscripcionEstado(
  mpStatus: string | undefined | null
): SuscripcionEstado {
  const s = (mpStatus ?? "").toLowerCase();
  if (s === "authorized") return "authorized";
  if (s === "paused") return "paused";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "pending") return "pending";
  return "pending";
}

const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  marca: "SAG",
  motivo_plantilla: "{marca} {plan} — {cuenta}",
  url_retorno_path: "/?billing=ok",
  mensaje_checkout: "",
  color_acento: "#7cb342",
  trial_dias: null,
  actualizado_en: null,
};

function rowToBillingSettings(row: Record<string, unknown>): BillingSettings {
  return {
    marca: String(row.marca ?? DEFAULT_BILLING_SETTINGS.marca),
    motivo_plantilla: String(row.motivo_plantilla ?? DEFAULT_BILLING_SETTINGS.motivo_plantilla),
    url_retorno_path: String(row.url_retorno_path ?? DEFAULT_BILLING_SETTINGS.url_retorno_path),
    mensaje_checkout: String(row.mensaje_checkout ?? ""),
    color_acento: String(row.color_acento ?? DEFAULT_BILLING_SETTINGS.color_acento),
    trial_dias: row.trial_dias != null ? Number(row.trial_dias) : null,
    actualizado_en: row.actualizado_en != null ? String(row.actualizado_en) : null,
  };
}

export async function getBillingSettings(db: Db): Promise<BillingSettings> {
  const row = (await db
    .prepare(
      `SELECT marca, motivo_plantilla, url_retorno_path, mensaje_checkout, color_acento, trial_dias, actualizado_en
       FROM BILLING_SETTINGS
       WHERE id = 1`
    )
    .get()) as Record<string, unknown> | undefined;
  return row ? rowToBillingSettings(row) : { ...DEFAULT_BILLING_SETTINGS };
}

export async function updateBillingSettings(
  db: Db,
  patch: Partial<
    Pick<
      BillingSettings,
      "marca" | "motivo_plantilla" | "url_retorno_path" | "mensaje_checkout" | "color_acento" | "trial_dias"
    >
  >
): Promise<BillingSettings> {
  const current = await getBillingSettings(db);
  const next: BillingSettings = {
    marca: patch.marca?.trim() || current.marca,
    motivo_plantilla: patch.motivo_plantilla?.trim() || current.motivo_plantilla,
    url_retorno_path: patch.url_retorno_path?.trim() || current.url_retorno_path,
    mensaje_checkout: patch.mensaje_checkout != null ? patch.mensaje_checkout.trim() : current.mensaje_checkout,
    color_acento: patch.color_acento?.trim() || current.color_acento,
    trial_dias:
      patch.trial_dias === null
        ? null
        : patch.trial_dias != null && Number.isFinite(patch.trial_dias) && patch.trial_dias > 0
          ? Math.floor(patch.trial_dias)
          : current.trial_dias,
    actualizado_en: null,
  };

  if (!next.url_retorno_path.startsWith("/")) {
    throw new Error("La URL de retorno debe comenzar con /");
  }

  await db
    .prepare(
      `INSERT INTO BILLING_SETTINGS (id, marca, motivo_plantilla, url_retorno_path, mensaje_checkout, color_acento, trial_dias, actualizado_en)
       VALUES (1, ?, ?, ?, ?, ?, ?, NOW())
       ON CONFLICT (id) DO UPDATE SET
         marca = EXCLUDED.marca,
         motivo_plantilla = EXCLUDED.motivo_plantilla,
         url_retorno_path = EXCLUDED.url_retorno_path,
         mensaje_checkout = EXCLUDED.mensaje_checkout,
         color_acento = EXCLUDED.color_acento,
         trial_dias = EXCLUDED.trial_dias,
         actualizado_en = NOW()`
    )
    .run(
      next.marca,
      next.motivo_plantilla,
      next.url_retorno_path,
      next.mensaje_checkout,
      next.color_acento,
      next.trial_dias
    );

  return getBillingSettings(db);
}

function diasRestantesTrialDate(trialHasta: string | null): number | null {
  if (!trialHasta) return null;
  const end = new Date(`${trialHasta}T23:59:59`);
  if (Number.isNaN(end.getTime())) return null;
  const diff = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function suscripcionActivaEstado(estado: SuscripcionEstado | "sin_registro"): boolean {
  return estado === "trial" || estado === "authorized" || estado === "pending";
}

export async function listSuscripcionesAdmin(db: Db): Promise<SuscripcionAdminRow[]> {
  const rows = (await db
    .prepare(
      `SELECT
         c.id AS cuenta_id,
         c.nombre AS cuenta_nombre,
         c.codigo AS cuenta_codigo,
         c.activo AS cuenta_activo,
         s.plan_codigo,
         s.estado,
         s.mp_preapproval_id,
         s.trial_hasta,
         s.proximo_cobro,
         s.actualizado_en,
         p.nombre AS plan_nombre,
         p.precio_mensual,
         p.moneda
       FROM EMPRESAS_CUENTA c
       LEFT JOIN CUENTA_SUSCRIPCIONES s ON s.cuenta_id = c.id
       LEFT JOIN BILLING_PLANS p ON p.codigo = s.plan_codigo
       ORDER BY LOWER(c.nombre) ASC, c.id ASC`
    )
    .all()) as Record<string, unknown>[];

  return rows.map((row) => {
    const estadoRaw = row.estado != null ? String(row.estado) : "sin_registro";
    const estado = estadoRaw as SuscripcionEstado | "sin_registro";
    const trialHasta = row.trial_hasta != null ? String(row.trial_hasta).slice(0, 10) : null;
    return {
      cuenta_id: Number(row.cuenta_id),
      cuenta_nombre: String(row.cuenta_nombre ?? ""),
      cuenta_codigo: String(row.cuenta_codigo ?? ""),
      cuenta_activa: Number(row.cuenta_activo) === 1,
      plan_codigo: row.plan_codigo != null ? String(row.plan_codigo) : null,
      plan_nombre: row.plan_nombre != null ? String(row.plan_nombre) : null,
      precio_mensual: row.precio_mensual != null ? Number(row.precio_mensual) : null,
      moneda: row.moneda != null ? String(row.moneda) : null,
      estado,
      mp_preapproval_id: row.mp_preapproval_id != null ? String(row.mp_preapproval_id) : null,
      trial_hasta: trialHasta,
      proximo_cobro: row.proximo_cobro != null ? String(row.proximo_cobro).slice(0, 10) : null,
      actualizado_en: row.actualizado_en != null ? String(row.actualizado_en) : null,
      trial_dias_restantes: estado === "trial" ? diasRestantesTrialDate(trialHasta) : null,
      activa: suscripcionActivaEstado(estado),
    };
  });
}

export function summarizeSuscripcionesAdmin(rows: SuscripcionAdminRow[]): BillingAdminResumen {
  const resumen: BillingAdminResumen = {
    total_cuentas: rows.length,
    con_suscripcion: 0,
    trial: 0,
    pending: 0,
    authorized: 0,
    paused: 0,
    cancelled: 0,
    sin_registro: 0,
    mrr_estimado_uyu: 0,
  };

  for (const row of rows) {
    if (row.estado === "sin_registro") {
      resumen.sin_registro += 1;
      continue;
    }
    resumen.con_suscripcion += 1;
    if (row.estado === "trial") resumen.trial += 1;
    if (row.estado === "pending") resumen.pending += 1;
    if (row.estado === "authorized") {
      resumen.authorized += 1;
      if (row.precio_mensual != null && row.moneda === "UYU") {
        resumen.mrr_estimado_uyu += row.precio_mensual;
      }
    }
    if (row.estado === "paused") resumen.paused += 1;
    if (row.estado === "cancelled") resumen.cancelled += 1;
  }

  return resumen;
}

export async function listRecentBillingEventos(db: Db, limit = 30): Promise<BillingEventoRow[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const rows = (await db
    .prepare(
      `SELECT e.id, e.cuenta_id, e.tipo, e.mp_resource_id, e.creado_en, c.nombre AS cuenta_nombre
       FROM BILLING_EVENTOS e
       LEFT JOIN EMPRESAS_CUENTA c ON c.id = e.cuenta_id
       ORDER BY e.creado_en DESC, e.id DESC
       LIMIT ?`
    )
    .all(safeLimit)) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    cuenta_id: row.cuenta_id != null ? Number(row.cuenta_id) : null,
    cuenta_nombre: row.cuenta_nombre != null ? String(row.cuenta_nombre) : null,
    tipo: String(row.tipo),
    mp_resource_id: row.mp_resource_id != null ? String(row.mp_resource_id) : null,
    creado_en: String(row.creado_en),
  }));
}

export async function listCuentasConMpPreapproval(db: Db): Promise<Array<{ cuenta_id: number; mp_preapproval_id: string }>> {
  const rows = (await db
    .prepare(
      `SELECT cuenta_id, mp_preapproval_id
       FROM CUENTA_SUSCRIPCIONES
       WHERE mp_preapproval_id IS NOT NULL AND TRIM(mp_preapproval_id) <> ''`
    )
    .all()) as Array<{ cuenta_id: number; mp_preapproval_id: string }>;
  return rows.map((row) => ({
    cuenta_id: Number(row.cuenta_id),
    mp_preapproval_id: String(row.mp_preapproval_id),
  }));
}
