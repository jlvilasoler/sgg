import "./load-env.js";
import "./pdf-node-polyfills.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import "express-async-errors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./database.js";
import { closePool, dbCapacityHint, isDbCapacityError, warmupPool } from "./db/pg-client.js";
import {
  apiRateLimiter,
  authMiddleware,
  csrfOriginGuard,
  getCorsOptions,
  registerAuthRoutes,
  securityHeaders,
} from "./auth.js";
import { clientSafeErrorDetail, clientSafeErrorMessage } from "./auth-security.js";
import { getPasswordResetEmailStatus } from "./password-reset-email.js";
import { registerChatRoutes } from "./chat.js";
import { registerBillingRoutes } from "./billing.js";
import { PARES_DIVISA, type ParDivisa } from "./divisas-db.js";
import { parseDivisasBuffer, parseDivisasText } from "./parse-divisas-file.js";
import { fetchBcuUsdUyu } from "./bcu-usd-uyu.js";
import { fetchYahooUsdBrl } from "./yahoo-usd-brl.js";
import { fetchInvestingUsdUyu } from "./investing-usd-uyu.js";
import { parseAcgGanadoGordoHtml } from "./acg-ganado-gordo.js";
import { parseAcgGanadoReposicionHtml } from "./acg-ganado-reposicion.js";
import { fetchAcgHomeHtml } from "./acg-page.js";
import type { SegmentoPreciosGanado, PrecioGanadoInput } from "./precios-ganado-db.js";
import * as simVenta from "./simulador-venta-ganado-db.js";
import * as ventasAgri from "./ventas-agricultura-db.js";
import * as ventasArr from "./ventas-arrendamientos-db.js";
import {
  auditSimuladorActualizacion,
  auditSimuladorCreacion,
  auditSimuladorEliminacion,
  auditSimuladorPatch,
} from "./simulador-venta-audit.js";
import { normalizarTituloRubro } from "./text-normalize.js";
import {
  parseStockGanaderoBuffer,
  parseStockGanaderoFile,
  parseStockGanaderoText,
  normalizeStockGanaderoRows,
  applyDefaultEmpresaToStockRows,
} from "./parse-stock-ganadero-txt.js";
import type { DispositivoMetaPatch, StockGanaderoFilters } from "./stock-ganadero-db.js";
import type { StockEquinoFilters } from "./stock-equino-db.js";
import { parseTipoBaja, tipoBajaDesdeEstadoImport, type TipoBaja } from "./stock-ganadero-db.js";
import { auditBajasDispositivos, auditStockMovimiento, historialAutorFromRequest, historialAutorLabelFromRequest } from "./stock-audit.js";
import { type Empresa, type Presupuesto, type PresupuestoInput } from "./types.js";
import { empresasCuenta } from "./database.js";
import {
  assertGastosRubroRowWritable,
  gastosRubrosReadScopeFromRequest,
  gastosRubrosWriteCuentaId,
  type GastosRubrosReadScope,
} from "./gastos-rubros-scope.js";
import type { UserPublic } from "./auth-db.js";
import * as authDb from "./auth-db.js";
import {
  BROU_MAPEO_DEFAULT,
  normalizeComisionConfig,
  normalizeGastoCampoList,
  normalizeGastoMapeo,
} from "./gasto-campos.js";
import { extractTextFromBrouDocument } from "./extract-brou-document-text.js";
import { detectarCamposDocumento } from "./detect-document-fields.js";
import { extractValoresPorMapeo } from "./extract-valores-etiquetas.js";
import {
  looksLikeBrouTransferenciaComprobante,
  type BrouTransferenciaParsed,
  parseBrouTransferenciaText,
} from "./parse-brou-transferencia.js";
import {
  looksLikeSantanderEnElPais,
  parseSantanderEnElPais,
} from "./parse-santander-comprobante.js";
import * as presDoc from "./presupuesto-documentos-db.js";
import * as stockDispositivoFoto from "./stock-dispositivo-foto-db.js";
import * as stockControlSanitario from "./stock-control-sanitario-db.js";
import * as contribRural from "./contribucion-rural-calendarios-db.js";
import * as patenteSucive from "./patente-sucive-calendarios-db.js";
import * as bpsCajaRural from "./bps-caja-rural-calendarios-db.js";
import {
  OPERATIVA_TAREA_ESTADOS,
  type OperativaTareaEstado,
  type OperativaTareaListFilters,
} from "./operativa-tareas-db.js";
import * as primariaRural from "./primaria-rural-calendarios-db.js";
import * as vencImpPrefs from "./vencimientos-impuestos-prefs-db.js";
import * as notasDb from "./notas-db.js";
import { recordUserActivity } from "./user-activity.js";
import { clientIp } from "./auth-security.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const presupuestoDocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: presDoc.PRESUPUESTO_DOC_MAX_BYTES },
});

const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes JPG, PNG, WebP o GIF."));
    }
  },
});

