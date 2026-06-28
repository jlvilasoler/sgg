import type { Db } from "./db/pg-client.js";
import {
  buildBajaSnapshotDesdeClave,
  claveRegistradaPorNumero,
} from "./stock-ganadero-db.js";

export type StockMovimientoTipo = "ALTA" | "BAJA" | "MODIFICACION";

export interface StockMovimientoAuditoriaInput {
  user_id: number;
  user_email: string;
  user_nombre: string;
  tipo: StockMovimientoTipo;
  clave?: string;
  cantidad?: number;
  resumen: string;
  detalle?: string;
  ip?: string;
}

export interface StockMovimientoBajaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  numero: string;
  primera_fecha: string;
  fecha_baja: string;
  dias_en_sistema: number | null;
  categoria: string;
  tipo_baja: string;
}

export interface StockMovimientoAuditoria {
  id: number;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  tipo: StockMovimientoTipo;
  clave: string;
  cantidad: number;
  resumen: string;
  detalle: string;
  ip: string;
  creado_en: string;
  baja_dispositivo?: StockMovimientoBajaDispositivo | null;
}

export interface StockMovimientoAuditoriaFilters {
  user_id?: number;
  /** Limitar a usuarios de la misma cuenta (ids permitidos). */
  user_ids_in?: number[];
  tipo?: StockMovimientoTipo;
  limite?: number;
  offset?: number;
}

