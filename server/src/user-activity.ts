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
  password_reset_requested: "Solicitud de recuperación de contraseña",
  password_reset_completed: "Contraseña restablecida por email",
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

const MODULO_AREA_LABELS: Record<string, string> = {
  auth: "cuenta y acceso",
  presupuesto: "gastos y presupuesto",
  proveedores: "proveedores",
  rubros: "rubros de gastos",
  "sub-rubros": "sub-rubros de gastos",
  divisas: "divisas",
  rrhh: "recursos humanos",
  funcionarios: "recursos humanos",
  "ingresos-ventas": "ingresos por ventas",
  "venta-sub-rubros": "rubros de ventas",
  "venta-sub-rubro-items": "ítems de ventas",
  "venta-grupo-iconos": "iconos de ventas",
  "stock-ganadero": "stock ganadero",
  "stock-equino": "stock equino",
  notas: "notas",
  chat: "chat interno",
  "vencimientos-impuestos": "vencimientos de impuestos",
  "contribucion-rural": "contribución rural",
  "patente-sucive": "patente SUCIVE",
  "bps-caja-rural": "BPS caja rural",
  "primaria-rural": "primaria rural",
  documentos: "documentos digitales",
  "empresas-cuenta": "cuentas de actividad",
};

const VERB_BY_METHOD: Record<string, string> = {
  POST: "Registró un cambio en",
  PUT: "Actualizó datos en",
  PATCH: "Modificó datos en",
  DELETE: "Eliminó un registro en",
};

