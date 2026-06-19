import "./load-env.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import "express-async-errors";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./database.js";
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
import { normalizarTituloRubro } from "./text-normalize.js";
import { parseStockGanaderoBuffer, parseStockGanaderoText, normalizeStockGanaderoRows } from "./parse-stock-ganadero-txt.js";
import type { DispositivoMetaPatch } from "./stock-ganadero-db.js";
import { parseTipoBaja, tipoBajaDesdeEstadoImport, type TipoBaja } from "./stock-ganadero-db.js";
import { auditBajasDispositivos, auditStockMovimiento } from "./stock-audit.js";
import { EMPRESAS, type Empresa, type Presupuesto, type PresupuestoInput } from "./types.js";
import type { UserPublic } from "./auth-db.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
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

const dbReady = db.initDb();
let dbInitOk = false;
void dbReady
  .then(() => {
    dbInitOk = true;
  })
  .catch((err) => {
    lastDbInitError = err instanceof Error ? err.message : String(err);
    console.error("[SGG] Error al inicializar la base de datos:", err);
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

app.get("/api/health", (_req, res) => {
  if (lastDbInitError) {
    res.status(503).json({
      ok: false,
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

app.use(async (req, res, next) => {
  if (req.path === "/api/health") {
    next();
    return;
  }
  try {
    await dbReady;
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
  const empresa = String(body.empresa ?? "").trim();
  if (!EMPRESAS.includes(empresa as Empresa)) {
    throw new Error(
      "Empresa inválida. Debe ser GANADERA GUAVIYU o GANADERA CHIVILCOY."
    );
  }
  const fecha = String(body.fecha ?? "").trim();
  if (!fecha) throw new Error("La fecha es obligatoria.");
  const concepto = String(body.concepto ?? "").trim();
  const rubro = String(body.rubro ?? "").trim();
  const sub_rubro = String(body.sub_rubro ?? "").trim();
  const responsable_gasto = String(body.responsable_gasto ?? "").trim();
  let funcionario_cedula = String(body.funcionario_cedula ?? "").trim();
  if (!concepto) throw new Error("El concepto es obligatorio.");
  if (!rubro) throw new Error("El rubro es obligatorio.");
  if (!await db.rubros.gastoValido(rubro)) {
    throw new Error(
      "El rubro debe existir en Configuración → Rubros (grupo con sub-rubros activos)."
    );
  }
  if (sub_rubro) {
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
    const porNombre = await db.funcionarios.getByNombreDisplay(responsable_gasto);
    if (porNombre) funcionario_cedula = porNombre.cedula;
  }

  if (
    responsable_gasto &&
    !rubroSueldos &&
    !await db.responsables.existsActivo(responsable_gasto)
  ) {
    throw new Error(
      "El presupuesto asignado debe existir en el catálogo y estar activo."
    );
  }

  if (rubroSueldos && responsable_gasto) {
    const f =
      (funcionario_cedula ? await db.funcionarios.getByCedula(funcionario_cedula) : undefined) ??
      await db.funcionarios.getByNombreDisplay(responsable_gasto);
    if (f) {
      if (!f.activo) {
        throw new Error(
          "El empleado debe estar ACTIVO en Recursos Humanos → Funcionarios."
        );
      }
      funcionario_cedula = f.cedula;
    } else if (!await db.responsables.existsActivo(responsable_gasto)) {
      throw new Error(
        "Presupuesto asignado: elegí un empleado activo de RRHH o un nombre del catálogo Presupuesto asignado."
      );
    } else {
      funcionario_cedula = "";
    }
  } else if (funcionario_cedula) {
    const f = await db.funcionarios.getByCedula(funcionario_cedula);
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
    pesos: parseNum(body.pesos),
    dolares_usd: parseNum(body.dolares_usd),
    reales: parseNum(body.reales),
    tc_usd: parseNum(body.tc_usd),
    tc_reales: parseNum(body.tc_reales),
    saldo_usd: parseNum(body.saldo_usd),
  };
}

app.get("/api/catalogos", async (_req, res) => {
  res.json({ ok: true, ...(await db.getCatalogos()) });
});

function puedeAccederPresupuesto(row: Presupuesto, user: UserPublic): boolean {
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

function presupuestoListFilters(req: Request): db.ListFilters {
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
    return filters;
  }

  if (verTodos && (user.rol === "editor" || user.rol === "gestor_n2" || user.rol === "consulta")) {
    return filters;
  }

  filters.ingresado_por_email = user.email;
  return filters;
}

app.get("/api/presupuesto", async (req, res) => {
  const data = await db.listPresupuesto(presupuestoListFilters(req));
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
  if (!puedeAccederPresupuesto(reg, req.user!)) {
    res.status(403).json({ ok: false, error: "No tenés permiso para ver este registro" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/presupuesto", async (req, res) => {
  try {
    const payload = await parseBody(req);
    const user = req.user!;
    const newId = await db.insertPresupuesto(payload, {
      email: user.email,
      nombre: user.nombre,
    });
    const reg = await db.getPresupuesto(newId);
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
    if (!puedeAccederPresupuesto(prev, req.user!)) {
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
  if (!puedeAccederPresupuesto(prev, req.user!)) {
    res.status(403).json({ ok: false, error: "No tenés permiso para eliminar este registro" });
    return;
  }
  if (!await db.deletePresupuesto(id)) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Registro eliminado" });
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

app.get("/api/ingresos-ventas", async (req, res) => {
  const data = await db.ingresosVentas.list({
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
    busqueda: req.query.busqueda as string | undefined,
  });
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

app.get("/api/ingresos-ventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const reg = await db.ingresosVentas.getById(id);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Registro no encontrado" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/ingresos-ventas", async (req, res) => {
  try {
    const payload = parseIngresoVentaBody(req);
    const newId = await db.ingresosVentas.insert(payload);
    const reg = await db.ingresosVentas.getById(newId);
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
    if (!await db.ingresosVentas.update(id, payload)) {
      res.status(404).json({ ok: false, error: "Registro no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.ingresosVentas.getById(id),
      message: "Registro actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/ingresos-ventas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.ingresosVentas.delete(id)) {
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

app.get("/api/stock-ganadero/lotes", async (_req, res) => {
  res.json({ ok: true, data: await db.stockGanadero.listLotes() });
});

app.get("/api/stock-ganadero/registros", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  res.json({
    ok: true,
    data: await db.stockGanadero.listRegistros({
      lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
      busqueda: req.query.busqueda as string | undefined,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      solo_repetidos: req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
    }),
  });
});

app.get("/api/stock-ganadero/estadisticas", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  res.json({
    ok: true,
    data: await db.stockGanadero.estadisticas({
      lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
      busqueda: req.query.busqueda as string | undefined,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    }),
  });
});

app.get("/api/stock-ganadero/dispositivos", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const estadoRaw = String(req.query.estado_dispositivo ?? "").toUpperCase();
  const estadoDispositivo =
    estadoRaw === "MUERTO" ||
    estadoRaw === "VENDIDO" ||
    estadoRaw === "FRIGORIFICO" ||
    estadoRaw === "PERDIDO"
      ? estadoRaw
      : undefined;
  res.json({
    ok: true,
    data: await db.stockGanadero.listDispositivos({
      lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
      busqueda: req.query.busqueda as string | undefined,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
      solo_repetidos:
        req.query.solo_repetidos === "1" || req.query.solo_repetidos === "true",
      solo_bajas:
        req.query.solo_bajas === "1" || req.query.solo_bajas === "true",
      estado_dispositivo: estadoDispositivo,
    }),
  });
});

app.get("/api/stock-ganadero/dispositivos/:clave", async (req, res) => {
  const loteId = req.query.lote_id ? Number(req.query.lote_id) : undefined;
  const detalle = await db.stockGanadero.getDispositivo(req.params.clave, {
    lote_id: loteId && Number.isFinite(loteId) ? loteId : undefined,
    busqueda: req.query.busqueda as string | undefined,
    fecha_desde: req.query.fecha_desde as string | undefined,
    fecha_hasta: req.query.fecha_hasta as string | undefined,
  });
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
      metaPatch.empresa = String(patch.empresa).toUpperCase() as
        | ""
        | "GUAVIYU"
        | "CHIVILCOY";
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
      eids
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
      eid
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
    const empresa = String(body.empresa ?? "").toUpperCase() as
      | ""
      | "GUAVIYU"
      | "CHIVILCOY";
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
      eid
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

app.get("/api/stock-ganadero/resumen", async (_req, res) => {
  const lotes = await db.stockGanadero.listLotes();
  res.json({
    ok: true,
    data: {
      lotes: lotes.length,
      registros: await db.stockGanadero.countRegistros(),
      dispositivos: await db.stockGanadero.countDispositivos(),
    },
  });
});

app.post("/api/stock-ganadero/import/file", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo .txt o .csv" });
      return;
    }
    const rows = parseStockGanaderoBuffer(file.buffer);
    const result = await db.stockGanadero.importRows(file.originalname || "import.txt", rows);
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
    const result = await db.stockGanadero.importRows(nombre, rows);
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
      }>;
      nombre_archivo?: string;
    };
    const rows = normalizeStockGanaderoRows(body.rows ?? []);
    const nombre = String(body.nombre_archivo ?? "carga-manual").trim() || "carga-manual";
    const result = await db.stockGanadero.importRows(nombre, rows);
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
      return "Perdido";
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
    const result = await db.stockGanadero.importBaja(rows, tipo_baja);
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
    const result = await db.stockGanadero.importBaja(rows, tipo_baja);
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
    const result = await db.stockGanadero.importBaja(rows, tipo_baja);
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
      const result = await db.stockGanadero.importBajaDetalle(items);
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
    const result = await db.stockGanadero.importBajaNumeros(dispositivos, tipo_baja);
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
  res.json({ ok: true, data: await db.proveedores.list(busqueda) });
});

app.get("/api/proveedores/siguiente-cod", async (_req, res) => {
  res.json({ ok: true, cod: await db.proveedores.nextCod() });
});

app.get("/api/proveedores/:cod", async (req, res) => {
  const cod = Number(req.params.cod);
  const reg = await db.proveedores.getByCod(cod);
  if (!reg) {
    res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
    return;
  }
  res.json({ ok: true, data: reg });
});

app.post("/api/proveedores", async (req, res) => {
  try {
    const payload = parseProveedorBody(req);
    if (await db.proveedores.getByCod(payload.cod)) {
      res.status(400).json({ ok: false, error: "Ya existe un proveedor con ese código" });
      return;
    }
    const id = await db.proveedores.insert(payload);
    res.status(201).json({
      ok: true,
      data: await db.proveedores.getById(id),
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
    const existing = await db.proveedores.getByCod(payload.cod);
    if (existing && existing.id !== id) {
      res.status(400).json({ ok: false, error: "Ya existe otro proveedor con ese código" });
      return;
    }
    if (!await db.proveedores.update(id, payload)) {
      res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.proveedores.getById(id),
      message: "Proveedor actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/proveedores/id/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!await db.proveedores.delete(id)) {
    res.status(404).json({ ok: false, error: "Proveedor no encontrado" });
    return;
  }
  res.json({ ok: true, message: "Proveedor eliminado" });
});

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
  return { nombre, activo };
}

app.get("/api/responsables", async (req, res) => {
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.responsables.list(soloActivos) });
});

app.post("/api/responsables", async (req, res) => {
  try {
    const payload = parseResponsableBody(req);
    const id = await db.responsables.insert(payload);
    res.status(201).json({
      ok: true,
      data: await db.responsables.getById(id),
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
    if (!await db.responsables.update(id, payload)) {
      res.status(404).json({ ok: false, error: "Nombre no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.responsables.getById(id),
      message: "Nombre actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/responsables/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!await db.responsables.delete(id)) {
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

app.get("/api/resumen", async (req, res) => {
  const fecha_desde = req.query.fecha_desde as string | undefined;
  const fecha_hasta = req.query.fecha_hasta as string | undefined;
  const empresa = req.query.empresa as string | undefined;
  res.json({
    ok: true,
    por_empresa: await db.resumenPorEmpresa(fecha_desde, fecha_hasta),
    por_rubro: await db.resumenPorRubro(empresa),
    rubros: await db.rubros.listNombres(),
  });
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
    celular: String(body.celular ?? "").trim(),
    email: String(body.email ?? "").trim(),
    activo: body.activo !== false && body.activo !== 0 && body.activo !== "0",
  };
}

app.get("/api/funcionarios", async (req, res) => {
  const busqueda = req.query.busqueda as string | undefined;
  const soloActivos = req.query.solo_activos === "1";
  res.json({ ok: true, data: await db.funcionarios.list({ busqueda, soloActivos }) });
});

app.get("/api/funcionarios/cedula/:cedula", async (req, res) => {
  const cedula = decodeURIComponent(paramString(req.params.cedula));
  const row = await db.funcionarios.getByCedula(cedula);
  if (!row) {
    res.status(404).json({ ok: false, error: "Funcionario no encontrado" });
    return;
  }
  res.json({ ok: true, data: row });
});

app.post("/api/funcionarios", async (req, res) => {
  try {
    const id = await db.funcionarios.insert(parseFuncionarioBody(req));
    res.status(201).json({
      ok: true,
      data: await db.funcionarios.getById(id),
      message: "Funcionario registrado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.put("/api/funcionarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!await db.funcionarios.update(id, parseFuncionarioBody(req))) {
      res.status(404).json({ ok: false, error: "Funcionario no encontrado" });
      return;
    }
    res.json({
      ok: true,
      data: await db.funcionarios.getById(id),
      message: "Funcionario actualizado",
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.delete("/api/funcionarios/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!await db.funcionarios.delete(id)) {
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
  if (!res.headersSent) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Error interno del servidor",
    });
  }
});

if (!IS_VERCEL) {
  app.listen(PORT, HOST, () => {
    const label = IS_PROD ? "SGG producción" : "API SGG";
    console.log(`${label}: http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
  });
}
