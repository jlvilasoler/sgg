import type { Db } from "./db/pg-client.js";

export const TIPOS_PRESTAMO_PAGO = [
  "PRESTAMO",
  "HIPOTECARIO",
  "PRENDARIO",
  "LEASING",
  "TARJETA",
  "OTRO",
] as const;

export type TipoPrestamoPago = (typeof TIPOS_PRESTAMO_PAGO)[number];

export const MONEDAS_PAGO = ["UYU", "USD"] as const;
export type MonedaPagoPersonalizado = (typeof MONEDAS_PAGO)[number];

export interface PagoPersonalizadoCuota {
  id: number;
  nro_cuota: number;
  fecha: string;
  monto: number | null;
  descripcion: string | null;
  pagado: boolean;
}

export interface PagoPersonalizadoRow {
  id: number;
  cuenta_id: number;
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes: number | null;
  cantidad_cuotas: number;
  moneda: MonedaPagoPersonalizado;
  monto_cuota: number | null;
  notas: string | null;
  activo: boolean;
  cuotas: PagoPersonalizadoCuota[];
  creado_por_user_id: number | null;
  creado_en: string;
  actualizado_en: string;
}

export interface PagoPersonalizadoCuotaInput {
  nro_cuota: number;
  fecha: string;
  monto?: number | null;
  descripcion?: string | null;
  pagado?: boolean;
}

export interface PagoPersonalizadoInput {
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes?: number | null;
  moneda?: MonedaPagoPersonalizado;
  monto_cuota?: number | null;
  notas?: string | null;
  activo?: boolean;
  cuotas: PagoPersonalizadoCuotaInput[];
}

function isTipoPrestamo(value: string): value is TipoPrestamoPago {
  return (TIPOS_PRESTAMO_PAGO as readonly string[]).includes(value);
}

function isMoneda(value: string): value is MonedaPagoPersonalizado {
  return (MONEDAS_PAGO as readonly string[]).includes(value);
}