export function describeApiActivity(method: string, path: string): string | null {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return null;

  const p = path.toLowerCase();
  const rel = p.replace(/^\/api\//, "");

  if (rel === "auth/presencia") return null;
  if (rel.startsWith("chat/read")) return null;
  if (rel.includes("/control-sanitario/") && (rel.includes("resumen") || rel.includes("fechas-aplicacion") || rel.includes("cantidad-opciones") || rel.includes("espera-opciones"))) {
    return null;
  }

  if (rel.startsWith("presupuesto")) {
    if (m === "POST") return "Ingresó un gasto";
    if (m === "PUT" || m === "PATCH") return "Editó un gasto";
    if (m === "DELETE") return "Eliminó un gasto";
  }
  if (rel.startsWith("proveedores")) {
    if (m === "POST") return "Agregó un proveedor";
    if (m === "PUT" || m === "PATCH") return "Actualizó un proveedor";
    if (m === "DELETE") return "Eliminó un proveedor";
  }
  if (rel.startsWith("rubros") || rel.startsWith("sub-rubros")) {
    if (m === "POST") return "Creó un rubro o sub-rubro de gastos";
    if (m === "PUT" || m === "PATCH") return "Actualizó rubros o sub-rubros de gastos";
    if (m === "DELETE") return "Eliminó un rubro o sub-rubro de gastos";
  }
  if (rel.startsWith("divisas")) {
    if (m === "POST") return "Cargó o importó tipos de cambio";
    if (m === "DELETE") return "Eliminó un registro de divisas";
  }
  if (rel.startsWith("rrhh") || rel.startsWith("funcionarios")) {
    if (m === "POST") return "Registró un funcionario";
    if (m === "PUT" || m === "PATCH") return "Actualizó datos de un funcionario";
    if (m === "DELETE") return "Eliminó un funcionario";
  }
  if (rel.startsWith("ingresos-ventas")) {
    if (rel.includes("agricultura")) {
      if (m === "POST") return "Registró una venta de agricultura";
      if (m === "PUT" || m === "PATCH") return "Actualizó una venta de agricultura";
      if (m === "DELETE") return "Eliminó una venta de agricultura";
    }
    if (rel.includes("arrendamientos")) {
      if (m === "POST") return "Registró un arrendamiento";
      if (m === "PUT" || m === "PATCH") return "Actualizó un arrendamiento";
      if (m === "DELETE") return "Eliminó un arrendamiento";
    }
    if (rel.includes("ganado-cerradas") && m === "PATCH") {
      return "Actualizó una venta de ganado cerrada";
    }
    if (m === "POST") return "Registró un ingreso por venta";
    if (m === "PUT" || m === "PATCH") return "Actualizó un ingreso por venta";
    if (m === "DELETE") return "Eliminó un ingreso por venta";
  }
  if (rel.startsWith("venta-sub-rubros") || rel.startsWith("venta-sub-rubro-items") || rel.startsWith("venta-grupo-iconos")) {
    if (m === "POST") return "Configuró rubros o ítems de ventas";
    if (m === "PUT" || m === "PATCH") return "Actualizó la configuración de ventas";
    if (m === "DELETE") return "Eliminó datos de la configuración de ventas";
  }
  if (rel.startsWith("stock-ganadero") || rel.startsWith("stock-equino")) {
    const modulo = rel.startsWith("stock-equino") ? "stock equino" : "stock ganadero";
    if (rel.includes("/baja")) return `Registró una baja en ${modulo}`;
    if (rel.includes("/import") || rel.includes("/file") || rel.includes("/text") || rel.includes("/rows")) {
      return `Importó movimientos en ${modulo}`;
    }
    if (rel.includes("bulk-delete") || rel.includes("wipe-all")) return `Eliminó registros de ${modulo}`;
    if (rel.includes("backup/restore")) return `Restauró un respaldo de ${modulo}`;
    if (rel.includes("control-sanitario")) {
      if (rel.includes("producto-ficha")) {
        if (m === "PUT") return `Actualizó una ficha sanitaria en ${modulo}`;
        if (m === "DELETE") return `Eliminó una ficha sanitaria en ${modulo}`;
      }
      if (rel.includes("dispositivos")) return `Registró un tratamiento sanitario en ${modulo}`;
      return null;
    }
    if (rel.includes("/foto")) return `Actualizó fotos de un animal en ${modulo}`;
    if (rel.includes("/potreros")) return m === "POST" ? `Creó un potrero en ${modulo}` : `Modificó potreros en ${modulo}`;
    if (rel.includes("/grupos")) return `Organizó grupos en ${modulo}`;
    if (rel.includes("/razas")) return `Actualizó razas en ${modulo}`;
    if (rel.includes("/cabana")) return `Actualizó la cabaña en ${modulo}`;
    if (m === "POST") return `Registró un movimiento en ${modulo}`;
    if (m === "PUT" || m === "PATCH") return `Modificó un animal en ${modulo}`;
    if (m === "DELETE") return `Eliminó un registro de ${modulo}`;
  }
  if (rel.startsWith("notas")) {
    return null;
  }
  if (rel.startsWith("chat/")) {
    if (rel.includes("/messages")) return m === "POST" ? "Envió un mensaje en el chat" : null;
    if (rel.includes("/channels") && m === "POST") return "Creó un canal de chat";
    if (rel.includes("/contacts/external")) return "Gestionó contactos del chat";
  }
  if (
    rel.startsWith("vencimientos-impuestos") ||
    rel.startsWith("contribucion-rural") ||
    rel.startsWith("patente-sucive") ||
    rel.startsWith("bps-caja-rural") ||
    rel.startsWith("primaria-rural")
  ) {
    if (rel.includes("calendarios") || rel.includes("preferencias")) {
      return "Actualizó la configuración de vencimientos de impuestos";
    }
  }
  if (rel.startsWith("auth/users")) {
    if (m === "POST") return "Creó un usuario";
    if (m === "PATCH") return "Actualizó un usuario";
  }
  if (rel.startsWith("auth/role-permissions") && m === "PATCH") {
    return "Actualizó permisos de un rol";
  }
  if (rel.startsWith("auth/cambiar-password")) return "Cambió su contraseña";
  if (rel.startsWith("empresas-cuenta")) {
    if (m === "POST") return "Creó o actualizó una cuenta de actividad";
    if (m === "PUT" || m === "PATCH") return "Modificó una cuenta de actividad";
    if (m === "DELETE") return "Eliminó una cuenta de actividad";
  }
  if (rel.startsWith("documentos")) {
    if (m === "POST") return "Subió o registró un documento digital";
    if (m === "PUT" || m === "PATCH") return "Actualizó un documento digital";
    if (m === "DELETE") return "Eliminó un documento digital";
  }

  const areaKey = rel.split("/")[0] ?? rel;
  const area = MODULO_AREA_LABELS[areaKey] ?? areaKey.replace(/-/g, " ");
  const verb = VERB_BY_METHOD[m];
  if (!verb) return null;
  return `${verb} ${area}`;
}

const SKIP_ACTIVITY_PATHS = new Set([
  "/api/auth/actividad",
  "/api/auth/actividad/pantalla",
  "/api/auth/presencia",
  "/api/auth/me",
  "/api/health",
  "/api/chat/unread",
  "/api/chat/messages",
  "/api/chat/contacts",
  "/api/chat/presence",
  "/api/chat/search",
  "/api/chat/wallpapers",
  "/api/chat/channels",
  "/api/chat/attachments",
  "/api/chat/read",
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
  home: "Inicio",
  registro: "Ingresar gasto",
  listado: "Presupuesto / listado de gastos",
  resumen: "Resumen",
  vencimientos_impuestos: "Vencimientos Impuestos",
  configuracion: "Configuración",
  divisas: "Divisas",
  precios_ganado: "Precios de Ganado",
  simulador_venta_ganado: "Simulador venta ganado",
  recursos_humanos: "Recursos Humanos",
  ingresos_ventas: "Ingresos por ventas",
  stock_ganadero: "Stock Ganadero",
  stock_equino: "Stock Equino",
  stock_movimientos: "Movimientos de dispositivos",
  registro_actividad: "Registro de actividad",
  usuarios: "Administración de Usuarios",
  panel_admin_sitio: "Administración del sitio",
  chat: "Chat interno",
  notas: "Notas",
  documentos_digitales: "Documentos Digitales",
};

export function formatNavegacionDetalle(pantallaLabel: string): string {
  return `Visitó el módulo «${pantallaLabel}»`;
}
