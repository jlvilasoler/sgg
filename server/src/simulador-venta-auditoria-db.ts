import type { Db } from "./db/pg-client.js";
import {
  getSimulacionVentaGanadoById,
  type SimuladorVentaGanadoRow,
} from "./simulador-venta-ganado-db.js";
import { snapshotOperacion } from "./simulador-venta-snapshot.js";

export const SIMULADOR_VENTA_AUDITORIA_TIPOS = [
  "CREAR",
  "ACTUALIZAR",
  "DESTACAR",
  "QUITAR_DESTACADO",
  "VENTA_REAL_REGISTRADA",
  "VENTA_REAL_ACTUALIZADA",
  "VENTA_REAL_ANULADA",
  "ELIMINAR",
] as const;

export type SimuladorVentaAuditoriaTipo = (typeof SIMULADOR_VENTA_AUDITORIA_TIPOS)[number];

export interface SimuladorVentaAuditoriaInput {
  simulacion_id?: number | null;
  numero_operacion: string;
  user_id?: number | null;
  user_email: string;
  user_nombre: string;
  tipo: SimuladorVentaAuditoriaTipo;
  resumen: string;
  detalle?: string;
  ip?: string;
}

export interface SimuladorVentaAuditoriaRow {
  id: number;
  simulacion_id: number | null;
  numero_operacion: string;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  tipo: SimuladorVentaAuditoriaTipo;
  resumen: string;
  detalle: string;
  ip: string;
  creado_en: string;
}

export interface SimuladorVentaAuditoriaFilters {
  simulacion_id?: number;
  numero_operacion?: string;
  limite?: number;
  offset?: number;
}

const TIPOS_VALIDOS = new Set<string>(SIMULADOR_VENTA_AUDITORIA_TIPOS);