function parseIsoDate(value: unknown, label: string): string {
  const raw = String(value ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${label} debe tener formato AAAA-MM-DD.`);
  }
  return raw;
}

function normalizeOptionalMonto(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("El monto debe ser un número mayor o igual a 0.");
  }
  return Math.round(n * 100) / 100;
}

function normalizeTasa(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000) {
    throw new Error("La tasa de interés debe ser un porcentaje entre 0 y 1000.");
  }
  return Math.round(n * 1000) / 1000;
}

function normalizeCuotasInput(raw: unknown): PagoPersonalizadoCuotaInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Indicá al menos una cuota con fecha de vencimiento.");
  }
  if (raw.length > 360) {
    throw new Error("Máximo 360 cuotas por pago personalizado.");
  }
  const out: PagoPersonalizadoCuotaInput[] = [];
  const seenNro = new Set<number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      throw new Error("Formato de cuota inválido.");
    }
    const row = item as Record<string, unknown>;
    const nro = Number(row.nro_cuota);
    if (!Number.isInteger(nro) || nro < 1) {
      throw new Error("El número de cuota debe ser un entero ≥ 1.");
    }
    if (seenNro.has(nro)) {
      throw new Error(`La cuota ${nro} está duplicada.`);
    }
    seenNro.add(nro);
    out.push({
      nro_cuota: nro,
      fecha: parseIsoDate(row.fecha, `Fecha de la cuota ${nro}`),
      monto: normalizeOptionalMonto(row.monto),
      descripcion: (() => {
        const raw = row.descripcion != null ? String(row.descripcion).trim() : "";
        return raw ? raw.slice(0, 200) : null;
      })(),
      pagado: row.pagado === true || row.pagado === 1 || row.pagado === "1",
    });
  }
  return out.sort((a, b) => a.nro_cuota - b.nro_cuota || a.fecha.localeCompare(b.fecha));
}

function normalizeInput(data: PagoPersonalizadoInput): {
  entidad: string;
  tipo_prestamo: TipoPrestamoPago;
  tasa_interes: number | null;
  moneda: MonedaPagoPersonalizado;
  monto_cuota: number | null;
  notas: string | null;
  activo: boolean;
  cuotas: PagoPersonalizadoCuotaInput[];
} {
  const entidad = String(data.entidad ?? "").trim();
  if (!entidad) throw new Error("El nombre del contenido es obligatorio.");
  if (entidad.length > 120) throw new Error("El nombre del contenido no puede superar 120 caracteres.");

  const tipoRaw = String(data.tipo_prestamo ?? "PRESTAMO").trim().toUpperCase();
  if (!isTipoPrestamo(tipoRaw)) {
    throw new Error("Tipo de préstamo / pago inválido.");
  }

  const monedaRaw = String(data.moneda ?? "UYU").trim().toUpperCase();
  if (!isMoneda(monedaRaw)) throw new Error("Moneda inválida (UYU o USD).");

  const notasRaw = data.notas != null ? String(data.notas).trim() : "";
  const cuotas = normalizeCuotasInput(data.cuotas);

  return {
    entidad,
    tipo_prestamo: tipoRaw,
    tasa_interes: normalizeTasa(data.tasa_interes),
    moneda: monedaRaw,
    monto_cuota: normalizeOptionalMonto(data.monto_cuota),
    notas: notasRaw ? notasRaw.slice(0, 2000) : null,
    activo: data.activo !== false,
    cuotas,
  };
}

function rowDateToIso(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const d = String(parsed.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
}

function rowToCuota(row: Record<string, unknown>): PagoPersonalizadoCuota {
  const desc = row.descripcion != null ? String(row.descripcion).trim() : "";
  return {
    id: Number(row.id),
    nro_cuota: Number(row.nro_cuota),
    fecha: rowDateToIso(row.fecha),
    monto: row.monto != null ? Number(row.monto) : null,
    descripcion: desc || null,
    pagado: Number(row.pagado ?? 0) === 1,
  };
}

function rowToPago(
  row: Record<string, unknown>,
  cuotas: PagoPersonalizadoCuota[],
): PagoPersonalizadoRow {
  const tipoRaw = String(row.tipo_prestamo ?? "PRESTAMO").toUpperCase();
  const monedaRaw = String(row.moneda ?? "UYU").toUpperCase();
  return {
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    entidad: String(row.entidad ?? ""),
    tipo_prestamo: isTipoPrestamo(tipoRaw) ? tipoRaw : "OTRO",
    tasa_interes: row.tasa_interes != null ? Number(row.tasa_interes) : null,
    cantidad_cuotas: Number(row.cantidad_cuotas ?? cuotas.length),
    moneda: isMoneda(monedaRaw) ? monedaRaw : "UYU",
    monto_cuota: row.monto_cuota != null ? Number(row.monto_cuota) : null,
    notas: row.notas != null ? String(row.notas) : null,
    activo: Number(row.activo ?? 1) === 1,
    cuotas,
    creado_por_user_id:
      row.creado_por_user_id != null ? Number(row.creado_por_user_id) : null,
    creado_en: row.creado_en != null ? String(row.creado_en) : "",
    actualizado_en: row.actualizado_en != null ? String(row.actualizado_en) : "",
  };
}

export async function initPagosPersonalizadosTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS PAGOS_PERSONALIZADOS (
         id SERIAL PRIMARY KEY,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         entidad TEXT NOT NULL,
         tipo_prestamo TEXT NOT NULL DEFAULT 'PRESTAMO',
         tasa_interes DOUBLE PRECISION,
         cantidad_cuotas INTEGER NOT NULL DEFAULT 1,
         moneda TEXT NOT NULL DEFAULT 'UYU',
         monto_cuota DOUBLE PRECISION,
         notas TEXT,
         activo INTEGER NOT NULL DEFAULT 1,
         creado_por_user_id INTEGER,
         creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
         actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS PAGOS_PERSONALIZADOS_CUOTAS (
         id SERIAL PRIMARY KEY,
         pago_id INTEGER NOT NULL REFERENCES PAGOS_PERSONALIZADOS(id) ON DELETE CASCADE,
         nro_cuota INTEGER NOT NULL,
         fecha DATE NOT NULL,
         monto DOUBLE PRECISION,
         descripcion TEXT,
         pagado INTEGER NOT NULL DEFAULT 0,
         UNIQUE (pago_id, nro_cuota)
       )`,
    )
    .run();

  try {
    await db
      .prepare(`ALTER TABLE PAGOS_PERSONALIZADOS_CUOTAS ADD COLUMN descripcion TEXT`)
      .run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_pagos_pers_cuenta
       ON PAGOS_PERSONALIZADOS(cuenta_id, activo, actualizado_en DESC)`,
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_pagos_pers_cuotas_fecha
       ON PAGOS_PERSONALIZADOS_CUOTAS(fecha, pago_id)`,
    )
    .run();
}

async function loadCuotasForPago(db: Db, pagoId: number): Promise<PagoPersonalizadoCuota[]> {
  const rows = (await db
    .prepare(
      `SELECT id, nro_cuota, fecha, monto, descripcion, pagado
       FROM PAGOS_PERSONALIZADOS_CUOTAS
       WHERE pago_id = ?
       ORDER BY nro_cuota ASC, fecha ASC`,
    )
    .all(pagoId)) as Record<string, unknown>[];
  return rows.map(rowToCuota);
}