function optionalTipoBaja(raw: unknown): TipoBaja | "" {
  if (typeof raw !== "string" || !raw.trim()) return "";
  try {
    return parseTipoBaja(raw);
  } catch {
    return "";
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";
const IS_VERCEL = process.env.VERCEL === "1";
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || (IS_PROD ? "0.0.0.0" : "127.0.0.1");
const CLIENT_DIST = path.join(__dirname, "../../client/dist");
const VITE_DEV_URL = process.env.SCG_VITE_URL || "http://127.0.0.1:5173";

let lastDbInitError: string | null = null;
let dbInitOk = false;
let dbInitPromise: Promise<void> | null = null;

const DB_INIT_TRANSIENT = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|Connection terminated|socket hang up|Client has encountered a connection error/i;

async function runDbInitAttempt(): Promise<void> {
  await db.initDb();
}

async function runDbInitWithRetry(maxAttempts = 5): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runDbInitAttempt();
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[SGG] Error al inicializar la base de datos (intento ${attempt}/${maxAttempts}):`,
        err
      );
      if (attempt < maxAttempts && DB_INIT_TRANSIENT.test(msg)) {
        try {
          await closePool();
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function beginDbInit(): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = runDbInitWithRetry()
      .then(() => {
        dbInitOk = true;
        lastDbInitError = null;
        console.info("[SGG] Base de datos lista");
        // Pre-calentar conexiones para que la primera ráfaga del dashboard no
        // pague la creación de todas las conexiones SSL a la vez.
        void warmupPool();
      })
      .catch((err) => {
        dbInitOk = false;
        lastDbInitError = err instanceof Error ? err.message : String(err);
        throw err;
      });
  }
  return dbInitPromise;
}

async function retryDbInitFromScratch(): Promise<boolean> {
  dbInitPromise = null;
  dbInitOk = false;
  lastDbInitError = null;
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  try {
    await beginDbInit();
    return dbInitOk;
  } catch {
    return false;
  }
}

const dbReady = beginDbInit();
void dbReady.catch(() => {
  /* lastDbInitError ya registrado */
});

const app = express();
if (process.env.SCG_TRUST_PROXY === "1" || IS_VERCEL) {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");
app.use(securityHeaders);
app.use(apiRateLimiter);
app.use(cors(getCorsOptions()));
app.use(cookieParser());
app.use(express.json({ limit: "512kb" }));

app.get("/api/health", async (_req, res) => {
  const passwordResetEmail = getPasswordResetEmailStatus();
  if (dbInitOk) {
    res.json({
      ok: true,
      service: "scg-api",
      database: "postgres",
      ready: true,
      password_reset_email: passwordResetEmail,
    });
    return;
  }

  if (!lastDbInitError) {
    try {
      await Promise.race([
        beginDbInit(),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch {
      /* init rechazado; se reporta abajo */
    }
  }

  if (lastDbInitError) {
    res.json({
      ok: true,
      service: "scg-api",
      database: "postgres",
      ready: false,
      error: "Base de datos no disponible",
      password_reset_email: passwordResetEmail,
      ...(clientSafeErrorDetail(lastDbInitError)
        ? { detail: clientSafeErrorDetail(lastDbInitError) }
        : {}),
    });
    return;
  }
  res.json({
    ok: true,
    service: "scg-api",
    database: "postgres",
    ready: dbInitOk,
    password_reset_email: passwordResetEmail,
  });
});

app.post("/api/health/retry-init", async (_req, res) => {
  if (dbInitOk) {
    res.json({ ok: true, ready: true });
    return;
  }
  const ok = await retryDbInitFromScratch();
  if (ok) {
    res.json({ ok: true, ready: true });
    return;
  }
  res.status(503).json({
    ok: true,
    ready: false,
    error: "Base de datos no disponible",
    ...(clientSafeErrorDetail(lastDbInitError)
      ? { detail: clientSafeErrorDetail(lastDbInitError) }
      : {}),
  });
});

app.use(async (req, res, next) => {
  if (req.path === "/api/health" || req.path === "/api/health/retry-init") {
    next();
    return;
  }
  try {
    await beginDbInit();
    next();
  } catch (err) {
    console.error("[SGG] Base de datos no disponible:", err);
    const hint = !process.env.DATABASE_URL?.trim()
      ? IS_VERCEL
        ? "Configurá DATABASE_URL en Vercel (Supabase → Transaction pooler, puerto 6543)."
        : "Creá server/.env (copiá .env.example) y pegá DATABASE_URL de Supabase — la misma URI que en Vercel."
      : lastDbInitError?.includes("db.") && lastDbInitError.includes("supabase.co")
        ? "Cambiá DATABASE_URL: no uses db.xxx.supabase.co:5432. Usá Transaction pooler (puerto 6543) desde Supabase."
        : lastDbInitError?.includes("password authentication failed")
          ? "Contraseña o usuario incorrectos en DATABASE_URL. Usuario pooler: postgres.mxcrpumaadtixlmnlgmj (no solo postgres). Reseteá la contraseña en Supabase → Database y pegá la URI completa."
          : lastDbInitError?.includes("Transaction pooler")
          ? lastDbInitError
          : lastDbInitError?.includes("EMAXCONN") ||
              lastDbInitError?.includes("max clients reached")
            ? dbCapacityHint()
          : "Revisá que DATABASE_URL sea la del pooler (6543) y que el proyecto Supabase esté activo.";
    res.status(503).json({
      ok: false,
      error: "Base de datos no disponible",
      hint,
      detail: lastDbInitError,
    });
  }
});
app.use(csrfOriginGuard);
app.use(authMiddleware);

registerAuthRoutes(app);
registerBillingRoutes(app);
registerChatRoutes(app);
console.info("[SGG Auth] Rutas de autenticación registradas");

function paramString(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

function setStockDispositivoFotoCacheHeaders(req: Request, res: Response): void {
  const v = req.query.v;
  if (typeof v === "string" && v.length > 0) {
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "private, max-age=3600");
  }
}

function wantsFotoThumb(req: Request): boolean {
  const raw = req.query.thumb;
  return raw === "1" || raw === "true";
}

function parseNum(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function isoDateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIso(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function parseFacturaBody(req: Request): Promise<PresupuestoInput> {
  const body = req.body as Record<string, unknown>;
  const user = req.user;
  const cuentaId = user ? await cuentaIdForUser(user) : null;
  let empresa = String(body.empresa ?? "").trim();
  if (user) {
    const permitidas = await empresasPermitidas(user);
    if (permitidas.length > 0 && !permitidas.includes(empresa)) {
      throw new Error("La empresa seleccionada no pertenece a su cuenta.");
    }
  }
  if (cuentaId != null && cuentaId > 0) {
    if (!(await empresasCuenta.isValidEmpresaNombreForCuenta(db.getDb(), empresa, cuentaId))) {
      throw new Error("Empresa inválida o no pertenece a su cuenta.");
    }
  } else if (!(await empresasCuenta.isValidEmpresaNombre(db.getDb(), empresa))) {
    throw new Error("Empresa inválida o inactiva.");
  }
  const fecha = String(body.fecha ?? "").trim();
  if (!fecha) throw new Error("La fecha es obligatoria.");
  const concepto = String(body.concepto ?? "").trim();
  const rubro = String(body.rubro ?? "").trim();
  const sub_rubro = String(body.sub_rubro ?? "").trim();
  const responsable_gasto = String(body.responsable_gasto ?? "").trim();
  let funcionario_cedula = String(body.funcionario_cedula ?? "").trim();
  if (!rubro) throw new Error("El rubro es obligatorio.");
  const rubrosReadScope = gastosRubrosReadScopeForUser(user!);
  if (!await db.rubros.gastoValido(rubro, rubrosReadScope)) {
    throw new Error(
      "El rubro debe existir en Configuración → Rubros (grupo con sub-rubros activos)."
    );
  }
  const esComisionBancaria =
    String(body.nro_operacion_origen ?? "")
      .trim()
      .toUpperCase()
      .endsWith("-COM") ||
    sub_rubro.toLowerCase().startsWith("comisiones bancarias");
  if (sub_rubro && !esComisionBancaria) {
    if (!await db.subRubros.existsActivo(sub_rubro, rubrosReadScope)) {
      throw new Error(
        "El sub-rubro debe existir en el catálogo SUB_RUBROS y estar activo."
      );
    }
    if (!await db.rubroVinculos.isValidPair(rubro, sub_rubro, rubrosReadScope)) {
      throw new Error(
        "El sub-rubro no está vinculado a este rubro. Configuralo en Rubros → Configuración vínculos."
      );
    }
  }
  const rubroSueldos = db.funcionarios.esRubroRemuneracion(rubro, sub_rubro);

  if (rubroSueldos && responsable_gasto && !funcionario_cedula) {
    const porNombre = await db.funcionarios.getByNombreDisplay(responsable_gasto, cuentaId);
    if (porNombre) funcionario_cedula = porNombre.cedula;
  }

  if (
    responsable_gasto &&
    !rubroSueldos &&
    !await db.responsables.existsActivo(responsable_gasto, cuentaId)
  ) {
    throw new Error(
      "El presupuesto asignado debe existir en el catálogo y estar activo."
    );
  }

  if (rubroSueldos && responsable_gasto) {
    const f =
      (funcionario_cedula ? await db.funcionarios.getByCedula(funcionario_cedula, cuentaId) : undefined) ??
      await db.funcionarios.getByNombreDisplay(responsable_gasto, cuentaId);
    if (f) {
      if (!f.activo) {
        throw new Error(
          "El empleado debe estar ACTIVO en Recursos Humanos → Funcionarios."
        );
      }
      funcionario_cedula = f.cedula;
    } else if (!await db.responsables.existsActivo(responsable_gasto, cuentaId)) {
      throw new Error(
        "Presupuesto asignado: elegí un empleado activo de RRHH o un nombre del catálogo Presupuesto asignado."
      );
    } else {
      funcionario_cedula = "";
    }
  } else if (funcionario_cedula) {
    const f = await db.funcionarios.getByCedula(funcionario_cedula, cuentaId);
    if (!f || !f.activo) {
      throw new Error(
        "El funcionario (cédula) debe existir en Recursos Humanos → Funcionarios y estar activo."
      );
    }
    funcionario_cedula = f.cedula;
  }

  return {
    empresa: empresa as Empresa,
    fecha,
    codigo_proveedor: String(body.codigo_proveedor ?? "").trim(),
    razon_social_proveedor: String(body.razon_social_proveedor ?? "").trim(),
    concepto,
    observaciones: String(body.observaciones ?? "").trim(),
    rubro,
    sub_rubro,
    responsable_gasto,
    funcionario_cedula,
    nro_factura: String(body.nro_factura ?? "").trim(),
    nro_operacion_origen: String(body.nro_operacion_origen ?? "").trim(),
    pesos: parseNum(body.pesos),
    dolares_usd: parseNum(body.dolares_usd),
    reales: parseNum(body.reales),
    tc_usd: parseNum(body.tc_usd),
    tc_reales: parseNum(body.tc_reales),
    saldo_usd: parseNum(body.saldo_usd),
    tipo_comprobante: "FACTURA" as const,
    presupuesto_origen_id: null,
    nro_nota_credito: "",
  };
}

async function parseNotaCreditoBody(
  req: Request,
  excludeNcId?: number | null,
): Promise<PresupuestoInput> {
  const body = req.body as Record<string, unknown>;
  const user = req.user!;
  const origenId = Number(body.presupuesto_origen_id);
  if (!Number.isFinite(origenId) || origenId <= 0) {
    throw new Error("Seleccioná la factura o gasto a anular.");
  }
  const origen = await db.getPresupuesto(origenId);
  if (!origen) throw new Error("La factura/gasto origen no existe.");
  if (!(await puedeAccederPresupuesto(origen, user))) {
    throw new Error("No tenés permiso para anular ese registro.");
  }
  if ((origen.tipo_comprobante ?? "FACTURA") === "NOTA_CREDITO") {
    throw new Error("No se puede aplicar una nota de crédito sobre otra nota de crédito.");
  }

  const fecha = String(body.fecha ?? "").trim() || origen.fecha;
  if (!fecha) throw new Error("La fecha es obligatoria.");
  const nro_nota_credito = String(body.nro_nota_credito ?? "").trim();
  if (!nro_nota_credito) throw new Error("Ingresá el número de la nota de crédito.");

  const modo = String(body.modo_nc ?? body.modo ?? "total").trim().toLowerCase();
  const esTotal = modo !== "parcial";
  const pendiente = await db.saldoPendienteFacturaUsd(origen, excludeNcId);
  if (pendiente <= 0.0001) {
    throw new Error("Esa factura ya está totalmente anulada por notas de crédito.");
  }

  const saldoFinal = esTotal
    ? Math.round(-pendiente * 100) / 100
    : (() => {
        const montoNcUsd = Math.abs(parseNum(body.saldo_usd));
        if (!(montoNcUsd > 0)) {
          throw new Error("Ingresá el importe de la nota de crédito parcial.");
        }
        if (montoNcUsd > pendiente + 0.02) {
          throw new Error(
            `El importe supera el saldo pendiente (USD ${pendiente.toFixed(2)}).`,
          );
        }
        return Math.round(-montoNcUsd * 100) / 100;
      })();

  const scale =
    Math.abs(origen.saldo_usd) > 0.0001
      ? Math.abs(saldoFinal) / Math.abs(origen.saldo_usd)
      : 1;
  const scaleNeg = (n: number) => Math.round(-Math.abs(n) * scale * 100) / 100;

  const conceptoDefault = origen.nro_factura?.trim()
    ? `NC — Factura ${origen.nro_factura.trim()}`
    : `NC — Op. ${origen.nro_registro}`;
  const concepto = String(body.concepto ?? "").trim() || conceptoDefault;

  return {
    empresa: origen.empresa,
    fecha,
    codigo_proveedor: origen.codigo_proveedor,
    razon_social_proveedor: origen.razon_social_proveedor,
    concepto,
    observaciones: String(body.observaciones ?? "").trim(),
    rubro: origen.rubro,
    sub_rubro: origen.sub_rubro,
    responsable_gasto: origen.responsable_gasto,
    funcionario_cedula: origen.funcionario_cedula,
    nro_factura: origen.nro_factura,
    nro_operacion_origen: String(body.nro_operacion_origen ?? "").trim(),
    pesos: scaleNeg(origen.pesos),
    dolares_usd: scaleNeg(origen.dolares_usd),
    reales: scaleNeg(origen.reales),
    tc_usd: origen.tc_usd,
    tc_reales: origen.tc_reales,
    saldo_usd: saldoFinal,
    tipo_comprobante: "NOTA_CREDITO",
    presupuesto_origen_id: origen.id,
    nro_nota_credito,
  };
}

async function parseBody(req: Request): Promise<PresupuestoInput> {
  const body = req.body as Record<string, unknown>;
  const tipo = String(body.tipo_comprobante ?? "FACTURA").trim().toUpperCase();
  if (tipo === "NOTA_CREDITO") {
    const excludeId =
      req.method === "PUT" && req.params.id ? Number(req.params.id) : null;
    return parseNotaCreditoBody(req, excludeId);
  }
  return parseFacturaBody(req);
}

app.get("/api/catalogos", async (req, res) => {
  res.json({ ok: true, ...(await db.getCatalogos(req.user)) });
});

app.get("/api/empresas-operativas", async (req, res) => {
  const user = req.user!;
  const formato = String(req.query.formato ?? "nombre").toLowerCase();
  const scopeUser = {
    id: user.id,
    email: user.email,
    es_super_admin: user.es_super_admin,
    empresa_id: user.empresa_id,
  };
  if (formato === "stock") {
    const detalle = await empresasCuenta.getEmpresasOperativasDetallePermitidas(
      db.getDb(),
      scopeUser
    );
    res.json({ ok: true, data: detalle });
    return;
  }
  if (formato === "codigo") {
    const permitidas = await empresasCuenta.getEmpresasCodigosOperativasPermitidas(
      db.getDb(),
      scopeUser
    );
    res.json({ ok: true, data: permitidas ?? [] });
    return;
  }
  const permitidas = await empresasCuenta.getEmpresasOperativasPermitidas(
    db.getDb(),
    scopeUser
  );
  res.json({
    ok: true,
    data: permitidas ?? [],
  });
});

async function puedeAccederPresupuesto(row: Presupuesto, user: UserPublic): Promise<boolean> {
  const cuentaId = await cuentaIdForScopedRead(user);
  if (
    cuentaId != null &&
    cuentaId > 0 &&
    row.cuenta_id != null &&
    Number(row.cuenta_id) !== cuentaId
  ) {
    return false;
  }
  const permitidas = await empresasPermitidas(user);
  if (permitidas.length > 0 && !permitidas.includes(row.empresa)) {
    return false;
  }
  if (
    user.rol === "admin" ||
    user.rol === "editor" ||
    user.rol === "gestor_n2" ||
    user.rol === "consulta"
  ) {
    return true;
  }
  const owner = (row.ingresado_por_email ?? "").trim().toLowerCase();
  return owner !== "" && owner === user.email.trim().toLowerCase();
}

function queryFlag(value: unknown): boolean {
  return value === "1" || value === "true" || value === "yes";
}

async function empresasPermitidas(user: UserPublic): Promise<string[]> {
  const scope = await empresasCuenta.getEmpresasScopeFilter(db.getDb(), user);
  if (scope === undefined) return [];
  return scope;
}

/** cuenta_id para FILTRAR lecturas: número = su cuenta; null = super admin (ve todo). */
async function cuentaIdForUser(user: UserPublic): Promise<number | null> {
  return await empresasCuenta.resolveCuentaMadreIdForUser(db.getDb(), user);
}

/** Scope de lectura OPERATIVA: gastos, stock, RRHH, etc. Siempre acotado a la cuenta del usuario. */
async function cuentaIdForScopedRead(user: UserPublic): Promise<number | null> {
  return await cuentaIdForUser(user);
}

/** cuenta_id para INSERTAR: su cuenta, o VILA DIAZ como fallback para super admin. */
async function cuentaIdParaInsert(user: UserPublic): Promise<number | null> {
  return await empresasCuenta.cuentaIdParaInsert(db.getDb(), user);
}

/** Scope de lectura del catálogo venta-sub-rubros; undefined = usuario sin cuenta. */
async function ventaRubrosCuentaReadScope(
  user: UserPublic
): Promise<number | null | undefined> {
  const cuentaId = await cuentaIdForScopedRead(user);
  if (!user.es_super_admin && cuentaId == null) return undefined;
  return cuentaId;
}

function requireVentaRubrosManage(req: Request, res: Response): boolean {
  const user = req.user!;
  if (user.rol === "admin" || user.rol === "editor") return true;
  res.status(403).json({
    ok: false,
    error:
      "Solo administradores y gestores nivel 1 pueden modificar el catálogo de rubros de ventas",
  });
  return false;
}

/** Cuenta efectiva para altas/ediciones del catálogo de ventas. */
async function ventaRubrosCuentaWriteScope(user: UserPublic): Promise<number | null> {
  return (await cuentaIdForUser(user)) ?? (await cuentaIdParaInsert(user));
}

function gastosRubrosSagMode(req: Request): boolean {
  const raw = req.query.ambito ?? (req.body as Record<string, unknown> | undefined)?.ambito;
  return (
    req.user?.es_super_admin === true &&
    String(raw ?? "")
      .trim()
      .toLowerCase() === "sag"
  );
}

function gastosRubrosReadScopeOr403(
  req: Request,
  res: Response
): GastosRubrosReadScope | null {
  const user = req.user!;
  const scope = gastosRubrosReadScopeFromRequest(
    user,
    req.query as Record<string, unknown>
  );
  if (scope.mode === "cuenta" && scope.cuentaId == null && !user.es_super_admin) {
    res.status(403).json({ ok: false, error: "Sin cuenta operativa asignada" });
    return null;
  }
  return scope;
}

function gastosRubrosReadScopeForUser(user: UserPublic): GastosRubrosReadScope {
  const cuentaId = user.cuenta_actividad_id ?? user.empresa_id ?? null;
  return {
    mode: "cuenta",
    cuentaId: cuentaId != null && cuentaId > 0 ? cuentaId : null,
  };
}

/** Etiquetas creado_por de todos los usuarios de la cuenta (para marcas más usadas). */
async function autoresLabelsForMarcaScope(user: UserPublic): Promise<string[]> {
  const labels = new Set<string>();
  const self = (user.nombre ?? "").trim() || (user.email ?? "").trim();
  if (self) labels.add(self);

  const cuentaId = await cuentaIdForUser(user);
  if (cuentaId != null) {
    const users = await authDb.listUsers(db.getDb(), {
      empresa_id: cuentaId,
      incluir_admin_id: user.id,
    });
    for (const u of users) {
      const nombre = (u.nombre ?? "").trim();
      const email = (u.email ?? "").trim();
      if (nombre) labels.add(nombre);
      if (email) labels.add(email);
    }
  }

  return [...labels];
}

async function stockGanaderoFiltersFromRequest(
  req: Request,
  base: StockGanaderoFilters = {}
): Promise<StockGanaderoFilters> {
  const user = req.user;
  if (!user) return base;
  let filters: StockGanaderoFilters = { ...base };
  const empresas = await empresasCuenta.getEmpresasCodigosScopeFilter(db.getDb(), user);
  if (empresas) filters = { ...filters, empresas };
  const lecturasScope = await stockLecturasFiltersFromRequest(req, {});
  if (lecturasScope.cuenta_id != null) {
    filters = { ...filters, cuenta_id: lecturasScope.cuenta_id };
  }
  return filters;
}

async function stockEquinoFiltersFromRequest(
  req: Request,
  base: StockEquinoFilters = {}
): Promise<StockEquinoFilters> {
  const user = req.user;
  if (!user) return base;
  let filters: StockEquinoFilters = { ...base };
  const empresas = await empresasCuenta.getEmpresasCodigosScopeFilter(db.getDb(), user);
  if (empresas) filters = { ...filters, empresas };
  const lecturasScope = await stockLecturasFiltersFromRequest(req, {});
  if (lecturasScope.cuenta_id != null) {
    filters = { ...filters, cuenta_id: lecturasScope.cuenta_id };
  }
  return filters;
}

/** Filtro por cuenta madre para lotes y lecturas importadas. */
async function stockLecturasFiltersFromRequest(
  req: Request,
  base: StockGanaderoFilters = {}
): Promise<StockGanaderoFilters> {
  const user = req.user;
  if (!user) return base;
  if (user.es_super_admin) {
    const cuentaId = await cuentaIdForUser(user);
    if (cuentaId == null) return base;
    return { ...base, cuenta_id: cuentaId };
  }
  const cuentaId = await cuentaIdForUser(user);
  if (!cuentaId) return { ...base, cuenta_id: 0 };
  return { ...base, cuenta_id: cuentaId };
}

async function assertLoteEnCuentaUsuario(req: Request, loteId: number): Promise<void> {
  const lote = await db.stockGanadero.getLote(loteId);
  if (!lote) throw new Error("Lote no encontrado");
  const user = req.user!;
  const cuentaId = await cuentaIdForUser(user);
  if (cuentaId == null && user.es_super_admin) return;
  const loteCuenta = lote.cuenta_id ?? null;
  if (!cuentaId || loteCuenta !== cuentaId) {
    throw new Error("Sin permiso sobre esta importación");
  }
}

async function assertLoteEquinoEnCuentaUsuario(req: Request, loteId: number): Promise<void> {
  const lote = await db.stockEquino.getLote(loteId);
  if (!lote) throw new Error("Lote no encontrado");
  const user = req.user!;
  if (user.es_super_admin) return;
  const cuentaId = await cuentaIdForUser(user);
  const loteCuenta = lote.cuenta_id ?? null;
  if (!cuentaId || loteCuenta !== cuentaId) {
    throw new Error("Sin permiso sobre esta importación");
  }
}

function stockGanaderoQueryBase(req: Request): StockGanaderoFilters {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const estadoRaw = String(req.query.estado_dispositivo ?? "").toUpperCase();
  const estadoDispositivo =
    estadoRaw === "MUERTO" ||
    estadoRaw === "VENDIDO" ||
    estadoRaw === "FRIGORIFICO" ||
    estadoRaw === "PERDIDO"
      ? estadoRaw
      : undefined;
  return {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    estado_dispositivo: estadoDispositivo,
  };
}

function stockEquinoQueryBase(req: Request): StockEquinoFilters {
  return stockGanaderoQueryBase(req) as StockEquinoFilters;
}

async function applyEmpresaScopeToFilters(
  filters: db.ListFilters,
  user: UserPublic
): Promise<db.ListFilters> {
  const permitidas = await empresasPermitidas(user);
  if (permitidas.length === 0) {
    return { ...filters, empresas: ["__sin_empresas__"] };
  }
  if (filters.empresa && permitidas.includes(filters.empresa)) {
    return filters;
  }
  return { ...filters, empresa: undefined, empresas: permitidas };
}

async function resumenEmpresaScope(
  user: UserPublic,
  empresa?: string
): Promise<db.ResumenEmpresaScope> {
  const cuentaId = await cuentaIdForScopedRead(user);
  const cuentaScope: db.ResumenEmpresaScope =
    cuentaId != null && cuentaId > 0 ? { cuenta_id: cuentaId } : {};

  const permitidas = await empresasPermitidas(user);
  if (permitidas.length === 0) {
    return { ...cuentaScope, empresas: ["__sin_empresas__"] };
  }
  if (empresa && permitidas.includes(empresa)) {
    return { ...cuentaScope, empresa };
  }
  return { ...cuentaScope, empresas: permitidas };
}

async function presupuestoListFilters(req: Request): Promise<db.ListFilters> {
  const user = req.user!;
  const filters: db.ListFilters = {
    empresa: req.query.empresa as string | undefined,
    rubro: req.query.rubro as string | undefined,
    responsable_gasto: req.query.responsable_gasto as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
  };
  const cuentaId = await cuentaIdForScopedRead(user);
  if (cuentaId != null && cuentaId > 0) {
    filters.cuenta_id = cuentaId;
  }
  const soloMios = queryFlag(req.query.solo_mios);
  const verTodos = queryFlag(req.query.ver_todos);

  if (user.rol === "admin") {
    if (soloMios) {
      filters.ingresado_por_email = user.email;
    }
    return await applyEmpresaScopeToFilters(filters, user);
  }

  if (verTodos && (user.rol === "editor" || user.rol === "gestor_n2" || user.rol === "consulta")) {
    return await applyEmpresaScopeToFilters(filters, user);
  }

  filters.ingresado_por_email = user.email;
  return await applyEmpresaScopeToFilters(filters, user);
}

app.get("/api/presupuesto", async (req, res) => {
  const data = await db.listPresupuesto(await presupuestoListFilters(req));
  res.json({ ok: true, data });
});

app.get("/api/contribucion-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  res.json({ ok: true, data: contribRural.loadContribucionRuralCalendarios() });
});

app.put("/api/contribucion-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  if (req.user.rol !== "admin" || !req.user.es_super_admin) {
    res.status(403).json({ ok: false, error: "Solo el superadministrador puede actualizar calendarios" });
    return;
  }
  try {
    const body = req.body as contribRural.ContribucionRuralCalendariosStore;
    const saved = contribRural.saveContribucionRuralCalendarios(
      body,
      req.user.nombre || req.user.email,
    );
    res.json({ ok: true, data: saved });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Datos de calendario inválidos",
    });
  }
});

app.get("/api/patente-sucive/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  res.json({ ok: true, data: patenteSucive.loadPatenteSuciveCalendarios() });
});

app.put("/api/patente-sucive/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  if (req.user.rol !== "admin" || !req.user.es_super_admin) {
    res.status(403).json({ ok: false, error: "Solo el superadministrador puede actualizar calendarios" });
    return;
  }
  try {
    const body = req.body as patenteSucive.PatenteSuciveCalendariosStore;
    const saved = patenteSucive.savePatenteSuciveCalendarios(
      body,
      req.user.nombre || req.user.email,
    );
    res.json({ ok: true, data: saved });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Datos de calendario inválidos",
    });
  }
});

app.get("/api/bps-caja-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  res.json({ ok: true, data: bpsCajaRural.loadBpsCajaRuralCalendarios() });
});

app.put("/api/bps-caja-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  if (req.user.rol !== "admin" || !req.user.es_super_admin) {
    res.status(403).json({ ok: false, error: "Solo el superadministrador puede actualizar calendarios" });
    return;
  }
  try {
    const body = req.body as bpsCajaRural.BpsCajaRuralCalendariosStore;
    const saved = bpsCajaRural.saveBpsCajaRuralCalendarios(
      body,
      req.user.nombre || req.user.email,
    );
    res.json({ ok: true, data: saved });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Datos de calendario inválidos",
    });
  }
});

app.get("/api/primaria-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  res.json({ ok: true, data: primariaRural.loadPrimariaRuralCalendarios() });
});

app.put("/api/primaria-rural/calendarios", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  if (req.user.rol !== "admin" || !req.user.es_super_admin) {
    res.status(403).json({ ok: false, error: "Solo el superadministrador puede actualizar calendarios" });
    return;
  }
  try {
    const body = req.body as primariaRural.PrimariaRuralCalendariosStore;
    const saved = primariaRural.savePrimariaRuralCalendarios(
      body,
      req.user.nombre || req.user.email,
    );
    res.json({ ok: true, data: saved });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Datos de calendario inválidos",
    });
  }
});

app.get("/api/vencimientos-impuestos/bootstrap", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  const cuentaId = await cuentaIdForUser(req.user);
  const preferencias =
    cuentaId != null
      ? await vencImpPrefs.getCuentaVencimientosPrefs(db.getDb(), cuentaId)
      : null;
  res.json({
    ok: true,
    data: {
      rural: contribRural.loadContribucionRuralCalendarios(),
      patente: patenteSucive.loadPatenteSuciveCalendarios(),
      bps: bpsCajaRural.loadBpsCajaRuralCalendarios(),
      primaria: primariaRural.loadPrimariaRuralCalendarios(),
      preferencias,
    },
  });
});

app.get("/api/vencimientos-impuestos/preferencias", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  const cuentaId = await cuentaIdForUser(req.user);
  if (cuentaId == null) {
    res.json({ ok: true, data: null });
    return;
  }
  const prefs = await vencImpPrefs.getCuentaVencimientosPrefs(db.getDb(), cuentaId);
  res.json({ ok: true, data: prefs });
});

app.put("/api/vencimientos-impuestos/preferencias", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  const cuentaId = await cuentaIdParaInsert(req.user);
  if (cuentaId == null) {
    res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta para guardar las preferencias." });
    return;
  }
  try {
    const body = req.body as vencImpPrefs.CuentaVencimientosImpuestosPrefsInput;
    if (!Array.isArray(body.jurisdiccion_ids)) {
      res.status(400).json({ ok: false, error: "Departamentos inválidos." });
      return;
    }
    const saved = await vencImpPrefs.saveCuentaVencimientosPrefs(
      db.getDb(),
      cuentaId,
      req.user.id,
      {
        jurisdiccion_ids: body.jurisdiccion_ids,
        modalidad_pago: body.modalidad_pago,
        modalidad_pago_patente: body.modalidad_pago_patente,
        planes_cuotas_por_jurisdiccion: body.planes_cuotas_por_jurisdiccion,
        seguir_patente_sucive: body.seguir_patente_sucive,
        seguir_bps_caja_rural: body.seguir_bps_caja_rural,
        seguir_primaria_rural: body.seguir_primaria_rural,
        regimen_primaria_rural: body.regimen_primaria_rural,
        onboarding_completado: body.onboarding_completado ?? true,
      },
    );
    res.json({ ok: true, data: saved });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Preferencias inválidas",
    });
  }
});

function notaCompartidaConEquipo(nota: {
  compartida?: boolean | number;
  compartidos_con?: { id: number }[];
}): boolean {
  return Boolean(Number(nota.compartida ?? 0)) || (nota.compartidos_con?.length ?? 0) > 0;
}

async function logNotaCompartidaActividad(
  user: UserPublic,
  accion: "creó" | "editó" | "eliminó",
  titulo: string,
  req: Request
): Promise<void> {
  const label = titulo.trim() || "Sin título";
  const verbo = accion === "creó" ? "Creó" : accion === "editó" ? "Editó" : "Eliminó";
  await recordUserActivity(
    user,
    "accion",
    `${verbo} una nota compartida con el equipo: «${label.slice(0, 80)}»`,
    { ip: clientIp(req), userAgent: req.headers["user-agent"] }
  );
}

app.get("/api/notas", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  try {
    const cuentaId = await cuentaIdParaInsert(req.user);
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : undefined;
    const data = await notasDb.listNotasVisibles(db.getDb(), req.user.id, cuentaId, limit);
    res.json({ ok: true, data });
  } catch (e) {
    console.error("[SGG] /api/notas:", e);
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar notas",
    });
  }
});

app.post("/api/asistente/consultar", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  try {
    const pregunta = String((req.body as { pregunta?: string } | null)?.pregunta ?? "").trim();
    if (!pregunta) {
      res.status(400).json({ ok: false, error: "Escribí una pregunta." });
      return;
    }
    if (pregunta.length > 500) {
      res.status(400).json({ ok: false, error: "La pregunta es demasiado larga." });
      return;
    }
    const { consultarAsistente } = await import("./asistente.js");
    const stockFilters = await stockGanaderoFiltersFromRequest(req);
    const resumenScope = await resumenEmpresaScope(req.user);
    const data = await consultarAsistente(db.getDb(), req.user, pregunta, {
      stockFilters,
      resumenScope,
    });
    res.json({ ok: true, data });
  } catch (e) {
    console.error("[SGG] /api/asistente/consultar:", e);
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al consultar el asistente",
    });
  }
});

app.post("/api/notas", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  try {
    const body = req.body as notasDb.NotaInput;
    const cuentaId = await cuentaIdParaInsert(req.user);
    const data = await notasDb.createNota(db.getDb(), req.user.id, cuentaId, body);
    if (notaCompartidaConEquipo(data)) {
      await logNotaCompartidaActividad(req.user, "creó", data.titulo, req);
    }
    res.status(201).json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/notas/:id", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdParaInsert(req.user);
  const data = await notasDb.getNotaVisible(db.getDb(), id, req.user.id, cuentaId);
  if (!data) {
    res.status(404).json({ ok: false, error: "Nota no encontrada" });
    return;
  }
  res.json({ ok: true, data });
});

app.put("/api/notas/:id", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  try {
    const id = Number(req.params.id);
    const body = req.body as notasDb.NotaInput;
    const cuentaId = await cuentaIdParaInsert(req.user);
    const data = await notasDb.updateNota(db.getDb(), id, req.user.id, cuentaId, body);
    if (notaCompartidaConEquipo(data)) {
      await logNotaCompartidaActividad(req.user, "editó", data.titulo, req);
    }
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/notas/:id", async (req, res) => {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return;
  }
  try {
    const id = Number(req.params.id);
    const prev = await notasDb.getNotaPropia(db.getDb(), id, req.user.id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Nota no encontrada" });
      return;
    }
    await notasDb.deleteNota(db.getDb(), id, req.user.id);
    if (notaCompartidaConEquipo(prev)) {
      await logNotaCompartidaActividad(req.user, "eliminó", prev.titulo, req);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/presupuesto/siguiente-operacion", async (_req, res) => {
  const nro = await db.peekNextNroRegistro();
  res.json({
    ok: true,
    data: {
      nro_registro: nro,
      numero_operacion: db.formatNumeroOperacion(nro),
    },
  });
});

app.get("/api/presupuesto/facturas-para-nc", async (req, res) => {
  try {
    const codigo_proveedor = String(req.query.codigo_proveedor ?? "").trim();
    if (!codigo_proveedor) {
      res.status(400).json({ ok: false, error: "Indicá el proveedor." });
      return;
    }
    const empresa = String(req.query.empresa ?? "").trim() || undefined;
    const lecturasScope = await presupuestoListFilters(req);
    const data = await db.listFacturasParaNc({
      codigo_proveedor,
      empresa,
      cuenta_id: lecturasScope.cuenta_id ?? null,
    });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "No se pudieron cargar las facturas",
    });
  }
});

async function cuentaIdPresupuestoWrite(user: UserPublic): Promise<number | null> {
  return await cuentaIdParaInsert(user);
}

app.get("/api/presupuesto/automatizacion", async (req, res) => {
  try {
    const cuentaId = await cuentaIdPresupuestoWrite(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    await db.gastosAutomatizacion.syncPendientes(cuentaId);
    const plantillas = await db.gastosAutomatizacion.list(cuentaId);
    const pendientes = await db.gastosAutomatizacion.listPendientes(cuentaId, {
      soloPendientes: true,
    });
    res.json({ ok: true, data: { plantillas, pendientes } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar automatizaciones",
    });
  }
});

app.post("/api/presupuesto/automatizacion/sync", async (req, res) => {
  try {
    const cuentaId = await cuentaIdPresupuestoWrite(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const creados = await db.gastosAutomatizacion.syncPendientes(cuentaId);
    res.json({ ok: true, data: { creados } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al sincronizar pendientes",
    });
  }
});

app.post("/api/presupuesto/automatizacion", async (req, res) => {
  try {
    const user = req.user!;
    const cuentaId = await cuentaIdPresupuestoWrite(user);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const presupuestoId = Number(body.presupuesto_id);
    const diaMes = Number(body.dia_mes);
    const nombre = String(body.nombre ?? "").trim();
    if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
      throw new Error("Seleccioná un gasto válido.");
    }
    if (!nombre) throw new Error("El nombre de la automatización es obligatorio.");

    const presupuesto = await db.getPresupuesto(presupuestoId);
    if (!presupuesto) {
      res.status(404).json({ ok: false, error: "Gasto no encontrado" });
      return;
    }
    if (!(await puedeAccederPresupuesto(presupuesto, user))) {
      res.status(403).json({ ok: false, error: "No tenés permiso para automatizar este gasto" });
      return;
    }

    const overrides: Record<string, unknown> = {};
    const strFields = [
      "empresa",
      "codigo_proveedor",
      "razon_social_proveedor",
      "concepto",
      "observaciones",
      "rubro",
      "sub_rubro",
      "responsable_gasto",
      "funcionario_cedula",
      "nro_factura",
      "nro_operacion_origen",
    ] as const;
    for (const key of strFields) {
      if (body[key] != null) overrides[key] = String(body[key]);
    }
    const numFields = [
      "pesos",
      "dolares_usd",
      "reales",
      "tc_usd",
      "tc_reales",
      "saldo_usd",
    ] as const;
    for (const key of numFields) {
      if (body[key] != null) overrides[key] = Number(body[key]);
    }

    const plantilla = await db.gastosAutomatizacion.createFromPresupuesto(
      cuentaId,
      presupuesto,
      {
        nombre,
        dia_mes: diaMes,
        intervalo_meses: body.intervalo_meses != null ? Number(body.intervalo_meses) : 1,
        fecha_inicio:
          typeof body.fecha_inicio === "string" ? body.fecha_inicio : undefined,
        responsable_user_id: user.id,
        responsable_email: user.email,
        responsable_nombre: user.nombre,
        creado_por_user_id: user.id,
        creado_por_email: user.email,
        creado_por_nombre: user.nombre,
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      },
    );
    res.status(201).json({ ok: true, data: plantilla });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al crear automatización",
    });
  }
});

app.patch("/api/presupuesto/automatizacion/:id", async (req, res) => {
  try {
    const user = req.user!;
    const cuentaId = await cuentaIdPresupuestoWrite(user);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    const prev = await db.gastosAutomatizacion.getById(cuentaId, id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Automatización no encontrada" });
      return;
    }
    if (!db.gastosAutomatizacion.esResponsable(prev, user)) {
      res.status(403).json({
        ok: false,
        error: "Solo el responsable puede modificar esta automatización",
      });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const input: Record<string, unknown> = {};
    const strFields = [
      "nombre",
      "empresa",
      "codigo_proveedor",
      "razon_social_proveedor",
      "concepto",
      "observaciones",
      "rubro",
      "sub_rubro",
      "responsable_gasto",
      "funcionario_cedula",
      "nro_factura",
      "nro_operacion_origen",
    ] as const;
    for (const key of strFields) {
      if (body[key] != null) input[key] = String(body[key]);
    }
    const numFields = [
      "pesos",
      "dolares_usd",
      "reales",
      "tc_usd",
      "tc_reales",
      "saldo_usd",
      "dia_mes",
      "intervalo_meses",
      "fecha_inicio",
    ] as const;
    for (const key of numFields) {
      if (body[key] != null) input[key] = Number(body[key]);
    }
    if (body.fecha_inicio != null) input.fecha_inicio = String(body.fecha_inicio);
    if (body.activo != null) input.activo = Boolean(body.activo);

    const updated = await db.gastosAutomatizacion.update(cuentaId, id, input);
    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar automatización",
    });
  }
});

app.delete("/api/presupuesto/automatizacion/:id", async (req, res) => {
  try {
    const user = req.user!;
    const cuentaId = await cuentaIdPresupuestoWrite(user);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    const prev = await db.gastosAutomatizacion.getById(cuentaId, id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Automatización no encontrada" });
      return;
    }
    if (!db.gastosAutomatizacion.esResponsable(prev, user)) {
      res.status(403).json({
        ok: false,
        error: "Solo el responsable puede eliminar esta automatización",
      });
      return;
    }
    await db.gastosAutomatizacion.delete(cuentaId, id);
    res.json({ ok: true, message: "Automatización eliminada" });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar automatización",
    });
  }
});

app.post("/api/presupuesto/automatizacion/pendientes/:id/aprobar", async (req, res) => {
  try {
    const user = req.user!;
    const cuentaId = await cuentaIdPresupuestoWrite(user);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    const item = await db.gastosAutomatizacion.getPendienteById(cuentaId, id);
    if (!item) {
      res.status(404).json({ ok: false, error: "Solicitud no encontrada" });
      return;
    }
    if (!db.gastosAutomatizacion.esResponsable(item.plantilla, user)) {
      res.status(403).json({
        ok: false,
        error: "Solo el administrador de la cuenta puede aprobar este pago automático",
      });
      return;
    }
    const result = await db.gastosAutomatizacion.aprobarPendiente(cuentaId, id, {
      email: user.email,
      nombre: user.nombre,
    });
    res.json({
      ok: true,
      data: result,
      message: "Pago registrado correctamente",
      nro_registro: result.presupuesto.nro_registro,
    });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al aprobar el pago",
    });
  }
});

app.post("/api/presupuesto/automatizacion/pendientes/:id/rechazar", async (req, res) => {
  try {
    const user = req.user!;
    const cuentaId = await cuentaIdPresupuestoWrite(user);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    const item = await db.gastosAutomatizacion.getPendienteById(cuentaId, id);
    if (!item) {
      res.status(404).json({ ok: false, error: "Solicitud no encontrada" });
      return;
    }
    if (!db.gastosAutomatizacion.esResponsable(item.plantilla, user)) {
      res.status(403).json({
        ok: false,
        error: "Solo el administrador de la cuenta puede omitir este pago automático",
      });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const nota = typeof body.nota === "string" ? body.nota : "";
    const pendiente = await db.gastosAutomatizacion.rechazarPendiente(
      cuentaId,
      id,
      { email: user.email, nombre: user.nombre },
      nota,
    );
    res.json({ ok: true, data: pendiente, message: "Pago automático omitido para este mes" });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al rechazar el ingreso",
    });
  }
});

app.get("/api/presupuesto/:id", async (req, res) => {
  const id = Number(req.params.id);
  const reg = await db.getPresupuesto(id);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  if (!(await puedeAccederPresupuesto(reg, req.user!))) {
    res.status(403).json({ ok: false, error: "No tenés permiso para ver este registro" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/presupuesto", async (req, res) => {
  try {
    const payload = await parseBody(req);
    const user = req.user!;
    const cuentaId = (await cuentaIdParaInsert(user)) ?? (await cuentaIdForUser(user));
    const reg = await db.insertPresupuesto(
      payload,
      {
        email: user.email,
        nombre: user.nombre,
      },
      cuentaId,
    );
    res.status(201).json({
      ok: true,
      data: reg,
      message: "Operacion ingresada con exito!",
      nro_registro: reg?.nro_registro,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/presupuesto/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const prev = await db.getPresupuesto(id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Registro no encontrado" });
      return;
    }
    if (!(await puedeAccederPresupuesto(prev, req.user!))) {
      res.status(403).json({ ok: false, error: "No tenés permiso para modificar este registro" });
      return;
    }
    const payload = await parseBody(req);
    if (!await db.updatePresupuesto(id, payload)) {
      res.status(404).json({ ok: false, error: "Registro no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.getPresupuesto(id),
      message: "Registro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/presupuesto/:id", async (req, res) => {
  const id = Number(req.params.id);
  const prev = await db.getPresupuesto(id);
  if (!prev) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  if (!(await puedeAccederPresupuesto(prev, req.user!))) {
    res.status(403).json({ ok: false, error: "No tenés permiso para eliminar este registro" });
    return;
  }
  if (!await db.deletePresupuesto(id)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
});

app.post(
  "/api/presupuesto/:id/documento",
  presupuestoDocUpload.single("file"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const reg = await db.getPresupuesto(id);
      if (!reg) {
        res.status(404).json({ ok: false, error: "Registro no encontrado" });
        return;
      }
      if (!(await puedeAccederPresupuesto(reg, req.user!))) {
        res.status(403).json({ ok: false, error: "No tenés permiso para modificar este registro" });
        return;
      }

      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Subí un PDF o imagen del comprobante" });
        return;
      }

      const meta = await presDoc.savePresupuestoDocumento(
        db.getDb(),
        id,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      res.status(201).json({ ok: true, data: meta });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

app.get("/api/presupuesto/:id/documento", async (req, res) => {
  const id = Number(req.params.id);
  const reg = await db.getPresupuesto(id);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  if (!(await puedeAccederPresupuesto(reg, req.user!))) {
    res.status(403).json({ ok: false, error: "No tenés permiso para ver este documento" });
    return;
  }

  const file = await presDoc.readPresupuestoDocumento(db.getDb(), id);
  if (!file) {
    res.status(404).json({ ok: false, error: "Este registro no tiene documento adjunto" });
    return;
  }

  const download = queryFlag(req.query.download);
  res.setHeader("Content-Type", file.mime || "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(file.nombre)}"`
  );
  res.setHeader("Content-Length", String(file.buffer.length));
  res.end(file.buffer);
});

function parseIngresoVentaBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const fecha = String(body.fecha ?? "").trim();
  const concepto = String(body.concepto ?? "").trim();
  if (!fecha) throw new Error("La fecha es obligatoria.");
  if (!concepto) throw new Error("El concepto es obligatorio.");
  const pesos = Number(body.pesos) || 0;
  const dolares_usd = Number(body.dolares_usd) || 0;
  const tc_usd = Number(body.tc_usd) || 0;
  return {
    fecha,
    codigo_proveedor: String(body.codigo_proveedor ?? "").trim(),
    razon_social_proveedor: String(body.razon_social_proveedor ?? "").trim(),
    concepto,
    nro_factura: String(body.nro_factura ?? "").trim(),
    pesos,
    dolares_usd,
    tc_usd,
    total_usd: 0,
  };
}

