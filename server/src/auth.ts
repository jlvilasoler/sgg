import type { Express, Request, Response, NextFunction } from "express";
import type { CookieOptions } from "express";
import multer from "multer";
import * as authDb from "./auth-db.js";
import type { Modulo, UserPublic } from "./auth-db.js";
import {
  avatarDtoFromRow,
  clearUserAvatar,
  loadUserAvatarImage,
  saveUserAvatarFoto,
} from "./user-avatar-db.js";
import { dbCapacityHint, isDbCapacityError } from "./db/pg-client.js";
import type { StockMovimientoTipo } from "./stock-auditoria-db.js";
import { getDb, empresasCuenta, stockAuditoria } from "./database.js";
import { summarizeCuentasControlPlataforma } from "./plataforma-cuentas-control-db.js";
import {
  attachApiActivityLogger,
  formatNavegacionDetalle,
  PANTALLA_LABELS,
  recordUserActivity,
} from "./user-activity.js";
import { listHomeFeedActivity } from "./home-actividad-feed.js";
import { listOnlineUsers, listRecentlyOfflineUsers, listStaleOfflineUsers, markUserPresenceDisconnected, touchUserPresence } from "./user-presence.js";
import {
  artificialLoginDelay,
  clientIp,
  clientPublicOriginFromRequest,
  clientSafeErrorDetail,
  getAllowedClientOrigins,
  hitPasswordChangeRateLimit,
  isValidSessionTokenFormat,
  loginRateLimiter,
  PASSWORD_POLICY_HINT,
} from "./auth-security.js";
import {
  buildPasswordResetUrl,
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "./password-reset-email.js";

export {
  apiRateLimiter,
  csrfOriginGuard,
  getAllowedClientOrigins,
  getCorsOptions,
  securityHeaders,
} from "./auth-security.js";

export const SESSION_COOKIE = "scg_session";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF."));
  },
});

const IS_PROD = process.env.NODE_ENV === "production";

async function canViewUserProfilePhoto(
  viewer: UserPublic,
  targetUserId: number
): Promise<boolean> {
  if (viewer.id === targetUserId) return true;
  if (viewer.es_super_admin) return true;

  const db = getDb();
  const target = await authDb.getUserById(db, targetUserId);
  if (!target?.activo) return false;

  const viewerCuenta = await empresasCuenta.resolveCuentaMadreIdForUser(db, viewer);
  const targetCuenta = await empresasCuenta.resolveCuentaMadreIdForUser(db, target);
  return (
    viewerCuenta != null &&
    targetCuenta != null &&
    viewerCuenta === targetCuenta
  );
}

const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login"]);

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function canAccessModulo(user: UserPublic, modulo: Modulo): boolean {
  if (authDb.MODULOS_TODOS_LOS_USUARIOS.includes(modulo)) return true;
  if (modulo === "documentos_digitales") return Boolean(user.es_super_admin);
  if (authDb.MODULOS_SOLO_ADMIN.includes(modulo)) return user.rol === "admin";
  if (user.rol === "admin") return true;
  return user.permisos.includes(modulo);
}

function canWriteInModulo(user: UserPublic, modulo: Modulo | null): boolean {
  if (modulo && authDb.MODULOS_ESCRITURA_TODOS_LOS_USUARIOS.includes(modulo)) {
    return true;
  }
  if (!user.puede_escribir) return false;
  if (!modulo) return true;
  return !user.modulos_solo_lectura.includes(modulo);
}

/** Agricultura/arrendamientos del simulador: gestor N2 usa módulo simulador si no tiene ventas. */
function effectiveModuloForPath(user: UserPublic, path: string): Modulo | null {
  const p = path.toLowerCase();
  if (p === "/api/documentos-digitales/parse-brou-transferencia") {
    return "presupuesto";
  }
  if (p === "/api/documentos-digitales/leer-comprobante") {
    return "presupuesto";
  }
  const modulo = moduleFromApiPath(path);
  if (!modulo) return null;
  if (
    modulo === "ventas" &&
    (p.startsWith("/api/ingresos-ventas/ventas-agricultura") ||
      p.startsWith("/api/ingresos-ventas/ventas-arrendamientos")) &&
    !user.permisos.includes("ventas")
  ) {
    return "simulador_venta_ganado";
  }
  return modulo;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPublic;
    }
  }
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
  });
}

/** Potreros, marcadores y tareas operativas: datos compartidos por cuenta. */
function isCampoMapaApiPath(path: string): boolean {
  const p = path.toLowerCase();
  return (
    p.startsWith("/api/campo-potreros") ||
    p.startsWith("/api/campo-mapa-elementos") ||
    p.startsWith("/api/operativa-tareas")
  );
}

export function moduleFromApiPath(path: string): Modulo | null {
  if (path === "/api/auth/actividad/pantalla") return null;
  const p = path.toLowerCase();
  if (
    p.startsWith("/api/auth/users") ||
    p.startsWith("/api/auth/role-permissions") ||
    p.startsWith("/api/auth/stock-movimientos") ||
    p.startsWith("/api/auth/actividad") ||
    p.startsWith("/api/empresas-cuenta")
  ) {
    return "usuarios";
  }
  if (p.startsWith("/api/presupuesto") || p.startsWith("/api/resumen") || p.startsWith("/api/vencimientos-impuestos")) {
    return "presupuesto";
  }
  if (
    p.startsWith("/api/proveedores") ||
    p.startsWith("/api/rubros") ||
    p.startsWith("/api/sub-rubros") ||
    p.startsWith("/api/sub-rubro-items") ||
    p.startsWith("/api/grupo-iconos") ||
    p.startsWith("/api/rubro-vinculos") ||
    p.startsWith("/api/responsables")
  ) {
    return "configuracion";
  }
  if (p.startsWith("/api/divisas")) return "divisas";
  if (p.startsWith("/api/precios-ganado")) return "precios_ganado";
  if (p.startsWith("/api/simulador-venta-ganado")) return "simulador_venta_ganado";
  if (p.startsWith("/api/chat")) return "chat";
  if (p.startsWith("/api/funcionarios") || p.startsWith("/api/rrhh")) {
    return "rrhh";
  }
  if (
    p.startsWith("/api/ingresos-ventas") ||
    p.startsWith("/api/venta-sub-rubros") ||
    p.startsWith("/api/venta-sub-rubro-items") ||
    p.startsWith("/api/venta-grupo-iconos")
  ) {
    return "ventas";
  }
  if (p.startsWith("/api/stock-ganadero")) return "stock";
  if (p.startsWith("/api/stock-equino")) return "stock";
  if (isCampoMapaApiPath(p)) return "stock";
  if (p.startsWith("/api/documentos-digitales")) return "documentos_digitales";
  if (p.startsWith("/api/catalogos") || p.startsWith("/api/empresas-operativas")) {
    return "presupuesto";
  }
  return null;
}

// Caché en memoria del usuario resuelto por token de sesión. Colapsa la ráfaga
// de requests GET del inicio (que dispara ~10 llamadas a la vez) en una sola
// reconstrucción de toUserPublic, aliviando el pool chico de Postgres. TTL corto;
// cualquier escritura invalida la entrada para no servir datos stale.
const SESSION_USER_CACHE_TTL_MS = 5_000;
const sessionUserCache = new Map<string, { user: UserPublic; exp: number }>();

