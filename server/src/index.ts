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
import { closePool, dbCapacityHint, isDbCapacityError } from "./db/pg-client.js";
import {
  apiRateLimiter,
  authMiddleware,
  csrfOriginGuard,
  getCorsOptions,
  registerAuthRoutes,
  securityHeaders,
} from "./auth.js";
import { registerChatRoutes } from "./chat.js";
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
import { parseStockGanaderoBuffer, parseStockGanaderoFile, parseStockGanaderoText, normalizeStockGanaderoRows } from "./parse-stock-ganadero-txt.js";
import type { DispositivoMetaPatch, StockGanaderoFilters } from "./stock-ganadero-db.js";
import { parseTipoBaja, tipoBajaDesdeEstadoImport, type TipoBaja } from "./stock-ganadero-db.js";
import { auditBajasDispositivos, auditStockMovimiento, historialAutorFromRequest } from "./stock-audit.js";
import { type Empresa, type Presupuesto, type PresupuestoInput } from "./types.js";
import { empresasCuenta } from "./database.js";
import type { UserPublic } from "./auth-db.js";
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
  if (dbInitOk) {
    res.json({
      ok: true,
      service: "scg-api",
      database: "postgres",
      ready: true,
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
      detail: lastDbInitError,
    });
    return;
  }
  res.json({
    ok: true,
    service: "scg-api",
    database: "postgres",
    ready: dbInitOk,
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
    detail: lastDbInitError,
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
registerChatRoutes(app);
console.info("[SGG Auth] Rutas de autenticación registradas");

function paramString(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
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

async function parseBody(req: Request): Promise<PresupuestoInput> {
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
  if (!(await empresasCuenta.isValidEmpresaNombre(db.getDb(), empresa))) {
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
  if (!await db.rubros.gastoValido(rubro)) {
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
    if (!await db.subRubros.existsActivo(sub_rubro)) {
      throw new Error(
        "El sub-rubro debe existir en el catálogo SUB_RUBROS y estar activo."
      );
    }
    if (!await db.rubroVinculos.isValidPair(rubro, sub_rubro)) {
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
  };
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
  if (!user.es_super_admin) {
    const permitidas = await empresasPermitidas(user);
    if (permitidas.length > 0 && !permitidas.includes(row.empresa)) {
      return false;
    }
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

/** Scope de lectura por cuenta: super admin ve todo; resto solo su cuenta (nunca null sin filtro). */
async function cuentaIdForScopedRead(user: UserPublic): Promise<number | null> {
  if (user.es_super_admin) return null;
  return await cuentaIdForUser(user);
}

/** cuenta_id para INSERTAR: su cuenta, o VILA DIAZ como fallback para super admin. */
async function cuentaIdParaInsert(user: UserPublic): Promise<number | null> {
  return await empresasCuenta.cuentaIdParaInsert(db.getDb(), user);
}

async function stockGanaderoFiltersFromRequest(
  req: Request,
  base: StockGanaderoFilters = {}
): Promise<StockGanaderoFilters> {
  const user = req.user;
  if (!user) return base;
  const empresas = await empresasCuenta.getEmpresasScopeFilter(db.getDb(), user);
  if (!empresas) return base;
  return { ...base, empresas };
}

/** Filtro por cuenta madre para lotes y lecturas importadas. */
async function stockLecturasFiltersFromRequest(
  req: Request,
  base: StockGanaderoFilters = {}
): Promise<StockGanaderoFilters> {
  const user = req.user;
  if (!user || user.es_super_admin) return base;
  const cuentaId = await cuentaIdForUser(user);
  if (!cuentaId) return { ...base, cuenta_id: 0 };
  return { ...base, cuenta_id: cuentaId };
}

async function assertLoteEnCuentaUsuario(req: Request, loteId: number): Promise<void> {
  const lote = await db.stockGanadero.getLote(loteId);
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

async function applyEmpresaScopeToFilters(
  filters: db.ListFilters,
  user: UserPublic
): Promise<db.ListFilters> {
  if (user.es_super_admin) return filters;
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
  if (user.es_super_admin) {
    return empresa ? { empresa } : {};
  }
  const permitidas = await empresasPermitidas(user);
  if (permitidas.length === 0) {
    return { empresas: ["__sin_empresas__"] };
  }
  if (empresa && permitidas.includes(empresa)) {
    return { empresa };
  }
  return { empresas: permitidas };
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
    const reg = await db.insertPresupuesto(payload, {
      email: user.email,
      nombre: user.nombre,
    });
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
    departamento: req.query.departamento as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
  };
}

async function assertEmpresaPermitida(user: UserPublic, empresa: string): Promise<void> {
  const nombre = empresa.trim();
  if (!nombre) throw new Error("La empresa es obligatoria.");
  if (user.es_super_admin) {
    if (!(await empresasCuenta.isValidEmpresaNombre(db.getDb(), nombre))) {
      throw new Error("Empresa inválida o inactiva.");
    }
    return;
  }
  const permitidas = await empresasPermitidas(user);
  if (!permitidas.includes(nombre)) {
    throw new Error("Empresa inválida o no pertenece a su cuenta.");
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
  if (user.es_super_admin) {
    if (!(await empresasCuenta.isValidEmpresaCodigo(db.getDb(), normalized))) {
      throw new Error("Empresa inválida o inactiva.");
    }
    return;
  }
  const permitidas = await empresasCodigosPermitidos(user);
  if (!permitidas.includes(normalized)) {
    throw new Error("Empresa inválida o no pertenece a su cuenta.");
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
  const cuentaId = await cuentaIdForUser(req.user!);
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
    const newId = await db.ventasAgricultura.insert(payload);
    const reg = await db.ventasAgricultura.getById(newId);
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
    const row = await db.ventasAgricultura.update(id, payload);
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
    const row = await db.ventasAgricultura.patch(id, patch);
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
  if (!await db.ventasAgricultura.delete(id)) {
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
    const newId = await db.ventasArrendamientos.insert(payload);
    const reg = await db.ventasArrendamientos.getById(newId);
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
    const row = await db.ventasArrendamientos.update(id, payload);
    res.json({ ok: true, data: row, message: "Simulación actualizada" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.delete("/api/ingresos-ventas/ventas-arrendamientos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.ventasArrendamientos.delete(id)) {
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
    const row = await db.ventasArrendamientos.patch(id, patch);
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
    cuentaId: await cuentaIdForUser(req.user!),
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
      await cuentaIdForUser(req.user!)
    );
    res.json({ ok: true, data: row, message: "Destino actualizado" });
  } catch (e) {
    const msg = (e as Error).message;
    res.status(msg.includes("no encontrada") ? 404 : 400).json({ ok: false, error: msg });
  }
});

app.get("/api/ingresos-ventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cuentaId = await cuentaIdForUser(req.user!);
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
    const cuentaId = await cuentaIdForUser(req.user!);
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
  const cuentaId = await cuentaIdForUser(req.user!);
  if (!await db.ingresosVentas.delete(id, cuentaId)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
});

app.get("/api/venta-sub-rubros", async (req, res) => {
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.ventaSubRubros.list(soloActivos) });
});

app.get("/api/venta-sub-rubros/grupos", async (_req, res) => {
  res.json({ ok: true, data: await db.ventaSubRubros.listGrupos() });
});

app.post("/api/venta-sub-rubros", async (req, res) => {
  try {
    const payload = parseSubRubroBody(req);
    const id = await db.ventaSubRubros.insert(payload);
    res.status(201).json({
      ok: true,
      data: await db.ventaSubRubros.getById(id),
      message: "Sub-rubro creado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/venta-sub-rubros/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const prev = await db.ventaSubRubros.getById(id);
    const payload = parseSubRubroBody(req);
    if (!await db.ventaSubRubros.update(id, payload)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    if (prev && prev.grupo !== payload.grupo) {
      await db.ventaGrupoIconos.renameGrupo(prev.grupo, payload.grupo);
    }
    res.json({
      ok: true,
      data: await db.ventaSubRubros.getById(id),
      message: "Sub-rubro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/venta-sub-rubros/grupo/rename", async (req, res) => {
  try {
    const anterior = String(req.body?.anterior ?? "").trim();
    const nuevo = String(req.body?.nuevo ?? "").trim();
    const updated = await db.ventaSubRubros.renameGrupo(anterior, nuevo);
    const nombreCanon = normalizarTituloRubro(nuevo);
    await db.ventaGrupoIconos.renameGrupo(anterior, nombreCanon);
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
  try {
    const grupo = decodeURIComponent(req.params.grupo);
    const result = await db.ventaSubRubros.deleteByGrupo(grupo);
    await db.ventaGrupoIconos.deleteByGrupo(grupo);
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
  try {
    const id = Number(req.params.id);
    if (!await db.ventaSubRubros.delete(id)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    res.json({ ok: true, message: "Sub-rubro eliminado" });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/venta-sub-rubros/items-counts", async (req, res) => {
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({ ok: true, data: await db.ventaSubRubroItems.countsBySubRubroIds(ids) });
});

app.get("/api/venta-sub-rubros/items-batch", async (req, res) => {
  const raw = String(req.query.ids ?? "").trim();
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  res.json({ ok: true, data: await db.ventaSubRubroItems.groupedBySubRubroIds(ids) });
});

app.get("/api/venta-sub-rubros/items", async (req, res) => {
  const nombre = String(req.query.sub_rubro ?? "").trim();
  if (!nombre) {
    res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({
    ok: true,
    data: await db.ventaSubRubroItems.listBySubRubroNombre(nombre, soloActivos),
  });
});

app.post("/api/venta-sub-rubros/items", async (req, res) => {
  try {
    const subRubroNombre = String(
      (req.body as { sub_rubro?: string }).sub_rubro ?? ""
    ).trim();
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    if (!subRubroNombre) {
      res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
      return;
    }
    const sub = await db.ventaSubRubros.getByNombre(subRubroNombre);
    if (!sub) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.ventaSubRubroItems.insert(sub.id, { nombre, activo });
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
  const sub = await db.ventaSubRubros.getById(id);
  if (!sub) {
    res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({ ok: true, data: await db.ventaSubRubroItems.listBySubRubroId(id, soloActivos) });
});

app.post("/api/venta-sub-rubros/:id/items", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!await db.ventaSubRubros.getById(id)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.ventaSubRubroItems.insert(id, { nombre, activo });
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
  try {
    const id = Number(req.params.id);
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    const activo = (req.body as { activo?: boolean }).activo !== false;
    if (!await db.ventaSubRubroItems.update(id, { nombre, activo })) {
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
  const id = Number(req.params.id);
  if (!await db.ventaSubRubroItems.delete(id)) {
    res.status(404).json({ ok: false, error: "Ítem no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Ítem eliminado" });
});

app.get("/api/venta-grupo-iconos", async (_req, res) => {
  res.json({ ok: true, data: await db.ventaGrupoIconos.map() });
});

app.get("/api/venta-grupo-iconos/banco", async (_req, res) => {
  res.json({ ok: true, data: await db.ventaGrupoIconos.banco() });
});

app.put("/api/venta-grupo-iconos/:grupo/emoji", async (req, res) => {
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
    const emoji = String((req.body as { emoji?: unknown })?.emoji ?? "").trim();
    if (!grupo) {
      res.status(400).json({ ok: false, error: "Rubro inválido." });
      return;
    }
    const dto = await db.ventaGrupoIconos.saveEmoji(grupo, emoji);
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
  const filePath = await db.ventaGrupoIconos.filePath(grupo);
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
      const icono = await db.ventaGrupoIconos.save(grupo, file.buffer, file.mimetype);
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
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo));
    await db.ventaGrupoIconos.deleteByGrupo(grupo);
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
    const data = await db.stockGanadero.listHistorialCambios(req.params.clave);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({
      ok: false,
      error: e instanceof Error ? e.message : "Error al cargar historial",
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
    const rows = await parseStockGanaderoFile(file.buffer, file.originalname || "import.txt");
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
    cuentaId = (await cuentaIdForUser(req.user!)) ?? 0;
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
    const cuentaId = await cuentaIdForUser(req.user!);
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

      if (rubro && !await db.rubros.gastoValido(rubro)) {
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
        if (!await db.subRubros.existsActivo(sub_rubro)) {
          res.status(400).json({
            ok: false,
            error: "El sub-rubro debe existir en el catálogo SUB_RUBROS y estar activo.",
          });
          return;
        }
        if (!await db.rubroVinculos.isValidPair(rubro, sub_rubro)) {
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
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.rubros.list(soloActivos) });
});

app.post("/api/rubros", async (req, res) => {
  try {
    const payload = parseRubroBody(req);
    const id = await db.rubros.insert(payload);
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
  try {
    const id = Number(req.params.id);
    const payload = parseRubroBody(req);
    if (!await db.rubros.update(id, payload)) {
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

app.delete("/api/rubros/:id", async (req, res) => {
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
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.subRubros.list(soloActivos) });
});

app.get("/api/sub-rubros/grupos", async (_req, res) => {
  res.json({ ok: true, data: await db.subRubros.listGrupos() });
});

app.post("/api/sub-rubros", async (req, res) => {
  try {
    const payload = parseSubRubroBody(req);
    const id = await db.subRubros.insert(payload);
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
    const id = await db.subRubros.insert({ nombre, grupo, activo });
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
  try {
    const id = Number(req.params.id);
    const prev = await db.subRubros.getById(id);
    const payload = parseSubRubroBody(req);
    if (!await db.subRubros.update(id, payload)) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    if (prev && prev.grupo !== payload.grupo) {
      await db.grupoIconos.renameGrupo(prev.grupo, payload.grupo);
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
  try {
    const anterior = String(req.body?.anterior ?? "").trim();
    const nuevo = String(req.body?.nuevo ?? "").trim();
    const updated = await db.subRubros.renameGrupo(anterior, nuevo);
    const nombreCanon = normalizarTituloRubro(nuevo);
    await db.grupoIconos.renameGrupo(anterior, nombreCanon);
    const subs = (await db.subRubros.list(false)).filter(
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

app.delete("/api/sub-rubros/grupo/:grupo", async (req, res) => {
  try {
    const grupo = decodeURIComponent(req.params.grupo);
    const result = await db.subRubros.deleteByGrupo(grupo);
    await db.grupoIconos.deleteByGrupo(grupo);
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
  try {
    const id = Number(req.params.id);
    if (!await db.subRubros.delete(id)) {
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
  const nombre = String(req.query.sub_rubro ?? "").trim();
  if (!nombre) {
    res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
    return;
  }
  const soloActivos = req.query.solo_activos !== "0";
  res.json({
    ok: true,
    data: await db.subRubroItems.listBySubRubroNombre(nombre, soloActivos),
  });
});

app.post("/api/sub-rubros/items", async (req, res) => {
  try {
    const subRubroNombre = String(
      (req.body as { sub_rubro?: string }).sub_rubro ?? ""
    ).trim();
    const nombre = String((req.body as { nombre?: string }).nombre ?? "").trim();
    if (!subRubroNombre) {
      res.status(400).json({ ok: false, error: "Falta el sub-rubro." });
      return;
    }
    const sub = await db.subRubros.getByNombre(subRubroNombre);
    if (!sub) {
      res.status(404).json({ ok: false, error: "Sub-rubro no encontrado" });
      return;
    }
    const activo = (req.body as { activo?: boolean }).activo !== false;
    const itemId = await db.subRubroItems.insert(sub.id, { nombre, activo });
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
  const id = Number(req.params.id);
  if (!await db.subRubroItems.delete(id)) {
    res.status(404).json({ ok: false, error: "Ítem no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Ítem eliminado" });
});

app.get("/api/grupo-iconos", async (_req, res) => {
  res.json({ ok: true, data: await db.grupoIconos.map() });
});

app.get("/api/grupo-iconos/banco", async (_req, res) => {
  res.json({ ok: true, data: await db.grupoIconos.banco() });
});

app.put("/api/grupo-iconos/:grupo/emoji", async (req, res) => {
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo)).trim();
    const emoji = String((req.body as { emoji?: unknown })?.emoji ?? "").trim();
    if (!grupo) {
      res.status(400).json({ ok: false, error: "Rubro inválido." });
      return;
    }
    const dto = await db.grupoIconos.saveEmoji(grupo, emoji);
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
  const grupo = decodeURIComponent(paramString(req.params.grupo));
  const filePath = await db.grupoIconos.filePath(grupo);
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
      const icono = await db.grupoIconos.save(grupo, file.buffer, file.mimetype);
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
  try {
    const grupo = decodeURIComponent(paramString(req.params.grupo));
    await db.grupoIconos.deleteByGrupo(grupo);
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
    const cuentaId = await cuentaIdForUser(req.user!);
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
    const cuentaId = await cuentaIdForUser(req.user!);
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
    cuentaId: await cuentaIdForUser(req.user!),
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

    const cuentaId = await cuentaIdForUser(req.user!);
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
  const cuentaId = await cuentaIdForUser(req.user!);

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
    const cuentaId = await cuentaIdForUser(req.user!);
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
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForUser(req.user!));
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
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForUser(req.user!));
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
  const existing = await db.simuladorVentaGanado.getById(id, await cuentaIdForUser(req.user!));
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
  const cuentaId = await cuentaIdForUser(req.user!);
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
  const cuentaId = await cuentaIdForUser(req.user!);
  res.json({ ok: true, data: await db.funcionarios.list({ busqueda, soloActivos }, cuentaId) });
});

app.get("/api/funcionarios/cedula/:cedula", async (req, res) => {
  const cedula = decodeURIComponent(paramString(req.params.cedula));
  const cuentaId = await cuentaIdForUser(req.user!);
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
    const cuentaId = await cuentaIdForUser(req.user!);
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
    const cuentaId = await cuentaIdForUser(req.user!);
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
    const data = await db.rrhhPagos.porCedula(cedula, {
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      empresa: req.query.empresa as string | undefined,
    });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.get("/api/rrhh/resumen-global", async (req, res) => {
  res.json({
    ok: true,
    data: await db.rrhhPagos.resumenGlobal({
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    }),
  });
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
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  res.status(500).json({
    ok: false,
    error: err instanceof Error ? err.message : "Error interno del servidor",
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