/** cuenta_id para proveedores: null = super admin (todos); 0 = sin cuenta (ninguno). */
async function proveedoresCuentaId(user: UserPublic): Promise<number | null> {
  if (user.es_super_admin) return null;
  const cuentaId = await cuentaIdForUser(user);
  return cuentaId ?? 0;
}

/** Cuenta obligatoria al crear proveedores (nunca mezclar cuentas). */
async function proveedoresCuentaIdParaInsert(user: UserPublic): Promise<number> {
  if (user.es_super_admin) {
    const cuentaId = await cuentaIdParaInsert(user);
    if (!cuentaId) throw new Error("Sin cuenta para registrar proveedores");
    return cuentaId;
  }
  const cuentaId = await cuentaIdForUser(user);
  if (!cuentaId) throw new Error("Sin cuenta para registrar proveedores");
  return cuentaId;
}

async function ventasAgriculturaFiltersFromRequest(
  req: Request
): Promise<ventasAgri.VentaAgriculturaFilters> {
  const mesRaw = Number(req.query.mes);
  const anioRaw = Number(req.query.anio);
  const empresaQuery = req.query.empresa as string | undefined;
  const scope = await resumenEmpresaScope(req.user!, empresaQuery);
  return {
    empresa: scope.empresa,
    empresas: scope.empresas,
    cuenta_id: scope.cuenta_id,
    mes: Number.isFinite(mesRaw) ? mesRaw : undefined,
    anio: Number.isFinite(anioRaw) ? anioRaw : undefined,
    cultivo: req.query.cultivo as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
  };
}

async function ventasArrendamientoFiltersFromRequest(
  req: Request
): Promise<ventasArr.VentaArrendamientoFilters> {
  const empresaQuery = req.query.empresa as string | undefined;
  const scope = await resumenEmpresaScope(req.user!, empresaQuery);
  return {
    empresa: scope.empresa,
    empresas: scope.empresas,
    cuenta_id: scope.cuenta_id,
    departamento: req.query.departamento as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
  };
}

async function assertStockGanaderoDispositivoEnScope(req: Request, clave: string): Promise<void> {
  const filters = await stockGanaderoFiltersFromRequest(req, stockGanaderoQueryBase(req));
  const detalle = await db.stockGanadero.getDispositivo(clave, filters);
  if (!detalle) throw new Error("Dispositivo no encontrado");
}

async function assertStockEquinoDispositivoEnScope(req: Request, clave: string): Promise<void> {
  const filters = await stockGanaderoFiltersFromRequest(req, stockGanaderoQueryBase(req));
  const detalle = await db.stockEquino.getDispositivo(clave, filters);
  if (!detalle) throw new Error("Dispositivo no encontrado");
}

async function assertEmpresaPermitida(user: UserPublic, empresa: string): Promise<void> {
  const nombre = empresa.trim();
  if (!nombre) throw new Error("La empresa es obligatoria.");
  const permitidas = await empresasPermitidas(user);
  if (permitidas.length > 0) {
    if (!permitidas.includes(nombre)) {
      throw new Error("Empresa inválida o no pertenece a su cuenta.");
    }
    return;
  }
  if (!(await empresasCuenta.isValidEmpresaNombre(db.getDb(), nombre))) {
    throw new Error("Empresa inválida o inactiva.");
  }
}

async function empresasCodigosPermitidos(user: UserPublic): Promise<string[]> {
  const scope = await empresasCuenta.getEmpresasCodigosOperativasPermitidas(
    db.getDb(),
    user
  );
  if (scope === null) {
    return await empresasCuenta.getEmpresaCodigosActivos(db.getDb());
  }
  return scope;
}

async function assertEmpresaCodigoPermitida(
  user: UserPublic,
  codigo: string
): Promise<void> {
  const normalized = codigo.trim().toUpperCase();
  if (!normalized) return;
  const permitidas = await empresasCodigosPermitidos(user);
  if (permitidas.length > 0) {
    if (!permitidas.includes(normalized)) {
      throw new Error("Empresa inválida o no pertenece a su cuenta.");
    }
    return;
  }
  if (!(await empresasCuenta.isValidEmpresaCodigo(db.getDb(), normalized))) {
    throw new Error("Empresa inválida o inactiva.");
  }
}

async function assertStockImportRowsEmpresas(
  user: UserPublic,
  rows: Array<{ empresa?: string }>
): Promise<void> {
  for (const row of rows) {
    await assertEmpresaCodigoPermitida(user, String(row.empresa ?? ""));
  }
}

async function parseVentaAgriculturaBody(req: Request): Promise<ventasAgri.VentaAgriculturaInput> {
  const body = req.body as Record<string, unknown>;
  const hectareas = Number(body.hectareas);
  const rendimiento_ton_ha = Number(body.rendimiento_ton_ha);
  const precio_usd_ton = Number(body.precio_usd_ton);
  const total_ton = hectareas * rendimiento_ton_ha;
  const importe_usd = (total_ton * precio_usd_ton) / 1000;
  const empresa = String(body.empresa ?? "").trim();
  await assertEmpresaPermitida(req.user!, empresa);
  return {
    empresa,
    mes_inicio: Number(body.mes_inicio ?? body.mes),
    mes_fin: Number(body.mes_fin ?? body.mes_inicio ?? body.mes),
    anio_inicio: Number(body.anio_inicio ?? body.anio),
    anio_fin: Number(body.anio_fin ?? body.anio_fin ?? body.anio_inicio ?? body.anio),
    cultivo: String(body.cultivo ?? "").trim() as ventasAgri.CultivoAgricultura,
    hectareas,
    rendimiento_ton_ha,
    precio_usd_ton,
    total_ton,
    importe_usd,
  };
}

async function parseVentaArrendamientoBody(req: Request): Promise<ventasArr.VentaArrendamientoInput> {
  const body = req.body as Record<string, unknown>;
  const hectareas = Number(body.hectareas);
  const precio_usd_ha = Number(body.precio_usd_ha);
  const fecha_inicio = String(body.fecha_inicio ?? "").trim();
  const fecha_fin = String(body.fecha_fin ?? "").trim();
  const total_usd = ventasArr.calcularTotalArrendamientoEsperado(
    hectareas,
    precio_usd_ha,
    fecha_inicio,
    fecha_fin
  );
  const empresa = String(body.empresa ?? "").trim();
  await assertEmpresaPermitida(req.user!, empresa);
  return {
    empresa,
    fecha_inicio,
    fecha_fin,
    departamento: String(body.departamento ?? "").trim() as ventasArr.DepartamentoArrendamiento,
    padron: String(body.padron ?? "").trim(),
    hectareas,
    precio_usd_ha,
    total_usd,
    notas:
      body.notas != null && String(body.notas).trim() !== ""
        ? String(body.notas).trim()
        : null,
    pago_frecuencia: String(body.pago_frecuencia ?? "ANUAL").trim() as ventasArr.FrecuenciaPagoArrendamiento,
    pago_inicio: String(body.pago_inicio ?? "").trim(),
    pago_fin: String(body.pago_fin ?? "").trim(),
    pago_inicio_monto: Number(body.pago_inicio_monto),
    pago_inicio_tipo: String(body.pago_inicio_tipo ?? "VALOR").trim() as ventasArr.TipoMontoPagoArrendamiento,
    pago_fin_monto: Number(body.pago_fin_monto),
    pago_fin_tipo: String(body.pago_fin_tipo ?? "VALOR").trim() as ventasArr.TipoMontoPagoArrendamiento,
  };
}

app.get("/api/ingresos-ventas", async (req, res) => {
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  const data = await db.ingresosVentas.list(
    {
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      busqueda: req.query.busqueda as string | undefined,
    },
    cuentaId
  );
  res.json({ ok: true, data });
});

app.get("/api/ingresos-ventas/siguiente-operacion", async (_req, res) => {
  const nro = await db.ingresosVentas.peekNextNro();
  res.json({
    ok: true,
    data: {
      nro_registro: nro,
      numero_operacion: await db.ingresosVentas.formatNumeroOperacion(nro),
    },
  });
});

app.get("/api/ingresos-ventas/ventas-agricultura", async (req, res) => {
  const data = await db.ventasAgricultura.list(await ventasAgriculturaFiltersFromRequest(req));
  res.json({ ok: true, data });
});

app.post("/api/ingresos-ventas/ventas-agricultura", async (req, res) => {
  try {
    const payload = await parseVentaAgriculturaBody(req);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const newId = await db.ventasAgricultura.insert(payload, cuentaId);
    const reg = await db.ventasAgricultura.getById(newId, await cuentaIdForScopedRead(req.user!));
    res.status(201).json({
      ok: true,
      data: reg,
      message: "Venta de agricultura registrada",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/ingresos-ventas/ventas-agricultura/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  try {
    const payload = await parseVentaAgriculturaBody(req);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const row = await db.ventasAgricultura.update(id, payload, cuentaId);
    res.json({ ok: true, data: row, message: "Simulación actualizada" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.patch("/api/ingresos-ventas/ventas-agricultura/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof db.ventasAgricultura.patch>[1] = {};

  if (typeof body.venta_realizada === "boolean") {
    patch.venta_realizada = body.venta_realizada;
  }
  if (typeof body.destacada === "boolean") {
    patch.destacada = body.destacada;
  }

  if (body.valores_reales != null && typeof body.valores_reales === "object") {
    const v = body.valores_reales as Record<string, unknown>;
    patch.valores_reales = {
      mes_inicio: Number(v.mes_inicio),
      mes_fin: Number(v.mes_fin),
      anio_inicio: Number(v.anio_inicio),
      anio_fin: Number(v.anio_fin),
      hectareas: Number(v.hectareas),
      rendimiento_ton_ha: Number(v.rendimiento_ton_ha),
      precio_usd_ton: Number(v.precio_usd_ton),
      total_ton: Number(v.total_ton),
      importe_usd: Number(v.importe_usd),
      notas: v.notas != null ? String(v.notas) : null,
    };
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      ok: false,
      error: "Indicá venta_realizada o valores_reales",
    });
    return;
  }

  try {
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const row = await db.ventasAgricultura.patch(id, patch, cuentaId);
    const message =
      patch.venta_realizada === false
        ? "Venta anulada — la simulación volvió a pendiente"
        : patch.valores_reales
          ? "Venta registrada con datos reales"
          : "Simulación actualizada";
    res.json({ ok: true, data: row, message });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.delete("/api/ingresos-ventas/ventas-agricultura/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  if (!await db.ventasAgricultura.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
});

app.get("/api/ingresos-ventas/ventas-arrendamientos", async (req, res) => {
  const data = await db.ventasArrendamientos.list(await ventasArrendamientoFiltersFromRequest(req));
  res.json({ ok: true, data });
});

app.post("/api/ingresos-ventas/ventas-arrendamientos", async (req, res) => {
  try {
    const payload = await parseVentaArrendamientoBody(req);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const newId = await db.ventasArrendamientos.insert(payload, cuentaId);
    const reg = await db.ventasArrendamientos.getById(newId, await cuentaIdForScopedRead(req.user!));
    res.status(201).json({
      ok: true,
      data: reg,
      message: "Simulación de arrendamiento guardada",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/ingresos-ventas/ventas-arrendamientos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  try {
    const payload = await parseVentaArrendamientoBody(req);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const row = await db.ventasArrendamientos.update(id, payload, cuentaId);
    res.json({ ok: true, data: row, message: "Simulación actualizada" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.delete("/api/ingresos-ventas/ventas-arrendamientos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  if (!await db.ventasArrendamientos.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
});

app.patch("/api/ingresos-ventas/ventas-arrendamientos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof db.ventasArrendamientos.patch>[1] = {};

  if (typeof body.venta_realizada === "boolean") {
    patch.venta_realizada = body.venta_realizada;
  }
  if (typeof body.destacada === "boolean") {
    patch.destacada = body.destacada;
  }

  if (body.valores_reales != null && typeof body.valores_reales === "object") {
    const v = body.valores_reales as Record<string, unknown>;
    patch.valores_reales = {
      fecha_inicio: String(v.fecha_inicio),
      fecha_fin: String(v.fecha_fin),
      hectareas: Number(v.hectareas),
      precio_usd_ha: Number(v.precio_usd_ha),
      total_usd: Number(v.total_usd),
      notas: v.notas != null ? String(v.notas) : null,
      pago_frecuencia: String(v.pago_frecuencia) as "MENSUAL" | "ANUAL",
      pago_inicio: String(v.pago_inicio),
      pago_fin: String(v.pago_fin),
      pago_inicio_monto: Number(v.pago_inicio_monto),
      pago_inicio_tipo: String(v.pago_inicio_tipo) as "VALOR" | "PORCENTAJE",
      pago_fin_monto: Number(v.pago_fin_monto),
      pago_fin_tipo: String(v.pago_fin_tipo) as "VALOR" | "PORCENTAJE",
    };
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      ok: false,
      error: "Indicá venta_realizada, valores_reales o destacada",
    });
    return;
  }

  try {
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const row = await db.ventasArrendamientos.patch(id, patch, cuentaId);
    const message =
      patch.venta_realizada === false
        ? "Confirmación anulada — la simulación volvió a pendiente"
        : patch.valores_reales
          ? "Operación confirmada con datos reales"
          : "Simulación actualizada";
    res.json({ ok: true, data: row, message });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.get("/api/ingresos-ventas/ventas-ganado-cerradas", async (req, res) => {
  const tipo = parseSimuladorVentaTipo(req.query.tipo) ?? undefined;
  const data = await db.simuladorVentaGanado.list({
    cerradas: true,
    tipo,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
    limit: 500,
    cuentaId: await cuentaIdForScopedRead(req.user!),
  });
  res.json({ ok: true, data });
});

app.patch("/api/ingresos-ventas/ventas-ganado-cerradas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const destinoRaw = req.body?.destino;
  if (destinoRaw != null && typeof destinoRaw !== "string") {
    res.status(400).json({ ok: false, error: "destino debe ser texto" });
    return;
  }
  try {
    const row = await db.simuladorVentaGanado.updateDestino(
      id,
      destinoRaw == null ? null : destinoRaw,
      await cuentaIdForScopedRead(req.user!)
    );
    res.json({ ok: true, data: row, message: "Destino actualizado" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.get("/api/ingresos-ventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  const reg = await db.ingresosVentas.getById(id, cuentaId);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/ingresos-ventas", async (req, res) => {
  try {
    const payload = parseIngresoVentaBody(req);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const newId = await db.ingresosVentas.insert(payload, cuentaId);
    const reg = await db.ingresosVentas.getById(newId, cuentaId);
    res.status(201).json({
      ok: true,
      data: reg,
      message: "Ingreso por venta registrado",
      nro_registro: reg?.nro_registro,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/ingresos-ventas/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = parseIngresoVentaBody(req);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!await db.ingresosVentas.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Registro no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.ingresosVentas.getById(id, cuentaId),
      message: "Registro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/ingresos-ventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  if (!await db.ingresosVentas.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
});

app.get("/api/venta-sub-rubros", async (req, res) => {
  const soloActivos = req.query.solo_activos === "1";
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: [] });
    return;
  }
  res.json({ ok: true, data: await db.ventaSubRubros.list(soloActivos, cuentaId) });
});

app.get("/api/venta-sub-rubros/grupos", async (req, res) => {
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: [] });
    return;
  }
  res.json({ ok: true, data: await db.ventaSubRubros.listGrupos(cuentaId) });
});

app.post("/api/venta-sub-rubros", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const payload = parseSubRubroBody(req);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const id = await db.ventaSubRubros.insert(payload, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.ventaSubRubros.getById(id, cuentaId),
      message: "Sub-rubro creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/venta-sub-rubros/:id", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const id = Number(req.params.id);
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    const prev = await db.ventaSubRubros.getById(id, cuentaId);
    const payload = parseSubRubroBody(req);
    if (!await db.ventaSubRubros.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    if (prev && prev.grupo !== payload.grupo) {
      await db.ventaGrupoIconos.renameGrupo(prev.grupo, payload.grupo, cuentaId);
    }
    res.json({
      ok: true,
      data: await db.ventaSubRubros.getById(id, cuentaId),
      message: "Sub-rubro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/venta-sub-rubros/grupo/rename", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const anterior = String(req.body?.anterior ?? "").trim();
    const nuevo = String(req.body?.nuevo ?? "").trim();
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    const updated = await db.ventaSubRubros.renameGrupo(anterior, nuevo, cuentaId);
    const nombreCanon = normalizarTituloRubro(nuevo);
    await db.ventaGrupoIconos.renameGrupo(anterior, nombreCanon, cuentaId);
    res.json({
      ok: true,
      message:
        updated > 0
          ? `Rubro renombrado a «${nombreCanon}» (${updated} sub-rubro(s))`
          : "Sin cambios",
      data: { updated, nombre: nombreCanon },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/venta-sub-rubros/grupo/:grupo", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  if (!denyUnlessSuperAdminRubrosDelete(req, res)) return;
  try {
    const grupo = decodeURIComponent(req.params.grupo);
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    const result = await db.ventaSubRubros.deleteByGrupo(grupo, cuentaId);
    await db.ventaGrupoIconos.deleteByGrupo(grupo, cuentaId);
    const msg =
      result.deleted > 0
        ? `Rubro eliminado (${result.deleted} sub-rubro(s))`
        : "Rubro sin sub-rubros guardados";
    res.json({ ok: true, message: msg, data: result });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/venta-sub-rubros/:id", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  if (!denyUnlessSuperAdminRubrosDelete(req, res)) return;
  try {
    const id = Number(req.params.id);
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    if (!await db.ventaSubRubros.delete(id, cuentaId)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Sub-rubro eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/venta-sub-rubros/items-counts", async (req, res) => {
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: {} });
    return;
  }
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({ ok: true, data: await db.ventaSubRubroItems.countsBySubRubroIds(ids, cuentaId) });
});

app.get("/api/venta-sub-rubros/items-batch", async (req, res) => {
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: {} });
    return;
  }
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({
    ok: true,
    data: await db.ventaSubRubroItems.groupedBySubRubroIds(ids, cuentaId),
  });
});

app.get("/api/venta-sub-rubros/items", async (req, res) => {
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: [] });
    return;
  }
  const nombre = String(req.query.sub_rubro ?? "").trim();
  if (!nombre) {
    res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({
    ok: true,
    data: await db.ventaSubRubroItems.listBySubRubroNombre(nombre, soloActivos, cuentaId),
  });
});

app.post("/api/venta-sub-rubros/items", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const subRubroNombre = String(
      (req.body as { sub_rubro?: string }).sub_rubro ?? ""
    ).trim();
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    if (!subRubroNombre) {
      res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
      return;
    }
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    const sub = await db.ventaSubRubros.getByNombre(subRubroNombre, cuentaId);
    if (!sub) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.ventaSubRubroItems.insert(sub.id, { nombre, activo }, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.ventaSubRubroItems.getById(itemId),
      message: "Ítem creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/venta-sub-rubros/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: [] });
    return;
  }
  const sub = await db.ventaSubRubros.getById(id, cuentaId);
  if (!sub) {
    res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({
    ok: true,
    data: await db.ventaSubRubroItems.listBySubRubroId(id, soloActivos, cuentaId),
  });
});

app.post("/api/venta-sub-rubros/:id/items", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const id = Number(req.params.id);
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    if (!await db.ventaSubRubros.getById(id, cuentaId)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.ventaSubRubroItems.insert(id, { nombre, activo }, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.ventaSubRubroItems.getById(itemId),
      message: "Ítem creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/venta-sub-rubro-items/:id", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const id = Number(req.params.id);
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    if (!await db.ventaSubRubroItems.update(id, { nombre, activo }, cuentaId)) {
      res.status(404).json({ ok: false, error: "Ítem no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.ventaSubRubroItems.getById(id),
      message: "Ítem actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/venta-sub-rubro-items/:id", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  if (!denyUnlessCuentaAdminOrSuperAdminItemsDelete(req, res)) return;
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  if (!await db.ventaSubRubroItems.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Ítem no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Ítem eliminado" });
});

app.get("/api/venta-grupo-iconos", async (req, res) => {
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.json({ ok: true, data: {} });
    return;
  }
  res.json({ ok: true, data: await db.ventaGrupoIconos.map(cuentaId) });
});

app.get("/api/venta-grupo-iconos/banco", async (_req, res) => {
  res.json({ ok: true, data: await db.ventaGrupoIconos.banco() });
});

app.put("/api/venta-grupo-iconos/:grupo/emoji", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
    const emoji = String((req.body as { emoji?: unknown })?.emoji ?? "").trim();
    if (!grupo) {
      res.status(400).json({ ok: false, error: "Rubro inválido." });
      return;
    }
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const dto = await db.ventaGrupoIconos.saveEmoji(grupo, emoji, cuentaId);
    res.json({
      ok: true,
      data: { grupo, icono: dto },
      message: "Icono actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/venta-grupo-iconos/:grupo/imagen", async (req, res) => {
  const grupo = decodeURIComponent(paramString(req.params.grupo));
  const user = req.user!;
  const cuentaId = await ventaRubrosCuentaReadScope(user);
  if (cuentaId === undefined) {
    res.status(404).json({ ok: false, error: "Sin imagen personalizada" });
    return;
  }
  const filePath = await db.ventaGrupoIconos.filePath(grupo, cuentaId);
  if (!filePath) {
    res.status(404).json({ ok: false, error: "Sin imagen personalizada" });
    return;
  }
  res.sendFile(filePath, { maxAge: 0 }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ ok: false, error: "Imagen no encontrada" });
    }
  });
});

app.post(
  "/api/venta-grupo-iconos/:grupo/imagen",
  iconUpload.single("imagen"),
  async (req, res) => {
    if (!requireVentaRubrosManage(req, res)) return;
    try {
      const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
      if (!grupo) {
        res.status(400).json({ ok: false, error: "Rubro inválido." });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Seleccioná una imagen." });
        return;
      }
      const cuentaId = await cuentaIdParaInsert(req.user!);
      const icono = await db.ventaGrupoIconos.save(grupo, file.buffer, file.mimetype, cuentaId);
      res.json({
        ok: true,
        data: { grupo, icono },
        message: "Icono actualizado",
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

app.delete("/api/venta-grupo-iconos/:grupo/imagen", async (req, res) => {
  if (!requireVentaRubrosManage(req, res)) return;
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo));
    const cuentaId = await ventaRubrosCuentaWriteScope(req.user!);
    await db.ventaGrupoIconos.deleteByGrupo(grupo, cuentaId);
    res.json({ ok: true, message: "Icono restaurado al predeterminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/stock-ganadero/ultima-importacion-archivo", async (req, res) => {
  const filters = await stockLecturasFiltersFromRequest(req);
  const lotes = await db.stockGanadero.listLotes(filters);
  const lote = lotes.find((l) => l.nombre_archivo !== "carga-manual");
  if (!lote) {
    res.json({ ok: true, data: null });
    return;
  }
  res.json({
    ok: true,
    data: { id: lote.id, nombre: lote.nombre_archivo, filas: lote.filas },
  });
});

app.get("/api/stock-ganadero/lotes", async (req, res) => {
  const filters = await stockLecturasFiltersFromRequest(req);
  res.json({ ok: true, data: await db.stockGanadero.listLotes(filters) });
});

app.get("/api/stock-ganadero/registros", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const filters = await stockLecturasFiltersFromRequest(req, {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    solo_repetidos: req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
  });
  res.json({
    ok: true,
    data: await db.stockGanadero.listRegistros(filters),
  });
});

app.get("/api/stock-ganadero/estadisticas", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const filters = await stockLecturasFiltersFromRequest(req, {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
  });
  res.json({
    ok: true,
    data: await db.stockGanadero.estadisticas(filters),
  });
});

app.get("/api/stock-ganadero/salidas", async (req, res) => {
  const filters = await stockGanaderoFiltersFromRequest(req, stockGanaderoQueryBase(req));
  const { data, bajas_reparadas } = await db.stockGanadero.listSalidas(filters);
  res.json({ ok: true, data, bajas_reparadas });
});

app.get("/api/stock-ganadero/empresas-operativas", async (req, res) => {
  const detalle = await empresasCuenta.getEmpresasOperativasDetallePermitidas(
    db.getDb(),
    req.user!
  );
  res.json({ ok: true, data: detalle });
});

app.get("/api/stock-ganadero/dispositivos", async (req, res) => {
  const filters = await stockGanaderoFiltersFromRequest(req, {
    ...stockGanaderoQueryBase(req),
    solo_repetidos:
      req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
    solo_bajas:
      req.query.solo_bajas === "1" || req.query.solo_bajas === "true",
  });
  res.json({
    ok: true,
    data: await db.stockGanadero.listDispositivos(filters),
  });
});

app.get("/api/stock-ganadero/dispositivos/:clave", async (req, res) => {
  const filters = await stockGanaderoFiltersFromRequest(req, stockGanaderoQueryBase(req));
  const detalle = await db.stockGanadero.getDispositivo(req.params.clave, filters);
  if (!detalle) {
    res.status(404).json({ ok: false, error: "Dispositivo no encontrado" });
    return;
  }
  res.json({ ok: true, data: detalle });
});

app.get("/api/stock-ganadero/dispositivos/:clave/historial-cambios", async (req, res) => {
  try {
    await assertStockGanaderoDispositivoEnScope(req, req.params.clave);
    const data = await db.stockGanadero.listHistorialCambios(req.params.clave);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar historial",
    });
  }
});

app.get("/api/stock-ganadero/control-sanitario/cantidad-opciones", async (_req, res) => {
  try {
    const data = await stockControlSanitario.listStockControlSanitarioCantidadCatalog(
      db.getDb()
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar cantidades",
    });
  }
});

app.post("/api/stock-ganadero/control-sanitario/cantidad-opciones", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const valor = String(req.body?.valor ?? "");
    const data = await stockControlSanitario.createStockControlSanitarioCantidadCatalog(
      db.getDb(),
      valor,
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar cantidad",
    });
  }
});

app.get("/api/stock-ganadero/control-sanitario/espera-opciones", async (_req, res) => {
  try {
    const data = await stockControlSanitario.listStockControlSanitarioEsperaCatalog(db.getDb());
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar tiempos de espera",
    });
  }
});

app.post("/api/stock-ganadero/control-sanitario/espera-opciones", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const valor = String(req.body?.valor ?? "");
    const data = await stockControlSanitario.createStockControlSanitarioEsperaCatalog(
      db.getDb(),
      valor,
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar tiempo de espera",
    });
  }
});

app.get("/api/stock-ganadero/control-sanitario/producto-fichas", async (_req, res) => {
  try {
    const data = await stockControlSanitario.listStockControlSanitarioProductoFichas(db.getDb());
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar productos sanitarios",
    });
  }
});

app.get("/api/stock-ganadero/control-sanitario/producto-nombres", async (req, res) => {
  try {
    const autoresCuenta = req.user ? await autoresLabelsForMarcaScope(req.user) : [];
    const moduloRaw = String(req.query.modulo ?? "").trim().toLowerCase();
    const modulo =
      moduloRaw === "equino" || moduloRaw === "ganadero"
        ? (moduloRaw as "equino" | "ganadero")
        : undefined;
    const data = await stockControlSanitario.listStockControlSanitarioProductoNombresGlobales(
      db.getDb(),
      autoresCuenta,
      modulo
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar nombres comerciales",
    });
  }
});

app.get("/api/stock-ganadero/control-sanitario/producto-ficha/:nombre", async (req, res) => {
  try {
    const data = await stockControlSanitario.getStockControlSanitarioProductoFicha(
      db.getDb(),
      String(req.params.nombre ?? "")
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar ficha del producto",
    });
  }
});

app.put("/api/stock-ganadero/control-sanitario/producto-ficha", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const data = await stockControlSanitario.upsertStockControlSanitarioProductoFicha(
      db.getDb(),
      req.body ?? {},
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar ficha del producto",
    });
  }
});

app.delete("/api/stock-ganadero/control-sanitario/producto-ficha/:nombre", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const nombre = await stockControlSanitario.deleteStockControlSanitarioProductoFichaForUser(
      db.getDb(),
      String(req.params.nombre ?? ""),
      {
        esSuperAdmin: Boolean(req.user?.es_super_admin),
        autorLabel: autor,
      }
    );
    res.json({ ok: true, data: { nombre } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al eliminar producto sanitario";
    const status = /solo quien agregó|solo el superadministrador/i.test(msg) ? 403 : 400;
    res.status(status).json({ ok: false, error: msg });
  }
});

app.post("/api/stock-ganadero/control-sanitario/resumen", async (req, res) => {
  try {
    const claves = Array.isArray(req.body?.claves)
      ? req.body.claves.map((c: unknown) => String(c))
      : [];
    const data = await stockControlSanitario.summarizeStockControlSanitarioByClaves(
      db.getDb(),
      "ganadero",
      claves
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar resumen sanitario",
    });
  }
});

app.post("/api/stock-ganadero/control-sanitario/fechas-aplicacion", async (req, res) => {
  try {
    const claves = Array.isArray(req.body?.claves)
      ? req.body.claves.map((c: unknown) => String(c))
      : [];
    const data = await stockControlSanitario.getUltimaFechaAplicacionPorClaves(
      db.getDb(),
      "ganadero",
      claves
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar fechas de aplicación",
    });
  }
});

app.get("/api/stock-ganadero/dispositivos/:clave/control-sanitario", async (req, res) => {
  try {
    await assertStockGanaderoDispositivoEnScope(req, req.params.clave);
    const data = await stockControlSanitario.listStockControlSanitario(
      db.getDb(),
      "ganadero",
      String(req.params.clave)
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar control sanitario",
    });
  }
});