function getCachedSessionUser(token: string): UserPublic | null {
  const hit = sessionUserCache.get(token);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    sessionUserCache.delete(token);
    return null;
  }
  return hit.user;
}

function setCachedSessionUser(token: string, user: UserPublic): void {
  sessionUserCache.set(token, { user, exp: Date.now() + SESSION_USER_CACHE_TTL_MS });
  if (sessionUserCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of sessionUserCache) {
      if (v.exp <= now) sessionUserCache.delete(k);
    }
  }
}

export function invalidateSessionUserCache(token?: string): void {
  if (token) sessionUserCache.delete(token);
  else sessionUserCache.clear();
}

// De-duplicación de resoluciones en vuelo: el dashboard dispara ~10 requests GET
// a la vez y, sin esto, cada una arranca su propio toUserPublic (~15 queries)
// contra un pool de 5 conexiones → saturación y timeouts. Con esto, la ráfaga
// concurrente comparte UNA sola resolución por token.
const sessionUserInflight = new Map<string, Promise<UserPublic | null>>();

async function resolveSessionUser(
  db: ReturnType<typeof getDb>,
  token: string,
): Promise<UserPublic | null> {
  const cached = getCachedSessionUser(token);
  if (cached) return cached;

  const inflight = sessionUserInflight.get(token);
  if (inflight) return inflight;

  const p = (async () => {
    const u = await authDb.getUserBySessionToken(db, token);
    if (u) setCachedSessionUser(token, u);
    return u;
  })();
  sessionUserInflight.set(token, p);
  try {
    return await p;
  } finally {
    sessionUserInflight.delete(token);
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path;

  if (!path.startsWith("/api")) {
    next();
    return;
  }

  if (
    PUBLIC_PATHS.has(path) ||
    path === "/api/auth/login" ||
    path === "/api/auth/me" ||
    path === "/api/auth/logout" ||
    path === "/api/auth/forgot-password" ||
    path === "/api/auth/reset-password" ||
    path === "/api/auth/reset-password/validate" ||
    path === "/api/billing/mercadopago/webhook"
  ) {
    next();
    return;
  }

  const db = getDb();
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!isValidSessionTokenFormat(token)) {
    res.status(401).json({ ok: false, error: "Sesión no válida o expirada" });
    return;
  }

  const isGet = req.method === "GET";
  let user: UserPublic | null;
  if (isGet) {
    user = await resolveSessionUser(db, token!);
  } else {
    // Las escrituras invalidan el caché y reconstruyen el usuario fresco.
    invalidateSessionUserCache(token!);
    user = await authDb.getUserBySessionToken(db, token);
  }

  if (!user) {
    res.status(401).json({ ok: false, error: "Sesión no válida o expirada" });
    return;
  }

  req.user = user;

  touchUserPresence(user, { ip: clientIp(req) });

  attachApiActivityLogger(req, res);

  const modulo = effectiveModuloForPath(user, path);
  const stockDispositivosLectura =
    req.method === "GET" &&
    (path.startsWith("/api/stock-ganadero/dispositivos") ||
      path.startsWith("/api/stock-equino/dispositivos"));
  const empresasOperativasLectura =
    req.method === "GET" && path.startsWith("/api/empresas-operativas");
  const tiposGastoLectura =
    req.method === "GET" && path.startsWith("/api/documentos-digitales/tipos-gasto");
  const actividadLectura =
    req.method === "GET" &&
    (path === "/api/auth/actividad" || path === "/api/auth/actividad/online");

  if (
    modulo &&
    !canAccessModulo(user, modulo) &&
    !stockDispositivosLectura &&
    !actividadLectura &&
    !(
      empresasOperativasLectura &&
      (canAccessModulo(user, "presupuesto") || canAccessModulo(user, "stock"))
    ) &&
    !(tiposGastoLectura && canAccessModulo(user, "presupuesto"))
  ) {
    res.status(403).json({ ok: false, error: "Sin permiso para este módulo" });
    return;
  }

  if (
    modulo &&
    WRITE_METHODS.has(req.method.toUpperCase()) &&
    !canWriteInModulo(user, modulo)
  ) {
    const mapaColaborativo =
      isCampoMapaApiPath(path) && canAccessModulo(user, modulo);
    if (!mapaColaborativo) {
      res.status(403).json({
        ok: false,
        error:
          user.rol === "gestor_n2" && modulo === "divisas"
            ? "Gestor N2 solo puede consultar divisas, no modificarlas"
            : "Tu rol solo permite consultar datos, no modificarlos",
      });
      return;
    }
  }

  next();
}

function parseActividadAmbito(raw: unknown): authDb.ActividadAmbito | undefined {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "total") return "total";
  if (v === "cuenta") return "cuenta";
  return undefined;
}

function parseActividadCuentaId(raw: unknown): number | undefined {
  if (raw == null || String(raw).trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

async function requireCuentaAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (req.user.es_super_admin || req.user.es_admin_plataforma) return true;
  if (req.user.es_admin_cuenta) return true;
  const cuenta = await empresasCuenta.getEmpresaCuentaByAdminUserId(
    getDb(),
    req.user.id
  );
  if (cuenta) return true;
  res.status(403).json({
    ok: false,
    error: "Solo el administrador de la cuenta puede gestionar usuarios",
  });
  return false;
}

async function assertUserInCuentaScope(
  actor: UserPublic,
  target: UserPublic,
  res: Response
): Promise<boolean> {
  if (actor.es_super_admin || actor.es_admin_plataforma) return true;
  const cuenta = await empresasCuenta.getEmpresaCuentaByAdminUserId(getDb(), actor.id);
  if (!cuenta) {
    res.status(403).json({ ok: false, error: "Sin permiso sobre este usuario" });
    return false;
  }
  const inScope =
    target.empresa_id === cuenta.id || target.id === cuenta.admin_user_id;
  if (!inScope) {
    res.status(403).json({ ok: false, error: "Sin permiso sobre este usuario" });
    return false;
  }
  return true;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return false;
  }
  return true;
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.user?.es_super_admin && !req.user?.es_admin_plataforma) {
    res.status(403).json({
      ok: false,
      error: "Solo el administrador del sistema puede realizar esta acción",
    });
    return false;
  }
  return true;
}

function puedeVerIpActividad(user: UserPublic): boolean {
  return Boolean(user.es_super_admin);
}

function ocultarIpActividad<T extends { ip?: string | null }>(user: UserPublic, items: T[]): T[] {
  if (puedeVerIpActividad(user)) return items;
  return items.map((item) => ({ ...item, ip: null }));
}

async function cuentaIdDelActor(req: Request): Promise<number | null> {
  if (!req.user) return null;
  return empresasCuenta.resolveCuentaMadreIdForUser(getDb(), req.user);
}

async function assertAccesoCuentaPropia(
  req: Request,
  res: Response,
  cuentaId: number
): Promise<boolean> {
  const actor = req.user;
  if (!actor) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return false;
  }
  if (actor.es_super_admin || actor.es_admin_plataforma) return true;
  const propia = await cuentaIdDelActor(req);
  if (propia === cuentaId) return true;
  if (actor.es_admin_cuenta && actor.empresa_id === cuentaId) return true;
  res.status(403).json({ ok: false, error: "Sin permiso sobre esta cuenta" });
  return false;
}

