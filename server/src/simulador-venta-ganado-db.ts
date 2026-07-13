import type { Db } from "./db/pg-client.js";
import { migrateAddCuentaIdColumn } from "./empresas-cuenta-db.js";
import {
  CATEGORIA_GANADO_GORDO_LABELS,
  CATEGORIA_GANADO_REPOSICION_LABELS,
  listPreciosGanado,
  pivotSemanas,
  type CategoriaPrecioGanado,
  type SegmentoPreciosGanado,
  type SemanaPreciosGanado,
} from "./precios-ganado-db.js";

export const SIMULADOR_VENTA_TIPOS = ["EN_PIE", "CUARTA_BALANZA"] as const;
export type SimuladorVentaTipo = (typeof SIMULADOR_VENTA_TIPOS)[number];

export type SimuladorModoKg = "TOTAL" | "CABEZAS";

export interface SimuladorVentaGanadoRow {
  id: number;
  numero_operacion: string;
  tipo: SimuladorVentaTipo;
  segmento: SegmentoPreciosGanado;
  categoria: CategoriaPrecioGanado;
  modo_kg: SimuladorModoKg;
  precio_usd_kg: number;
  precio_ref_anio: number | null;
  precio_ref_semana: number | null;
  precio_ref_fecha_hasta: string | null;
  cantidad_animales: number | null;
  kg_promedio: number | null;
  kg_total: number;
  rendimiento: number | null;
  total_usd: number;
  total_usd_por_cabeza: number | null;
  notas: string | null;
  destacada: boolean;
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  real_precio_usd_kg: number | null;
  real_cantidad_animales: number | null;
  real_kg_promedio: number | null;
  real_kg_total: number | null;
  real_total_usd: number | null;
  real_total_usd_por_cabeza: number | null;
  real_notas: string | null;
  destino: string | null;
  usuario_id: number | null;
  usuario_nombre: string | null;
  creado_en: string;
  dispositivos_count: number;
}

export interface SimuladorVentaRealInput {
  precio_usd_kg: number;
  cantidad_animales?: number | null;
  kg_promedio?: number | null;
  kg_total: number;
  total_usd: number;
  total_usd_por_cabeza?: number | null;
  notas?: string | null;
}

export interface SimuladorVentaGanadoInput {
  tipo: SimuladorVentaTipo;
  categoria: CategoriaPrecioGanado;
  modo_kg: SimuladorModoKg;
  precio_usd_kg: number;
  precio_ref_anio?: number | null;
  precio_ref_semana?: number | null;
  precio_ref_fecha_hasta?: string | null;
  cantidad_animales?: number | null;
  kg_promedio?: number | null;
  kg_total: number;
  rendimiento?: number | null;
  total_usd: number;
  total_usd_por_cabeza?: number | null;
  notas?: string | null;
  usuario_id?: number | null;
}

export interface SimuladorPreciosReferencia {
  tipo: SimuladorVentaTipo;
  segmento: SegmentoPreciosGanado;
  ultima: SemanaPreciosGanado | null;
  precios: Partial<Record<CategoriaPrecioGanado, number>>;
  labels: Record<string, string>;
  categorias: readonly string[];
  siguiente_numero_operacion: string;
}

export function operacionPrefix(tipo: SimuladorVentaTipo): "VP" | "VC" {
  return tipo === "EN_PIE" ? "VP" : "VC";
}

export function formatNumeroOperacion(tipo: SimuladorVentaTipo, n: number): string {
  const prefix = operacionPrefix(tipo);
  const digits = Math.max(3, String(n).length);
  return `${prefix}${String(n).padStart(digits, "0")}`;
}