app.post("/api/stock-ganadero/dispositivos/:clave/control-sanitario", async (req, res) => {
  try {
    await assertStockGanaderoDispositivoEnScope(req, req.params.clave);
    const autor = historialAutorLabelFromRequest(req);
    const data = await stockControlSanitario.createStockControlSanitario(
      db.getDb(),
      "ganadero",
      String(req.params.clave),
      req.body ?? {},
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar control sanitario",
    });
  }
});

app.delete(
  "/api/stock-ganadero/dispositivos/:clave/control-sanitario/:id",
  async (req, res) => {
    try {
      await assertStockGanaderoDispositivoEnScope(req, req.params.clave);
      const id = Number(req.params.id);
      await stockControlSanitario.deleteStockControlSanitario(
        db.getDb(),
        "ganadero",
        String(req.params.clave),
        id
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al eliminar registro",
      });
    }
  }
);

app.get("/api/stock-ganadero/dispositivos/:clave/fotos", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const data = await stockDispositivoFoto.getStockDispositivoFotoDto(
      db.getDb(),
      "ganadero",
      clave
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar fotos",
    });
  }
});

app.get("/api/stock-ganadero/dispositivos/:clave/foto/:fotoId", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const fotoId = Number(req.params.fotoId);
    if (!Number.isFinite(fotoId) || fotoId < 1) {
      res.status(400).json({ ok: false, error: "Foto inválida" });
      return;
    }
    const image = await stockDispositivoFoto.loadStockDispositivoFotoById(
      db.getDb(),
      "ganadero",
      clave,
      fotoId,
      { thumb: wantsFotoThumb(req) }
    );
    if (!image) {
      res.status(404).json({ ok: false, error: "Sin foto del animal" });
      return;
    }
    setStockDispositivoFotoCacheHeaders(req, res);
    res.type(image.mime).send(image.buffer);
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar foto",
    });
  }
});

app.patch(
  "/api/stock-ganadero/dispositivos/:clave/foto/:fotoId/principal",
  async (req, res) => {
    try {
      const clave = String(req.params.clave);
      const fotoId = Number(req.params.fotoId);
      if (!Number.isFinite(fotoId) || fotoId < 1) {
        res.status(400).json({ ok: false, error: "Foto inválida" });
        return;
      }
      const data = await stockDispositivoFoto.setStockDispositivoFotoPrincipal(
        db.getDb(),
        "ganadero",
        clave,
        fotoId
      );
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al marcar foto principal",
      });
    }
  }
);

app.delete("/api/stock-ganadero/dispositivos/:clave/foto/:fotoId", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const fotoId = Number(req.params.fotoId);
    if (!Number.isFinite(fotoId) || fotoId < 1) {
      res.status(400).json({ ok: false, error: "Foto inválida" });
      return;
    }
    const data = await stockDispositivoFoto.deleteStockDispositivoFotoById(
      db.getDb(),
      "ganadero",
      clave,
      fotoId
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al quitar foto",
    });
  }
});

app.get("/api/stock-ganadero/dispositivos/:clave/foto", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const image = await stockDispositivoFoto.loadStockDispositivoFoto(
      db.getDb(),
      "ganadero",
      clave
    );
    if (!image) {
      res.status(404).json({ ok: false, error: "Sin foto del animal" });
      return;
    }
    setStockDispositivoFotoCacheHeaders(req, res);
    res.type(image.mime).send(image.buffer);
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar foto",
    });
  }
});

app.post(
  "/api/stock-ganadero/dispositivos/:clave/foto",
  iconUpload.single("foto"),
  async (req, res) => {
    try {
      const clave = String(req.params.clave);
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Seleccioná una imagen" });
        return;
      }
      const data = await stockDispositivoFoto.saveStockDispositivoFoto(
        db.getDb(),
        "ganadero",
        clave,
        file.buffer,
        file.mimetype
      );
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al subir foto",
      });
    }
  }
);

app.delete("/api/stock-ganadero/dispositivos/:clave/foto", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const data = await stockDispositivoFoto.clearStockDispositivoFoto(
      db.getDb(),
      "ganadero",
      clave
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al quitar foto",
    });
  }
});

app.patch("/api/stock-ganadero/dispositivos/bulk", async (req, res) => {
  try {
    const body = req.body ?? {};
    const claves = Array.isArray(body.claves)
      ? body.claves.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const eids =
      body.eids && typeof body.eids === "object" && !Array.isArray(body.eids)
        ? (body.eids as Record<string, string>)
        : {};

    const metaPatch: DispositivoMetaPatch = {};
    if (patch.sexo !== undefined) {
      metaPatch.sexo = String(patch.sexo).toUpperCase() as "" | "MACHO" | "HEMBRA";
    }
    if (patch.empresa !== undefined) {
      const empresa = String(patch.empresa).trim().toUpperCase();
      await assertEmpresaCodigoPermitida(req.user!, empresa);
      metaPatch.empresa = empresa;
    }
    if (patch.nacimiento_mes !== undefined) {
      const v = patch.nacimiento_mes;
      metaPatch.nacimiento_mes =
        v === null || v === "" ? null : Number(v);
    }
    if (patch.nacimiento_anio !== undefined) {
      const v = patch.nacimiento_anio;
      metaPatch.nacimiento_anio =
        v === null || v === "" ? null : Number(v);
    }
    if (patch.observaciones !== undefined) {
      metaPatch.observaciones = String(patch.observaciones);
    }
    if (patch.grupo_libre !== undefined) {
      metaPatch.grupo_libre = String(patch.grupo_libre);
    }
    if (patch.potrero !== undefined) {
      metaPatch.potrero = String(patch.potrero);
    }
    if (patch.raza !== undefined) {
      metaPatch.raza = String(patch.raza);
    }
    if (patch.color_caravana !== undefined) {
      metaPatch.color_caravana = String(patch.color_caravana);
    }
    if (patch.estado !== undefined) {
      metaPatch.estado = String(patch.estado).toUpperCase() as
        | "VIVO"
        | "MUERTO"
        | "VENDIDO"
        | "FRIGORIFICO";
    }
    if (patch.baja_mes !== undefined) {
      const v = patch.baja_mes;
      metaPatch.baja_mes = v === null || v === "" ? null : Number(v);
    }
    if (patch.baja_anio !== undefined) {
      const v = patch.baja_anio;
      metaPatch.baja_anio = v === null || v === "" ? null : Number(v);
    }

    const result = await db.stockGanadero.bulkPatchDispositivos(
      claves,
      metaPatch,
      eids,
      historialAutorFromRequest(req, "MASIVO")
    );
    if (result.actualizados > 0) {
      await auditStockMovimiento(req, "MODIFICACION", {
        cantidad: result.actualizados,
        resumen: `Modificación masiva de ${result.actualizados} dispositivo(s)`,
        detalle: { claves: claves.slice(0, 25), patch: metaPatch },
      });
    }
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar dispositivos",
    });
  }
});

app.post("/api/stock-ganadero/dispositivos/bulk-delete", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  try {
    const body = req.body ?? {};
    const claves = Array.isArray(body.claves)
      ? body.claves.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const result = await db.stockGanadero.deleteDispositivos(claves);
    await auditStockMovimiento(req, "MODIFICACION", {
      cantidad: result.eliminados,
      resumen: `Eliminó ${result.eliminados} dispositivo(s) del sistema`,
      detalle: {
        claves: claves.slice(0, 25),
        lecturas_eliminadas: result.lecturas_eliminadas,
        no_encontrados: result.no_encontrados,
      },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar dispositivos",
    });
  }
});

async function stockAdminCuentaIdForUser(user: UserPublic): Promise<number | null> {
  return empresasCuenta.resolveCuentaMadreIdForUser(db.getDb(), user);
}

async function requireStockAdminCuentaId(
  req: Request,
  res: Response
): Promise<number | null> {
  const user = req.user!;
  const cuentaId = await stockAdminCuentaIdForUser(user);
  if (cuentaId != null) return cuentaId;
  if (user.es_super_admin) return null;
  res.status(403).json({
    ok: false,
    error: "Sin cuenta asociada para administrar el stock ganadero",
  });
  return null;
}

app.post("/api/stock-ganadero/dispositivos/wipe-all", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null && !req.user!.es_super_admin) return;
  try {
    const result = await db.stockGanadero.vaciarCompleto(cuentaId);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: "Vació todo el stock ganadero",
      detalle: { ...result },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al vaciar el stock",
    });
  }
});

app.get("/api/stock-ganadero/backup", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null) {
    if (req.user.es_super_admin) {
      res.json({
        ok: true,
        data: {
          disponible: false,
          creado_en: null,
          dispositivos: 0,
          lecturas: 0,
          historial: 0,
          vinculos_sim: 0,
        },
      });
      return;
    }
    return;
  }
  try {
    res.json({ ok: true, data: await db.stockGanadero.backupInfo(cuentaId) });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al leer respaldo",
    });
  }
});

app.post("/api/stock-ganadero/backup/restore", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null) {
    if (!req.user.es_super_admin) return;
    res.status(400).json({
      ok: false,
      error: "Recuperación de respaldo requiere una cuenta madre asociada",
    });
    return;
  }
  try {
    const result = await db.stockGanadero.restaurarDesdeBackup(cuentaId);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Restauró stock ganadero desde respaldo (${result.dispositivos_restaurados} dispositivo(s))`,
      detalle: { ...result },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al restaurar respaldo",
    });
  }
});

app.patch("/api/stock-ganadero/dispositivos/:clave/sexo", async (req, res) => {
  try {
    const sexo = String(req.body?.sexo ?? "").toUpperCase() as
      | ""
      | "MACHO"
      | "HEMBRA";
    const eid = typeof req.body?.eid === "string" ? req.body.eid : undefined;
    const actualizado = await db.stockGanadero.updateDispositivoSexo(
      req.params.clave,
      sexo,
      eid,
      historialAutorFromRequest(req, "FICHA")
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Cambió sexo del dispositivo ${req.params.clave}`,
      detalle: { sexo: actualizado },
    });
    res.json({ ok: true, data: { sexo: actualizado } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar sexo",
    });
  }
});

app.patch("/api/stock-ganadero/dispositivos/:clave", async (req, res) => {
  try {
    const body = req.body ?? {};
    const sexo = String(body.sexo ?? "").toUpperCase() as "" | "MACHO" | "HEMBRA";
    const empresa = String(body.empresa ?? "").trim().toUpperCase();
    await assertEmpresaCodigoPermitida(req.user!, empresa);
    const mesRaw = body.nacimiento_mes;
    const nacimiento_mes =
      mesRaw === null || mesRaw === undefined || mesRaw === ""
        ? null
        : Number(mesRaw);
    const anioRaw = body.nacimiento_anio;
    const nacimiento_anio =
      anioRaw === null || anioRaw === undefined || anioRaw === ""
        ? null
        : Number(anioRaw);
    const observaciones =
      typeof body.observaciones === "string" ? body.observaciones : "";
    const grupo_libre =
      typeof body.grupo_libre === "string" ? body.grupo_libre : "";
    const potrero = typeof body.potrero === "string" ? body.potrero : "";
    const raza = typeof body.raza === "string" ? body.raza : "";
    const color_caravana =
      typeof body.color_caravana === "string" ? body.color_caravana : "";
    const estado = String(body.estado ?? "VIVO").toUpperCase() as
      | "VIVO"
      | "MUERTO"
      | "VENDIDO"
      | "FRIGORIFICO"
      | "PERDIDO";
    const tipo_baja = optionalTipoBaja(body.tipo_baja);
    const numero_guia =
      typeof body.numero_guia === "string" ? body.numero_guia : "";
    const bajaMesRaw = body.baja_mes;
    const baja_mes =
      bajaMesRaw === null || bajaMesRaw === undefined || bajaMesRaw === ""
        ? null
        : Number(bajaMesRaw);
    const bajaAnioRaw = body.baja_anio;
    const baja_anio =
      bajaAnioRaw === null || bajaAnioRaw === undefined || bajaAnioRaw === ""
        ? null
        : Number(bajaAnioRaw);
    const eid = typeof body.eid === "string" ? body.eid : undefined;

    const data = await db.stockGanadero.saveDispositivo(
      req.params.clave,
      {
        sexo,
        empresa,
        grupo: "",
        grupo_libre,
        potrero,
        raza,
        color_caravana,
        nacimiento_mes,
        nacimiento_anio,
        observaciones,
        estado,
        tipo_baja,
        numero_guia,
        baja_mes,
        baja_anio,
      },
      eid,
      historialAutorFromRequest(req, "FICHA")
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Modificó dispositivo ${req.params.clave}`,
      detalle: {
        estado: data.estado,
        tipo_baja: data.tipo_baja,
        sexo: data.sexo,
        empresa: data.empresa,
        potrero: data.potrero,
      },
    });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar dispositivo",
    });
  }
});

app.patch("/api/stock-ganadero/dispositivos/:clave/edad", async (req, res) => {
  try {
    const raw = req.body?.edad;
    const edad =
      raw === null || raw === undefined || raw === ""
        ? null
        : Number(raw);
    const eid = typeof req.body?.eid === "string" ? req.body.eid : undefined;
    const actualizado = await db.stockGanadero.updateDispositivoEdad(
      req.params.clave,
      edad,
      eid
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Actualizó edad del dispositivo ${req.params.clave}`,
      detalle: { edad: actualizado },
    });
    res.json({ ok: true, data: { edad: actualizado } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar edad",
    });
  }
});

app.patch("/api/stock-ganadero/cabana/seleccion", async (req, res) => {
  try {
    const body = req.body ?? {};
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items = rawItems
      .map((item: { clave?: string; nombre_cabana?: string; raza?: string; observaciones?: string }) => ({
        clave: String(item.clave ?? "").trim(),
        nombre_cabana: String(item.nombre_cabana ?? "").trim(),
        raza: typeof item.raza === "string" ? item.raza : "",
        observaciones: typeof item.observaciones === "string" ? item.observaciones : "",
      }))
      .filter((item: { clave: string; nombre_cabana: string }) => item.clave);
    if (!items.length) {
      res.status(400).json({ ok: false, error: "Ingresá al menos un dispositivo" });
      return;
    }
    const result = await db.stockGanadero.saveCabanaSeleccion(
      items,
      historialAutorFromRequest(req, "CABAÑA")
    );
    for (const item of items) {
      if (!result.errores.some((e) => e.clave === item.clave)) {
        await auditStockMovimiento(req, "MODIFICACION", {
          clave: item.clave,
          resumen: `Seleccionó animal de cabaña ${item.clave}`,
          detalle: { nombre_cabana: item.nombre_cabana, raza: item.raza },
        });
      }
    }
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar selección de cabaña",
    });
  }
});

app.get("/api/stock-ganadero/razas", async (_req, res) => {
  try {
    const razas = await db.stockGanadero.listRazas();
    res.json({ ok: true, data: razas });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar razas",
    });
  }
});

app.post("/api/stock-ganadero/razas", async (req, res) => {
  try {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const raza = await db.stockGanadero.createRaza(nombre);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Agregó raza ${raza} al catálogo`,
      detalle: { raza },
    });
    res.json({ ok: true, data: { nombre: raza } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al agregar raza",
    });
  }
});

app.delete("/api/stock-ganadero/razas", async (req, res) => {
  if (!req.user?.es_super_admin) {
    res.status(403).json({
      ok: false,
      error: "Solo el superadministrador puede eliminar razas del catálogo",
    });
    return;
  }
  try {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const eliminada = await db.stockGanadero.deleteRaza(nombre);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Eliminó raza ${eliminada} del catálogo`,
      detalle: { raza: eliminada },
    });
    res.json({ ok: true, data: { nombre: eliminada } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar raza",
    });
  }
});

app.get("/api/stock-ganadero/potreros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para listar potreros",
      });
      return;
    }
    const potreros = await db.stockGanadero.listPotreros(cuentaId);
    res.json({ ok: true, data: potreros });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar potreros",
    });
  }
});

app.get("/api/campo-potreros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para listar potreros del mapa",
      });
      return;
    }
    const items = await db.campoPotreros.list(cuentaId);
    res.json({ ok: true, data: items });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar potreros del mapa",
    });
  }
});

app.post("/api/campo-potreros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para guardar el potrero",
      });
      return;
    }
    const body = req.body ?? {};
    const item = await db.campoPotreros.create(cuentaId, {
      nombre: typeof body.nombre === "string" ? body.nombre : "",
      geojson: body.geojson,
      color: typeof body.color === "string" ? body.color : undefined,
      hectareas: body.hectareas,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Dibujó potrero ${item.nombre} en el mapa del campo`,
      detalle: { potrero_id: item.id, nombre: item.nombre, cuenta_id: cuentaId },
    });
    res.status(201).json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar el potrero",
    });
  }
});

app.put("/api/campo-potreros/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para actualizar el potrero",
      });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Potrero inválido" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.campoPotreros.update(cuentaId, id, {
      nombre: typeof body.nombre === "string" ? body.nombre : undefined,
      geojson: body.geojson,
      color: typeof body.color === "string" ? body.color : undefined,
      hectareas: body.hectareas,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    res.json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar el potrero",
    });
  }
});

app.delete("/api/campo-potreros/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para eliminar el potrero",
      });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Potrero inválido" });
      return;
    }
    const existing = await db.campoPotreros.getById(cuentaId, id);
    await db.campoPotreros.delete(cuentaId, id);
    if (existing) {
      await auditStockMovimiento(req, "MODIFICACION", {
        resumen: `Eliminó potrero ${existing.nombre} del mapa del campo`,
        detalle: { potrero_id: id, nombre: existing.nombre, cuenta_id: cuentaId },
      });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar el potrero",
    });
  }
});

app.get("/api/campo-mapa-elementos", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const items = await db.campoMapaElementos.list(cuentaId);
    res.json({ ok: true, data: items });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar elementos del mapa",
    });
  }
});

app.post("/api/campo-mapa-elementos", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.campoMapaElementos.create(cuentaId, {
      tipo: typeof body.tipo === "string" ? body.tipo : "marcador",
      nombre: typeof body.nombre === "string" ? body.nombre : "",
      geojson: body.geojson,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    res.status(201).json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar elemento del mapa",
    });
  }
});

app.put("/api/campo-mapa-elementos/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Elemento inválido" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.campoMapaElementos.update(cuentaId, id, {
      tipo: typeof body.tipo === "string" ? body.tipo : undefined,
      nombre: typeof body.nombre === "string" ? body.nombre : undefined,
      geojson: body.geojson,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      color: typeof body.color === "string" ? body.color : undefined,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
    });
    res.json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar elemento del mapa",
    });
  }
});

app.delete("/api/campo-mapa-elementos/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Elemento inválido" });
      return;
    }
    await db.campoMapaElementos.delete(cuentaId, id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar elemento del mapa",
    });
  }
});

app.get("/api/operativa-tareas/registros-dia", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const fecha = typeof req.query.fecha === "string" ? req.query.fecha.trim() : "";
    if (!fecha) {
      res.status(400).json({ ok: false, error: "Indicá la fecha (AAAA-MM-DD)." });
      return;
    }
    const items = await db.operativaTareas.listRegistrosPorFecha(cuentaId, fecha);
    res.json({ ok: true, data: items });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar registros del día",
    });
  }
});

app.get("/api/operativa-tareas", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const q = req.query;
    const filters: OperativaTareaListFilters = {};
    if (typeof q.desde === "string" && q.desde.trim()) filters.desde = q.desde.trim();
    if (typeof q.hasta === "string" && q.hasta.trim()) filters.hasta = q.hasta.trim();
    if (q.asignado_user_id != null) {
      const n = Number(q.asignado_user_id);
      if (Number.isFinite(n) && n > 0) filters.asignado_user_id = n;
    }
    if (typeof q.estado === "string" && q.estado.trim()) {
      const rawEstado = q.estado.trim();
      if ((OPERATIVA_TAREA_ESTADOS as readonly string[]).includes(rawEstado)) {
        filters.estado = rawEstado as OperativaTareaEstado;
      }
    }
    const items = await db.operativaTareas.list(cuentaId, filters);
    res.json({ ok: true, data: items });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar tareas operativas",
    });
  }
});

app.post("/api/operativa-tareas", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.operativaTareas.create(cuentaId, req.user!.id, {
      titulo: typeof body.titulo === "string" ? body.titulo : "",
      descripcion: typeof body.descripcion === "string" ? body.descripcion : undefined,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      fecha: typeof body.fecha === "string" ? body.fecha : undefined,
      dia_semana: body.dia_semana,
      asignado_user_id: body.asignado_user_id,
      asignados_user_ids: Array.isArray(body.asignados_user_ids)
        ? body.asignados_user_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
        : undefined,
      potrero_id: body.potrero_id,
      ubicacion: typeof body.ubicacion === "string" ? body.ubicacion : undefined,
    });
    res.status(201).json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al crear la tarea",
    });
  }
});

app.put("/api/operativa-tareas/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Tarea inválida" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.operativaTareas.update(cuentaId, id, {
      titulo: typeof body.titulo === "string" ? body.titulo : undefined,
      descripcion: typeof body.descripcion === "string" ? body.descripcion : undefined,
      notas: typeof body.notas === "string" ? body.notas : undefined,
      dia_semana: body.dia_semana,
      asignado_user_id: body.asignado_user_id,
      asignados_user_ids: Array.isArray(body.asignados_user_ids)
        ? body.asignados_user_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
        : undefined,
      potrero_id: body.potrero_id,
      ubicacion: typeof body.ubicacion === "string" ? body.ubicacion : undefined,
    });
    res.json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar la tarea",
    });
  }
});

app.delete("/api/operativa-tareas/:id", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Tarea inválida" });
      return;
    }
    await db.operativaTareas.delete(cuentaId, id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar la tarea",
    });
  }
});

app.get("/api/operativa-tareas/:id/registros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Tarea inválida" });
      return;
    }
    const fecha =
      typeof req.query.fecha === "string" && req.query.fecha.trim()
        ? req.query.fecha.trim()
        : undefined;
    const items = await db.operativaTareas.listRegistros(cuentaId, id, fecha);
    res.json({ ok: true, data: items });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar registros de la tarea",
    });
  }
});

app.post("/api/operativa-tareas/:id/registros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({ ok: false, error: "No se pudo determinar la cuenta" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Tarea inválida" });
      return;
    }
    const body = req.body ?? {};
    const item = await db.operativaTareas.createRegistro(cuentaId, id, req.user!.id, {
      texto: typeof body.texto === "string" ? body.texto : "",
      ganado_detalle: typeof body.ganado_detalle === "string" ? body.ganado_detalle : undefined,
      fecha_ejecucion:
        typeof body.fecha_ejecucion === "string" ? body.fecha_ejecucion : "",
    });
    res.status(201).json({ ok: true, data: item });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar el registro",
    });
  }
});

app.post("/api/stock-ganadero/potreros", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para registrar el potrero",
      });
      return;
    }
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const potrero = await db.stockGanadero.createPotrero(cuentaId, nombre);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Agregó potrero ${potrero} al catálogo`,
      detalle: { potrero, cuenta_id: cuentaId },
    });
    res.json({ ok: true, data: { nombre: potrero } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al agregar potrero",
    });
  }
});

