import type { Request } from "express";
import type { UserPublic } from "./auth-db.js";
import * as db from "./database.js";
import type { BajaDispositivoSnapshot } from "./stock-ganadero-db.js";
import type { StockMovimientoTipo } from "./stock-auditoria-db.js";

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]
      : Array.isArray(forwarded)
        ? forwarded[0]
        : req.socket.remoteAddress ?? "";
  return String(raw ?? "").trim().slice(0, 64);
}

export async function auditStockMovimiento(
  req: Request,
  tipo: StockMovimientoTipo,
  data: {
    clave?: string;
    cantidad?: number;
    resumen: string;
    detalle?: Record<string, unknown> | string;
  }
): Promise<void> {
  const user: UserPublic | undefined = req.user;
  if (!user?.id) return;

  const detalle =
    typeof data.detalle === "string"
      ? data.detalle
      : data.detalle
        ? JSON.stringify(data.detalle)
        : "";

  try {
    await db.stockAuditoria.record({
      user_id: user.id,
      user_email: user.email,
      user_nombre: user.nombre,
      tipo,
      clave: data.clave,
      cantidad: data.cantidad,
      resumen: data.resumen,
      detalle,
      ip: clientIp(req),
    });
  } catch (err) {
    console.error("[SGG] No se pudo registrar auditoría de stock:", err);
  }
}

export async function auditBajasDispositivos(
  req: Request,
  dispositivos: BajaDispositivoSnapshot[]
): Promise<void> {
  for (const d of dispositivos) {
    await auditStockMovimiento(req, "BAJA", {
      clave: d.clave,
      cantidad: 1,
      resumen: `Baja: ${d.numero}`,
      detalle: { dispositivo: d },
    });
  }
}