export async function initStockAuditoriaTable(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'auditoria_mov_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS STOCK_GANADERO_AUDITORIA_MOVIMIENTO (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
          user_email TEXT NOT NULL DEFAULT '',
          user_nombre TEXT NOT NULL DEFAULT '',
          tipo TEXT NOT NULL,
          clave TEXT NOT NULL DEFAULT '',
          cantidad INTEGER NOT NULL DEFAULT 1,
          resumen TEXT NOT NULL DEFAULT '',
          detalle TEXT NOT NULL DEFAULT '',
          ip TEXT NOT NULL DEFAULT '',
          creado_en TIMESTAMPTZ DEFAULT NOW()
        )`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_user
         ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(user_id)`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_creado
         ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(creado_en DESC)`
      )
      .run();
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_stock_audit_mov_tipo
         ON STOCK_GANADERO_AUDITORIA_MOVIMIENTO(tipo)`
      )
      .run();
  } catch {
    /* tabla ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'auditoria_mov_v1', '', '', '')`
    )
    .run();
}

const TIPOS_VALIDOS = new Set<StockMovimientoTipo>(["ALTA", "BAJA", "MODIFICACION"]);

function parseDetalleJson(detalle: string): Record<string, unknown> | null {
  if (!detalle?.trim()) return null;
  try {
    const parsed = JSON.parse(detalle) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function bajaDispositivoDesdeDetalle(
  detalle: string
): StockMovimientoBajaDispositivo | null {
  const json = parseDetalleJson(detalle);
  const raw = json?.dispositivo;
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const numero = String(d.numero ?? "").trim();
  if (!numero) return null;
  return {
    clave: String(d.clave ?? "").trim(),
    eid: String(d.eid ?? "").trim(),
    vid: String(d.vid ?? "").trim(),
    numero,
    primera_fecha: String(d.primera_fecha ?? "").trim(),
    fecha_baja: String(d.fecha_baja ?? "").trim(),
    dias_en_sistema:
      d.dias_en_sistema === null || d.dias_en_sistema === undefined
        ? null
        : Number(d.dias_en_sistema),
    categoria: String(d.categoria ?? "").trim(),
    tipo_baja: String(d.tipo_baja ?? "").trim(),
  };
}

async function expandirFilaBaja(
  db: Db,
  row: StockMovimientoAuditoria
): Promise<StockMovimientoAuditoria[]> {
  const desdeDetalle = bajaDispositivoDesdeDetalle(row.detalle);
  if (desdeDetalle) {
    return [{ ...row, baja_dispositivo: desdeDetalle }];
  }

  const json = parseDetalleJson(row.detalle);
  const numerosRaw = json?.numeros ?? json?.dispositivos;
  const numeros = Array.isArray(numerosRaw)
    ? numerosRaw.map((n) => String(n ?? "").trim()).filter(Boolean)
    : [];

  if (numeros.length > 0) {
    const expandidas: StockMovimientoAuditoria[] = [];
    for (const numero of numeros) {
      const clave = (await claveRegistradaPorNumero(db, numero)) ?? row.clave;
      const snap = clave ? await buildBajaSnapshotDesdeClave(db, clave) : null;
      expandidas.push({
        ...row,
        id: row.id * 10000 + expandidas.length,
        clave: snap?.clave ?? clave,
        cantidad: 1,
        resumen: snap ? `Baja: ${snap.numero}` : `Baja: ${numero}`,
        baja_dispositivo: snap,
      });
    }
    if (expandidas.length > 0) return expandidas;
  }

  if (row.clave) {
    const snap = await buildBajaSnapshotDesdeClave(db, row.clave);
    if (snap) {
      return [{ ...row, baja_dispositivo: snap }];
    }
  }

  return [{ ...row, baja_dispositivo: null }];
}

export async function recordStockMovimientoAuditoria(
  db: Db,
  input: StockMovimientoAuditoriaInput
): Promise<void> {
  if (!TIPOS_VALIDOS.has(input.tipo)) return;
  const resumen = String(input.resumen ?? "").trim().slice(0, 500);
  if (!resumen) return;

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_AUDITORIA_MOVIMIENTO (
         user_id, user_email, user_nombre, tipo, clave, cantidad, resumen, detalle, ip
       ) VALUES (
         @user_id, @user_email, @user_nombre, @tipo, @clave, @cantidad, @resumen, @detalle, @ip
       )`
    )
    .run({
      user_id: input.user_id,
      user_email: String(input.user_email ?? "").trim().slice(0, 200),
      user_nombre: String(input.user_nombre ?? "").trim().slice(0, 120),
      tipo: input.tipo,
      clave: String(input.clave ?? "").trim().slice(0, 64),
      cantidad: Math.max(1, Math.floor(input.cantidad ?? 1)),
      resumen,
      detalle: String(input.detalle ?? "").slice(0, 4000),
      ip: String(input.ip ?? "").trim().slice(0, 64),
    });
}

export async function listStockMovimientosAuditoria(
  db: Db,
  filters?: StockMovimientoAuditoriaFilters
): Promise<StockMovimientoAuditoria[]> {
  const limite = Math.min(200, Math.max(1, filters?.limite ?? 80));
  const offset = Math.max(0, filters?.offset ?? 0);

  let sql = `SELECT id, user_id, user_email, user_nombre, tipo, clave, cantidad, resumen, detalle, ip, creado_en
             FROM STOCK_GANADERO_AUDITORIA_MOVIMIENTO WHERE 1=1`;
  const params: Record<string, unknown> = { limite, offset };

  if (filters?.user_ids_in) {
    if (filters.user_ids_in.length === 0) {
      sql += ` AND 1=0`;
    } else {
      const placeholders = filters.user_ids_in
        .map((_, i) => `@scope_uid_${i}`)
        .join(", ");
      sql += ` AND user_id IN (${placeholders})`;
      filters.user_ids_in.forEach((id, i) => {
        params[`scope_uid_${i}`] = id;
      });
    }
  }
  if (filters?.user_id && Number.isFinite(filters.user_id)) {
    sql += ` AND user_id = @user_id`;
    params.user_id = filters.user_id;
  }
  if (filters?.tipo && TIPOS_VALIDOS.has(filters.tipo)) {
    sql += ` AND tipo = @tipo`;
    params.tipo = filters.tipo;
  }

  sql += ` ORDER BY creado_en DESC, id DESC LIMIT @limite OFFSET @offset`;

  const rows = (await db.prepare(sql).all(params)) as StockMovimientoAuditoria[];
  const normalizadas = rows.map((r) => ({
    ...r,
    tipo: TIPOS_VALIDOS.has(r.tipo as StockMovimientoTipo)
      ? (r.tipo as StockMovimientoTipo)
      : "MODIFICACION",
    cantidad: Number(r.cantidad) || 1,
  }));

  const expandidas: StockMovimientoAuditoria[] = [];
  for (const row of normalizadas) {
    if (row.tipo === "BAJA") {
      const partes = await expandirFilaBaja(db, row);
      expandidas.push(...partes);
    } else {
      expandidas.push(row);
    }
  }

  return expandidas.slice(0, limite);
}

export const STOCK_MOVIMIENTO_LABELS: Record<StockMovimientoTipo, string> = {
  ALTA: "Alta",
  BAJA: "Baja",
  MODIFICACION: "Modificación",
};