app.get("/api/stock-ganadero/grupos", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para listar grupos",
      });
      return;
    }
    const grupos = await db.stockGanadero.listGrupos(cuentaId);
    res.json({ ok: true, data: grupos });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar grupos",
    });
  }
});

app.post("/api/stock-ganadero/grupos", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    if (!cuentaId) {
      res.status(400).json({
        ok: false,
        error: "No se pudo determinar la cuenta para registrar el grupo",
      });
      return;
    }
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre : "";
    const grupo = await db.stockGanadero.createGrupo(cuentaId, nombre);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Agregó grupo ${grupo} al catálogo`,
      detalle: { grupo, cuenta_id: cuentaId },
    });
    res.json({ ok: true, data: { nombre: grupo } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al agregar grupo",
    });
  }
});

app.post("/api/stock-ganadero/cabana/quitar", async (req, res) => {
  try {
    const claves = Array.isArray(req.body?.claves)
      ? req.body.claves.map((c: unknown) => String(c ?? "").trim()).filter(Boolean)
      : [];
    if (!claves.length) {
      res.status(400).json({ ok: false, error: "Ingresá al menos un dispositivo" });
      return;
    }
    const quitados = await db.stockGanadero.quitarCabanaSeleccion(
      claves,
      historialAutorFromRequest(req, "CABAÑA")
    );
    for (const clave of claves) {
      await auditStockMovimiento(req, "MODIFICACION", {
        clave,
        resumen: `Quitó animal de cabaña ${clave}`,
      });
    }
    res.json({ ok: true, data: { quitados } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al quitar selección de cabaña",
    });
  }
});

app.get("/api/stock-ganadero/resumen", async (req, res) => {
  const filters = await stockGanaderoFiltersFromRequest(req);
  const lecturasFilters = await stockLecturasFiltersFromRequest(req);
  const lotes = await db.stockGanadero.listLotes(lecturasFilters);
  res.json({
    ok: true,
    data: {
      lotes: lotes.length,
      registros: await db.stockGanadero.countRegistros(lecturasFilters),
      dispositivos: await db.stockGanadero.countDispositivos(filters),
      dispositivos_total: await db.stockGanadero.countDispositivosTotal(filters),
      ventas_dispositivos: await db.simuladorVentaDispositivos.countEnVentasCerradas(),
    },
  });
});

app.get("/api/stock-ganadero/ventas-dispositivos", async (_req, res) => {
  const [total, claves] = await Promise.all([
    db.simuladorVentaDispositivos.countEnVentasCerradas(),
    db.simuladorVentaDispositivos.listClavesEnVentasCerradas(),
  ]);
  res.json({ ok: true, data: { total, claves } });
});

app.post("/api/stock-ganadero/import/file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo .txt, .csv o .xlsx" });
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, "empresa")) {
      res.status(400).json({ ok: false, error: "Seleccioná la empresa de los animales del archivo" });
      return;
    }
    const empresaDefault = String((req.body as { empresa?: string }).empresa ?? "").trim();
    let rows = await parseStockGanaderoFile(file.buffer, file.originalname || "import.txt");
    rows = applyDefaultEmpresaToStockRows(rows, empresaDefault);
    await assertStockImportRowsEmpresas(req.user!, rows);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockGanadero.importRows(
      file.originalname || "import.txt",
      rows,
      cuentaId
    );
    const lote = await db.stockGanadero.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Importó ${result.insertados} lectura(s) desde archivo`,
        detalle: {
          archivo: lote?.nombre_archivo ?? file.originalname,
          lote_id: result.lote_id,
        },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s) desde «${lote?.nombre_archivo ?? "archivo"}»`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-ganadero/import/text", async (req, res) => {
  try {
    const texto = String((req.body as { texto?: string }).texto ?? "");
    const nombre = String((req.body as { nombre_archivo?: string }).nombre_archivo ?? "pegado.txt");
    const rows = parseStockGanaderoText(texto);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockGanadero.importRows(nombre, rows, cuentaId);
    const lote = await db.stockGanadero.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Importó ${result.insertados} lectura(s) desde texto`,
        detalle: { archivo: nombre, lote_id: result.lote_id },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s)`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-ganadero/import/rows", async (req, res) => {
  try {
    const body = req.body as {
      rows?: Array<{
        eid?: string;
        vid?: string;
        fecha?: string;
        hora?: string;
        condicion?: string;
        empresa?: string;
      }>;
      nombre_archivo?: string;
    };
    const rows = normalizeStockGanaderoRows(body.rows ?? []);
    await assertStockImportRowsEmpresas(req.user!, rows);
    const nombre = String(body.nombre_archivo ?? "carga-manual").trim() || "carga-manual";
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockGanadero.importRows(nombre, rows, cuentaId);
    const lote = await db.stockGanadero.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Carga manual: ${result.insertados} lectura(s)`,
        detalle: { archivo: nombre, lote_id: result.lote_id },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s) (carga manual)`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function parseEstadoBajaImport(raw: unknown): "VENDIDO" | "FRIGORIFICO" {
  const estado = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (estado === "VENDIDO" || estado === "FRIGORIFICO") return estado;
  throw new Error("Indicá el tipo de baja: VENDIDO o FRIGORIFICO.");
}

function parseTipoBajaForImport(body: {
  tipo_baja?: unknown;
  estado?: unknown;
}): TipoBaja {
  const rawTipo = String(body.tipo_baja ?? "").trim();
  if (rawTipo) {
    const tipo = parseTipoBaja(rawTipo);
    if (tipo === "FRIGORIFICO") {
      throw new Error(
        "Tipo de baja inválido. Use VENTA_FRIGORIFICO, VENTA_PRODUCTOR, MUERTE o PERDIDO."
      );
    }
    return tipo;
  }
  if (body.estado) {
    return tipoBajaDesdeEstadoImport(parseEstadoBajaImport(body.estado));
  }
  throw new Error(
    "Indicá el tipo de baja: VENTA_FRIGORIFICO, VENTA_PRODUCTOR, MUERTE o PERDIDO."
  );
}

function etiquetaTipoBajaImport(tipo: TipoBaja): string {
  switch (tipo) {
    case "VENTA_FRIGORIFICO":
      return "Venta Frigorífico";
    case "VENTA_PRODUCTOR":
      return "Venta productor";
    case "MUERTE":
      return "Muerte";
    case "PERDIDO":
      return "Extraviado";
    case "FRIGORIFICO":
      return "Frigorífico";
  }
}

function mensajeImportBaja(
  result: {
    actualizados: number;
    no_encontrados: number;
    duplicados_omitidos: number;
    ambiguos?: number;
  },
  tipo_baja: TipoBaja
): string {
  const etiqueta = etiquetaTipoBajaImport(tipo_baja);
  let msg = `Se marcaron ${result.actualizados} dispositivo(s) como ${etiqueta}.`;
  if (result.no_encontrados > 0) {
    msg += ` ${result.no_encontrados} no estaban en el stock.`;
  }
  if ((result.ambiguos ?? 0) > 0) {
    msg += ` ${result.ambiguos} con número ambiguo (varios coinciden).`;
  }
  if (result.duplicados_omitidos > 0) {
    msg += ` ${result.duplicados_omitidos} duplicado(s) omitido(s).`;
  }
  return msg;
}

function mensajeImportBajaDetalle(result: {
  actualizados: number;
  no_encontrados: number;
  duplicados_omitidos: number;
  ambiguos?: number;
}): string {
  let msg = `Se registraron ${result.actualizados} baja(s).`;
  if (result.no_encontrados > 0) {
    msg += ` ${result.no_encontrados} no estaban en el stock.`;
  }
  if ((result.ambiguos ?? 0) > 0) {
    msg += ` ${result.ambiguos} con número ambiguo (varios coinciden).`;
  }
  if (result.duplicados_omitidos > 0) {
    msg += ` ${result.duplicados_omitidos} duplicado(s) omitido(s).`;
  }
  return msg;
}

app.post("/api/stock-ganadero/baja/file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo .txt o .csv" });
      return;
    }
    const tipo_baja = parseTipoBajaForImport(req.body ?? {});
    const rows = parseStockGanaderoBuffer(file.buffer);
    const result = await db.stockGanadero.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-ganadero/baja/text", async (req, res) => {
  try {
    const body = req.body as { texto?: string; tipo_baja?: string; estado?: string };
    const texto = String(body.texto ?? "");
    const tipo_baja = parseTipoBajaForImport(body);
    const rows = parseStockGanaderoText(texto);
    const result = await db.stockGanadero.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-ganadero/baja/rows", async (req, res) => {
  try {
    const body = req.body as {
      rows?: Array<{
        eid?: string;
        vid?: string;
        fecha?: string;
        hora?: string;
        condicion?: string;
      }>;
      tipo_baja?: string;
      estado?: string;
    };
    const tipo_baja = parseTipoBajaForImport(body);
    const rows = normalizeStockGanaderoRows(body.rows ?? []);
    const result = await db.stockGanadero.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-ganadero/baja/dispositivos", async (req, res) => {
  try {
    const body = req.body as {
      items?: Array<{
        numero?: string;
        tipo_baja?: string;
        fecha?: string;
        numero_guia?: string;
        observaciones?: string;
      }>;
      dispositivos?: string[];
      estado?: string;
    };

    if (Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items.map((item) => ({
        numero: String(item.numero ?? "").trim(),
        tipo_baja: parseTipoBaja(item.tipo_baja),
        fecha: String(item.fecha ?? "").trim(),
        numero_guia: String(item.numero_guia ?? "").trim() || undefined,
        observaciones: String(item.observaciones ?? "").trim() || undefined,
      }));
      const result = await db.stockGanadero.importBajaDetalle(
        items,
        historialAutorFromRequest(req, "IMPORT")
      );
      if (result.dispositivos_bajados.length > 0) {
        await auditBajasDispositivos(req, result.dispositivos_bajados);
      }
      res.status(201).json({
        ok: true,
        message: mensajeImportBajaDetalle(result),
        data: result,
      });
      return;
    }

    const tipo_baja = parseTipoBajaForImport(body);
    const dispositivos = Array.isArray(body.dispositivos)
      ? body.dispositivos.map((n) => String(n ?? "").trim()).filter(Boolean)
      : [];
    const result = await db.stockGanadero.importBajaNumeros(
      dispositivos,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/stock-ganadero/lotes/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await assertLoteEnCuentaUsuario(req, id);
  } catch (e) {
    res.status(403).json({
      ok: false,
      error: e instanceof Error ? e.message : "Sin permiso sobre esta importación",
    });
    return;
  }
  if (!await db.stockGanadero.deleteLote(id)) {
    res.status(404).json({ ok: false, error: "Lote no encontrado" });
    return;
  }
  await auditStockMovimiento(req, "MODIFICACION", {
    resumen: `Eliminó lote de importación #${id}`,
    detalle: { lote_id: id },
  });
  res.json({ ok: true, message: "Importación eliminada" });
});

// —— Stock equino (clon de rutas ganadero) ——
app.get("/api/stock-equino/ultima-importacion-archivo", async (req, res) => {
  const filters = await stockLecturasFiltersFromRequest(req);
  const lotes = await db.stockEquino.listLotes(filters);
  const lote = lotes.find((l) => l.nombre_archivo !== "carga-manual");
  if (!lote) {
    res.json({ ok: true, data: null });
    return;
  }
  res.json({
    ok: true,
    data: { id: lote.id, nombre: lote.nombre_archivo, filas: lote.filas },
  });
});

app.get("/api/stock-equino/lotes", async (req, res) => {
  const filters = await stockLecturasFiltersFromRequest(req);
  res.json({ ok: true, data: await db.stockEquino.listLotes(filters) });
});

app.get("/api/stock-equino/registros", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const filters = await stockLecturasFiltersFromRequest(req, {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    solo_repetidos: req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
  });
  res.json({
    ok: true,
    data: await db.stockEquino.listRegistros(filters),
  });
});

app.get("/api/stock-equino/estadisticas", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const filters = await stockLecturasFiltersFromRequest(req, {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
  });
  res.json({
    ok: true,
    data: await db.stockEquino.estadisticas(filters),
  });
});

app.get("/api/stock-equino/salidas", async (req, res) => {
  const filters = await stockEquinoFiltersFromRequest(req, stockEquinoQueryBase(req));
  const { data, bajas_reparadas } = await db.stockEquino.listSalidas(filters);
  res.json({ ok: true, data, bajas_reparadas });
});

app.get("/api/stock-equino/empresas-operativas", async (req, res) => {
  const detalle = await empresasCuenta.getEmpresasOperativasDetallePermitidas(
    db.getDb(),
    req.user!
  );
  res.json({ ok: true, data: detalle });
});

app.get("/api/stock-equino/dispositivos", async (req, res) => {
  const filters = await stockEquinoFiltersFromRequest(req, {
    ...stockEquinoQueryBase(req),
    solo_repetidos:
      req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
    solo_bajas:
      req.query.solo_bajas === "1" || req.query.solo_bajas === "true",
  });
  res.json({
    ok: true,
    data: await db.stockEquino.listDispositivos(filters),
  });
});

app.get("/api/stock-equino/dispositivos/:clave", async (req, res) => {
  const filters = await stockEquinoFiltersFromRequest(req, stockEquinoQueryBase(req));
  const detalle = await db.stockEquino.getDispositivo(req.params.clave, filters);
  if (!detalle) {
    res.status(404).json({ ok: false, error: "Dispositivo no encontrado" });
    return;
  }
  res.json({ ok: true, data: detalle });
});

app.get("/api/stock-equino/dispositivos/:clave/historial-cambios", async (req, res) => {
  try {
    await assertStockEquinoDispositivoEnScope(req, req.params.clave);
    const data = await db.stockEquino.listHistorialCambios(req.params.clave);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar historial",
    });
  }
});

app.get("/api/stock-equino/control-sanitario/cantidad-opciones", async (_req, res) => {
  try {
    const data = await stockControlSanitario.listStockControlSanitarioCantidadCatalog(
      db.getDb()
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar cantidades",
    });
  }
});

app.post("/api/stock-equino/control-sanitario/cantidad-opciones", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const valor = String(req.body?.valor ?? "");
    const data = await stockControlSanitario.createStockControlSanitarioCantidadCatalog(
      db.getDb(),
      valor,
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar cantidad",
    });
  }
});

app.get("/api/stock-equino/control-sanitario/espera-opciones", async (_req, res) => {
  try {
    const data = await stockControlSanitario.listStockControlSanitarioEsperaCatalog(db.getDb());
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar tiempos de espera",
    });
  }
});

app.post("/api/stock-equino/control-sanitario/espera-opciones", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const valor = String(req.body?.valor ?? "");
    const data = await stockControlSanitario.createStockControlSanitarioEsperaCatalog(
      db.getDb(),
      valor,
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar tiempo de espera",
    });
  }
});

app.get("/api/stock-equino/control-sanitario/producto-ficha/:nombre", async (req, res) => {
  try {
    const data = await stockControlSanitario.getStockControlSanitarioProductoFicha(
      db.getDb(),
      String(req.params.nombre ?? "")
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar ficha del producto",
    });
  }
});

app.put("/api/stock-equino/control-sanitario/producto-ficha", async (req, res) => {
  try {
    const autor = historialAutorLabelFromRequest(req);
    const data = await stockControlSanitario.upsertStockControlSanitarioProductoFicha(
      db.getDb(),
      req.body ?? {},
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar ficha del producto",
    });
  }
});

app.get("/api/stock-equino/dispositivos/:clave/control-sanitario", async (req, res) => {
  try {
    await assertStockEquinoDispositivoEnScope(req, req.params.clave);
    const data = await stockControlSanitario.listStockControlSanitario(
      db.getDb(),
      "equino",
      String(req.params.clave)
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar control sanitario",
    });
  }
});

app.post("/api/stock-equino/dispositivos/:clave/control-sanitario", async (req, res) => {
  try {
    await assertStockEquinoDispositivoEnScope(req, req.params.clave);
    const autor = historialAutorLabelFromRequest(req);
    const data = await stockControlSanitario.createStockControlSanitario(
      db.getDb(),
      "equino",
      String(req.params.clave),
      req.body ?? {},
      autor
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar control sanitario",
    });
  }
});

app.delete(
  "/api/stock-equino/dispositivos/:clave/control-sanitario/:id",
  async (req, res) => {
    try {
      await assertStockEquinoDispositivoEnScope(req, req.params.clave);
      const id = Number(req.params.id);
      await stockControlSanitario.deleteStockControlSanitario(
        db.getDb(),
        "equino",
        String(req.params.clave),
        id
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al eliminar registro",
      });
    }
  }
);

app.get("/api/stock-equino/dispositivos/:clave/fotos", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const data = await stockDispositivoFoto.getStockDispositivoFotoDto(
      db.getDb(),
      "equino",
      clave
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al listar fotos",
    });
  }
});

app.get("/api/stock-equino/dispositivos/:clave/foto/:fotoId", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const fotoId = Number(req.params.fotoId);
    if (!Number.isFinite(fotoId) || fotoId < 1) {
      res.status(400).json({ ok: false, error: "Foto inválida" });
      return;
    }
    const image = await stockDispositivoFoto.loadStockDispositivoFotoById(
      db.getDb(),
      "equino",
      clave,
      fotoId,
      { thumb: wantsFotoThumb(req) }
    );
    if (!image) {
      res.status(404).json({ ok: false, error: "Sin foto del animal" });
      return;
    }
    setStockDispositivoFotoCacheHeaders(req, res);
    res.type(image.mime).send(image.buffer);
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar foto",
    });
  }
});

app.patch(
  "/api/stock-equino/dispositivos/:clave/foto/:fotoId/principal",
  async (req, res) => {
    try {
      const clave = String(req.params.clave);
      const fotoId = Number(req.params.fotoId);
      if (!Number.isFinite(fotoId) || fotoId < 1) {
        res.status(400).json({ ok: false, error: "Foto inválida" });
        return;
      }
      const data = await stockDispositivoFoto.setStockDispositivoFotoPrincipal(
        db.getDb(),
        "equino",
        clave,
        fotoId
      );
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al marcar foto principal",
      });
    }
  }
);

app.delete("/api/stock-equino/dispositivos/:clave/foto/:fotoId", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const fotoId = Number(req.params.fotoId);
    if (!Number.isFinite(fotoId) || fotoId < 1) {
      res.status(400).json({ ok: false, error: "Foto inválida" });
      return;
    }
    const data = await stockDispositivoFoto.deleteStockDispositivoFotoById(
      db.getDb(),
      "equino",
      clave,
      fotoId
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al quitar foto",
    });
  }
});

app.get("/api/stock-equino/dispositivos/:clave/foto", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const image = await stockDispositivoFoto.loadStockDispositivoFoto(
      db.getDb(),
      "equino",
      clave
    );
    if (!image) {
      res.status(404).json({ ok: false, error: "Sin foto del animal" });
      return;
    }
    setStockDispositivoFotoCacheHeaders(req, res);
    res.type(image.mime).send(image.buffer);
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar foto",
    });
  }
});

app.post(
  "/api/stock-equino/dispositivos/:clave/foto",
  iconUpload.single("foto"),
  async (req, res) => {
    try {
      const clave = String(req.params.clave);
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Seleccioná una imagen" });
        return;
      }
      const data = await stockDispositivoFoto.saveStockDispositivoFoto(
        db.getDb(),
        "equino",
        clave,
        file.buffer,
        file.mimetype
      );
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al subir foto",
      });
    }
  }
);

app.delete("/api/stock-equino/dispositivos/:clave/foto", async (req, res) => {
  try {
    const clave = String(req.params.clave);
    const data = await stockDispositivoFoto.clearStockDispositivoFoto(
      db.getDb(),
      "equino",
      clave
    );
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al quitar foto",
    });
  }
});

app.patch("/api/stock-equino/dispositivos/bulk", async (req, res) => {
  try {
    const body = req.body ?? {};
    const claves = Array.isArray(body.claves)
      ? body.claves.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const eids =
      body.eids && typeof body.eids === "object" && !Array.isArray(body.eids)
        ? (body.eids as Record<string, string>)
        : {};

    const metaPatch: DispositivoMetaPatch = {};
    if (patch.sexo !== undefined) {
      metaPatch.sexo = String(patch.sexo).toUpperCase() as "" | "MACHO" | "HEMBRA";
    }
    if (patch.empresa !== undefined) {
      const empresa = String(patch.empresa).trim().toUpperCase();
      await assertEmpresaCodigoPermitida(req.user!, empresa);
      metaPatch.empresa = empresa;
    }
    if (patch.nacimiento_mes !== undefined) {
      const v = patch.nacimiento_mes;
      metaPatch.nacimiento_mes =
        v === null || v === "" ? null : Number(v);
    }
    if (patch.nacimiento_anio !== undefined) {
      const v = patch.nacimiento_anio;
      metaPatch.nacimiento_anio =
        v === null || v === "" ? null : Number(v);
    }
    if (patch.observaciones !== undefined) {
      metaPatch.observaciones = String(patch.observaciones);
    }
    if (patch.estado !== undefined) {
      metaPatch.estado = String(patch.estado).toUpperCase() as
        | "VIVO"
        | "MUERTO"
        | "VENDIDO"
        | "FRIGORIFICO";
    }
    if (patch.baja_mes !== undefined) {
      const v = patch.baja_mes;
      metaPatch.baja_mes = v === null || v === "" ? null : Number(v);
    }
    if (patch.baja_anio !== undefined) {
      const v = patch.baja_anio;
      metaPatch.baja_anio = v === null || v === "" ? null : Number(v);
    }

    const result = await db.stockEquino.bulkPatchDispositivos(
      claves,
      metaPatch,
      eids,
      historialAutorFromRequest(req, "MASIVO")
    );
    if (result.actualizados > 0) {
      await auditStockMovimiento(req, "MODIFICACION", {
        cantidad: result.actualizados,
        resumen: `Modificación masiva de ${result.actualizados} dispositivo(s)`,
        detalle: { claves: claves.slice(0, 25), patch: metaPatch },
      });
    }
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al actualizar dispositivos",
    });
  }
});

app.post("/api/stock-equino/dispositivos/bulk-delete", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  try {
    const body = req.body ?? {};
    const claves = Array.isArray(body.claves)
      ? body.claves.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const result = await db.stockEquino.deleteDispositivos(claves);
    await auditStockMovimiento(req, "MODIFICACION", {
      cantidad: result.eliminados,
      resumen: `Eliminó ${result.eliminados} dispositivo(s) del sistema`,
      detalle: {
        claves: claves.slice(0, 25),
        lecturas_eliminadas: result.lecturas_eliminadas,
        no_encontrados: result.no_encontrados,
      },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al eliminar dispositivos",
    });
  }
});

app.post("/api/stock-equino/dispositivos/wipe-all", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null && !req.user!.es_super_admin) return;
  try {
    const result = await db.stockEquino.vaciarCompleto(cuentaId);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: "Vació todo el stock equino",
      detalle: { ...result },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al vaciar el stock",
    });
  }
});

app.get("/api/stock-equino/backup", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null) {
    if (req.user.es_super_admin) {
      res.json({
        ok: true,
        data: {
          disponible: false,
          creado_en: null,
          dispositivos: 0,
          lecturas: 0,
          historial: 0,
          vinculos_sim: 0,
        },
      });
      return;
    }
    return;
  }
  try {
    res.json({ ok: true, data: await db.stockEquino.backupInfo(cuentaId) });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al leer respaldo",
    });
  }
});

app.post("/api/stock-equino/backup/restore", async (req, res) => {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return;
  }
  const cuentaId = await requireStockAdminCuentaId(req, res);
  if (cuentaId == null) {
    if (!req.user.es_super_admin) return;
    res.status(400).json({
      ok: false,
      error: "Recuperación de respaldo requiere una cuenta madre asociada",
    });
    return;
  }
  try {
    const result = await db.stockEquino.restaurarDesdeBackup(cuentaId);
    await auditStockMovimiento(req, "MODIFICACION", {
      resumen: `Restauró stock ganadero desde respaldo (${result.dispositivos_restaurados} dispositivo(s))`,
      detalle: { ...result },
    });
    res.json({ ok: true, data: result });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al restaurar respaldo",
    });
  }
});

