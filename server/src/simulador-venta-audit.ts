import type { Request } from "express";
import type { UserPublic } from "./auth-db.js";
import * as db from "./database.js";
import type { SimuladorVentaAuditoriaTipo } from "./simulador-venta-auditoria-db.js";
import type {
  SimuladorVentaGanadoRow,
  SimuladorVentaRealInput,
} from "./simulador-venta-ganado-db.js";
import {
  computeCambiosSimulacion,
  computeCambiosVentaReal,
  snapshotOperacion,
} from "./simulador-venta-snapshot.js";
import { clientIp } from "./stock-audit.js";

async function record(
  req: Request,
  data: {
    simulacion_id?: number | null;
    numero_operacion: string;
    tipo: SimuladorVentaAuditoriaTipo;
    resumen: string;
    detalle: Record<string, unknown>;
  }
): Promise<void> {
  const user: UserPublic | undefined = req.user;

  try {
    await db.simuladorVentaAuditoria.record({
      simulacion_id: data.simulacion_id,
      numero_operacion: data.numero_operacion,
      user_id: user?.id ?? null,
      user_email: user?.email ?? "",
      user_nombre: user?.nombre ?? "Sistema",
      tipo: data.tipo,
      resumen: data.resumen,
      detalle: JSON.stringify(data.detalle),
      ip: clientIp(req),
    });
  } catch (err) {
    console.error("[SGG] No se pudo registrar auditoría simulador venta:", err);
  }
}

function opLabel(row: SimuladorVentaGanadoRow): string {
  return row.numero_operacion?.trim() || `#${row.id}`;
}

export async function auditSimuladorCreacion(
  req: Request,
  row: SimuladorVentaGanadoRow
): Promise<void> {
  await record(req, {
    simulacion_id: row.id,
    numero_operacion: row.numero_operacion,
    tipo: "CREAR",
    resumen: `${opLabel(row)}: simulación creada`,
    detalle: { despues: snapshotOperacion(row) },
  });
}

export async function auditSimuladorActualizacion(
  req: Request,
  antes: SimuladorVentaGanadoRow,
  despues: SimuladorVentaGanadoRow
): Promise<void> {
  const snapAntes = snapshotOperacion(antes);
  const snapDespues = snapshotOperacion(despues);
  const cambios = computeCambiosSimulacion(snapAntes, snapDespues);
  if (cambios.length === 0) return;

  await record(req, {
    simulacion_id: despues.id,
    numero_operacion: despues.numero_operacion,
    tipo: "ACTUALIZAR",
    resumen: `${opLabel(despues)}: simulación editada`,
    detalle: { antes: snapAntes, despues: snapDespues, cambios },
  });
}

export async function auditSimuladorPatch(
  req: Request,
  antes: SimuladorVentaGanadoRow,
  despues: SimuladorVentaGanadoRow,
  patch: {
    destacada?: boolean;
    venta_realizada?: boolean;
    valores_reales?: SimuladorVentaRealInput | null;
  }
): Promise<void> {
  const snapAntes = snapshotOperacion(antes);
  const snapDespues = snapshotOperacion(despues);
  const label = opLabel(despues);

  if (patch.destacada === true && !antes.destacada) {
    await record(req, {
      simulacion_id: despues.id,
      numero_operacion: despues.numero_operacion,
      tipo: "DESTACAR",
      resumen: `${label}: operación destacada`,
      detalle: { antes: snapAntes, despues: snapDespues, cambios: ["destacada"] },
    });
    return;
  }

  if (patch.destacada === false && antes.destacada) {
    await record(req, {
      simulacion_id: despues.id,
      numero_operacion: despues.numero_operacion,
      tipo: "QUITAR_DESTACADO",
      resumen: `${label}: se quitó el destacado`,
      detalle: { antes: snapAntes, despues: snapDespues, cambios: ["destacada"] },
    });
    return;
  }

  if (patch.venta_realizada === false) {
    await record(req, {
      simulacion_id: despues.id,
      numero_operacion: despues.numero_operacion,
      tipo: "VENTA_REAL_ANULADA",
      resumen: `${label}: venta real anulada`,
      detalle: {
        antes: snapAntes,
        despues: snapDespues,
        cambios: computeCambiosVentaReal(snapAntes, snapDespues),
      },
    });
    return;
  }

  if (patch.valores_reales) {
    const tipo: SimuladorVentaAuditoriaTipo =
      antes.real_total_usd != null ? "VENTA_REAL_ACTUALIZADA" : "VENTA_REAL_REGISTRADA";
    const resumen =
      tipo === "VENTA_REAL_REGISTRADA"
        ? `${label}: venta real registrada`
        : `${label}: venta real editada`;

    await record(req, {
      simulacion_id: despues.id,
      numero_operacion: despues.numero_operacion,
      tipo,
      resumen,
      detalle: {
        antes: snapAntes,
        despues: snapDespues,
        cambios: computeCambiosVentaReal(snapAntes, snapDespues),
      },
    });
  }
}

export async function auditSimuladorEliminacion(
  req: Request,
  row: SimuladorVentaGanadoRow
): Promise<void> {
  await record(req, {
    simulacion_id: row.id,
    numero_operacion: row.numero_operacion,
    tipo: "ELIMINAR",
    resumen: `${opLabel(row)}: simulación eliminada`,
    detalle: { antes: snapshotOperacion(row) },
  });
}