function parseNumeroOperacionSeq(numero: string, prefix: string): number | null {
  if (!numero.startsWith(prefix)) return null;
  const n = Number.parseInt(numero.slice(prefix.length), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getMaxOperacionSeq(
  db: Db,
  tipo: SimuladorVentaTipo
): Promise<number> {
  const prefix = operacionPrefix(tipo);
  let max = 0;

  const rows = (await db
    .prepare(
      `SELECT numero_operacion FROM SIMULADOR_VENTA_GANADO
       WHERE tipo = @tipo AND numero_operacion IS NOT NULL AND numero_operacion != ''`
    )
    .all({ tipo })) as { numero_operacion: string }[];

  for (const row of rows) {
    const n = parseNumeroOperacionSeq(row.numero_operacion, prefix);
    if (n != null && n > max) max = n;
  }

  const seq = (await db
    .prepare("SELECT last_num FROM SIMULADOR_VENTA_GANADO_OP_SEQ WHERE tipo = ?")
    .get(tipo)) as { last_num: number } | undefined;
  if (seq != null && Number(seq.last_num) > max) max = Number(seq.last_num);

  return max;
}

async function syncOperacionSeq(db: Db, tipo: SimuladorVentaTipo, lastNum: number): Promise<void> {
  const existing = (await db
    .prepare("SELECT last_num FROM SIMULADOR_VENTA_GANADO_OP_SEQ WHERE tipo = ?")
    .get(tipo)) as { last_num: number } | undefined;

  if (!existing) {
    await db
      .prepare(
        "INSERT INTO SIMULADOR_VENTA_GANADO_OP_SEQ (tipo, last_num) VALUES (@tipo, @last_num)"
      )
      .run({ tipo, last_num: lastNum });
    return;
  }

  if (lastNum > Number(existing.last_num)) {
    await db
      .prepare("UPDATE SIMULADOR_VENTA_GANADO_OP_SEQ SET last_num = @last_num WHERE tipo = @tipo")
      .run({ last_num: lastNum, tipo });
  }
}

async function backfillNumeroOperacion(db: Db): Promise<void> {
  for (const tipo of SIMULADOR_VENTA_TIPOS) {
    const prefix = operacionPrefix(tipo);
    const pending = (await db
      .prepare(
        `SELECT id FROM SIMULADOR_VENTA_GANADO
         WHERE tipo = @tipo AND (numero_operacion IS NULL OR numero_operacion = '')
         ORDER BY id ASC`
      )
      .all({ tipo })) as { id: number }[];

    if (pending.length === 0) continue;

    let counter = await getMaxOperacionSeq(db, tipo);
    for (const row of pending) {
      counter += 1;
      const numero = formatNumeroOperacion(tipo, counter);
      await db
        .prepare("UPDATE SIMULADOR_VENTA_GANADO SET numero_operacion = @numero WHERE id = @id")
        .run({ numero, id: row.id });
    }
    await syncOperacionSeq(db, tipo, counter);
  }
}

async function allocateNumeroOperacion(db: Db, tipo: SimuladorVentaTipo): Promise<string> {
  const locked = (await db
    .prepare(
      "SELECT last_num FROM SIMULADOR_VENTA_GANADO_OP_SEQ WHERE tipo = @tipo FOR UPDATE"
    )
    .get({ tipo })) as { last_num: number } | undefined;

  let next: number;
  if (!locked) {
    next = (await getMaxOperacionSeq(db, tipo)) + 1;
    await db
      .prepare(
        "INSERT INTO SIMULADOR_VENTA_GANADO_OP_SEQ (tipo, last_num) VALUES (@tipo, @last_num)"
      )
      .run({ tipo, last_num: next });
  } else {
    next = Number(locked.last_num) + 1;
    await db
      .prepare("UPDATE SIMULADOR_VENTA_GANADO_OP_SEQ SET last_num = @last_num WHERE tipo = @tipo")
      .run({ last_num: next, tipo });
  }

  return formatNumeroOperacion(tipo, next);
}

export async function peekNextNumeroOperacion(
  db: Db,
  tipo: SimuladorVentaTipo
): Promise<string> {
  const next = (await getMaxOperacionSeq(db, tipo)) + 1;
  return formatNumeroOperacion(tipo, next);
}

export function tipoToSegmento(tipo: SimuladorVentaTipo): SegmentoPreciosGanado {
  return tipo === "EN_PIE" ? "REPOSICION" : "GORDO";
}

export function categoriasPorTipo(tipo: SimuladorVentaTipo): readonly string[] {
  return tipo === "EN_PIE"
    ? (["TERNERO", "TERNERA", "VACA_INVERNADA"] as const)
    : (["NOVILLO", "VACA", "VAQUILLONA"] as const);
}

export function labelsPorTipo(tipo: SimuladorVentaTipo): Record<string, string> {
  return tipo === "EN_PIE"
    ? CATEGORIA_GANADO_REPOSICION_LABELS
    : CATEGORIA_GANADO_GORDO_LABELS;
}

export async function initSimuladorVentaGanadoTable(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL CHECK (tipo IN ('EN_PIE', 'CUARTA_BALANZA')),
      segmento TEXT NOT NULL CHECK (segmento IN ('GORDO', 'REPOSICION')),
      categoria TEXT NOT NULL,
      modo_kg TEXT NOT NULL CHECK (modo_kg IN ('TOTAL', 'CABEZAS')),
      precio_usd_kg DOUBLE PRECISION NOT NULL,
      precio_ref_anio INTEGER,
      precio_ref_semana INTEGER,
      precio_ref_fecha_hasta TEXT,
      cantidad_animales DOUBLE PRECISION,
      kg_promedio DOUBLE PRECISION,
      kg_total DOUBLE PRECISION NOT NULL,
      total_usd DOUBLE PRECISION NOT NULL,
      total_usd_por_cabeza DOUBLE PRECISION,
      notas TEXT,
      destacada INTEGER NOT NULL DEFAULT 0,
      venta_realizada INTEGER NOT NULL DEFAULT 0,
      venta_realizada_en TIMESTAMPTZ,
      real_precio_usd_kg DOUBLE PRECISION,
      real_cantidad_animales DOUBLE PRECISION,
      real_kg_promedio DOUBLE PRECISION,
      real_kg_total DOUBLE PRECISION,
      real_total_usd DOUBLE PRECISION,
      real_total_usd_por_cabeza DOUBLE PRECISION,
      real_notas TEXT,
      destino TEXT,
      numero_operacion TEXT,
      usuario_id INTEGER,
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_OP_SEQ (
      tipo TEXT PRIMARY KEY CHECK (tipo IN ('EN_PIE', 'CUARTA_BALANZA')),
      last_num INTEGER NOT NULL DEFAULT 0
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sim_venta_ganado_tipo ON SIMULADOR_VENTA_GANADO(tipo, creado_en DESC)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sim_venta_ganado_user ON SIMULADOR_VENTA_GANADO(usuario_id, creado_en DESC)`
  ).run();

  for (const col of [
    "destacada INTEGER NOT NULL DEFAULT 0",
    "venta_realizada INTEGER NOT NULL DEFAULT 0",
    "venta_realizada_en TIMESTAMPTZ",
    "real_precio_usd_kg DOUBLE PRECISION",
    "real_cantidad_animales DOUBLE PRECISION",
    "real_kg_promedio DOUBLE PRECISION",
    "real_kg_total DOUBLE PRECISION",
    "real_total_usd DOUBLE PRECISION",
    "real_total_usd_por_cabeza DOUBLE PRECISION",
    "real_notas TEXT",
    "destino TEXT",
    "numero_operacion TEXT",
    "rendimiento DOUBLE PRECISION",
  ] as const) {
    const name = col.split(" ")[0]!;
    try {
      await db.prepare(`ALTER TABLE SIMULADOR_VENTA_GANADO ADD COLUMN ${col}`).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }

  await backfillNumeroOperacion(db);

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sim_venta_ganado_numero_operacion
     ON SIMULADOR_VENTA_GANADO(numero_operacion)
     WHERE numero_operacion IS NOT NULL AND numero_operacion != ''`
  ).run();

  await migrateAddCuentaIdColumn(db, "SIMULADOR_VENTA_GANADO");
}

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null,
  alias = "s"
): string {
  if (cuentaId != null) {
    query += ` AND ${alias}.cuenta_id = @cuentaId`;
    params.cuentaId = cuentaId;
  }
  return query;
}

export async function getPreciosReferenciaSimulador(
  db: Db,
  tipo: SimuladorVentaTipo
): Promise<SimuladorPreciosReferencia> {
  const segmento = tipoToSegmento(tipo);
  const rows = await listPreciosGanado(db, { segmento });
  const semanas = pivotSemanas(rows);
  const ultima = semanas[0] ?? null;

  return {
    tipo,
    segmento,
    ultima,
    precios: ultima?.precios ?? {},
    labels: labelsPorTipo(tipo),
    categorias: categoriasPorTipo(tipo),
    siguiente_numero_operacion: await peekNextNumeroOperacion(db, tipo),
  };
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

function toPgBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "1" || s === "true" || s === "t";
  }
  return Boolean(value);
}

function toNumOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): SimuladorVentaGanadoRow {
  return {
    id: Number(row.id),
    numero_operacion: row.numero_operacion != null ? String(row.numero_operacion) : "",
    tipo: row.tipo as SimuladorVentaTipo,
    segmento: row.segmento as SegmentoPreciosGanado,
    categoria: row.categoria as CategoriaPrecioGanado,
    modo_kg: row.modo_kg as SimuladorModoKg,
    precio_usd_kg: Number(row.precio_usd_kg),
    precio_ref_anio: row.precio_ref_anio != null ? Number(row.precio_ref_anio) : null,
    precio_ref_semana: row.precio_ref_semana != null ? Number(row.precio_ref_semana) : null,
    precio_ref_fecha_hasta:
      row.precio_ref_fecha_hasta != null ? String(row.precio_ref_fecha_hasta) : null,
    cantidad_animales:
      row.cantidad_animales != null ? Number(row.cantidad_animales) : null,
    kg_promedio: row.kg_promedio != null ? Number(row.kg_promedio) : null,
    kg_total: Number(row.kg_total),
    rendimiento: toNumOrNull(row.rendimiento),
    total_usd: Number(row.total_usd),
    total_usd_por_cabeza:
      row.total_usd_por_cabeza != null ? Number(row.total_usd_por_cabeza) : null,
    notas: row.notas != null ? String(row.notas) : null,
    destacada: toPgBool(row.destacada),
    venta_realizada: toPgBool(row.venta_realizada),
    venta_realizada_en:
      row.venta_realizada_en != null ? toIsoTimestamp(row.venta_realizada_en) : null,
    real_precio_usd_kg: toNumOrNull(row.real_precio_usd_kg),
    real_cantidad_animales: toNumOrNull(row.real_cantidad_animales),
    real_kg_promedio: toNumOrNull(row.real_kg_promedio),
    real_kg_total: toNumOrNull(row.real_kg_total),
    real_total_usd: toNumOrNull(row.real_total_usd),
    real_total_usd_por_cabeza: toNumOrNull(row.real_total_usd_por_cabeza),
    real_notas: row.real_notas != null ? String(row.real_notas) : null,
    destino: row.destino != null ? String(row.destino).trim() || null : null,
    usuario_id: row.usuario_id != null ? Number(row.usuario_id) : null,
    usuario_nombre: row.usuario_nombre != null ? String(row.usuario_nombre) : null,
    creado_en: toIsoTimestamp(row.creado_en),
    dispositivos_count: Number(row.dispositivos_count ?? 0),
  };
}