async function assertListUsersCuenta(
  actor: UserPublic,
  res: Response,
  cuentaId: number
): Promise<Awaited<ReturnType<typeof empresasCuenta.getEmpresaCuentaById>> | null> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(getDb(), cuentaId);
  if (!cuenta) {
    res.status(404).json({ ok: false, error: "Cuenta no encontrada" });
    return null;
  }
  if (actor.es_admin_plataforma || actor.es_super_admin) return cuenta;
  const propia = await empresasCuenta.getEmpresaCuentaByAdminUserId(getDb(), actor.id);
  if (propia?.id === cuentaId) return cuenta;
  if (actor.es_admin_cuenta && actor.empresa_id === cuentaId) return cuenta;
  res.status(403).json({
    ok: false,
    error: "Sin permiso para listar usuarios de esta cuenta",
  });
  return null;
}

function assertUserInScope(
  actor: UserPublic,
  target: UserPublic,
  res: Response
): boolean {
  if (actor.es_super_admin) return true;
  if (!actor.empresa_id) {
    res.status(403).json({ ok: false, error: "Sin permiso sobre este usuario" });
    return false;
  }
  if (target.empresa_id !== actor.empresa_id) {
    res.status(403).json({ ok: false, error: "Sin permiso sobre este usuario" });
    return false;
  }
  return true;
}

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().slice(0, 254);
      const password = String(req.body?.password ?? "").slice(0, 128);

      if (!email || !password) {
        res.status(400).json({ ok: false, error: "Email y contraseña requeridos" });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: "Email o contraseña incorrectos" });
        return;
      }

      const db = getDb();
      const ip = clientIp(req);
      const result = await authDb.verifyLogin(db, email, password, {
        ip,
        userAgent: req.headers["user-agent"],
      });

      if (!result.ok) {
        await artificialLoginDelay();
        const msg =
          result.reason === "locked"
            ? "Cuenta bloqueada temporalmente por intentos fallidos. Probá más tarde."
            : "Email o contraseña incorrectos";
        res.status(401).json({ ok: false, error: msg });
        return;
      }

      const token = await authDb.createSession(db, result.user.id, {
        ip,
        userAgent: req.headers["user-agent"],
      });

      // En modo "individual" se pregunta la empresa en cada inicio de sesión.
      // Excepción: si la cuenta tiene una sola empresa, se entra directo a ella
      // (no tiene sentido preguntar cuando no hay alternativas).
      let sessionUser = result.user;
      if (sessionUser.login_mode === "individual") {
        const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(db, sessionUser);
        const empresas = cuentaId
          ? (await empresasCuenta.listEmpresasOperativas(db, cuentaId)).filter((e) => e.activo)
          : [];
        const empresaActivaId = empresas.length === 1 ? empresas[0].id : null;
        await authDb.setEmpresaActiva(db, sessionUser.id, empresaActivaId);
        const refreshed = await authDb.getUserById(db, sessionUser.id);
        if (refreshed) sessionUser = refreshed;
      }

      res.cookie(SESSION_COOKIE, token, cookieOptions());
      touchUserPresence(sessionUser, {
        ip,
        pantalla: PANTALLA_LABELS.home,
      });
      res.json({ ok: true, data: sessionUser });
    } catch (e) {
      console.error("[SGG Auth] Error en login:", e);
      if (isDbCapacityError(e)) {
        res.status(503).json({
          ok: false,
          error: "Base de datos saturada",
          hint: dbCapacityHint(),
          ...(clientSafeErrorDetail(e) ? { detail: clientSafeErrorDetail(e) } : {}),
        });
        return;
      }
      res.status(500).json({
        ok: false,
        error: "Error al iniciar sesión",
        ...(clientSafeErrorDetail(e) ? { detail: clientSafeErrorDetail(e) } : {}),
      });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    let user: UserPublic | null = null;
    if (token) {
      user = await authDb.getUserBySessionToken(getDb(), token);
      await authDb.deleteSession(getDb(), token);
      invalidateSessionUserCache(token);
    }
    if (user) {
      markUserPresenceDisconnected(user.email);
      await recordUserActivity(user, "logout", "Cierre de sesión", {
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!isValidSessionTokenFormat(token)) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const user = await resolveSessionUser(getDb(), token!);
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    touchUserPresence(user, { ip: clientIp(req) });
    res.json({ ok: true, data: user });
  });

  const FORGOT_PASSWORD_MESSAGE =
    "Si el email está registrado en el sistema, recibirás un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada y la carpeta de spam.";

  app.post("/api/auth/forgot-password", loginRateLimiter, async (req, res) => {
    try {
      const email = String(req.body?.email ?? "").trim().slice(0, 254);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: "Ingresá un email válido" });
        return;
      }

      const db = getDb();
      const ip = clientIp(req);
      const user = await authDb.findActiveUserByEmail(db, email);

      let devPreview:
        | { reset_url: string; email_preview_url?: string }
        | undefined;

      if (user) {
        const rawToken = await authDb.createPasswordResetToken(db, user.id, { ip });
        const resetUrl = buildPasswordResetUrl(
          rawToken,
          clientPublicOriginFromRequest(req)
        );
        try {
          const mailResult = await sendPasswordResetEmail({
            to: user.email,
            nombre: user.nombre,
            resetUrl,
          });
          if (process.env.NODE_ENV !== "production") {
            devPreview = {
              reset_url: resetUrl,
              email_preview_url: mailResult.emailPreviewUrl,
            };
          }
        } catch (mailErr) {
          console.error("[SGG Auth] No se pudo enviar email de recuperación:", mailErr);
          const msg = mailErr instanceof Error ? mailErr.message : "";
          if (process.env.NODE_ENV !== "production") {
            devPreview = { reset_url: resetUrl };
          } else {
            const userMessage = msg.includes("Servicio de email no configurado")
              ? "El envío de correos no está configurado en el servidor. Contactá al administrador del sistema."
              : msg.toLowerCase().includes("only send testing emails") ||
                  msg.toLowerCase().includes("verify a domain")
                ? "El correo de recuperación no está habilitado para todos los usuarios. El administrador debe verificar un dominio en Resend."
                : "No se pudo enviar el correo en este momento. Intentá más tarde o contactá al administrador.";
            res.status(503).json({ ok: false, error: userMessage });
            return;
          }
        }
        await authDb.recordAuthEvent(db, "password_reset_requested", {
          email: user.email,
          ip,
          userAgent: req.headers["user-agent"],
        });
      }

      await artificialLoginDelay();
      res.json({
        ok: true,
        message: FORGOT_PASSWORD_MESSAGE,
        ...(devPreview ? { dev_preview: devPreview } : {}),
      });
    } catch (e) {
      console.error("[SGG Auth] Error en forgot-password:", e);
      res.status(500).json({
        ok: false,
        error: "No se pudo procesar la solicitud. Intentá nuevamente más tarde.",
      });
    }
  });

  app.get("/api/auth/reset-password/validate", async (req, res) => {
    try {
      const token = String(req.query.token ?? "").trim().slice(0, 128);
      if (!isValidSessionTokenFormat(token)) {
        res.json({ ok: true, data: { valid: false, reason: "invalid" } });
        return;
      }
      const status = await authDb.peekPasswordResetToken(getDb(), token);
      res.json({
        ok: true,
        data: { valid: status === "valid", reason: status },
      });
    } catch (e) {
      console.error("[SGG Auth] Error al validar token de reset:", e);
      res.status(500).json({ ok: false, error: "Error al validar enlace" });
    }
  });

  app.post("/api/auth/reset-password", loginRateLimiter, async (req, res) => {
    try {
      const token = String(req.body?.token ?? "").trim().slice(0, 128);
      const password_nueva = String(req.body?.password_nueva ?? "").slice(0, 128);

      if (!isValidSessionTokenFormat(token)) {
        res.status(400).json({
          ok: false,
          error: "El enlace de recuperación no es válido. Solicitá uno nuevo.",
        });
        return;
      }
      if (!password_nueva) {
        res.status(400).json({ ok: false, error: "Ingresá la nueva contraseña" });
        return;
      }

      const db = getDb();
      const result = await authDb.resetPasswordWithToken(db, token, password_nueva);

      if (!result.ok) {
        const msg =
          result.reason === "expired"
            ? "El enlace expiró. Solicitá uno nuevo desde la pantalla de inicio de sesión."
            : result.reason === "used"
              ? "Este enlace ya fue utilizado. Solicitá uno nuevo si necesitás cambiar la contraseña."
              : "El enlace de recuperación no es válido. Solicitá uno nuevo.";
        res.status(400).json({ ok: false, error: msg });
        return;
      }

      await authDb.recordAuthEvent(db, "password_reset_completed", {
        email: result.email,
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });

      res.json({
        ok: true,
        message: "Contraseña actualizada. Ya podés iniciar sesión con tu nueva contraseña.",
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al restablecer contraseña",
      });
    }
  });

  app.post("/api/auth/cambiar-password", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (!isValidSessionTokenFormat(token)) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const user = await authDb.getUserBySessionToken(getDb(), token);
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }

    try {
      const rate = hitPasswordChangeRateLimit(user.id);
      if (rate.blocked) {
        res.setHeader("Retry-After", String(rate.retryAfterSec));
        res.status(429).json({
          ok: false,
          error: "Demasiados intentos. Esperá unos minutos e intentá de nuevo.",
        });
        return;
      }

      const actual = String(req.body?.password_actual ?? "").slice(0, 128);
      const nueva = String(req.body?.password_nueva ?? "").slice(0, 128);
      await authDb.changeOwnPassword(getDb(), user.id, actual, nueva);
      await recordUserActivity(user, "password_changed", "Cambió su contraseña", {
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });
      clearSessionCookie(res);
      res.json({
        ok: true,
        message: "Contraseña actualizada. Iniciá sesión nuevamente.",
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cambiar contraseña",
      });
    }
  });

  app.get("/api/auth/avatar/:userId/imagen", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) {
      res.status(400).json({ ok: false, error: "ID inválido" });
      return;
    }
    const target = await authDb.getUserById(getDb(), userId);
    if (!target?.activo) {
      res.status(404).json({ ok: false, error: "Usuario no encontrado" });
      return;
    }
    if (!(await canViewUserProfilePhoto(user, userId))) {
      res.status(403).json({ ok: false, error: "No autorizado" });
      return;
    }
    const image = await loadUserAvatarImage(getDb(), userId);
    if (!image) {
      res.status(404).json({ ok: false, error: "Sin foto de perfil" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-cache");
    res.type(image.mime).send(image.buffer);
  });

  app.post(
    "/api/auth/avatar/foto",
    avatarUpload.single("foto"),
    async (req, res) => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ ok: false, error: "No autenticado" });
        return;
      }
      try {
        const file = req.file;
        if (!file?.buffer?.length) {
          res.status(400).json({ ok: false, error: "Seleccioná una imagen" });
          return;
        }
        await saveUserAvatarFoto(getDb(), user.id, file.buffer, file.mimetype);
        const updated = await authDb.getUserById(getDb(), user.id);
        if (!updated) {
          res.status(404).json({ ok: false, error: "Usuario no encontrado" });
          return;
        }
        res.json({ ok: true, data: updated });
      } catch (e) {
        res.status(400).json({
          ok: false,
          error: e instanceof Error ? e.message : "Error al subir foto",
        });
      }
    }
  );

  app.delete("/api/auth/avatar", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      await clearUserAvatar(getDb(), user.id);
      const updated = await authDb.getUserById(getDb(), user.id);
      if (!updated) {
        res.status(404).json({ ok: false, error: "Usuario no encontrado" });
        return;
      }
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al quitar foto",
      });
    }
  });

  app.get("/api/auth/users", async (req, res) => {
    const actor = req.user!;
    const ambito = String(req.query.ambito ?? "").trim().toLowerCase();

    if (ambito === "actividad_total") {
      if (!empresasCuenta.isPrimaryPlatformAdmin(actor)) {
        res.status(403).json({
          ok: false,
          error: "Solo el superadministrador de plataforma puede listar todos los usuarios",
        });
        return;
      }
      const cuentaIdRaw = req.query.cuenta_id;
      const cuentaId =
        cuentaIdRaw != null && String(cuentaIdRaw).trim() !== ""
          ? Number(cuentaIdRaw)
          : null;
      if (cuentaId != null && Number.isFinite(cuentaId)) {
        const cuenta = await empresasCuenta.getEmpresaCuentaById(getDb(), cuentaId);
        if (!cuenta) {
          res.status(404).json({ ok: false, error: "Cuenta no encontrada" });
          return;
        }
        res.json({
          ok: true,
          data: await authDb.listUsers(getDb(), {
            empresa_id: cuentaId,
            incluir_admin_id: cuenta.admin_user_id,
          }),
        });
        return;
      }
      res.json({ ok: true, data: await authDb.listUsers(getDb()) });
      return;
    }

    if (ambito === "propio") {
      res.json({ ok: true, data: [actor] });
      return;
    }

    if (ambito === "mi_cuenta") {
      const cuentaId =
        actor.cuenta_actividad_id ??
        (await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor));
      if (!cuentaId) {
        res.json({ ok: true, data: [actor] });
        return;
      }
      const cuenta = await empresasCuenta.getEmpresaCuentaById(getDb(), cuentaId);
      const users = await authDb.listUsers(getDb(), {
        empresa_id: cuentaId,
        incluir_admin_id: cuenta?.admin_user_id ?? null,
      });
      res.json({
        ok: true,
        data: users.filter((u) => u.activo),
      });
      return;
    }

    const empresaIdRaw = req.query.empresa_id ?? req.query.cuenta_id;
    const empresaId =
      empresaIdRaw != null && String(empresaIdRaw).trim() !== ""
        ? Number(empresaIdRaw)
        : null;
    if (empresaId != null && Number.isFinite(empresaId)) {
      const cuenta = await assertListUsersCuenta(actor, res, empresaId);
      if (!cuenta) return;
      res.json({
        ok: true,
        data: await authDb.listUsers(getDb(), {
          empresa_id: cuenta.id,
          incluir_admin_id: cuenta.admin_user_id,
        }),
      });
      return;
    }

    if (!(await requireCuentaAdmin(req, res))) return;
    const cuenta = await empresasCuenta.getEmpresaCuentaByAdminUserId(
      getDb(),
      actor.id
    );
    if (!cuenta) {
      res.status(403).json({
        ok: false,
        error: "Solo el administrador de la cuenta puede gestionar usuarios",
      });
      return;
    }
    res.json({
      ok: true,
      data: await authDb.listUsers(getDb(), {
        empresa_id: cuenta.id,
        incluir_admin_id: cuenta.admin_user_id,
      }),
    });
  });

  app.post("/api/auth/users", async (req, res) => {
    if (!(await requireCuentaAdmin(req, res))) return;
    try {
      const actor = req.user!;
      const body = req.body ?? {};
      const data: authDb.UserInput = {
        email: String(body.email ?? ""),
        nombre: String(body.nombre ?? ""),
        rol: body.rol as authDb.Rol,
        password: String(body.password ?? ""),
        activo: body.activo !== false,
      };
      if (!authDb.isValidRol(data.rol)) {
        res.status(400).json({ ok: false, error: "Rol inválido" });
        return;
      }

      if (actor.es_super_admin) {
        if (body.empresa_id !== undefined && body.empresa_id !== null) {
          data.empresa_id = Number(body.empresa_id);
        } else {
          const propia = await empresasCuenta.getEmpresaCuentaByAdminUserId(
            getDb(),
            actor.id
          );
          data.empresa_id = propia?.id ?? null;
        }
      } else {
        const propia = await empresasCuenta.getEmpresaCuentaByAdminUserId(
          getDb(),
          actor.id
        );
        data.empresa_id = propia?.id ?? actor.empresa_id ?? null;
      }

      if (data.empresa_id == null) {
        res.status(403).json({ ok: false, error: "Sin permiso para crear usuarios" });
        return;
      }

      const user = await authDb.insertUser(getDb(), data);
      await authDb.recordAuthEvent(getDb(), "user_created", {
        email: user.email,
        detalle: `rol=${user.rol}`,
      });
      res.status(201).json({ ok: true, data: user });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear usuario",
      });
    }
  });

  app.patch("/api/auth/users/:id", async (req, res) => {
    if (!(await requireCuentaAdmin(req, res))) return;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }

      const body = req.body ?? {};
      const updateData: Partial<authDb.UserInput> = {};
      if (body.email !== undefined) updateData.email = String(body.email);
      if (body.nombre !== undefined) updateData.nombre = String(body.nombre);
      if (body.rol !== undefined) {
        if (!authDb.isValidRol(body.rol)) {
          res.status(400).json({ ok: false, error: "Rol inválido" });
          return;
        }
        updateData.rol = body.rol;
      }
      if (body.activo !== undefined) updateData.activo = Boolean(body.activo);
      if (body.password) updateData.password = String(body.password);

      const current = await authDb.getUserById(getDb(), id);
      if (!current) {
        res.status(404).json({ ok: false, error: "Usuario no encontrado" });
        return;
      }

      if (!(await assertUserInCuentaScope(req.user!, current, res))) return;

      if (body.empresa_id !== undefined && req.user!.es_super_admin) {
        updateData.empresa_id =
          body.empresa_id === null ? null : Number(body.empresa_id);
      }

      if (
        updateData.activo === false &&
        current.rol === "admin" &&
        await authDb.countActiveAdmins(getDb(), id) === 0
      ) {
        res.status(400).json({
          ok: false,
          error: "Debe quedar al menos un administrador activo",
        });
        return;
      }

      if (
        updateData.rol &&
        updateData.rol !== "admin" &&
        current.rol === "admin" &&
        await authDb.countActiveAdmins(getDb(), id) === 0
      ) {
        res.status(400).json({
          ok: false,
          error: "Debe quedar al menos un administrador activo",
        });
        return;
      }

      const user = await authDb.updateUser(getDb(), id, updateData);
      await recordUserActivity(req.user!, "user_updated", `Actualizó usuario: ${user.email}`, {
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });
      res.json({ ok: true, data: user });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al actualizar usuario",
      });
    }
  });

  app.get("/api/auth/actividad/online", async (req, res) => {
    const actor = req.user;
    if (!actor) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const db = getDb();
    const allowedIds = await authDb.resolveActividadOnlineUserIds(
      db,
      actor,
      parseActividadAmbito(req.query.ambito),
      parseActividadCuentaId(req.query.cuenta_id)
    );
    const filterAllowed = (users: ReturnType<typeof listOnlineUsers>) =>
      users.filter((u) => allowedIds === null || allowedIds.includes(u.id));

    const enrichPresenceUsers = async (
      base: ReturnType<typeof listOnlineUsers>
    ) => {
      const data = [];
      for (const u of base) {
        const row = (await db
          .prepare(
            `SELECT id, avatar_tipo, avatar_archivo, actualizado_en FROM USERS WHERE id = ?`
          )
          .get(u.id)) as {
          id: number;
          avatar_tipo?: string;
          avatar_archivo?: string;
          actualizado_en?: string;
        } | undefined;
        data.push({
          ...u,
          avatar: row
            ? avatarDtoFromRow(row.id, row)
            : { tipo: "iniciales" as const, url: null },
        });
      }
      return data;
    };

    res.json({
      ok: true,
      data: {
        online: ocultarIpActividad(
          actor,
          await enrichPresenceUsers(filterAllowed(listOnlineUsers()))
        ),
        recently_offline: ocultarIpActividad(
          actor,
          await enrichPresenceUsers(filterAllowed(listRecentlyOfflineUsers()))
        ),
        stale_offline: ocultarIpActividad(
          actor,
          await enrichPresenceUsers(filterAllowed(listStaleOfflineUsers()))
        ),
      },
    });
  });

  app.post("/api/auth/presencia", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const pantalla = String(req.body?.pantalla ?? "").trim().slice(0, 120) || undefined;
    touchUserPresence(user, {
      ip: clientIp(req),
      pantalla: pantalla ? (PANTALLA_LABELS[pantalla] ?? pantalla) : undefined,
    });
    res.json({ ok: true });
  });

  app.get("/api/auth/actividad", async (req, res) => {
    const actor = req.user;
    if (!actor) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      const email = String(req.query.email ?? "").trim() || undefined;
      const evento = String(req.query.evento ?? "").trim() || undefined;
      const limite = req.query.limite ? Number(req.query.limite) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const ambito = parseActividadAmbito(req.query.ambito);
      const cuentaId = parseActividadCuentaId(req.query.cuenta_id);
      const feedHome = String(req.query.feed ?? "").trim().toLowerCase() === "home";
      const scopeResult = await authDb.resolveAuthAuditLogScope(
        getDb(),
        actor,
        email,
        ambito,
        cuentaId
      );
      if (!scopeResult.ok) {
        res.status(403).json({ ok: false, error: scopeResult.error });
        return;
      }
      const baseFilters = {
        email: scopeResult.filters.email,
        scope: scopeResult.filters.scope,
      };
      const page = feedHome
        ? await listHomeFeedActivity(
            getDb(),
            baseFilters,
            Number.isFinite(limite) ? limite! : 7
          )
        : await authDb.listAuthAuditLog(getDb(), {
            ...baseFilters,
            evento,
            limite: Number.isFinite(limite) ? limite : undefined,
            offset: Number.isFinite(offset) ? offset : undefined,
          });
      res.json({
        ok: true,
        data: ocultarIpActividad(actor, page.rows),
        total: page.total,
        resumen: page.resumen,
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar actividad",
      });
    }
  });

  app.post("/api/auth/actividad/pantalla", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      const pantalla = String(req.body?.pantalla ?? "").trim().slice(0, 64);
      if (!pantalla) {
        res.status(400).json({ ok: false, error: "Pantalla requerida" });
        return;
      }
      const label = PANTALLA_LABELS[pantalla] ?? pantalla;
      touchUserPresence(user, { ip: clientIp(req), pantalla: label });
      await recordUserActivity(user, "navegacion", formatNavegacionDetalle(label), {
        ip: clientIp(req),
        userAgent: req.headers["user-agent"],
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al registrar navegación",
      });
    }
  });

  app.get("/api/auth/stock-movimientos", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const actor = req.user!;
      const db = getDb();
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(db, actor);
      const allowedUserIds = cuentaId
        ? await authDb.listUserIdsForCuentaMadre(db, cuentaId)
        : [actor.id];

      const userIdRaw = req.query.user_id;
      const user_id =
        userIdRaw !== undefined && userIdRaw !== ""
          ? Number(userIdRaw)
          : undefined;
      if (
        user_id !== undefined &&
        Number.isFinite(user_id) &&
        !allowedUserIds.includes(user_id)
      ) {
        res.status(403).json({ ok: false, error: "Usuario fuera de su cuenta" });
        return;
      }
      const tipoRaw = String(req.query.tipo ?? "").toUpperCase();
      const tipo =
        tipoRaw === "ALTA" || tipoRaw === "BAJA" || tipoRaw === "MODIFICACION"
          ? (tipoRaw as StockMovimientoTipo)
          : undefined;
      const limite = req.query.limite ? Number(req.query.limite) : undefined;
      const data = await stockAuditoria.list({
        user_id: Number.isFinite(user_id) ? user_id : undefined,
        user_ids_in: allowedUserIds,
        tipo,
        limite: Number.isFinite(limite) ? limite : undefined,
      });

      let usuarios: Array<{ id: number; nombre: string; email: string }> = [];
      if (cuentaId) {
        const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
        const users = await authDb.listUsers(db, {
          empresa_id: cuentaId,
          incluir_admin_id: cuenta?.admin_user_id ?? null,
        });
        usuarios = users.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          email: u.email,
        }));
      } else {
        usuarios = [
          { id: actor.id, nombre: actor.nombre, email: actor.email },
        ];
      }

      res.json({ ok: true, data, usuarios });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar movimientos",
      });
    }
  });

  app.get("/api/auth/role-permissions", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ ok: true, data: await authDb.listRolePermissions(getDb()) });
  });

  app.patch("/api/auth/role-permissions/:rol", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const rol = String(req.params.rol) as authDb.Rol;
      if (!authDb.isValidRol(rol)) {
        res.status(400).json({ ok: false, error: "Rol inválido" });
        return;
      }
      const body = req.body ?? {};
      const updated = await authDb.updateRolePermissions(getDb(), rol, {
        puede_escribir: Boolean(body.puede_escribir),
        modulos: body.modulos ?? {},
        modulos_solo_lectura: body.modulos_solo_lectura ?? {},
      });
      await authDb.recordAuthEvent(getDb(), "role_permissions_updated", {
        detalle: `rol=${rol}`,
      });
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar permisos",
      });
    }
  });

  app.get("/api/auth/home-layout", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const homeLayoutDb = await import("./home-layout-db.js");
    res.json({ ok: true, data: await homeLayoutDb.listHomeLayoutConfig(getDb()) });
  });

  app.get("/api/auth/home-layout/monitor", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const monitorDb = await import("./home-layout-monitor-db.js");
    res.json({ ok: true, data: await monitorDb.getHomeLayoutMonitorSnapshot(getDb()) });
  });

  app.get("/api/auth/home-layout/monitor/:userId", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ ok: false, error: "Usuario inválido" });
      return;
    }
    const monitorDb = await import("./home-layout-monitor-db.js");
    const detalle = await monitorDb.getHomeLayoutMonitorUsuario(getDb(), userId);
    if (!detalle) {
      res.status(404).json({ ok: false, error: "Usuario no encontrado" });
      return;
    }
    res.json({ ok: true, data: detalle });
  });

  app.get("/api/auth/home-layout/monitor/:userId/campo-mapa", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      res.status(400).json({ ok: false, error: "Usuario inválido" });
      return;
    }
    try {
      const monitorDb = await import("./home-layout-monitor-db.js");
      const data = await monitorDb.getHomeLayoutMonitorCampoMapa(getDb(), userId);
      if (!data) {
        res.status(404).json({ ok: false, error: "Usuario no encontrado" });
        return;
      }
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar mapa del campo",
      });
    }
  });

  app.patch("/api/auth/home-layout/:rol", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const homeLayoutDb = await import("./home-layout-db.js");
      const rol = String(req.params.rol) as authDb.Rol;
      if (!homeLayoutDb.HOME_LAYOUT_ROLES.includes(rol)) {
        res.status(400).json({ ok: false, error: "Rol no configurable para el inicio" });
        return;
      }
      const updated = await homeLayoutDb.updateHomeLayoutForRole(
        getDb(),
        rol,
        req.body?.paneles ?? {},
        req.body?.orden,
      );
      await authDb.recordAuthEvent(getDb(), "home_layout_updated", {
        detalle: `rol=${rol}`,
      });
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar inicio",
      });
    }
  });

  app.get("/api/auth/my-home-layout", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const homeLayoutDb = await import("./home-layout-db.js");
    res.json({
      ok: true,
      data: await homeLayoutDb.getUserHomeLayoutConfig(getDb(), user.id, user.rol),
    });
  });

  app.patch("/api/auth/my-home-layout", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      const homeLayoutDb = await import("./home-layout-db.js");
      const config = await homeLayoutDb.updateUserHomeLayout(
        getDb(),
        user.id,
        user.rol,
        req.body?.paneles ?? {},
        req.body?.orden,
      );
      const updated = await authDb.getUserById(getDb(), user.id);
      res.json({ ok: true, data: { config, user: updated } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar tu inicio",
      });
    }
  });

  app.get("/api/auth/platform-notifications", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      res.json({ ok: true, data: await platformNotif.listPlatformNotificationsAdmin(getDb()) });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar notificaciones",
      });
    }
  });

  app.post("/api/auth/platform-notifications", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      const body = req.body ?? {};
      const data = await platformNotif.createPlatformNotification(
        getDb(),
        {
          titulo: String(body.titulo ?? ""),
          mensaje: String(body.mensaje ?? ""),
          fecha_inicio: String(body.fecha_inicio ?? ""),
          fecha_fin: String(body.fecha_fin ?? ""),
          activo: Boolean(body.activo),
        },
        req.user!.id,
      );
      await authDb.recordAuthEvent(getDb(), "platform_notification_created", {
        detalle: `id=${data.id}`,
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear la notificación",
      });
    }
  });

  app.patch("/api/auth/platform-notifications/:id", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Notificación inválida" });
      return;
    }
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      const body = req.body ?? {};
      const data = await platformNotif.updatePlatformNotification(getDb(), id, {
        titulo: String(body.titulo ?? ""),
        mensaje: String(body.mensaje ?? ""),
        fecha_inicio: String(body.fecha_inicio ?? ""),
        fecha_fin: String(body.fecha_fin ?? ""),
        activo: Boolean(body.activo),
      });
      await authDb.recordAuthEvent(getDb(), "platform_notification_updated", {
        detalle: `id=${id}`,
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar la notificación",
      });
    }
  });

  app.get("/api/auth/platform-notifications/:id/recipients", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Notificación inválida" });
      return;
    }
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      const data = await platformNotif.listPlatformNotificationRecipients(getDb(), id);
      res.json({ ok: true, data });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar destinatarios",
      });
    }
  });

  app.delete("/api/auth/platform-notifications/:id", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Notificación inválida" });
      return;
    }
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      await platformNotif.deletePlatformNotification(getDb(), id);
      await authDb.recordAuthEvent(getDb(), "platform_notification_deleted", {
        detalle: `id=${id}`,
      });
      res.json({ ok: true, data: { id } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al eliminar la notificación",
      });
    }
  });

  app.get("/api/platform-notifications/pending", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      const data = await platformNotif.listPendingPlatformNotificationsForUser(
        getDb(),
        user.id,
        user.email,
      );
      res.json({ ok: true, data });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar avisos",
      });
    }
  });

  app.post("/api/platform-notifications/:id/dismiss", async (req, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Notificación inválida" });
      return;
    }
    try {
      const platformNotif = await import("./platform-notifications-db.js");
      await platformNotif.dismissPlatformNotificationForUser(getDb(), user.id, id);
      res.json({ ok: true, data: { id } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al marcar el aviso como leído",
      });
    }
  });

  app.patch("/api/auth/mi-ejercicio", async (req, res) => {
    if (!(await requireCuentaAdmin(req, res))) return;
    const actor = req.user!;
    try {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor);
      if (cuentaId == null) {
        res.status(400).json({
          ok: false,
          error: "No tenés una cuenta asociada para configurar el ejercicio fiscal",
        });
        return;
      }
      await empresasCuenta.updateEjercicioFiscalForCuenta(
        getDb(),
        cuentaId,
        req.body?.inicio_mes,
        req.body?.inicio_dia,
      );
      const updated = await authDb.getUserById(getDb(), actor.id);
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar el ejercicio fiscal",
      });
    }
  });

  app.patch("/api/auth/mi-modo-inicio", async (req, res) => {
    if (!(await requireCuentaAdmin(req, res))) return;
    const actor = req.user!;
    try {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor);
      if (cuentaId == null) {
        res.status(400).json({
          ok: false,
          error: "No tenés una cuenta asociada para configurar el modo de inicio",
        });
        return;
      }
      await empresasCuenta.updateLoginModeForCuenta(getDb(), cuentaId, req.body?.login_mode);
      const updated = await authDb.getUserById(getDb(), actor.id);
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar el modo de inicio",
      });
    }
  });

  app.patch("/api/auth/mi-ejercicio-empresa", async (req, res) => {
    if (!(await requireCuentaAdmin(req, res))) return;
    const actor = req.user!;
    try {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor);
      if (cuentaId == null) {
        res.status(400).json({
          ok: false,
          error: "No tenés una cuenta asociada para configurar el ejercicio fiscal",
        });
        return;
      }
      const rawId = req.body?.empresa_id;
      const empresaId = rawId == null || rawId === "" ? null : Number(rawId);
      await empresasCuenta.updateEjercicioEmpresaPrincipal(getDb(), cuentaId, empresaId);
      const updated = await authDb.getUserById(getDb(), actor.id);
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al configurar el ejercicio fiscal",
      });
    }
  });

  app.get("/api/auth/mis-empresas", async (req, res) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    try {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), req.user);
      if (cuentaId == null) {
        res.json({ ok: true, data: [] });
        return;
      }
      const empresas = (await empresasCuenta.listEmpresasOperativas(getDb(), cuentaId)).filter(
        (e) => e.activo,
      );
      res.json({ ok: true, data: empresas });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al listar empresas",
      });
    }
  });

  app.post("/api/auth/empresa-activa", async (req, res) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "No autenticado" });
      return;
    }
    const actor = req.user;
    try {
      const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor);
      const rawId = req.body?.empresa_id;
      const empresaId =
        rawId == null || rawId === "" ? null : Number(rawId);
      if (empresaId != null) {
        const empresa = await empresasCuenta.getEmpresaActivaForUser(
          getDb(),
          cuentaId,
          empresaId,
        );
        if (!empresa) {
          res.status(400).json({
            ok: false,
            error: "La empresa seleccionada no pertenece a tu cuenta o no está activa",
          });
          return;
        }
      }
      await authDb.setEmpresaActiva(getDb(), actor.id, empresaId);
      const updated = await authDb.getUserById(getDb(), actor.id);
      res.json({ ok: true, data: updated });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al seleccionar la empresa",
      });
    }
  });

  app.get("/api/empresas-cuenta/mi-cuenta", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const actor = req.user!;
    const cuentaId = await empresasCuenta.resolveCuentaMadreIdForUser(getDb(), actor);
    if (!cuentaId) {
      res.status(404).json({ ok: false, error: "No tiene una cuenta asignada" });
      return;
    }
    const cuenta = await empresasCuenta.getEmpresaCuentaById(getDb(), cuentaId);
    if (!cuenta) {
      res.status(404).json({ ok: false, error: "Cuenta no encontrada" });
      return;
    }
    res.json({ ok: true, data: cuenta });
  });

  app.get("/api/empresas-cuenta/resumen-control", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      res.json({ ok: true, data: await summarizeCuentasControlPlataforma(getDb()) });
    } catch (err) {
      console.error("[SGG] resumen-control cuentas:", err);
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "Error al cargar resumen de cuentas",
      });
    }
  });

  app.get("/api/empresas-cuenta", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ ok: true, data: await empresasCuenta.listEmpresasCuenta(getDb()) });
  });

  app.post("/api/empresas-cuenta", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const body = req.body ?? {};
      const adminEmail = String(body.admin_email ?? "").trim();
      if (!adminEmail.includes("@")) {
        res.status(400).json({
          ok: false,
          error: "El email del administrador de la cuenta es obligatorio",
        });
        return;
      }

      const nombre = String(body.nombre ?? "");
      const activo = body.activo !== false;
      const opRaw = body.empresa_operativa ?? {};
      const opNombre = String(opRaw.nombre ?? "").trim();
      const opColor = String(opRaw.color ?? "").trim();
      if (!opNombre) {
        res.status(400).json({
          ok: false,
          error: "La primera empresa operativa (nombre) es obligatoria",
        });
        return;
      }
      if (!opColor) {
        res.status(400).json({
          ok: false,
          error: "Elegí un color para la primera empresa operativa",
        });
        return;
      }

      const db = getDb();
      const tempPassword = authDb.generateInitialPassword();

      const empresa = await db.transaction(async (tx) => {
        const created = await empresasCuenta.insertEmpresaCuenta(tx, {
          nombre,
          activo,
        });
        const adminUser = await authDb.insertUser(tx, {
          email: adminEmail,
          nombre: created.nombre,
          rol: "admin",
          password: tempPassword,
          activo: true,
          empresa_id: created.id,
        });
        const withAdmin = await empresasCuenta.setEmpresaCuentaAdmin(
          tx,
          created.id,
          adminUser.id
        );
        await empresasCuenta.insertEmpresaOperativa(tx, withAdmin.id, {
          nombre: opNombre,
          color: opColor,
          activo: true,
        });
        return (await empresasCuenta.getEmpresaCuentaById(tx, withAdmin.id))!;
      });

      await authDb.recordAuthEvent(getDb(), "empresa_cuenta_created", {
        email: req.user!.email,
        detalle: `empresa=${empresa.nombre};admin=${adminEmail};op=${opNombre}`,
      });
      await authDb.recordAuthEvent(getDb(), "user_created", {
        email: adminEmail,
        detalle: `rol=admin;empresa=${empresa.nombre};auto_alta_cuenta`,
      });

      res.status(201).json({
        ok: true,
        data: empresa,
        admin_password_temporal: tempPassword,
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear cuenta de empresa",
      });
    }
  });

  app.patch("/api/empresas-cuenta/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }
      const actor = req.user!;
      if (!actor.es_super_admin && !(await assertAccesoCuentaPropia(req, res, id))) return;

      const body = req.body ?? {};
      const patch: Partial<empresasCuenta.EmpresaCuentaInput> = {};
      if (body.nombre !== undefined) patch.nombre = String(body.nombre);
      if (body.activo !== undefined) {
        if (!actor.es_super_admin) {
          res.status(403).json({
            ok: false,
            error: "Solo el administrador del sistema puede cambiar el estado de la cuenta",
          });
          return;
        }
        patch.activo = Boolean(body.activo);
      }
      const empresa = await empresasCuenta.updateEmpresaCuenta(getDb(), id, patch);
      res.json({ ok: true, data: empresa });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al actualizar cuenta de empresa",
      });
    }
  });

  app.patch("/api/empresas-cuenta/:id/admin", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const cuentaId = Number(req.params.id);
      if (!Number.isFinite(cuentaId)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }
      if (!req.user!.es_super_admin && !(await assertAccesoCuentaPropia(req, res, cuentaId))) {
        return;
      }
      const body = req.body ?? {};
      const userId =
        body.user_id === null || body.user_id === undefined
          ? null
          : Number(body.user_id);
      if (userId !== null && !Number.isFinite(userId)) {
        res.status(400).json({ ok: false, error: "user_id inválido" });
        return;
      }
      const empresa = await empresasCuenta.setEmpresaCuentaAdmin(
        getDb(),
        cuentaId,
        userId
      );
      await authDb.recordAuthEvent(getDb(), "empresa_cuenta_admin_updated", {
        email: req.user!.email,
        detalle: `cuenta=${empresa.nombre};admin=${empresa.admin?.email ?? "—"}`,
      });
      res.json({ ok: true, data: empresa });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al asignar administrador",
      });
    }
  });

  app.post("/api/empresas-cuenta/:id/empresas", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const cuentaId = Number(req.params.id);
      if (!Number.isFinite(cuentaId)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }
      if (!req.user!.es_super_admin && !(await assertAccesoCuentaPropia(req, res, cuentaId))) {
        return;
      }
      const body = req.body ?? {};
      const empresa = await empresasCuenta.insertEmpresaOperativa(getDb(), cuentaId, {
        nombre: String(body.nombre ?? ""),
        color: String(body.color ?? ""),
        activo: body.activo !== false,
      });
      res.status(201).json({ ok: true, data: empresa });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear empresa interna",
      });
    }
  });

  app.patch("/api/empresas-cuenta/:cuentaId/empresas/:empresaId", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const cuentaId = Number(req.params.cuentaId);
      const empresaId = Number(req.params.empresaId);
      if (!Number.isFinite(cuentaId) || !Number.isFinite(empresaId)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }
      if (!req.user!.es_super_admin && !(await assertAccesoCuentaPropia(req, res, cuentaId))) {
        return;
      }
      const body = req.body ?? {};
      const patch: Partial<empresasCuenta.EmpresaOperativaInput> = {};
      if (body.nombre !== undefined) patch.nombre = String(body.nombre);
      if (body.color !== undefined) patch.color = String(body.color);
      if (body.activo !== undefined) patch.activo = body.activo !== false;
      if (body.rut !== undefined) patch.rut = String(body.rut ?? "");
      if (body.ejercicio_inicio_mes !== undefined) {
        patch.ejercicio_inicio_mes = Number(body.ejercicio_inicio_mes);
      }
      if (body.ejercicio_inicio_dia !== undefined) {
        patch.ejercicio_inicio_dia = Number(body.ejercicio_inicio_dia);
      }
      const empresa = await empresasCuenta.updateEmpresaOperativa(
        getDb(),
        cuentaId,
        empresaId,
        patch
      );
      res.json({ ok: true, data: empresa });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al actualizar empresa operativa",
      });
    }
  });

  app.post("/api/empresas-cuenta/:id/usuarios", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const empresaId = Number(req.params.id);
      if (!Number.isFinite(empresaId)) {
        res.status(400).json({ ok: false, error: "ID inválido" });
        return;
      }
      if (!req.user!.es_super_admin && !(await assertAccesoCuentaPropia(req, res, empresaId))) {
        return;
      }
      const empresa = await empresasCuenta.getEmpresaCuentaById(getDb(), empresaId);
      if (!empresa) {
        res.status(404).json({ ok: false, error: "Cuenta de empresa no encontrada" });
        return;
      }
      const body = req.body ?? {};
      const rol = body.rol as authDb.Rol;
      if (!authDb.isValidRol(rol)) {
        res.status(400).json({ ok: false, error: "Rol inválido" });
        return;
      }
      const user = await authDb.insertUser(getDb(), {
        email: String(body.email ?? ""),
        nombre: String(body.nombre ?? ""),
        rol,
        password: String(body.password ?? ""),
        activo: body.activo !== false,
        empresa_id: empresaId,
      });
      await authDb.recordAuthEvent(getDb(), "user_created", {
        email: user.email,
        detalle: `rol=${user.rol};empresa=${empresa.nombre}`,
      });

      let cuentaActualizada = empresa;
      if (user.rol === "admin" && empresa.admin_user_id == null) {
        cuentaActualizada = await empresasCuenta.setEmpresaCuentaAdmin(
          getDb(),
          empresaId,
          user.id
        );
      }

      res.status(201).json({ ok: true, data: user, cuenta: cuentaActualizada });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear usuario de empresa",
      });
    }
  });

  logPasswordResetEmailStatus();
}

function logPasswordResetEmailStatus(): void {
  if (isPasswordResetEmailConfigured()) {
    console.info("[SGG Auth] Recuperación de contraseña: email configurado (Resend o SMTP)");
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[SGG Auth] Recuperación de contraseña: sin email en .env — el enlace se registra en la consola del servidor al solicitarlo",
    );
    return;
  }
  console.warn(
    "[SGG Auth] ADVERTENCIA: recuperación de contraseña sin RESEND_API_KEY ni SMTP — los usuarios no recibirán emails",
  );
}

export function getCorsOrigin(): string {
  return getAllowedClientOrigins()[0]!;
}

export function getPasswordPolicyHint(): string {
  return PASSWORD_POLICY_HINT;
}