export async function initSimuladorVentaAuditoriaTable(db: Db): Promise<void> {
  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_AUDITORIA (
          id SERIAL PRIMARY KEY,
          simulacion_id INTEGER,
          numero_operacion TEXT NOT NULL DEFAULT '',
          user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
          user_email TEXT NOT NULL DEFAULT '',
          user_nombre TEXT NOT NULL DEFAULT '',
          tipo TEXT NOT NULL,
          resumen TEXT NOT NULL DEFAULT '',
          detalle TEXT NOT NULL DEFAULT '',
          ip TEXT NOT NULL DEFAULT '',
          creado_en TIMESTAMPTZ DEFAULT NOW()
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_sim
         ON SIMULADOR_VENTA_GANADO_AUDITORIA(simulacion_id)`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_numero
         ON SIMULADOR_VENTA_GANADO_AUDITORIA(numero_operacion)`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_sim_venta_audit_creado
         ON SIMULADOR_VENTA_GANADO_AUDITORIA(creado_en DESC)`
      )
      .run();
  } catch {
    /* tabla ya existe */
  }

  await backfillAuditoriaHistorico(db);
}

async function backfillAuditoriaHistorico(db: Db): Promise<void> {
  const pending = (await db
    .prepare(
      `SELECT s.id FROM SIMULADOR_VENTA_GANADO s
       WHERE NOT EXISTS (
         SELECT 1 FROM SIMULADOR_VENTA_GANADO_AUDITORIA a WHERE a.simulacion_id = s.id
       )
       ORDER BY s.id ASC`
    )
    .all()) as { id: number }[];

  for (const { id } of pending) {
    const row = await getSimulacionVentaGanadoById(db, id);
    if (!row) continue;
    await recordSimuladorVentaAuditoria(db, {
      simulacion_id: row.id,
      numero_operacion: row.numero_operacion,
      user_id: row.usuario_id,
      user_email: "",
      user_nombre: row.usuario_nombre?.trim() || "Registro histórico",
      tipo: "CREAR",
      resumen: `${row.numero_operacion || `#${row.id}`}: operación registrada (histórico)`,
      detalle: JSON.stringify({
        despues: snapshotOperacion(row),
        historico: true,
      }),
      ip: "",
    });
  }
}

export async function recordSimuladorVentaAuditoria(
  db: Db,
  input: SimuladorVentaAuditoriaInput
): Promise<void> {
  if (!TIPOS_VALIDOS.has(input.tipo)) return;
  const resumen = String(input.resumen ?? "").trim().slice(0, 500);
  if (!resumen) return;

  await db
    .prepare(
      `INSERT INTO SIMULADOR_VENTA_GANADO_AUDITORIA (
         simulacion_id, numero_operacion, user_id, user_email, user_nombre,
         tipo, resumen, detalle, ip
       ) VALUES (
         @simulacion_id, @numero_operacion, @user_id, @user_email, @user_nombre,
         @tipo, @resumen, @detalle, @ip
       )`
    )
    .run({
      simulacion_id: input.simulacion_id ?? null,
      numero_operacion: String(input.numero_operacion ?? "").trim().slice(0, 32),
      user_id: input.user_id ?? null,
      user_email: String(input.user_email ?? "").trim().slice(0, 200),
      user_nombre: String(input.user_nombre ?? "").trim().slice(0, 120),
      tipo: input.tipo,
      resumen,
      detalle: String(input.detalle ?? "").slice(0, 16000),
      ip: String(input.ip ?? "").trim().slice(0, 64),
    });
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  if (value != null) {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function mapAuditoriaRow(row: Record<string, unknown>): SimuladorVentaAuditoriaRow {
  const tipo = String(row.tipo ?? "");
  return {
    id: Number(row.id),
    simulacion_id: row.simulacion_id != null ? Number(row.simulacion_id) : null,
    numero_operacion: row.numero_operacion != null ? String(row.numero_operacion) : "",
    user_id: row.user_id != null ? Number(row.user_id) : null,
    user_email: row.user_email != null ? String(row.user_email) : "",
    user_nombre: row.user_nombre != null ? String(row.user_nombre) : "",
    tipo: TIPOS_VALIDOS.has(tipo) ? (tipo as SimuladorVentaAuditoriaTipo) : "ACTUALIZAR",
    resumen: row.resumen != null ? String(row.resumen) : "",
    detalle: row.detalle != null ? String(row.detalle) : "",
    ip: row.ip != null ? String(row.ip) : "",
    creado_en: toIsoTimestamp(row.creado_en),
  };
}

export async function listSimuladorVentaAuditoria(
  db: Db,
  filters?: SimuladorVentaAuditoriaFilters
): Promise<SimuladorVentaAuditoriaRow[]> {
  const limite = Math.min(200, Math.max(1, filters?.limite ?? 100));
  const offset = Math.max(0, filters?.offset ?? 0);

  let sql = `SELECT id, simulacion_id, numero_operacion, user_id, user_email, user_nombre,
                    tipo, resumen, detalle, ip, creado_en
             FROM SIMULADOR_VENTA_GANADO_AUDITORIA WHERE 1=1`;
  const params: Record<string, unknown> = { limite, offset };

  if (filters?.simulacion_id && Number.isFinite(filters.simulacion_id)) {
    sql += ` AND simulacion_id = @simulacion_id`;
    params.simulacion_id = filters.simulacion_id;
  }
  if (filters?.numero_operacion?.trim()) {
    sql += ` AND numero_operacion = @numero_operacion`;
    params.numero_operacion = filters.numero_operacion.trim();
  }

  sql += ` ORDER BY creado_en DESC, id DESC LIMIT @limite OFFSET @offset`;

  const rows = (await db.prepare(sql).all(params)) as Record<string, unknown>[];
  return rows.map(mapAuditoriaRow);
}

export const SIMULADOR_VENTA_AUDITORIA_LABELS: Record<SimuladorVentaAuditoriaTipo, string> = {
  CREAR: "Creación",
  ACTUALIZAR: "Edición simulación",
  DESTACAR: "Destacada",
  QUITAR_DESTACADO: "Quitar destacado",
  VENTA_REAL_REGISTRADA: "Venta real registrada",
  VENTA_REAL_ACTUALIZADA: "Venta real editada",
  VENTA_REAL_ANULADA: "Venta real anulada",
  ELIMINAR: "Eliminación",
};
