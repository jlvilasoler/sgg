import type { Request } from "express";
import type { UserPublic } from "./auth-db.js";
import * as authDb from "./auth-db.js";
import { getDb } from "./database.js";
import { clientIp } from "./auth-security.js";

export const AUTH_EVENTO_LABELS: Record<string, string> = {
  login_ok: "Inicio de sesión",
  login_fail: "Intento de login fallido",
  login_fail_unknown: "Login con email desconocido",
  login_blocked_locked: "Login bloqueado (cuenta bloqueada)",
  account_locked: "Cuenta bloqueada por intentos",
  logout: "Cierre de sesión",
  user_created: "Usuario creado",
  user_updated: "Usuario actualizado",
  role_permissions_updated: "Permisos de rol actualizados",
  password_changed: "Contraseña cambiada",
  navegacion: "Navegación en la app",
  accion: "Acción en el sistema",
};

export function labelAuthEvento(evento: string): string {
  return AUTH_EVENTO_LABELS[evento] ?? evento.replace(/_/g, " ");
}

export async function recordUserActivity(
  user: Pick<UserPublic, "email" | "nombre">,
  evento: string,
  detalle: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  try {
    await authDb.recordAuthEvent(getDb(), evento, {
      email: user.email,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
      detalle: detalle.trim().slice(0, 500),
    });
  } catch (err) {
    console.error("[SGG] No se pudo registrar actividad:", err);
  }
}

export function describeApiActivity(method: string, path: string): string | null {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;

  const p = path.toLowerCase();

  if (p.startsWith("/api/presupuesto")) {
    if (m === "POST") return "Creó un registro de presupuesto/gasto";
    if (m === "PUT" || m === "PATCH") return "Modificó un registro de presupuesto/gasto";
    if (m === "DELETE") return "Eliminó un registro de presupuesto/gasto";
  }
  if (p.startsWith("/api/proveedores")) {
    if (m === "POST") return "Creó un proveedor";
    if (m === "PUT" || m === "PATCH") return "Modificó un proveedor";
    if (m === "DELETE") return "Eliminó un proveedor";
  }
  if (p.startsWith("/api/rubros") || p.startsWith("/api/sub-rubros")) {
    if (m === "POST") return "Creó un rubro o sub-rubro";
    if (m === "PUT" || m === "PATCH") return "Modificó configuración de rubros";
    if (m === "DELETE") return "Eliminó un rubro o sub-rubro";
  }
  if (p.startsWith("/api/divisas")) {
    if (m === "POST") return "Importó o cargó tipos de cambio";
    if (m === "DELETE") return "Eliminó un registro de divisas";
  }
  if (p.startsWith("/api/rrhh") || p.startsWith("/api/funcionarios")) {
    if (m === "POST") return "Registró datos de RRHH";
    if (m === "PUT" || m === "PATCH") return "Modificó datos de RRHH";
    if (m === "DELETE") return "Eliminó un registro de RRHH";
  }
  if (p.startsWith("/api/ingresos-ventas") || p.startsWith("/api/venta-")) {
    if (m === "POST") return "Registró un ingreso por venta";
    if (m === "PUT" || m === "PATCH") return "Modificó un ingreso por venta";
    if (m === "DELETE") return "Eliminó un ingreso por venta";
  }
  if (p.startsWith("/api/stock-ganadero")) {
    if (p.includes("/baja")) return "Registró bajas de dispositivos";
    if (p.includes("/import") || p.includes("/file") || p.includes("/text"))
      return "Importó lecturas de dispositivos (alta)";
    if (m === "POST") return "Cargó datos en stock ganadero";
    if (m === "PUT" || m === "PATCH") return "Modificó un dispositivo del stock";
    if (m === "DELETE") return "Eliminó datos del stock ganadero";
  }
  if (p.startsWith("/api/auth/users")) {
    if (m === "POST") return "Creó un usuario";
    if (m === "PATCH") return "Actualizó un usuario";
  }
  if (p.startsWith("/api/auth/role-permissions")) {
    if (m === "PATCH") return "Actualizó permisos de un rol";
  }
  if (p.startsWith("/api/auth/cambiar-password")) {
    return "Cambió su contraseña";
  }

  return `Operación ${m} en ${path.replace(/^\/api\//, "")}`;
}

const SKIP_ACTIVITY_PATHS = new Set([
  "/api/auth/actividad",
  "/api/auth/actividad/pantalla",
  "/api/auth/me",
  "/api/health",
]);

export function attachApiActivityLogger(req: Request, res: import("express").Response): void {
  const user = req.user;
  if (!user) return;

  const method = req.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;

  const path = req.path;
  if (SKIP_ACTIVITY_PATHS.has(path) || path.startsWith("/api/auth/actividad")) return;

  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    const descripcion = describeApiActivity(method, path);
    if (!descripcion) return;
    void recordUserActivity(user, "accion", descripcion, {
      ip: clientIp(req),
      userAgent: req.headers["user-agent"],
    });
  });
}

export const PANTALLA_LABELS: Record<string, string> = {
  home: "Menú principal",
  registro: "Ingresar gasto",
  listado: "Presupuesto / listado de gastos",
  resumen: "Resumen",
  configuracion: "Configuración",
  divisas: "Divisas",
  recursos_humanos: "Recursos Humanos",
  ingresos_ventas: "Ingresos por ventas",
  stock_ganadero: "Stock Ganadero",
  stock_movimientos: "Movimientos de dispositivos",
  usuarios: "Usuarios y permisos",
};