async function replaceCuotas(
  db: Db,
  pagoId: number,
  cuotas: PagoPersonalizadoCuotaInput[],
): Promise<void> {
  await db.prepare(`DELETE FROM PAGOS_PERSONALIZADOS_CUOTAS WHERE pago_id = ?`).run(pagoId);
  const ins = db.prepare(
    `INSERT INTO PAGOS_PERSONALIZADOS_CUOTAS (pago_id, nro_cuota, fecha, monto, descripcion, pagado)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const c of cuotas) {
    await ins.run(
      pagoId,
      c.nro_cuota,
      c.fecha,
      c.monto ?? null,
      c.descripcion ?? null,
      c.pagado ? 1 : 0,
    );
  }
}

export async function listPagosPersonalizados(
  db: Db,
  cuentaId: number,
  opts: { incluirInactivos?: boolean } = {},
): Promise<PagoPersonalizadoRow[]> {
  const rows = (await db
    .prepare(
      opts.incluirInactivos
        ? `SELECT * FROM PAGOS_PERSONALIZADOS WHERE cuenta_id = ? ORDER BY entidad ASC, id ASC`
        : `SELECT * FROM PAGOS_PERSONALIZADOS
           WHERE cuenta_id = ? AND COALESCE(activo, 1) = 1
           ORDER BY entidad ASC, id ASC`,
    )
    .all(cuentaId)) as Record<string, unknown>[];

  const out: PagoPersonalizadoRow[] = [];
  for (const row of rows) {
    const cuotas = await loadCuotasForPago(db, Number(row.id));
    out.push(rowToPago(row, cuotas));
  }
  return out;
}

export async function getPagoPersonalizadoById(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<PagoPersonalizadoRow | null> {
  const row = (await db
    .prepare(`SELECT * FROM PAGOS_PERSONALIZADOS WHERE id = ? AND cuenta_id = ?`)
    .get(id, cuentaId)) as Record<string, unknown> | undefined;
  if (!row) return null;
  const cuotas = await loadCuotasForPago(db, id);
  return rowToPago(row, cuotas);
}

export async function createPagoPersonalizado(
  db: Db,
  cuentaId: number,
  userId: number,
  data: PagoPersonalizadoInput,
): Promise<PagoPersonalizadoRow> {
  const n = normalizeInput(data);
  const inserted = (await db
    .prepare(
      `INSERT INTO PAGOS_PERSONALIZADOS (
         cuenta_id, entidad, tipo_prestamo, tasa_interes, cantidad_cuotas,
         moneda, monto_cuota, notas, activo, creado_por_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .get(
      cuentaId,
      n.entidad,
      n.tipo_prestamo,
      n.tasa_interes,
      n.cuotas.length,
      n.moneda,
      n.monto_cuota,
      n.notas,
      n.activo ? 1 : 0,
      userId,
    )) as { id: number };

  await replaceCuotas(db, Number(inserted.id), n.cuotas);
  const created = await getPagoPersonalizadoById(db, cuentaId, Number(inserted.id));
  if (!created) throw new Error("No se pudo crear el pago personalizado.");
  return created;
}

export async function updatePagoPersonalizado(
  db: Db,
  cuentaId: number,
  id: number,
  data: PagoPersonalizadoInput,
): Promise<PagoPersonalizadoRow> {
  const existing = await getPagoPersonalizadoById(db, cuentaId, id);
  if (!existing) throw new Error("Pago personalizado no encontrado.");

  const n = normalizeInput(data);
  await db
    .prepare(
      `UPDATE PAGOS_PERSONALIZADOS SET
         entidad = ?,
         tipo_prestamo = ?,
         tasa_interes = ?,
         cantidad_cuotas = ?,
         moneda = ?,
         monto_cuota = ?,
         notas = ?,
         activo = ?,
         actualizado_en = NOW()
       WHERE id = ? AND cuenta_id = ?`,
    )
    .run(
      n.entidad,
      n.tipo_prestamo,
      n.tasa_interes,
      n.cuotas.length,
      n.moneda,
      n.monto_cuota,
      n.notas,
      n.activo ? 1 : 0,
      id,
      cuentaId,
    );

  await replaceCuotas(db, id, n.cuotas);
  const updated = await getPagoPersonalizadoById(db, cuentaId, id);
  if (!updated) throw new Error("No se pudo actualizar el pago personalizado.");
  return updated;
}

export async function deletePagoPersonalizado(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<boolean> {
  const r = await db
    .prepare(`DELETE FROM PAGOS_PERSONALIZADOS WHERE id = ? AND cuenta_id = ?`)
    .run(id, cuentaId);
  return r.changes > 0;
}

export async function setCuotaPagada(
  db: Db,
  cuentaId: number,
  pagoId: number,
  nroCuota: number,
  pagado: boolean,
): Promise<PagoPersonalizadoRow> {
  const existing = await getPagoPersonalizadoById(db, cuentaId, pagoId);
  if (!existing) throw new Error("Pago personalizado no encontrado.");
  const cuota = existing.cuotas.find((c) => c.nro_cuota === nroCuota);
  if (!cuota) throw new Error("Cuota no encontrada.");

  await db
    .prepare(
      `UPDATE PAGOS_PERSONALIZADOS_CUOTAS SET pagado = ?
       WHERE pago_id = ? AND nro_cuota = ?`,
    )
    .run(pagado ? 1 : 0, pagoId, nroCuota);

  await db
    .prepare(
      `UPDATE PAGOS_PERSONALIZADOS SET actualizado_en = NOW()
       WHERE id = ? AND cuenta_id = ?`,
    )
    .run(pagoId, cuentaId);

  const updated = await getPagoPersonalizadoById(db, cuentaId, pagoId);
  if (!updated) throw new Error("No se pudo actualizar la cuota.");
  return updated;
}