const SIM_VENTA_SELECT = `SELECT s.*, u.nombre AS usuario_nombre,
  (SELECT COUNT(*) FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO d WHERE d.simulacion_id = s.id) AS dispositivos_count`;

export interface SimuladorVentaGanadoListFilters {
  tipo?: SimuladorVentaTipo;
  limit?: number;
  cerradas?: boolean;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
  cuentaId?: number | null;
}

export async function listSimulacionesVentaGanado(
  db: Db,
  filters: SimuladorVentaGanadoListFilters = {}
): Promise<SimuladorVentaGanadoRow[]> {
  let query = `${SIM_VENTA_SELECT}
    FROM SIMULADOR_VENTA_GANADO s
    LEFT JOIN USERS u ON u.id = s.usuario_id
    WHERE 1=1`;
  const params: Record<string, string | number> = {};

  query = scopeCuenta(query, params, filters.cuentaId);

  if (filters.tipo) {
    query += " AND s.tipo = @tipo";
    params.tipo = filters.tipo;
  }

  if (filters.cerradas) {
    query += " AND s.venta_realizada = 1 AND s.real_total_usd IS NOT NULL";
  }

  if (filters.fecha_desde) {
    query += " AND s.venta_realizada_en >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters.fecha_hasta) {
    query += " AND s.venta_realizada_en < (@fecha_hasta::date + INTERVAL '1 day')";
    params.fecha_hasta = filters.fecha_hasta;
  }

  if (filters.busqueda?.trim()) {
    query += ` AND (
      s.numero_operacion ILIKE @busqueda OR
      s.categoria ILIKE @busqueda OR
      COALESCE(u.nombre, '') ILIKE @busqueda OR
      COALESCE(s.real_notas, '') ILIKE @busqueda OR
      COALESCE(s.destino, '') ILIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }

  if (filters.cerradas) {
    query += " ORDER BY s.venta_realizada_en DESC NULLS LAST, s.creado_en DESC";
  } else {
    query += " ORDER BY s.destacada DESC, s.venta_realizada ASC, s.creado_en DESC";
  }

  const defaultLimit = filters.cerradas ? 500 : 100;
  const limit = Math.min(Math.max(filters.limit ?? defaultLimit, 1), 500);
  query += ` LIMIT ${limit}`;

  const rows = (await db.prepare(query).all(params)) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function insertSimulacionVentaGanado(
  db: Db,
  input: SimuladorVentaGanadoInput,
  cuentaId?: number | null
): Promise<SimuladorVentaGanadoRow> {
  const segmento = tipoToSegmento(input.tipo);

  return db.transaction(async (tx) => {
    const numero_operacion = await allocateNumeroOperacion(tx, input.tipo);

    const result = await tx.prepare(
      `INSERT INTO SIMULADOR_VENTA_GANADO (
      tipo, segmento, categoria, modo_kg, precio_usd_kg,
      precio_ref_anio, precio_ref_semana, precio_ref_fecha_hasta,
      cantidad_animales, kg_promedio, kg_total, rendimiento, total_usd, total_usd_por_cabeza,
      notas, usuario_id, numero_operacion, cuenta_id
    ) VALUES (
      @tipo, @segmento, @categoria, @modo_kg, @precio_usd_kg,
      @precio_ref_anio, @precio_ref_semana, @precio_ref_fecha_hasta,
      @cantidad_animales, @kg_promedio, @kg_total, @rendimiento, @total_usd, @total_usd_por_cabeza,
      @notas, @usuario_id, @numero_operacion, @cuenta_id
    )`
    ).run({
      tipo: input.tipo,
      segmento,
      categoria: input.categoria,
      modo_kg: input.modo_kg,
      precio_usd_kg: input.precio_usd_kg,
      precio_ref_anio: input.precio_ref_anio ?? null,
      precio_ref_semana: input.precio_ref_semana ?? null,
      precio_ref_fecha_hasta: input.precio_ref_fecha_hasta ?? null,
      cantidad_animales: input.cantidad_animales ?? null,
      kg_promedio: input.kg_promedio ?? null,
      kg_total: input.kg_total,
      rendimiento: input.rendimiento ?? null,
      total_usd: input.total_usd,
      total_usd_por_cabeza: input.total_usd_por_cabeza ?? null,
      notas: input.notas?.trim() || null,
      usuario_id: input.usuario_id ?? null,
      numero_operacion,
      cuenta_id: cuentaId ?? null,
    });

    const id = Number(result.lastInsertRowid);
    if (!id) throw new Error("No se pudo guardar la simulación");
    const row = await getSimulacionVentaGanadoById(tx, id);
    if (!row) throw new Error("No se pudo recuperar la simulación guardada");
    return row;
  });
}

export async function getSimulacionVentaGanadoById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<SimuladorVentaGanadoRow | null> {
  let query = `${SIM_VENTA_SELECT}
       FROM SIMULADOR_VENTA_GANADO s
       LEFT JOIN USERS u ON u.id = s.usuario_id
       WHERE s.id = @id`;
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  const row = (await db.prepare(query).get(params)) as
    | Record<string, unknown>
    | undefined;
  return row ? mapRow(row) : null;
}

export async function deleteSimulacionVentaGanado(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<void> {
  const existing = await getSimulacionVentaGanadoById(db, id, cuentaId);
  if (!existing) throw new Error("Simulación no encontrada");
  if (existing.real_total_usd != null) {
    throw new Error("No se puede eliminar una operación con venta real registrada");
  }

  const result = await db.prepare("DELETE FROM SIMULADOR_VENTA_GANADO WHERE id = ?").run(id);
  if (((result as { changes?: number }).changes ?? 0) === 0) {
    throw new Error("Simulación no encontrada");
  }
}

export async function updateSimulacionVentaGanado(
  db: Db,
  id: number,
  input: SimuladorVentaGanadoInput,
  cuentaId?: number | null
): Promise<SimuladorVentaGanadoRow> {
  const existing = await getSimulacionVentaGanadoById(db, id, cuentaId);
  if (!existing) throw new Error("Simulación no encontrada");

  const segmento = tipoToSegmento(input.tipo);
  await db.prepare(
    `UPDATE SIMULADOR_VENTA_GANADO SET
      tipo = @tipo, segmento = @segmento, categoria = @categoria, modo_kg = @modo_kg,
      precio_usd_kg = @precio_usd_kg, precio_ref_anio = @precio_ref_anio,
      precio_ref_semana = @precio_ref_semana, precio_ref_fecha_hasta = @precio_ref_fecha_hasta,
      cantidad_animales = @cantidad_animales, kg_promedio = @kg_promedio,
      kg_total = @kg_total, rendimiento = @rendimiento, total_usd = @total_usd, total_usd_por_cabeza = @total_usd_por_cabeza,
      notas = @notas
     WHERE id = @id`
  ).run({
    id,
    tipo: input.tipo,
    segmento,
    categoria: input.categoria,
    modo_kg: input.modo_kg,
    precio_usd_kg: input.precio_usd_kg,
    precio_ref_anio: input.precio_ref_anio ?? null,
    precio_ref_semana: input.precio_ref_semana ?? null,
    precio_ref_fecha_hasta: input.precio_ref_fecha_hasta ?? null,
    cantidad_animales: input.cantidad_animales ?? null,
    kg_promedio: input.kg_promedio ?? null,
    kg_total: input.kg_total,
    rendimiento: input.rendimiento ?? null,
    total_usd: input.total_usd,
    total_usd_por_cabeza: input.total_usd_por_cabeza ?? null,
    notas: input.notas?.trim() || null,
  });

  const row = await getSimulacionVentaGanadoById(db, id);
  if (!row) throw new Error("No se pudo recuperar la simulación actualizada");
  return row;
}

export async function patchSimulacionVentaGanado(
  db: Db,
  id: number,
  patch: {
    destacada?: boolean;
    venta_realizada?: boolean;
    valores_reales?: SimuladorVentaRealInput | null;
  },
  cuentaId?: number | null
): Promise<SimuladorVentaGanadoRow> {
  const existing = await getSimulacionVentaGanadoById(db, id, cuentaId);
  if (!existing) throw new Error("Simulación no encontrada");

  const destacada = patch.destacada ?? existing.destacada;
  let venta_realizada = patch.venta_realizada ?? existing.venta_realizada;
  let venta_realizada_en = existing.venta_realizada_en;

  if (patch.venta_realizada === true && !existing.venta_realizada) {
    venta_realizada_en = new Date().toISOString();
  } else if (patch.venta_realizada === false) {
    venta_realizada_en = null;
  }

  let real_precio_usd_kg = existing.real_precio_usd_kg;
  let real_cantidad_animales = existing.real_cantidad_animales;
  let real_kg_promedio = existing.real_kg_promedio;
  let real_kg_total = existing.real_kg_total;
  let real_total_usd = existing.real_total_usd;
  let real_total_usd_por_cabeza = existing.real_total_usd_por_cabeza;
  let real_notas = existing.real_notas;

  if (patch.venta_realizada === false) {
    venta_realizada = false;
    venta_realizada_en = null;
    real_precio_usd_kg = null;
    real_cantidad_animales = null;
    real_kg_promedio = null;
    real_kg_total = null;
    real_total_usd = null;
    real_total_usd_por_cabeza = null;
    real_notas = null;
  } else if (patch.valores_reales) {
    const v = patch.valores_reales;
    real_precio_usd_kg = v.precio_usd_kg;
    real_cantidad_animales = v.cantidad_animales ?? null;
    real_kg_promedio = v.kg_promedio ?? null;
    real_kg_total = v.kg_total;
    real_total_usd = v.total_usd;
    real_total_usd_por_cabeza = v.total_usd_por_cabeza ?? null;
    real_notas = v.notas?.trim() || null;
    venta_realizada = true;
    if (!venta_realizada_en) venta_realizada_en = new Date().toISOString();
  }

  if (patch.venta_realizada === true && !patch.valores_reales && !existing.real_total_usd) {
    throw new Error("Completá los valores reales del embarque");
  }

  await db.transaction(async (tx) => {
    await tx.prepare(
      `UPDATE SIMULADOR_VENTA_GANADO SET
      destacada = @destacada,
      venta_realizada = @venta_realizada,
      venta_realizada_en = @venta_realizada_en,
      real_precio_usd_kg = @real_precio_usd_kg,
      real_cantidad_animales = @real_cantidad_animales,
      real_kg_promedio = @real_kg_promedio,
      real_kg_total = @real_kg_total,
      real_total_usd = @real_total_usd,
      real_total_usd_por_cabeza = @real_total_usd_por_cabeza,
      real_notas = @real_notas
     WHERE id = @id`
    ).run({
      id,
      destacada: destacada ? 1 : 0,
      venta_realizada: venta_realizada ? 1 : 0,
      venta_realizada_en,
      real_precio_usd_kg,
      real_cantidad_animales,
      real_kg_promedio,
      real_kg_total,
      real_total_usd,
      real_total_usd_por_cabeza,
      real_notas,
    });
  });

  const row = await getSimulacionVentaGanadoById(db, id);
  if (!row) throw new Error("No se pudo recuperar la simulación");
  return row;
}

export async function updateDestinoVentaGanado(
  db: Db,
  id: number,
  destino: string | null,
  cuentaId?: number | null
): Promise<SimuladorVentaGanadoRow> {
  const existing = await getSimulacionVentaGanadoById(db, id, cuentaId);
  if (!existing) throw new Error("Venta no encontrada");
  if (existing.real_total_usd == null) {
    throw new Error("Solo se puede asignar destino a ventas cerradas");
  }

  const normalized = destino?.trim().slice(0, 200) || null;
  await db.prepare(`UPDATE SIMULADOR_VENTA_GANADO SET destino = @destino WHERE id = @id`).run({
    id,
    destino: normalized,
  });

  const row = await getSimulacionVentaGanadoById(db, id);
  if (!row) throw new Error("No se pudo recuperar la venta");
  return row;
}
