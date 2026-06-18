import type { Express, Request, Response, NextFunction } from "express";
import type { CookieOptions } from "express";
import * as authDb from "./auth-db.js";
import type { Modulo, UserPublic } from "./auth-db.js";
import type { StockMovimientoTipo } from "./stock-auditoria-db.js";
import { getDb, stockAuditoria } from "./database.js";
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

export {
  apiRateLimiter,
  csrfOriginGuard,
  getAllowedClientOrigins,
  getCorsOptions,
  securityHeaders,
} from "./auth-security.js";

export const SESSION_COOKIE = "scg_session";

const IS_PROD = process.env.NODE_ENV === "production";

const PUBLIC_PATHS = new Set(["/api/health", "/api/auth/login"]);

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
    p.startsWith("/api/auth/actividad")
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
  if (p.startsWith("/api/catalogos")) return "presupuesto";
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
    path === "/api/auth/logout"
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

  const modulo = moduleFromApiPath(path);
  if (modulo && !user.permisos.includes(modulo)) {
    res.status(403).json({ ok: false, error: "Sin permiso para este módulo" });
    return;
  }

  if (
    modulo &&
    WRITE_METHODS.has(req.method.toUpperCase()) &&
    !user.puede_escribir
  ) {
    res.status(403).json({
      ok: false,
      error: "Tu rol solo permite consultar datos, no modificarlos",
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

  app.get("/api/auth/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ ok: true, data: await authDb.listUsers(getDb()) });
  });

  app.post("/api/auth/users", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const data = {
        email: String(req.body?.email ?? ""),
        nombre: String(req.body?.nombre ?? ""),
        rol: req.body?.rol as authDb.Rol,
        password: String(req.body?.password ?? ""),
        activo: req.body?.activo !== false,
      };
      if (!["admin", "editor", "consulta"].includes(data.rol)) {
        res.status(400).json({ ok: false, error: "Rol inválido" });
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
        if (!["admin", "editor", "consulta"].includes(body.rol)) {
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
    if (!requireAdmin(req, res)) return;
    res.json({ ok: true, data: listOnlineUsers() });
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
    if (!requireAdmin(req, res)) return;
    try {
      const email = String(req.query.email ?? "").trim() || undefined;
      const evento = String(req.query.evento ?? "").trim() || undefined;
      const limite = req.query.limite ? Number(req.query.limite) : undefined;
      const data = await authDb.listAuthAuditLog(getDb(), {
        email,
        evento,
        limite: Number.isFinite(limite) ? limite : undefined,
      });
      res.json({ ok: true, data });
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
    if (!requireAdmin(req, res)) return;
    res.json({ ok: true, data: await authDb.listRolePermissions(getDb()) });
  });

  app.patch("/api/auth/role-permissions/:rol", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
      const rol = String(req.params.rol) as authDb.Rol;
      if (!["admin", "editor", "consulta"].includes(rol)) {
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
}

export function getCorsOrigin(): string {
  return getAllowedClientOrigins()[0]!;
}

export function getPasswordPolicyHint(): string {
  return PASSWORD_POLICY_HINT;
}
