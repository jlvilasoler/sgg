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
import {
  attachApiActivityLogger,
  PANTALLA_LABELS,
  recordUserActivity,
} from "./user-activity.js";
import { listOnlineUsers, removeUserPresence, touchUserPresence } from "./user-presence.js";
import {
  artificialLoginDelay,
  clientIp,
  getAllowedClientOrigins,
  isValidSessionTokenFormat,
  loginRateLimiter,
  PASSWORD_POLICY_HINT,
} from "./auth-security.js";
import {
  buildPasswordResetUrl,
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
  if (p.startsWith("/api/presupuesto") || p.startsWith("/api/resumen")) {
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
  if (p.startsWith("/api/documentos-digitales")) return "documentos_digitales";
  if (p.startsWith("/api/catalogos") || p.startsWith("/api/empresas-operativas")) {
    return "presupuesto";
  }
  return null;
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
    path === "/api/auth/reset-password/validate"
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

  const user = await authDb.getUserBySessionToken(db, token);

  if (!user) {
    res.status(401).json({ ok: false, error: "Sesión no válida o expirada" });
    return;
  }

  req.user = user;

  touchUserPresence(user, { ip: clientIp(req) });

  attachApiActivityLogger(req, res);

  const modulo = effectiveModuloForPath(user, path);
  const stockDispositivosLectura =
    req.method === "GET" && path.startsWith("/api/stock-ganadero/dispositivos");
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
    res.status(403).json({
      ok: false,
      error:
        user.rol === "gestor_n2" && modulo === "divisas"
          ? "Gestor N2 solo puede consultar divisas, no modificarlas"
          : "Tu rol solo permite consultar datos, no modificarlos",
    });
    return;
  }

  next();
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user || req.user.rol !== "admin") {
    res.status(403).json({ ok: false, error: "Solo administradores" });
    return false;
  }
  return true;
}

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.user?.es_super_admin) {
    res.status(403).json({
      ok: false,
      error: "Solo el administrador del sistema puede realizar esta acción",
    });
    return false;
  }
  return true;
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
  if (req.user?.es_super_admin) return true;
  const propia = await cuentaIdDelActor(req);
  if (propia === cuentaId) return true;
  res.status(403).json({ ok: false, error: "Sin permiso sobre esta cuenta" });
  return false;
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

      res.cookie(SESSION_COOKIE, token, cookieOptions());
      touchUserPresence(result.user, {
        ip,
        pantalla: PANTALLA_LABELS.home,
      });
      res.json({ ok: true, data: result.user });
    } catch (e) {
      console.error("[SGG Auth] Error en login:", e);
      if (isDbCapacityError(e)) {
        res.status(503).json({
          ok: false,
          error: "Base de datos saturada",
          hint: dbCapacityHint(),
          detail: e instanceof Error ? e.message : String(e),
        });
        return;
      }
      res.status(500).json({
        ok: false,
        error: "Error al iniciar sesión",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    let user: UserPublic | null = null;
    if (token) {
      user = await authDb.getUserBySessionToken(getDb(), token);
      await authDb.deleteSession(getDb(), token);
    }
    if (user) {
      removeUserPresence(user.email);
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
    const user = await authDb.getUserBySessionToken(getDb(), token);
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

      if (user) {
        const rawToken = await authDb.createPasswordResetToken(db, user.id, { ip });
        const resetUrl = buildPasswordResetUrl(rawToken);
        try {
          await sendPasswordResetEmail({
            to: user.email,
            nombre: user.nombre,
            resetUrl,
          });
        } catch (mailErr) {
          console.error("[SGG Auth] No se pudo enviar email de recuperación:", mailErr);
        }
        await authDb.recordAuthEvent(db, "password_reset_requested", {
          email: user.email,
          ip,
          userAgent: req.headers["user-agent"],
        });
      }

      await artificialLoginDelay();
      res.json({ ok: true, message: FORGOT_PASSWORD_MESSAGE });
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
    if (!requireAdmin(req, res)) return;
    const actor = req.user!;
    const empresaQuery = req.query.empresa_id;
    const ambitoPropio = String(req.query.ambito ?? "") === "propio";
    if (actor.es_super_admin) {
      if (empresaQuery != null && String(empresaQuery).trim() !== "") {
        const empresaId = Number(empresaQuery);
        if (!Number.isFinite(empresaId)) {
          res.status(400).json({ ok: false, error: "empresa_id inválido" });
          return;
        }
        const cuenta = await empresasCuenta.getEmpresaCuentaById(
          getDb(),
          empresaId
        );
        res.json({
          ok: true,
          data: await authDb.listUsers(getDb(), {
            empresa_id: empresaId,
            incluir_admin_id: cuenta?.admin_user_id ?? null,
          }),
        });
        return;
      }
      if (ambitoPropio) {
        const cuenta = await empresasCuenta.getEmpresaCuentaByAdminUserId(
          getDb(),
          actor.id
        );
        if (cuenta) {
          res.json({
            ok: true,
            data: await authDb.listUsers(getDb(), {
              empresa_id: cuenta.id,
              incluir_admin_id: cuenta.admin_user_id,
            }),
          });
          return;
        }
      }
      res.json({ ok: true, data: await authDb.listUsers(getDb()) });
      return;
    }
    if (actor.empresa_id) {
      const cuenta = await empresasCuenta.getEmpresaCuentaById(
        getDb(),
        actor.empresa_id
      );
      res.json({
        ok: true,
        data: await authDb.listUsers(getDb(), {
          empresa_id: actor.empresa_id,
          incluir_admin_id: cuenta?.admin_user_id ?? null,
        }),
      });
      return;
    }
    res.json({ ok: true, data: await authDb.listUsers(getDb()) });
  });

  app.post("/api/auth/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
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
      } else if (actor.empresa_id) {
        data.empresa_id = actor.empresa_id;
      } else {
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
    if (!requireAdmin(req, res)) return;
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

      if (!assertUserInScope(req.user!, current, res)) return;

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
    const allowedIds = await authDb.resolveActividadOnlineUserIds(db, actor);
    const base = listOnlineUsers().filter(
      (u) => allowedIds === null || allowedIds.includes(u.id)
    );
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
        avatar: row ? avatarDtoFromRow(row.id, row) : { tipo: "iniciales" as const, url: null },
      });
    }
    res.json({ ok: true, data });
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
      const scopeResult = await authDb.resolveAuthAuditLogScope(
        getDb(),
        actor,
        email
      );
      if (!scopeResult.ok) {
        res.status(403).json({ ok: false, error: scopeResult.error });
        return;
      }
      const page = await authDb.listAuthAuditLog(getDb(), {
        email: scopeResult.filters.email,
        scope: scopeResult.filters.scope,
        evento,
        limite: Number.isFinite(limite) ? limite : undefined,
        offset: Number.isFinite(offset) ? offset : undefined,
      });
      res.json({
        ok: true,
        data: page.rows,
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
      await recordUserActivity(user, "navegacion", `Accedió a: ${label}`, {
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
      const userIdRaw = req.query.user_id;
      const user_id =
        userIdRaw !== undefined && userIdRaw !== ""
          ? Number(userIdRaw)
          : undefined;
      const tipoRaw = String(req.query.tipo ?? "").toUpperCase();
      const tipo =
        tipoRaw === "ALTA" || tipoRaw === "BAJA" || tipoRaw === "MODIFICACION"
          ? (tipoRaw as StockMovimientoTipo)
          : undefined;
      const limite = req.query.limite ? Number(req.query.limite) : undefined;
      const data = await stockAuditoria.list({
        user_id: Number.isFinite(user_id) ? user_id : undefined,
        tipo,
        limite: Number.isFinite(limite) ? limite : undefined,
      });
      res.json({ ok: true, data });
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

  app.get("/api/empresas-cuenta/mi-cuenta", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const actor = req.user!;
    if (actor.es_super_admin) {
      res.status(403).json({
        ok: false,
        error: "Use el panel de Administración del sitio",
      });
      return;
    }
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

  app.get("/api/empresas-cuenta", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    res.json({ ok: true, data: await empresasCuenta.listEmpresasCuenta(getDb()) });
  });

  app.post("/api/empresas-cuenta", async (req, res) => {
    if (!requireSuperAdmin(req, res)) return;
    try {
      const body = req.body ?? {};
      const empresa = await empresasCuenta.insertEmpresaCuenta(getDb(), {
        nombre: String(body.nombre ?? ""),
        codigo: String(body.codigo ?? ""),
        activo: body.activo !== false,
      });
      await authDb.recordAuthEvent(getDb(), "empresa_cuenta_created", {
        email: req.user!.email,
        detalle: `empresa=${empresa.nombre}`,
      });
      res.status(201).json({ ok: true, data: empresa });
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
      if (body.codigo !== undefined) patch.codigo = String(body.codigo);
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
        codigo: String(body.codigo ?? ""),
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
}

export function getCorsOrigin(): string {
  return getAllowedClientOrigins()[0]!;
}

export function getPasswordPolicyHint(): string {
  return PASSWORD_POLICY_HINT;
}