app.patch("/api/stock-equino/dispositivos/:clave/sexo", async (req, res) => {
  try {
    const sexo = String(req.body?.sexo ?? "").toUpperCase() as
      | ""
      | "MACHO"
      | "HEMBRA";
    const eid = typeof req.body?.eid === "string" ? req.body.eid : undefined;
    const actualizado = await db.stockEquino.updateDispositivoSexo(
      req.params.clave,
      sexo,
      eid,
      historialAutorFromRequest(req, "FICHA")
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Cambió sexo del dispositivo ${req.params.clave}`,
      detalle: { sexo: actualizado },
    });
    res.json({ ok: true, data: { sexo: actualizado } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar sexo",
    });
  }
});

app.patch("/api/stock-equino/dispositivos/:clave", async (req, res) => {
  try {
    const body = req.body ?? {};
    const sexo = String(body.sexo ?? "").toUpperCase() as "" | "MACHO" | "HEMBRA";
    const empresa = String(body.empresa ?? "").trim().toUpperCase();
    await assertEmpresaCodigoPermitida(req.user!, empresa);
    const mesRaw = body.nacimiento_mes;
    const nacimiento_mes =
      mesRaw === null || mesRaw === undefined || mesRaw === ""
        ? null
        : Number(mesRaw);
    const anioRaw = body.nacimiento_anio;
    const nacimiento_anio =
      anioRaw === null || anioRaw === undefined || anioRaw === ""
        ? null
        : Number(anioRaw);
    const observaciones =
      typeof body.observaciones === "string" ? body.observaciones : "";
    const grupo_libre =
      typeof body.grupo_libre === "string" ? body.grupo_libre : "";
    const potrero = typeof body.potrero === "string" ? body.potrero : "";
    const estado = String(body.estado ?? "VIVO").toUpperCase() as
      | "VIVO"
      | "MUERTO"
      | "VENDIDO"
      | "FRIGORIFICO"
      | "PERDIDO";
    const tipo_baja = optionalTipoBaja(body.tipo_baja);
    const numero_guia =
      typeof body.numero_guia === "string" ? body.numero_guia : "";
    const bajaMesRaw = body.baja_mes;
    const baja_mes =
      bajaMesRaw === null || bajaMesRaw === undefined || bajaMesRaw === ""
        ? null
        : Number(bajaMesRaw);
    const bajaAnioRaw = body.baja_anio;
    const baja_anio =
      bajaAnioRaw === null || bajaAnioRaw === undefined || bajaAnioRaw === ""
        ? null
        : Number(bajaAnioRaw);
    const eid = typeof body.eid === "string" ? body.eid : undefined;

    const data = await db.stockEquino.saveDispositivo(
      req.params.clave,
      {
        sexo,
        empresa,
        grupo: "",
        grupo_libre,
        potrero,
        nacimiento_mes,
        nacimiento_anio,
        observaciones,
        estado,
        tipo_baja,
        numero_guia,
        baja_mes,
        baja_anio,
      },
      eid,
      historialAutorFromRequest(req, "FICHA")
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Modificó dispositivo ${req.params.clave}`,
      detalle: {
        estado: data.estado,
        tipo_baja: data.tipo_baja,
        sexo: data.sexo,
        empresa: data.empresa,
      },
    });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar dispositivo",
    });
  }
});

app.patch("/api/stock-equino/dispositivos/:clave/edad", async (req, res) => {
  try {
    const raw = req.body?.edad;
    const edad =
      raw === null || raw === undefined || raw === ""
        ? null
        : Number(raw);
    const eid = typeof req.body?.eid === "string" ? req.body.eid : undefined;
    const actualizado = await db.stockEquino.updateDispositivoEdad(
      req.params.clave,
      edad,
      eid
    );
    await auditStockMovimiento(req, "MODIFICACION", {
      clave: req.params.clave,
      resumen: `Actualizó edad del dispositivo ${req.params.clave}`,
      detalle: { edad: actualizado },
    });
    res.json({ ok: true, data: { edad: actualizado } });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar edad",
    });
  }
});

app.get("/api/stock-equino/resumen", async (req, res) => {
  const filters = await stockEquinoFiltersFromRequest(req);
  const lecturasFilters = await stockLecturasFiltersFromRequest(req);
  const lotes = await db.stockEquino.listLotes(lecturasFilters);
  res.json({
    ok: true,
    data: {
      lotes: lotes.length,
      registros: await db.stockEquino.countRegistros(lecturasFilters),
      dispositivos: await db.stockEquino.countDispositivos(filters),
      dispositivos_total: await db.stockEquino.countDispositivosTotal(filters),
      ventas_dispositivos: 0,
    },
  });
});

app.get("/api/stock-equino/ventas-dispositivos", async (_req, res) => {
  const [total, claves] = await Promise.all([
    db.simuladorVentaDispositivos.countEnVentasCerradas(),
    db.simuladorVentaDispositivos.listClavesEnVentasCerradas(),
  ]);
  res.json({ ok: true, data: { total, claves } });
});

app.post("/api/stock-equino/import/file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo .txt, .csv o .xlsx" });
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, "empresa")) {
      res.status(400).json({ ok: false, error: "Seleccioná la empresa de los animales del archivo" });
      return;
    }
    const empresaDefault = String((req.body as { empresa?: string }).empresa ?? "").trim();
    let rows = await parseStockGanaderoFile(file.buffer, file.originalname || "import.txt");
    rows = applyDefaultEmpresaToStockRows(rows, empresaDefault);
    await assertStockImportRowsEmpresas(req.user!, rows);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockEquino.importRows(
      file.originalname || "import.txt",
      rows,
      cuentaId
    );
    const lote = await db.stockEquino.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Importó ${result.insertados} lectura(s) desde archivo`,
        detalle: {
          archivo: lote?.nombre_archivo ?? file.originalname,
          lote_id: result.lote_id,
        },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s) desde «${lote?.nombre_archivo ?? "archivo"}»`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/import/text", async (req, res) => {
  try {
    const texto = String((req.body as { texto?: string }).texto ?? "");
    const nombre = String((req.body as { nombre_archivo?: string }).nombre_archivo ?? "pegado.txt");
    const rows = parseStockGanaderoText(texto);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockEquino.importRows(nombre, rows, cuentaId);
    const lote = await db.stockEquino.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Importó ${result.insertados} lectura(s) desde texto`,
        detalle: { archivo: nombre, lote_id: result.lote_id },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s)`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/import/rows", async (req, res) => {
  try {
    const body = req.body as {
      rows?: Array<{
        eid?: string;
        vid?: string;
        fecha?: string;
        hora?: string;
        condicion?: string;
        empresa?: string;
      }>;
      nombre_archivo?: string;
    };
    const rows = normalizeStockGanaderoRows(body.rows ?? []);
    await assertStockImportRowsEmpresas(req.user!, rows);
    const nombre = String(body.nombre_archivo ?? "carga-manual").trim() || "carga-manual";
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const result = await db.stockEquino.importRows(nombre, rows, cuentaId);
    const lote = await db.stockEquino.getLote(result.lote_id);
    if (result.insertados > 0) {
      await auditStockMovimiento(req, "ALTA", {
        cantidad: result.insertados,
        resumen: `Carga manual: ${result.insertados} lectura(s)`,
        detalle: { archivo: nombre, lote_id: result.lote_id },
      });
    }
    res.status(201).json({
      ok: true,
      message: `Importadas ${result.insertados} lectura(s) (carga manual)`,
      data: { ...result, lote },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/baja/file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo .txt o .csv" });
      return;
    }
    const tipo_baja = parseTipoBajaForImport(req.body ?? {});
    const rows = parseStockGanaderoBuffer(file.buffer);
    const result = await db.stockEquino.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/baja/text", async (req, res) => {
  try {
    const body = req.body as { texto?: string; tipo_baja?: string; estado?: string };
    const texto = String(body.texto ?? "");
    const tipo_baja = parseTipoBajaForImport(body);
    const rows = parseStockGanaderoText(texto);
    const result = await db.stockEquino.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/baja/rows", async (req, res) => {
  try {
    const body = req.body as {
      rows?: Array<{
        eid?: string;
        vid?: string;
        fecha?: string;
        hora?: string;
        condicion?: string;
      }>;
      tipo_baja?: string;
      estado?: string;
    };
    const tipo_baja = parseTipoBajaForImport(body);
    const rows = normalizeStockGanaderoRows(body.rows ?? []);
    const result = await db.stockEquino.importBaja(
      rows,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/stock-equino/baja/dispositivos", async (req, res) => {
  try {
    const body = req.body as {
      items?: Array<{
        numero?: string;
        tipo_baja?: string;
        fecha?: string;
        numero_guia?: string;
        observaciones?: string;
      }>;
      dispositivos?: string[];
      estado?: string;
    };

    if (Array.isArray(body.items) && body.items.length > 0) {
      const items = body.items.map((item) => ({
        numero: String(item.numero ?? "").trim(),
        tipo_baja: parseTipoBaja(item.tipo_baja),
        fecha: String(item.fecha ?? "").trim(),
        numero_guia: String(item.numero_guia ?? "").trim() || undefined,
        observaciones: String(item.observaciones ?? "").trim() || undefined,
      }));
      const result = await db.stockEquino.importBajaDetalle(
        items,
        historialAutorFromRequest(req, "IMPORT")
      );
      if (result.dispositivos_bajados.length > 0) {
        await auditBajasDispositivos(req, result.dispositivos_bajados);
      }
      res.status(201).json({
        ok: true,
        message: mensajeImportBajaDetalle(result),
        data: result,
      });
      return;
    }

    const tipo_baja = parseTipoBajaForImport(body);
    const dispositivos = Array.isArray(body.dispositivos)
      ? body.dispositivos.map((n) => String(n ?? "").trim()).filter(Boolean)
      : [];
    const result = await db.stockEquino.importBajaNumeros(
      dispositivos,
      tipo_baja,
      historialAutorFromRequest(req, "IMPORT")
    );
    if (result.dispositivos_bajados.length > 0) {
      await auditBajasDispositivos(req, result.dispositivos_bajados);
    }
    res.status(201).json({
      ok: true,
      message: mensajeImportBaja(result, tipo_baja),
      data: { ...result, tipo_baja },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/stock-equino/lotes/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await assertLoteEquinoEnCuentaUsuario(req, id);
  } catch (e) {
    res.status(403).json({
      ok: false,
      error: e instanceof Error ? e.message : "Sin permiso sobre esta importación",
    });
    return;
  }
  if (!await db.stockEquino.deleteLote(id)) {
    res.status(404).json({ ok: false, error: "Lote no encontrado" });
    return;
  }
  await auditStockMovimiento(req, "MODIFICACION", {
    resumen: `Eliminó lote de importación #${id}`,
    detalle: { lote_id: id },
  });
  res.json({ ok: true, message: "Importación eliminada" });
});

function parseProveedorBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const cod = Number(body.cod);
  const razon_social = String(body.razon_social ?? "").trim();
  if (!Number.isFinite(cod) || cod < 1) {
    throw new Error("El código de proveedor debe ser un número válido.");
  }
  if (!razon_social) throw new Error("La razón social es obligatoria.");
  return {
    cod,
    razon_social,
    rut: String(body.rut ?? "").trim(),
    direccion: String(body.direccion ?? "").trim(),
    ciudad: String(body.ciudad ?? "").trim(),
  };
}

app.get("/api/proveedores", async (req, res) => {
  const busqueda = req.query.busqueda as string | undefined;
  let cuentaId = await proveedoresCuentaId(req.user!);
  if (req.user!.es_super_admin && String(req.query.ambito ?? "") === "cuenta") {
    cuentaId = (await cuentaIdForScopedRead(req.user!)) ?? 0;
  }
  res.json({ ok: true, data: await db.proveedores.list(busqueda, cuentaId) });
});

app.get("/api/proveedores/siguiente-cod", async (req, res) => {
  try {
    const cuentaId = await proveedoresCuentaIdParaInsert(req.user!);
    res.json({ ok: true, cod: await db.proveedores.nextCod(cuentaId) });
  } catch (e) {
    res.status(403).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/proveedores/:cod", async (req, res) => {
  const cod = Number(req.params.cod);
  const cuentaId = await proveedoresCuentaId(req.user!);
  const reg = await db.proveedores.getByCod(cod, cuentaId);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/proveedores", async (req, res) => {
  try {
    const payload = parseProveedorBody(req);
    const cuentaId = await proveedoresCuentaIdParaInsert(req.user!);
    if (await db.proveedores.getByCod(payload.cod, cuentaId)) {
      res.status(400).json({ ok: false, error: "Ya existe un proveedor con ese código" });
      return;
    }
    const id = await db.proveedores.insert(payload, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.proveedores.getById(id, cuentaId),
      message: "Proveedor agregado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/proveedores/id/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = parseProveedorBody(req);
    const cuentaId = await proveedoresCuentaId(req.user!);
    const existing = await db.proveedores.getByCod(payload.cod, cuentaId);
    if (existing && existing.id !== id) {
      res.status(400).json({ ok: false, error: "Ya existe otro proveedor con ese código" });
      return;
    }
    if (!await db.proveedores.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.proveedores.getById(id, cuentaId),
      message: "Proveedor actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.patch("/api/proveedores/id/:id/clasificacion", async (req, res) => {
  if (!req.user?.es_super_admin) {
    res.status(403).json({
      ok: false,
      error: "Clasificación de proveedores disponible solo para superadministrador",
    });
    return;
  }
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "ID inválido" });
      return;
    }
    const body = req.body ?? {};
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!cuentaId) {
      res.status(403).json({
        ok: false,
        error: "Sin cuenta para clasificar proveedores",
      });
      return;
    }
    const hasRubroPayload = "rubro" in body || "sub_rubro" in body;

    if (hasRubroPayload) {
      const rubro = String(body.rubro ?? "").trim();
      const sub_rubro = String(body.sub_rubro ?? "").trim();
      const rubrosReadScope: GastosRubrosReadScope = {
        mode: "cuenta",
        cuentaId,
      };

      if (rubro && !await db.rubros.gastoValido(rubro, rubrosReadScope)) {
        res.status(400).json({
          ok: false,
          error: "El rubro debe existir en Configuración → Rubros (grupo con sub-rubros activos).",
        });
        return;
      }
      if (sub_rubro) {
        if (!rubro) {
          res.status(400).json({ ok: false, error: "Elegí un rubro antes del sub-rubro." });
          return;
        }
        if (!await db.subRubros.existsActivo(sub_rubro, rubrosReadScope)) {
          res.status(400).json({
            ok: false,
            error: "El sub-rubro debe existir en el catálogo SUB_RUBROS y estar activo.",
          });
          return;
        }
        if (!await db.rubroVinculos.isValidPair(rubro, sub_rubro, rubrosReadScope)) {
          res.status(400).json({
            ok: false,
            error:
              "El sub-rubro no está vinculado a este rubro. Configuralo en Rubros → Configuración vínculos.",
          });
          return;
        }
      }

      const data = await db.proveedores.updateRubroClasificacion(
        id,
        { rubro, sub_rubro },
        cuentaId
      );
      if (!data) {
        res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
        return;
      }
      res.json({ ok: true, data, message: "Clasificación actualizada" });
      return;
    }

    if ("clasificacion_resultado" in body) {
      const raw = body.clasificacion_resultado;
      const clasificacion =
        raw === null || raw === undefined || raw === ""
          ? null
          : String(raw).trim().toUpperCase();
      if (
        clasificacion &&
        !["COSTOS_PRODUCCION", "GASTOS_ADMINISTRATIVOS", "GASTOS_COMERCIALES"].includes(
          clasificacion
        )
      ) {
        res.status(400).json({ ok: false, error: "Clasificación inválida" });
        return;
      }
      const data = await db.proveedores.updateClasificacionResultado(
        id,
        clasificacion as import("./clasificacion-resultado.js").ClasificacionResultado | null,
        cuentaId
      );
      if (!data) {
        res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
        return;
      }
      res.json({ ok: true, data, message: "Estado de resultados actualizado" });
      return;
    }

    res.status(400).json({ ok: false, error: "Payload de clasificación inválido" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/proveedores/id/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await proveedoresCuentaId(req.user!);
  if (!await db.proveedores.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Proveedor eliminado" });
});

function parseTipoDocumentoGastoBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  const descripcion = String(body.descripcion ?? "").trim();
  const origen = String(body.origen ?? "").trim();
  const destino = String(body.destino ?? "").trim();
  const activo = body.activo !== false && body.activo !== 0 && body.activo !== "0";
  const campos_habilitados = normalizeGastoCampoList(body.campos_habilitados);
  const campos_requeridos = normalizeGastoCampoList(body.campos_requeridos);
  const valores_defecto =
    body.valores_defecto && typeof body.valores_defecto === "object" && !Array.isArray(body.valores_defecto)
      ? (body.valores_defecto as Record<string, string>)
      : {};
  const mapeo_campos = normalizeGastoMapeo(body.mapeo_campos);
  const comision_config = normalizeComisionConfig(body.comision_config);
  return {
    nombre,
    descripcion,
    origen,
    destino,
    activo,
    campos_habilitados,
    campos_requeridos,
    valores_defecto,
    mapeo_campos,
    comision_config,
  };
}

app.get("/api/documentos-digitales/tipos-gasto", async (req, res) => {
  const soloActivos = req.query.solo_activos === "1" || req.query.solo_activos === "true";
  res.json({
    ok: true,
    data: await db.documentosDigitales.listTiposGasto({ soloActivos }),
  });
});

app.get("/api/documentos-digitales/tipos-gasto/:id", async (req, res) => {
  const id = Number(req.params.id);
  const row = await db.documentosDigitales.getTipoGastoById(id);
  if (!row) {
    res.status(404).json({ ok: false, error: "Tipo de documento no encontrado" });
    return;
  }
  res.json({ ok: true, data: row });
});

app.post("/api/documentos-digitales/tipos-gasto", async (req, res) => {
  try {
    const payload = parseTipoDocumentoGastoBody(req);
    const id = await db.documentosDigitales.insertTipoGasto(payload);
    res.status(201).json({
      ok: true,
      data: await db.documentosDigitales.getTipoGastoById(id),
      message: "Tipo de documento creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/documentos-digitales/tipos-gasto/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = parseTipoDocumentoGastoBody(req);
    if (!(await db.documentosDigitales.updateTipoGasto(id, payload))) {
      res.status(404).json({ ok: false, error: "Tipo de documento no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.documentosDigitales.getTipoGastoById(id),
      message: "Tipo de documento actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/documentos-digitales/tipos-gasto/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!(await db.documentosDigitales.deleteTipoGasto(id))) {
    res.status(404).json({ ok: false, error: "Tipo de documento no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Tipo de documento eliminado" });
});

app.post(
  "/api/documentos-digitales/parse-brou-transferencia",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Subí un PDF o imagen del comprobante BROU" });
        return;
      }
      const text = await extractTextFromBrouDocument(
        file.buffer,
        file.mimetype,
        file.originalname
      );
      const data = parseBrouTransferenciaText(text);

      let valores_mapeo: Record<string, string> | undefined;
      let valores_mapeo_comision: Record<string, string> | undefined;
      const mapeoRaw = req.body?.mapeo;
      if (mapeoRaw) {
        try {
          const mapeo = normalizeGastoMapeo(
            typeof mapeoRaw === "string" ? JSON.parse(mapeoRaw) : mapeoRaw
          );
          if (Object.keys(mapeo).length > 0) {
            valores_mapeo = extractValoresPorMapeo(text, mapeo) as Record<string, string>;
          }
        } catch {
          /* mapeo inválido: se omite */
        }
      }
      const mapeoComisionRaw = req.body?.mapeo_comision;
      if (mapeoComisionRaw) {
        try {
          const mapeoCom = normalizeGastoMapeo(
            typeof mapeoComisionRaw === "string" ? JSON.parse(mapeoComisionRaw) : mapeoComisionRaw
          );
          if (Object.keys(mapeoCom).length > 0) {
            valores_mapeo_comision = extractValoresPorMapeo(text, mapeoCom) as Record<
              string,
              string
            >;
          }
        } catch {
          /* mapeo comisión inválido */
        }
      }

      let proveedor_cod: number | null = null;
      let proveedor_razon = "";
      const nombreProveedor =
        valores_mapeo?.proveedor?.trim() || data.beneficiario_nombre.trim();
      if (nombreProveedor) {
        const lista = await db.proveedores.list(
          nombreProveedor,
          await proveedoresCuentaId(req.user!)
        );
        const nombre = nombreProveedor.toLowerCase();
        const hit =
          lista.find((p) => p.razon_social.trim().toLowerCase() === nombre) ??
          lista.find((p) => p.razon_social.trim().toLowerCase().includes(nombre)) ??
          lista[0];
        if (hit) {
          proveedor_cod = hit.cod;
          proveedor_razon = hit.razon_social;
        }
      }
      res.json({
        ok: true,
        data: {
          ...data,
          proveedor_cod,
          proveedor_razon,
          valores_mapeo,
          valores_mapeo_comision,
        },
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

/**
 * Detecta a qué tipo de documento configurado corresponde el texto del comprobante.
 * Puntúa por el banco de origen/destino y por cuántos títulos del mapeo aparecen.
 */
function detectarTipoDocumentoPorTexto<
  T extends { origen: string; destino: string; mapeo_campos: Record<string, string> }
>(text: string, tipos: T[]): T | null {
  const lower = text.toLowerCase();
  let best: T | null = null;
  let bestScore = 0;
  for (const tipo of tipos) {
    let score = 0;
    const origen = (tipo.origen || "").toLowerCase().trim();
    if (origen && lower.includes(origen)) score += 3;
    const destino = (tipo.destino || "").toLowerCase().trim();
    if (destino && lower.includes(destino)) score += 1;
    for (const titulo of Object.values(tipo.mapeo_campos)) {
      const t = String(titulo || "").toLowerCase().trim();
      if (t.length >= 4 && lower.includes(t)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = tipo;
    }
  }
  return bestScore >= 2 ? best : null;
}

const EMPTY_BROU_PARSED: BrouTransferenciaParsed = {
  numero_operacion: "",
  numero_transferencia: "",
  fecha: "",
  importe_acreditar: { moneda: "USD" as const, valor: 0 },
  comision: null as { moneda: "UYU" | "USD"; valor: number } | null,
  beneficiario_nombre: "",
  beneficiario_direccion: "",
  beneficiario_observaciones: "",
  banco_destino: "",
  cuenta_destino: "",
  concepto_brou: "",
  cuenta_origen: "",
};

app.post(
  "/api/documentos-digitales/leer-comprobante",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Subí un PDF o imagen del comprobante" });
        return;
      }
      const text = await extractTextFromBrouDocument(
        file.buffer,
        file.mimetype,
        file.originalname
      );

      const tipos = await db.documentosDigitales.listTiposGasto({ soloActivos: true });
      const tipoPorTexto = detectarTipoDocumentoPorTexto(text, tipos);

      const esBrou =
        tipoPorTexto?.origen?.toUpperCase() === "BROU" ||
        looksLikeBrouTransferenciaComprobante(text);

      // Comprobante Santander «Transferencias en el país»: no trae la palabra
      // «Santander» ni las etiquetas del formato «a Otros Bancos», por eso se
      // detecta aparte y se lo asocia al tipo Santander configurado.
      const esSantanderPais = !esBrou && looksLikeSantanderEnElPais(text);
      const tipoSantander = esSantanderPais
        ? tipos.find(
            (t) =>
              t.origen?.toUpperCase() === "SANTANDER" ||
              t.nombre?.toUpperCase().includes("SANTANDER")
          ) ?? null
        : null;
      const tipo = tipoPorTexto ?? tipoSantander;

      let parsed: typeof EMPTY_BROU_PARSED = EMPTY_BROU_PARSED;
      if (esBrou) {
        try {
          parsed = parseBrouTransferenciaText(text);
        } catch {
          parsed = EMPTY_BROU_PARSED;
        }
      }

      const mapeo = tipoPorTexto
        ? normalizeGastoMapeo(tipoPorTexto.mapeo_campos)
        : esBrou
          ? BROU_MAPEO_DEFAULT
          : {};
      let valores_mapeo: Record<string, string> | undefined;
      if (esSantanderPais) {
        valores_mapeo = parseSantanderEnElPais(text) as Record<string, string>;
      } else if (Object.keys(mapeo).length > 0) {
        valores_mapeo = extractValoresPorMapeo(text, mapeo) as Record<string, string>;
      }

      let valores_mapeo_comision: Record<string, string> | undefined;
      const comCfg = tipo?.comision_config;
      if (comCfg?.activa) {
        const mapeoCom = normalizeGastoMapeo(comCfg.mapeo_campos);
        if (Object.keys(mapeoCom).length > 0) {
          valores_mapeo_comision = extractValoresPorMapeo(text, mapeoCom) as Record<
            string,
            string
          >;
        }
      }

      let proveedor_cod: number | null = null;
      let proveedor_razon = "";
      const nombreProveedor =
        valores_mapeo?.proveedor?.trim() || parsed.beneficiario_nombre.trim();
      if (nombreProveedor) {
        const lista = await db.proveedores.list(
          nombreProveedor,
          await proveedoresCuentaId(req.user!)
        );
        const nombre = nombreProveedor.toLowerCase();
        const hit =
          lista.find((p) => p.razon_social.trim().toLowerCase() === nombre) ??
          lista.find((p) => p.razon_social.trim().toLowerCase().includes(nombre)) ??
          lista[0];
        if (hit) {
          proveedor_cod = hit.cod;
          proveedor_razon = hit.razon_social;
        }
      }

      res.json({
        ok: true,
        data: {
          ...parsed,
          proveedor_cod,
          proveedor_razon,
          valores_mapeo,
          valores_mapeo_comision,
          es_brou: esBrou,
          es_santander_pais: esSantanderPais,
          tipo_detectado: tipo
            ? {
                id: tipo.id,
                nombre: tipo.nombre,
                origen: tipo.origen,
                destino: tipo.destino,
                comision_activa: Boolean(comCfg?.activa),
              }
            : null,
        },
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

app.post(
  "/api/documentos-digitales/detectar-campos",
  upload.single("file"),
  async (req, res) => {
    try {
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Subí un PDF o imagen del comprobante" });
        return;
      }
      const text = await extractTextFromBrouDocument(
        file.buffer,
        file.mimetype,
        file.originalname
      );
      const campos = detectarCamposDocumento(text).map(({ etiqueta, valor_muestra }) => ({
        etiqueta,
        valor_muestra,
      }));
      res.json({ ok: true, data: { campos } });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

function parseRubroBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  const activo = body.activo !== false && body.activo !== 0 && body.activo !== "0";
  return { nombre, activo };
}

app.get("/api/rubros", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.rubros.list(soloActivos, scope) });
});

app.post("/api/rubros", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    if (!req.user!.es_super_admin && cuentaId == null) {
      res.status(403).json({ ok: false, error: "Sin cuenta operativa asignada" });
      return;
    }
    const payload = parseRubroBody(req);
    const id = await db.rubros.insert(payload, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.rubros.getById(id),
      message: "Rubro creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/rubros/:id", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const id = Number(req.params.id);
    const prev = await db.rubros.getById(id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Rubro no encontrado" });
      return;
    }
    assertGastosRubroRowWritable(
      prev,
      req.user!,
      gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>),
      gastosRubrosSagMode(req)
    );
    const payload = parseRubroBody(req);
    const cuentaId = prev.cuenta_id ?? gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    if (!await db.rubros.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Rubro no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.rubros.getById(id),
      message: "Rubro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function denyUnlessSuperAdminRubrosDelete(req: Request, res: Response): boolean {
  if (!req.user?.es_super_admin) {
    res.status(403).json({
      ok: false,
      error: "Solo el superadministrador puede eliminar rubros del catálogo",
    });
    return false;
  }
  return true;
}

function denyUnlessManageRubrosCatalogo(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (!req.user.es_super_admin && !req.user.es_admin_cuenta) {
    res.status(403).json({
      ok: false,
      error:
        "Solo el administrador de la cuenta o el superadministrador puede modificar el catálogo de rubros",
    });
    return false;
  }
  return true;
}

function denyUnlessCreateRubrosFromGasto(req: Request, res: Response): boolean {
  const user = req.user;
  if (!user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (!user.puede_escribir || user.modulos_solo_lectura.includes("presupuesto")) {
    res.status(403).json({
      ok: false,
      error:
        "No tenés permiso para crear sub-rubros o ítems al ingresar gastos",
    });
    return false;
  }
  return true;
}

function denyUnlessCuentaAdminOrSuperAdminItemsDelete(
  req: Request,
  res: Response
): boolean {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (!req.user.es_super_admin && !req.user.es_admin_cuenta) {
    res.status(403).json({
      ok: false,
      error:
        "Solo el administrador de la cuenta o el superadministrador puede eliminar ítems del catálogo",
    });
    return false;
  }
  return true;
}

app.delete("/api/rubros/:id", async (req, res) => {
  if (!denyUnlessSuperAdminRubrosDelete(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!await db.rubros.delete(id)) {
      res.status(404).json({ ok: false, error: "Rubro no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Rubro eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function parseSubRubroBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  const grupo = String(body.grupo ?? "").trim();
  const activo = body.activo !== false && body.activo !== 0 && body.activo !== "0";
  return { nombre, grupo, activo };
}

app.get("/api/sub-rubros", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.subRubros.list(soloActivos, scope) });
});

app.get("/api/sub-rubros/grupos", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  res.json({ ok: true, data: await db.subRubros.listGrupos(scope) });
});

app.post("/api/sub-rubros", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    if (!req.user!.es_super_admin && cuentaId == null) {
      res.status(403).json({ ok: false, error: "Sin cuenta operativa asignada" });
      return;
    }
    const payload = parseSubRubroBody(req);
    const id = await db.subRubros.insert(payload, cuentaId);
    await db.rubroVinculos.syncPorGrupo(id, payload.grupo);
    res.status(201).json({
      ok: true,
      data: await db.subRubros.getById(id),
      message: "Sub-rubro creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/sub-rubros/desde-rubro", async (req, res) => {
  if (!denyUnlessCreateRubrosFromGasto(req, res)) return;
  try {
    const body = req.body as Record<string, unknown>;
    const rubro = String(body.rubro ?? "").trim();
    const nombre = String(body.nombre ?? "").trim();
    const activo =
      body.activo !== false && body.activo !== 0 && body.activo !== "0";
    if (!rubro) {
      res.status(400).json({ ok: false, error: "El rubro contable es obligatorio." });
      return;
    }
    const grupo = await db.rubroVinculos.resolveGrupoParaRubro(rubro);
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    if (cuentaId == null) {
      res.status(403).json({ ok: false, error: "Sin cuenta operativa asignada" });
      return;
    }
    const id = await db.subRubros.insert({ nombre, grupo, activo }, cuentaId);
    await db.rubroVinculos.syncPorGrupo(id, grupo);
    res.status(201).json({
      ok: true,
      data: await db.subRubros.getById(id),
      message: "Sub-rubro creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/sub-rubros/:id", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const id = Number(req.params.id);
    const prev = await db.subRubros.getById(id);
    if (!prev) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const writeCuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    const sagMode = gastosRubrosSagMode(req);
    assertGastosRubroRowWritable(prev, req.user!, writeCuentaId, sagMode);
    const payload = parseSubRubroBody(req);
    const cuentaId = prev.cuenta_id ?? writeCuentaId;
    if (!await db.subRubros.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    if (prev.grupo !== payload.grupo) {
      await db.grupoIconos.renameGrupo(prev.grupo, payload.grupo, cuentaId);
    }
    await db.rubroVinculos.syncPorGrupo(id, payload.grupo);
    res.json({
      ok: true,
      data: await db.subRubros.getById(id),
      message: "Sub-rubro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/sub-rubros/grupo/rename", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const anterior = String(req.body?.anterior ?? "").trim();
    const nuevo = String(req.body?.nuevo ?? "").trim();
    const writeCuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    const sagMode = gastosRubrosSagMode(req);
    const cuentaId = sagMode ? writeCuentaId : writeCuentaId;
    const updated = await db.subRubros.renameGrupo(anterior, nuevo, cuentaId, sagMode);
    const nombreCanon = normalizarTituloRubro(nuevo);
    await db.grupoIconos.renameGrupo(anterior, nombreCanon, cuentaId);
    const scope = gastosRubrosReadScopeFromRequest(req.user!, {
      ambito: sagMode ? "sag" : undefined,
      cuenta_id: cuentaId ?? undefined,
    });
    const subs = (await db.subRubros.list(false, scope)).filter(
      (s) =>
        s.grupo.localeCompare(nombreCanon, "es", { sensitivity: "accent" }) === 0
    );
    for (const s of subs) {
      await db.rubroVinculos.syncPorGrupo(s.id, s.grupo);
    }
    res.json({
      ok: true,
      message:
        updated > 0
          ? `Rubro renombrado a «${nombreCanon}» (${updated} sub-rubro(s))`
          : "Sin cambios",
      data: { updated, nombre: nombreCanon },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/gastos-rubros/monitor", async (req, res) => {
  if (!req.user?.es_super_admin && !req.user?.es_admin_plataforma) {
    res.status(403).json({
      ok: false,
      error: "Solo el superadministrador puede consultar el monitor de rubros",
    });
    return;
  }
  try {
    res.json({ ok: true, data: await db.rubrosMonitor.snapshot() });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/gastos-rubros/monitor/:cuentaId", async (req, res) => {
  if (!req.user?.es_super_admin && !req.user?.es_admin_plataforma) {
    res.status(403).json({
      ok: false,
      error: "Solo el superadministrador puede consultar el monitor de rubros",
    });
    return;
  }
  try {
    const cuentaId = Number(req.params.cuentaId);
    if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
      res.status(400).json({ ok: false, error: "Cuenta inválida" });
      return;
    }
    const data = await db.rubrosMonitor.cuenta(cuentaId);
    if (!data) {
      res.status(404).json({ ok: false, error: "Cuenta no encontrada" });
      return;
    }
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/sub-rubros/grupo/:grupo", async (req, res) => {
  if (!denyUnlessSuperAdminRubrosDelete(req, res)) return;
  try {
    const grupo = decodeURIComponent(req.params.grupo);
    const sagMode = gastosRubrosSagMode(req);
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.query as Record<string, unknown>);
    const result = await db.subRubros.deleteByGrupo(grupo, cuentaId, sagMode);
    await db.grupoIconos.deleteByGrupo(grupo, cuentaId);
    const msg =
      result.deleted > 0
        ? `Rubro eliminado (${result.deleted} sub-rubro(s))`
        : "Rubro sin sub-rubros guardados";
    res.json({ ok: true, message: msg, data: result });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/sub-rubros/:id", async (req, res) => {
  if (!denyUnlessSuperAdminRubrosDelete(req, res)) return;
  try {
    const id = Number(req.params.id);
    const sagMode = gastosRubrosSagMode(req);
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.query as Record<string, unknown>);
    if (!await db.subRubros.delete(id, cuentaId, sagMode)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Sub-rubro eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/sub-rubros/items-counts", async (req, res) => {
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({ ok: true, data: await db.subRubroItems.countsBySubRubroIds(ids) });
});

app.get("/api/sub-rubros/items-batch", async (req, res) => {
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({ ok: true, data: await db.subRubroItems.groupedBySubRubroIds(ids) });
});

app.get("/api/sub-rubros/items", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  const nombre = String(req.query.sub_rubro ?? "").trim();
  if (!nombre) {
    res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
    return;
  }
  const sub = await db.subRubros.getByNombre(nombre, scope);
  if (!sub) {
    res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({
    ok: true,
    data: await db.subRubroItems.listBySubRubroId(sub.id, soloActivos),
  });
});

app.post("/api/sub-rubros/items", async (req, res) => {
  if (!denyUnlessCreateRubrosFromGasto(req, res)) return;
  try {
    const scope = gastosRubrosReadScopeForUser(req.user!);
    const subRubroNombre = String(
      (req.body as { sub_rubro?: string }).sub_rubro ?? ""
    ).trim();
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    if (!subRubroNombre) {
      res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
      return;
    }
    const subRow = await db.subRubros.getByNombre(subRubroNombre, scope);
    if (!subRow) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.subRubroItems.insert(subRow.id, { nombre, activo });
    res.status(201).json({
      ok: true,
      data: await db.subRubroItems.getById(itemId),
      message: "Ítem creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/sub-rubros/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const sub = await db.subRubros.getById(id);
  if (!sub) {
    res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({ ok: true, data: await db.subRubroItems.listBySubRubroId(id, soloActivos) });
});

app.post("/api/sub-rubros/:id/items", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!await db.subRubros.getById(id)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.subRubroItems.insert(id, { nombre, activo });
    res.status(201).json({
      ok: true,
      data: await db.subRubroItems.getById(itemId),
      message: "Ítem creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/sub-rubro-items/:id", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const id = Number(req.params.id);
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    if (!await db.subRubroItems.update(id, { nombre, activo })) {
      res.status(404).json({ ok: false, error: "Ítem no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.subRubroItems.getById(id),
      message: "Ítem actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/sub-rubro-items/:id", async (req, res) => {
  if (!denyUnlessCuentaAdminOrSuperAdminItemsDelete(req, res)) return;
  const id = Number(req.params.id);
  if (!await db.subRubroItems.delete(id)) {
    res.status(404).json({ ok: false, error: "Ítem no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Ítem eliminado" });
});

app.get("/api/grupo-iconos", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  res.json({ ok: true, data: await db.grupoIconos.map(scope) });
});

app.get("/api/grupo-iconos/banco", async (_req, res) => {
  res.json({ ok: true, data: await db.grupoIconos.banco() });
});

app.put("/api/grupo-iconos/:grupo/emoji", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
    const emoji = String((req.body as { emoji?: unknown })?.emoji ?? "").trim();
    if (!grupo) {
      res.status(400).json({ ok: false, error: "Rubro inválido." });
      return;
    }
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
    const dto = await db.grupoIconos.saveEmoji(grupo, emoji, cuentaId);
    res.json({
      ok: true,
      data: { grupo, icono: dto },
      message: "Icono actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/grupo-iconos/:grupo/imagen", async (req, res) => {
  const scope = gastosRubrosReadScopeOr403(req, res);
  if (!scope) return;
  const grupo = decodeURIComponent(paramString(req.params.grupo));
  const cuentaId = scope.mode === "cuenta" ? scope.cuentaId ?? null : null;
  const filePath = await db.grupoIconos.filePath(grupo, cuentaId);
  if (!filePath) {
    res.status(404).json({ ok: false, error: "Sin imagen personalizada" });
    return;
  }
  res.sendFile(filePath, { maxAge: 0 }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ ok: false, error: "Imagen no encontrada" });
    }
  });
});

app.post(
  "/api/grupo-iconos/:grupo/imagen",
  iconUpload.single("imagen"),
  async (req, res) => {
    if (!denyUnlessManageRubrosCatalogo(req, res)) return;
    try {
      const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
      if (!grupo) {
        res.status(400).json({ ok: false, error: "Rubro inválido." });
        return;
      }
      const file = req.file;
      if (!file?.buffer?.length) {
        res.status(400).json({ ok: false, error: "Seleccioná una imagen." });
        return;
      }
      const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.body as Record<string, unknown>);
      const icono = await db.grupoIconos.save(grupo, file.buffer, file.mimetype, cuentaId);
      res.json({
        ok: true,
        data: { grupo, icono },
        message: "Icono actualizado",
      });
    } catch (e) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  }
);

app.delete("/api/grupo-iconos/:grupo/imagen", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo));
    const cuentaId = gastosRubrosWriteCuentaId(req.user!, req.query as Record<string, unknown>);
    await db.grupoIconos.deleteByGrupo(grupo, cuentaId);
    res.json({ ok: true, message: "Icono restaurado al predeterminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/rubro-vinculos/mapa", async (_req, res) => {
  res.json({ ok: true, data: await db.rubroVinculos.mapaCompleto() });
});

app.get("/api/rubros/:id/vinculos-sub-rubros", async (req, res) => {
  const rubroId = Number(req.params.id);
  const rubroRow = await db.rubros.getById(rubroId);
  if (!rubroRow) {
    res.status(404).json({ ok: false, error: "Rubro no encontrado" });
    return;
  }
  const mapa = await db.rubroVinculos.mapPorRubro(true);
  res.json({
    ok: true,
    data: {
      sub_rubro_ids: await db.rubroVinculos.getSubRubroIds(rubroId),
      sub_rubros: mapa[rubroRow.nombre] ?? [],
    },
  });
});

app.put("/api/rubros/:id/vinculos-sub-rubros", async (req, res) => {
  if (!denyUnlessManageRubrosCatalogo(req, res)) return;
  try {
    const rubroId = Number(req.params.id);
    const rubroRow = await db.rubros.getById(rubroId);
    if (!rubroRow) {
      res.status(404).json({ ok: false, error: "Rubro no encontrado" });
      return;
    }
    const body = req.body as { sub_rubro_ids?: unknown };
    const raw = body.sub_rubro_ids;
    const sub_rubro_ids = Array.isArray(raw)
      ? raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : [];
    await db.rubroVinculos.setSubRubros(rubroId, sub_rubro_ids);
    const ids = await db.rubroVinculos.getSubRubroIds(rubroId);
    const mapa = await db.rubroVinculos.mapPorRubro(true);
    res.json({
      ok: true,
      message: "Vínculos guardados",
      data: {
        rubro: rubroRow.nombre,
        sub_rubro_ids: ids,
        sub_rubros: ids.length ? mapa[rubroRow.nombre] ?? [] : [],
      },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function parseResponsableBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  const activo = body.activo !== false && body.activo !== 0 && body.activo !== "0";
  const observaciones = String(body.observaciones ?? "").trim().slice(0, 500);
  return { nombre, activo, observaciones };
}

app.get("/api/responsables", async (req, res) => {
  const soloActivos = req.query.solo_activos === "1";
  const user = req.user!;
  let cuentaId = await cuentaIdForScopedRead(user);
  if (user.es_super_admin && String(req.query.ambito ?? "") === "cuenta") {
    cuentaId = await cuentaIdForUser(user);
    if (!cuentaId) {
      res.json({ ok: true, data: [] });
      return;
    }
  }
  if (!user.es_super_admin && cuentaId == null) {
    res.json({ ok: true, data: [] });
    return;
  }
  res.json({ ok: true, data: await db.responsables.list(soloActivos, cuentaId) });
});

app.post("/api/responsables", async (req, res) => {
  try {
    const payload = parseResponsableBody(req);
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const id = await db.responsables.insert(payload, cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.responsables.getById(id, cuentaId),
      message: "Nombre guardado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/responsables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const payload = parseResponsableBody(req);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!await db.responsables.update(id, payload, cuentaId)) {
      res.status(404).json({ ok: false, error: "Nombre no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.responsables.getById(id, cuentaId),
      message: "Nombre actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/responsables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!await db.responsables.delete(id, cuentaId)) {
      res.status(404).json({ ok: false, error: "Nombre no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Nombre eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function parseDivisaBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  const fecha = String(body.fecha ?? "").trim();
  const par = String(body.par ?? "").trim().toUpperCase() as ParDivisa;
  const valor = parseNum(body.valor);
  if (!fecha) throw new Error("La fecha es obligatoria.");
  if (par !== "UYU_USD" && par !== "BRL_USD") {
    throw new Error("Par inválido. Use UYU_USD o BRL_USD.");
  }
  if (valor <= 0) throw new Error("El tipo de cambio debe ser mayor a 0.");
  return { fecha, par, valor };
}

app.get("/api/divisas", async (req, res) => {
  const par = req.query.par as ParDivisa | undefined;
  res.json({
    ok: true,
    data: await db.divisas.list({
      par,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    }),
    ultimos: await db.divisas.ultimos(),
    indicadores: par
      ? await db.divisas.indicadores(par)
      : await db.divisas.indicadores("UYU_USD"),
    pares: await db.divisas.pares,
    labels: await db.divisas.labels,
  });
});

app.get("/api/divisas/para-fecha", async (req, res) => {
  const par = req.query.par as ParDivisa | undefined;
  const fecha = String(req.query.fecha ?? "").trim();
  if (!par || !PARES_DIVISA.includes(par)) {
    res.status(400).json({ ok: false, error: "Par de divisa inválido." });
    return;
  }
  if (!fecha) {
    res.status(400).json({ ok: false, error: "La fecha es obligatoria." });
    return;
  }
  const row = await db.divisas.valorEnFecha(par, fecha);
  if (!row) {
    res.json({ ok: true, data: null });
    return;
  }
  res.json({
    ok: true,
    data: { par: row.par, valor: row.valor, fecha_tc: row.fecha },
  });
});

const MSG_TC_INMUTABLE =
  "Los tipos de cambio registrados no se pueden editar ni eliminar.";

function mensajeImportacionDivisas(result: {
  insertados: number;
  ignorados: number;
}): string {
  const partes = [`${result.insertados} nuevo(s)`];
  if (result.ignorados > 0) {
    partes.push(`${result.ignorados} ya existían (no modificados)`);
  }
  return partes.join(", ");
}

app.post("/api/divisas", async (req, res) => {
  try {
    const payload = parseDivisaBody(req);
    if (await db.divisas.exists(payload.fecha, payload.par)) {
      res.status(409).json({
        ok: false,
        error: `Ya existe un TC para ${payload.fecha} (${payload.par}). ${MSG_TC_INMUTABLE}`,
      });
      return;
    }
    await db.divisas.insert(payload);
    res.status(201).json({ ok: true, message: "Tipo de cambio guardado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/divisas/:id", (_req, res) => {
  res.status(403).json({ ok: false, error: MSG_TC_INMUTABLE });
});

app.delete("/api/divisas/:id", (_req, res) => {
  res.status(403).json({ ok: false, error: MSG_TC_INMUTABLE });
});

app.post("/api/divisas/import/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ ok: false, error: "Falta el archivo" });
      return;
    }
    const rows = await parseDivisasBuffer(req.file.buffer, req.file.originalname);
    if (!rows.length) {
      res.status(400).json({ ok: false, error: "No se encontraron filas válidas en el archivo" });
      return;
    }
    const result = await db.divisas.importBatch(rows, { solo_nuevos: true });
    res.json({
      ok: true,
      message: mensajeImportacionDivisas(result),
      total: rows.length,
      ...result,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/divisas/import/investing-uyu", async (req, res) => {
  try {
    const body = (req.body as { fecha_desde?: string; fecha_hasta?: string }) ?? {};
    const fetched = await fetchInvestingUsdUyu({
      fecha_desde: String(body.fecha_desde ?? "").trim() || undefined,
      fecha_hasta: String(body.fecha_hasta ?? "").trim() || undefined,
    });
    if (!fetched.rows.length) {
      res.status(400).json({ ok: false, error: "No hay filas para importar." });
      return;
    }
    const result = await db.divisas.importBatch(fetched.rows, { solo_nuevos: true });
    res.json({
      ok: true,
      message: `Investing.com (USD/UYU): ${mensajeImportacionDivisas(result)} (${fetched.rows.length} día(s)).`,
      total: fetched.rows.length,
      parseadas: fetched.parseadas,
      rango_html: fetched.rango_html,
      aviso: fetched.aviso,
      fuente: "https://es.investing.com/currencies/usd-uyu-historical-data",
      ...result,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/divisas/import/bcu-uyu", async (req, res) => {
  try {
    const body =
      (req.body as {
        anos?: number;
        fecha_desde?: string;
        fecha_hasta?: string;
        /** true: solo fechas que aún no están en la base; no sobrescribe. */
        solo_nuevos?: boolean;
        /** true: descarga ~2 años completos; false: solo días posteriores al último guardado. */
        completo?: boolean;
      }) ?? {};

    const soloNuevos = body.solo_nuevos !== false;
    const completo = body.completo === true;
    const fechaDesdeFiltro = String(body.fecha_desde ?? "").trim() || undefined;
    const fechaHastaFiltro = String(body.fecha_hasta ?? "").trim() || undefined;

    const anosRaw = body.anos;
    const anos =
      anosRaw === undefined || anosRaw === null
        ? 2
        : Math.min(Math.max(Number(anosRaw) || 2, 1), 10);

    const maxGuardada = await db.divisas.maxFecha("UYU_USD");
    let desdeIncremental: string | undefined;
    if (!completo && !fechaDesdeFiltro && maxGuardada) {
      desdeIncremental = addDaysIso(maxGuardada, 1);
    }

    const hoy = isoDateLocal();
    if (desdeIncremental && desdeIncremental > hoy) {
      res.json({
        ok: true,
        message: "El histórico USD/UYU ya está al día.",
        total: 0,
        insertados: 0,
        actualizados: 0,
        ignorados: 0,
        ya_actualizado: true,
        ultima_guardada: maxGuardada,
      });
      return;
    }

    const fetchOpts: Parameters<typeof fetchBcuUsdUyu>[0] = {
      fecha_desde: fechaDesdeFiltro,
      fecha_hasta: fechaHastaFiltro,
      desde_ultima_guardada: desdeIncremental,
    };
    if (!fechaDesdeFiltro && !desdeIncremental) {
      fetchOpts.anos = anos;
    }
    const fetched = await fetchBcuUsdUyu(fetchOpts);

    if (!fetched.rows.length) {
      if (maxGuardada && !completo) {
        res.json({
          ok: true,
          message: "No hay cotizaciones nuevas del BCU para importar.",
          total: 0,
          insertados: 0,
          actualizados: 0,
          ignorados: 0,
          ya_actualizado: true,
          ultima_guardada: maxGuardada,
          rango: fetched.rango,
        });
        return;
      }
      res.status(400).json({ ok: false, error: "No hay filas para importar." });
      return;
    }

    const result = await db.divisas.importBatch(fetched.rows, { solo_nuevos: soloNuevos });
    const msgPartes = [
      `BCU (USD/UYU): ${result.insertados} día(s) nuevo(s) guardado(s).`,
    ];
    if (result.ignorados > 0) {
      msgPartes.push(`${result.ignorados} fecha(s) ya existían (no se modificaron).`);
    }
    if (!soloNuevos && result.actualizados > 0) {
      msgPartes.push(`${result.actualizados} actualizado(s).`);
    }

    res.json({
      ok: true,
      message: msgPartes.join(" "),
      total: fetched.rows.length,
      parseadas: fetched.parseadas,
      rango: fetched.rango,
      lotes: fetched.lotes,
      ultima_guardada: await db.divisas.maxFecha("UYU_USD"),
      fuente: "https://www.bcu.gub.uy/",
      ...result,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/divisas/import/yahoo-brl", async (req, res) => {
  try {
    const body =
      (req.body as {
        anos?: number;
        fecha_desde?: string;
        fecha_hasta?: string;
        solo_nuevos?: boolean;
        completo?: boolean;
      }) ?? {};

    const soloNuevos = body.solo_nuevos !== false;
    const completo = body.completo === true;
    const fechaDesdeFiltro = String(body.fecha_desde ?? "").trim() || undefined;
    const fechaHastaFiltro = String(body.fecha_hasta ?? "").trim() || undefined;
    const anos =
      body.anos === undefined || body.anos === null
        ? 2
        : Math.min(Math.max(Number(body.anos) || 2, 1), 10);

    const maxGuardada = await db.divisas.maxFecha("BRL_USD");
    let desdeIncremental: string | undefined;
    if (!completo && !fechaDesdeFiltro && maxGuardada) {
      desdeIncremental = addDaysIso(maxGuardada, 1);
    }

    const hoy = isoDateLocal();
    if (desdeIncremental && desdeIncremental > hoy) {
      res.json({
        ok: true,
        message: "El histórico BRL/USD ya está al día.",
        total: 0,
        insertados: 0,
        actualizados: 0,
        ignorados: 0,
        ya_actualizado: true,
        ultima_guardada: maxGuardada,
      });
      return;
    }

    const fetchOpts: Parameters<typeof fetchYahooUsdBrl>[0] = {
      fecha_desde: fechaDesdeFiltro,
      fecha_hasta: fechaHastaFiltro,
      desde_ultima_guardada: desdeIncremental,
    };
    if (!fechaDesdeFiltro && !desdeIncremental) {
      fetchOpts.anos = anos;
    }
    const fetched = await fetchYahooUsdBrl(fetchOpts);

    if (!fetched.rows.length) {
      if (maxGuardada && !completo) {
        res.json({
          ok: true,
          message: "No hay cotizaciones nuevas para importar.",
          total: 0,
          insertados: 0,
          actualizados: 0,
          ignorados: 0,
          ya_actualizado: true,
          ultima_guardada: maxGuardada,
          rango: fetched.rango,
        });
        return;
      }
      res.status(400).json({ ok: false, error: "No hay filas para importar." });
      return;
    }

    const result = await db.divisas.importBatch(fetched.rows, { solo_nuevos: soloNuevos });
    const msgPartes = [
      `BRL/USD: ${result.insertados} día(s) nuevo(s) guardado(s).`,
    ];
    if (result.ignorados > 0) {
      msgPartes.push(`${result.ignorados} fecha(s) ya existían (no se modificaron).`);
    }

    res.json({
      ok: true,
      message: msgPartes.join(" "),
      total: fetched.rows.length,
      parseadas: fetched.parseadas,
      rango: fetched.rango,
      ultima_guardada: await db.divisas.maxFecha("BRL_USD"),
      fuente: "Yahoo Finance (USDBRL=X)",
      ...result,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.post("/api/divisas/import/text", async (req, res) => {
  try {
    const text = String((req.body as { text?: string }).text ?? "").trim();
    if (!text) {
      res.status(400).json({ ok: false, error: "Falta el contenido CSV" });
      return;
    }
    const rows = parseDivisasText(text);
    if (!rows.length) {
      res.status(400).json({ ok: false, error: "No se encontraron filas válidas" });
      return;
    }
    const result = await db.divisas.importBatch(rows, { solo_nuevos: true });
    res.json({
      ok: true,
      message: `Importación: ${mensajeImportacionDivisas(result)}`,
      total: rows.length,
      ...result,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

function parseSegmentoPreciosGanado(
  raw: unknown,
  fallback: SegmentoPreciosGanado | "ALL"
): SegmentoPreciosGanado | "ALL" {
  if (raw === "REPOSICION") return "REPOSICION";
  if (raw === "GORDO") return "GORDO";
  if (raw === "ALL") return "ALL";
  return fallback;
}

async function importPreciosGanadoDesdeHtml(
  html: string,
  segmento: SegmentoPreciosGanado
) {
  const fetched =
    segmento === "REPOSICION"
      ? parseAcgGanadoReposicionHtml(html)
      : parseAcgGanadoGordoHtml(html);
  const { semana, rows } = fetched;
  const precios = Object.fromEntries(rows.map((r) => [r.categoria, r.valor]));

  const yaSemana = await db.preciosGanado.semanaGuardada(
    segmento,
    semana.anio,
    semana.semana
  );
  const result = await db.preciosGanado.importBatch(rows, { solo_nuevos: false });

  let resultado: "insertado" | "actualizado" | "sin_cambios" = "sin_cambios";
  if (result.insertados > 0 && !yaSemana) resultado = "insertado";
  else if (result.actualizados > 0) resultado = "actualizado";
  else if (result.insertados > 0) resultado = "insertado";

  await db.preciosGanado.registrarSync({
    segmento,
    anio: semana.anio,
    semana: semana.semana,
    fecha_desde: semana.fecha_desde,
    fecha_hasta: semana.fecha_hasta,
    precios,
    resultado,
    detalle:
      resultado === "insertado"
        ? "Semana nueva registrada."
        : resultado === "actualizado"
          ? "Precios actualizados."
          : "Semana sin cambios en los valores.",
  });

  const msg =
    resultado === "insertado"
      ? `Semana N°${semana.semana} registrada (${result.insertados} precio(s)).`
      : resultado === "actualizado"
        ? `Semana N°${semana.semana} actualizada (${result.actualizados} precio(s)).`
        : `Semana N°${semana.semana} sin cambios (${semana.fecha_desde} → ${semana.fecha_hasta}).`;

  return {
    segmento,
    message: msg,
    total: rows.length,
    semana,
    rango: { desde: semana.fecha_desde, hasta: semana.fecha_hasta },
    ya_actualizado: resultado === "sin_cambios",
    guardado_local: true,
    resultado,
    ...result,
  };
}

app.get("/api/precios-ganado", async (req, res) => {
  const segmento = parseSegmentoPreciosGanado(req.query.segmento, "GORDO") as SegmentoPreciosGanado;
  const rows = await db.preciosGanado.list({
    segmento,
    categoria: req.query.categoria as PrecioGanadoInput["categoria"] | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
  });
  const semanas = db.preciosGanado.pivotSemanas(rows);
  const resumen_local = await db.preciosGanado.resumenLocal(segmento);
  res.json({
    ok: true,
    segmento,
    data: rows,
    semanas,
    ultima: semanas[0] ?? null,
    resumen_local,
    categorias: db.preciosGanado.categoriasPorSegmento(segmento),
    labels: db.preciosGanado.labelsPorSegmento(segmento),
  });
});

app.post("/api/precios-ganado/import/acg", async (req, res) => {
  const body = (req.body ?? {}) as { segmento?: string };
  const segmentoReq = parseSegmentoPreciosGanado(body.segmento, "ALL");

  try {
    const html = await fetchAcgHomeHtml();
    const segmentos: SegmentoPreciosGanado[] =
      segmentoReq === "ALL" ? ["GORDO", "REPOSICION"] : [segmentoReq];

    const results = [];
    for (const segmento of segmentos) {
      results.push(await importPreciosGanadoDesdeHtml(html, segmento));
    }

    const totalInsertados = results.reduce((n, r) => n + r.insertados, 0);
    const totalActualizados = results.reduce((n, r) => n + r.actualizados, 0);
    const message =
      segmentoReq === "ALL"
        ? totalInsertados + totalActualizados > 0
          ? "Precios actualizados."
          : "Los precios ya están al día."
        : results[0]!.message;

    res.json({
      ok: true,
      message,
      segmento: segmentoReq,
      resultados: results,
      insertados: totalInsertados,
      actualizados: totalActualizados,
      ignorados: results.reduce((n, r) => n + r.ignorados, 0),
      sin_cambios: results.reduce((n, r) => n + r.sin_cambios, 0),
      total: results.reduce((n, r) => n + r.total, 0),
    });
  } catch (e) {
    const errMsg = (e as Error).message;
    const segmentoError =
      segmentoReq === "ALL" ? ("GORDO" as SegmentoPreciosGanado) : segmentoReq;
    try {
      await db.preciosGanado.registrarSync({
        segmento: segmentoError,
        anio: 0,
        semana: 0,
        fecha_desde: "",
        fecha_hasta: "",
        precios: {},
        resultado: "error",
        detalle: errMsg,
      });
    } catch {
      /* log opcional si la tabla sync aún no existe */
    }
    res.status(400).json({ ok: false, error: errMsg });
  }
});

function parseSimuladorVentaTipo(raw: unknown): simVenta.SimuladorVentaTipo | null {
  if (raw === "EN_PIE" || raw === "CUARTA_BALANZA") return raw;
  return null;
}

function parseSimuladorVentaGanadoBody(
  body: unknown
):
  | { input: simVenta.SimuladorVentaGanadoInput }
  | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const tipo = parseSimuladorVentaTipo(b.tipo);
  if (!tipo) return { error: "tipo inválido" };

  const categoria = String(b.categoria ?? "").trim();
  const categorias = db.simuladorVentaGanado.categoriasPorTipo(tipo);
  if (!categorias.includes(categoria)) {
    return { error: "Categoría inválida para este tipo de venta" };
  }

  const modo_kg = b.modo_kg === "CABEZAS" ? "CABEZAS" : "TOTAL";
  const precio_usd_kg = Number(b.precio_usd_kg);
  const kg_total = Number(b.kg_total);
  const total_usd = Number(b.total_usd);

  if (!Number.isFinite(precio_usd_kg) || precio_usd_kg <= 0) {
    return { error: "Precio USD/kg inválido" };
  }
  if (!Number.isFinite(kg_total) || kg_total <= 0) {
    return { error: "Kg total inválido" };
  }
  if (!Number.isFinite(total_usd) || total_usd <= 0) {
    return { error: "Total USD inválido" };
  }

  const cantidad_animales =
    b.cantidad_animales != null && b.cantidad_animales !== ""
      ? Number(b.cantidad_animales)
      : null;
  const kg_promedio =
    b.kg_promedio != null && b.kg_promedio !== "" ? Number(b.kg_promedio) : null;

  if (modo_kg === "CABEZAS") {
    if (!cantidad_animales || cantidad_animales <= 0 || !Number.isFinite(cantidad_animales)) {
      return { error: "Cantidad de animales inválida" };
    }
    if (!kg_promedio || kg_promedio <= 0 || !Number.isFinite(kg_promedio)) {
      return { error: "Kg promedio inválido" };
    }
  }

  let rendimiento: number | null = null;
  if (tipo === "CUARTA_BALANZA") {
    rendimiento =
      b.rendimiento != null && b.rendimiento !== "" ? Number(b.rendimiento) : null;
    if (
      rendimiento == null ||
      !Number.isFinite(rendimiento) ||
      rendimiento <= 0 ||
      rendimiento > 1
    ) {
      return { error: "Rendimiento inválido (decimal entre 0 y 1, ej. 0,50)" };
    }
  }

  return {
    input: {
      tipo,
      categoria: categoria as simVenta.SimuladorVentaGanadoInput["categoria"],
      modo_kg,
      precio_usd_kg,
      precio_ref_anio: b.precio_ref_anio != null ? Number(b.precio_ref_anio) : null,
      precio_ref_semana: b.precio_ref_semana != null ? Number(b.precio_ref_semana) : null,
      precio_ref_fecha_hasta: b.precio_ref_fecha_hasta ? String(b.precio_ref_fecha_hasta) : null,
      cantidad_animales,
      kg_promedio,
      kg_total,
      rendimiento,
      total_usd,
      total_usd_por_cabeza:
        b.total_usd_por_cabeza != null ? Number(b.total_usd_por_cabeza) : null,
      notas: b.notas ? String(b.notas).slice(0, 500) : null,
    },
  };
}

function parseSimuladorVentaRealInput(
  body: Record<string, unknown>,
  modo_kg: simVenta.SimuladorModoKg
): simVenta.SimuladorVentaRealInput | { error: string } {
  const precio_usd_kg = Number(body.precio_usd_kg);
  const kg_total = Number(body.kg_total);
  const total_usd = Number(body.total_usd);

  if (!Number.isFinite(precio_usd_kg) || precio_usd_kg <= 0) {
    return { error: "Precio USD/kg real inválido" };
  }
  if (!Number.isFinite(kg_total) || kg_total <= 0) {
    return { error: "Kg total real inválido" };
  }
  if (!Number.isFinite(total_usd) || total_usd <= 0) {
    return { error: "Total USD real inválido" };
  }

  const cantidad_animales =
    body.cantidad_animales != null && body.cantidad_animales !== ""
      ? Number(body.cantidad_animales)
      : null;
  const kg_promedio =
    body.kg_promedio != null && body.kg_promedio !== "" ? Number(body.kg_promedio) : null;

  if (modo_kg === "CABEZAS") {
    if (!cantidad_animales || cantidad_animales <= 0 || !Number.isFinite(cantidad_animales)) {
      return { error: "Cantidad de animales real inválida" };
    }
    if (!kg_promedio || kg_promedio <= 0 || !Number.isFinite(kg_promedio)) {
      return { error: "Kg promedio real inválido" };
    }
  }

  return {
    precio_usd_kg,
    cantidad_animales,
    kg_promedio,
    kg_total,
    total_usd,
    total_usd_por_cabeza:
      body.total_usd_por_cabeza != null ? Number(body.total_usd_por_cabeza) : null,
    notas: body.notas ? String(body.notas).slice(0, 500) : null,
  };
}

app.get("/api/simulador-venta-ganado/precios-referencia", async (req, res) => {
  const tipo = parseSimuladorVentaTipo(req.query.tipo);
  if (!tipo) {
    res.status(400).json({ ok: false, error: "tipo inválido (EN_PIE o CUARTA_BALANZA)" });
    return;
  }
  const ref = await db.simuladorVentaGanado.preciosReferencia(tipo);
  res.json({ ok: true, ...ref });
});

app.get("/api/simulador-venta-ganado", async (req, res) => {
  const tipo = parseSimuladorVentaTipo(req.query.tipo) ?? undefined;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const data = await db.simuladorVentaGanado.list({
    tipo,
    limit,
    cuentaId: await cuentaIdForScopedRead(req.user!),
  });
  res.json({ ok: true, data });
});

app.post("/api/simulador-venta-ganado", async (req, res) => {
  try {
    const parsed = parseSimuladorVentaGanadoBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    const row = await db.simuladorVentaGanado.insert(
      {
        ...parsed.input,
        usuario_id: req.user!.id,
      },
      await cuentaIdParaInsert(req.user!)
    );
    await auditSimuladorCreacion(req, row);

    res.json({ ok: true, data: row, message: "Simulación guardada" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/simulador-venta-ganado/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  try {
    const parsed = parseSimuladorVentaGanadoBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const antes = await db.simuladorVentaGanado.getById(id, cuentaId);
    if (!antes) {
      res.status(404).json({ ok: false, error: "Simulación no encontrada" });
      return;
    }

    const row = await db.simuladorVentaGanado.update(id, parsed.input, cuentaId);
    await auditSimuladorActualizacion(req, antes, row);
    res.json({ ok: true, data: row, message: "Simulación actualizada" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.patch("/api/simulador-venta-ganado/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof db.simuladorVentaGanado.patch>[1] = {};
  const cuentaId = await cuentaIdForScopedRead(req.user!);

  const antes = await db.simuladorVentaGanado.getById(id, cuentaId);
  if (!antes) {
    res.status(404).json({ ok: false, error: "Simulación no encontrada" });
    return;
  }

  if (typeof body.destacada === "boolean") patch.destacada = body.destacada;
  if (typeof body.venta_realizada === "boolean") patch.venta_realizada = body.venta_realizada;

  if (body.valores_reales != null && typeof body.valores_reales === "object") {
    const parsed = parseSimuladorVentaRealInput(
      body.valores_reales as Record<string, unknown>,
      antes.modo_kg
    );
    if ("error" in parsed) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }
    patch.valores_reales = parsed;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({
      ok: false,
      error: "Indicá destacada, venta_realizada o valores_reales",
    });
    return;
  }
  try {
    const row = await db.simuladorVentaGanado.patch(id, patch, cuentaId);
    let restaurados = 0;
    if (patch.venta_realizada === false) {
      restaurados = await db.simuladorVentaDispositivos.revertStock(id);
      await db.simuladorVentaDispositivos.clear(id);
      if (restaurados > 0) {
        await auditStockMovimiento(req, "MODIFICACION", {
          resumen: `${restaurados} dispositivo(s) restaurado(s) al anular venta ${antes?.numero_operacion ?? id}`,
          cantidad: restaurados,
          detalle: { simulacion_id: id, restaurados },
        });
      }
    }
    await auditSimuladorPatch(req, antes, row, patch);
    const message =
      patch.venta_realizada === false
        ? restaurados > 0
          ? `Venta anulada — ${restaurados} dispositivo(s) vuelven al stock activo`
          : "Venta anulada — la operación volvió a pendiente"
        : "Simulación actualizada";
    res.json({ ok: true, data: row, restaurados, message });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.delete("/api/simulador-venta-ganado/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  try {
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const existing = await db.simuladorVentaGanado.getById(id, cuentaId);
    if (!existing) {
      res.status(404).json({ ok: false, error: "Simulación no encontrada" });
      return;
    }
    if (existing.real_total_usd != null) {
      res.status(400).json({
        ok: false,
        error: "No se puede eliminar una operación con venta real registrada",
      });
      return;
    }
    await auditSimuladorEliminacion(req, existing);
    await db.simuladorVentaGanado.delete(id, cuentaId);
    res.json({ ok: true, message: "Simulación eliminada" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.get("/api/simulador-venta-ganado/:id/dispositivos", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForScopedRead(req.user!));
  if (!existing) {
    res.status(404).json({ ok: false, error: "Simulación no encontrada" });
    return;
  }
  if (existing.real_total_usd == null) {
    res.status(400).json({ ok: false, error: "La venta aún no está cerrada" });
    return;
  }
  const data = await db.simuladorVentaDispositivos.list(id);
  res.json({ ok: true, data });
});

app.put("/api/simulador-venta-ganado/:id/dispositivos", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForScopedRead(req.user!));
  if (!existing) {
    res.status(404).json({ ok: false, error: "Simulación no encontrada" });
    return;
  }
  if (existing.real_total_usd == null) {
    res.status(400).json({ ok: false, error: "La venta aún no está cerrada" });
    return;
  }

  const raw = (req.body as { dispositivos?: unknown })?.dispositivos;
  if (!Array.isArray(raw)) {
    res.status(400).json({ ok: false, error: "dispositivos debe ser un array" });
    return;
  }

  const items = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const clave = String(o.clave ?? "").trim();
      if (!clave) return null;
      return {
        clave,
        eid: String(o.eid ?? "").trim(),
        vid: String(o.vid ?? "").trim(),
      };
    })
    .filter(Boolean) as { clave: string; eid: string; vid: string }[];

  try {
    const { data, bajados, restaurados } = await db.simuladorVentaDispositivos.replaceWithStock(
      existing,
      items
    );
    if (bajados.length > 0) {
      await auditBajasDispositivos(req, bajados);
    }
    if (restaurados > 0) {
      await auditStockMovimiento(req, "MODIFICACION", {
        resumen: `${restaurados} dispositivo(s) restaurado(s) en stock (venta ${existing.numero_operacion})`,
        cantidad: restaurados,
        detalle: { simulacion_id: id, restaurados },
      });
    }
    const parts: string[] = [];
    if (data.length > 0) parts.push(`${data.length} dispositivo(s) vinculado(s) a la venta`);
    if (bajados.length > 0) parts.push(`${bajados.length} dado(s) de baja en stock`);
    if (restaurados > 0) parts.push(`${restaurados} restaurado(s) al stock activo`);
    const message =
      parts.length > 0 ? parts.join(" · ") : "Sin dispositivos vinculados a la venta";
    res.json({
      ok: true,
      data,
      bajados: bajados.length,
      restaurados,
      message,
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/simulador-venta-ganado/:id/auditoria", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ ok: false, error: "ID inválido" });
    return;
  }
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForScopedRead(req.user!));
  if (!existing) {
    res.status(404).json({ ok: false, error: "Simulación no encontrada" });
    return;
  }
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const data = await db.simuladorVentaAuditoria.list({ simulacion_id: id, limite: limit });
  res.json({ ok: true, data, labels: db.simuladorVentaAuditoria.labels });
});

app.get("/api/resumen", async (req, res) => {
  try {
    const fecha_desde = req.query.fecha_desde as string | undefined;
    const fecha_hasta = req.query.fecha_hasta as string | undefined;
    const empresa = req.query.empresa as string | undefined;
    const scope = await resumenEmpresaScope(req.user!, empresa);
    const estado = await db.buildEstadoFinanciero(scope, fecha_hasta);
    res.json({
      ok: true,
      por_empresa: await db.resumenPorEmpresa(fecha_desde, fecha_hasta, scope),
      por_empresa_rubro: await db.resumenPorEmpresaRubro(fecha_desde, fecha_hasta, scope),
      por_rubro: await db.resumenPorRubro(scope, fecha_desde, fecha_hasta),
      estado_financiero: estado.rubros,
      estado_financiero_meses: estado.meses,
      rubros: await db.rubros.listNombres(),
    });
  } catch (e) {
    console.error("[SGG] /api/resumen:", e);
    res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al construir el resumen",
    });
  }
});

app.get("/api/resumen/gastos-proveedores", async (req, res) => {
  const fecha_desde = req.query.fecha_desde as string | undefined;
  const fecha_hasta = req.query.fecha_hasta as string | undefined;
  const empresa = req.query.empresa as string | undefined;
  const raw = req.query.proveedores;
  const partes =
    typeof raw === "string"
      ? raw.split(",")
      : Array.isArray(raw)
        ? raw.map(String)
        : [];
  const codigos = partes
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const scope = await resumenEmpresaScope(req.user!, empresa);
  const data = await db.buildGastosProveedoresReport(
    codigos,
    scope,
    fecha_desde,
    fecha_hasta
  );
  res.json({ ok: true, data });
});

app.get("/api/resumen/estado-resultados", async (req, res) => {
  const fecha_desde = req.query.fecha_desde as string | undefined;
  const fecha_hasta = req.query.fecha_hasta as string | undefined;
  const empresa = req.query.empresa as string | undefined;
  const scope = await resumenEmpresaScope(req.user!, empresa);
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  const data = await db.buildEstadoResultados({
    fecha_desde,
    fecha_hasta,
    empresa: scope.empresa,
    empresas: scope.empresas,
    cuentaId,
  });
  res.json({ ok: true, data });
});

function parseFuncionarioBody(req: Request) {
  const body = req.body as Record<string, unknown>;
  return {
    cedula: String(body.cedula ?? "").trim(),
    nombre: String(body.nombre ?? "").trim(),
    apellido: String(body.apellido ?? "").trim(),
    domicilio: String(body.domicilio ?? "").trim(),
    ciudad: String(body.ciudad ?? "").trim(),
    departamento: String(body.departamento ?? "").trim(),
    banco: String(body.banco ?? "").trim(),
    sucursal: String(body.sucursal ?? "").trim(),
    cuenta: String(body.cuenta ?? "").trim(),
    tipo_cuenta: String(body.tipo_cuenta ?? "").trim(),
    titular_cuenta: String(body.titular_cuenta ?? "").trim(),
    cuenta_otros_bancos: String(body.cuenta_otros_bancos ?? "").trim(),
    moneda_otros_bancos: String(body.moneda_otros_bancos ?? "").trim(),
    celular: String(body.celular ?? "").trim(),
    email: String(body.email ?? "").trim(),
    activo: body.activo !== false && body.activo !== 0 && body.activo !== "0",
  };
}

app.get("/api/funcionarios", async (req, res) => {
  const busqueda = req.query.busqueda as string | undefined;
  const soloActivos = req.query.solo_activos === "1";
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  res.json({ ok: true, data: await db.funcionarios.list({ busqueda, soloActivos }, cuentaId) });
});

app.get("/api/funcionarios/cedula/:cedula", async (req, res) => {
  const cedula = decodeURIComponent(paramString(req.params.cedula));
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  const row = await db.funcionarios.getByCedula(cedula, cuentaId);
  if (!row) {
    res.status(404).json({ ok: false, error: "Funcionario no encontrado" });
    return;
  }
  res.json({ ok: true, data: row });
});

app.post("/api/funcionarios", async (req, res) => {
  try {
    const cuentaId = await cuentaIdParaInsert(req.user!);
    const id = await db.funcionarios.insert(parseFuncionarioBody(req), cuentaId);
    res.status(201).json({
      ok: true,
      data: await db.funcionarios.getById(id, cuentaId),
      message: "Funcionario registrado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/funcionarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!await db.funcionarios.update(id, parseFuncionarioBody(req), cuentaId)) {
      res.status(404).json({ ok: false, error: "Funcionario no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.funcionarios.getById(id, cuentaId),
      message: "Funcionario actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/funcionarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    if (!await db.funcionarios.delete(id, cuentaId)) {
      res.status(404).json({ ok: false, error: "Funcionario no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Funcionario eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/rrhh/pagos", async (req, res) => {
  try {
    const cedula = String(req.query.cedula ?? "").trim();
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    const data = await db.rrhhPagos.porCedula(cedula, {
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      empresa: req.query.empresa as string | undefined,
    }, cuentaId);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/rrhh/resumen-global", async (req, res) => {
  const cuentaId = await cuentaIdForScopedRead(req.user!);
  res.json({
    ok: true,
    data: await db.rrhhPagos.resumenGlobal(cuentaId, {
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    }),
  });
});

app.get("/api/rrhh/dashboard", async (req, res) => {
  try {
    const cuentaId = await cuentaIdForScopedRead(req.user!);
    res.json({
      ok: true,
      data: await db.rrhhPagos.dashboard(cuentaId, {
        fecha_desde: req.query.fecha_desde as string | undefined,
        fecha_hasta: req.query.fecha_hasta as string | undefined,
      }),
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

if (!IS_PROD) {
  app.get("/", (_req, res) => {
    res.redirect(302, VITE_DEV_URL);
  });
}

if (IS_PROD && !IS_VERCEL) {
  if (!fs.existsSync(CLIENT_DIST)) {
    console.error(
      "[SGG] Falta client/dist. Ejecutá: npm run build --prefix client"
    );
    process.exit(1);
  }
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ ok: false, error: "No encontrado" });
      return;
    }
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

export default app;

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[SGG] Error no capturado:", err);
  if (res.headersSent) return;
  if (isDbCapacityError(err)) {
    res.status(503).json({
      ok: false,
      error: "Base de datos saturada",
      hint: dbCapacityHint(),
      ...(clientSafeErrorDetail(err) ? { detail: clientSafeErrorDetail(err) } : {}),
    });
    return;
  }
  res.status(500).json({
    ok: false,
    error: clientSafeErrorMessage(err),
  });
});

async function shutdownPool(signal: string): Promise<void> {
  console.info(`[SGG] ${signal}: cerrando pool de DB…`);
  try {
    await closePool();
  } catch {
    /* ignore */
  }
}

if (!IS_VERCEL) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void shutdownPool(signal).finally(() => process.exit(0));
    });
  }

  // Red de seguridad: un error async sin capturar en cualquier handler NO debe
  // tumbar todo el server (en dev no hay supervisor que lo reinicie).
  process.on("unhandledRejection", (reason) => {
    console.error("[SGG] unhandledRejection (server sigue vivo):", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[SGG] uncaughtException (server sigue vivo):", err);
  });
}

if (!IS_VERCEL) {
  const server = app.listen(PORT, HOST, () => {
    const label = IS_PROD ? "SAG producción" : "API SAG";
    console.log(`${label}: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `[SGG] Puerto ${PORT} en uso. Cerrá la otra instancia de npm run dev antes de reiniciar.`
      );
      process.exit(1);
    }
    throw err;
  });
}
