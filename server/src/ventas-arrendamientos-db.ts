import type { Db } from "./db/pg-client.js";
import { appendPresupuestoScope, type ResumenEmpresaScope } from "./empresa-scope.js";
import {
  backfillCuentaIdPorEmpresa,
  migrateAddCuentaIdColumn,
  resolveCuentaIdForEmpresaNombre,
} from "./empresas-cuenta-db.js";

export const DEPARTAMENTOS_ARRENDAMIENTO = ["RIVERA", "RIO_NEGRO"] as const;
export type DepartamentoArrendamiento = (typeof DEPARTAMENTOS_ARRENDAMIENTO)[number];

export type EmpresaArrendamiento = string;

export const FRECUENCIAS_PAGO_ARRENDAMIENTO = ["MENSUAL", "ANUAL"] as const;
export type FrecuenciaPagoArrendamiento = (typeof FRECUENCIAS_PAGO_ARRENDAMIENTO)[number];

export const TIPOS_MONTO_PAGO_ARRENDAMIENTO = ["VALOR", "PORCENTAJE"] as const;
export type TipoMontoPagoArrendamiento = (typeof TIPOS_MONTO_PAGO_ARRENDAMIENTO)[number];

export interface VentaArrendamientoRow {
  id: number;
  empresa: EmpresaArrendamiento;
  fecha_inicio: string;
  fecha_fin: string;
  departamento: DepartamentoArrendamiento;
  padron: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas: string | null;
  pago_frecuencia: FrecuenciaPagoArrendamiento;
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: TipoMontoPagoArrendamiento;
  pago_fin_monto: number;
  pago_fin_tipo: TipoMontoPagoArrendamiento;
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  pago_inicio_cobrado: boolean;
  pago_inicio_cobrado_en: string | null;
  pago_fin_cobrado: boolean;
  pago_fin_cobrado_en: string | null;
  real_fecha_inicio: string | null;
  real_fecha_fin: string | null;
  real_hectareas: number | null;
  real_precio_usd_ha: number | null;
  real_total_usd: number | null;
  real_notas: string | null;
  real_pago_frecuencia: FrecuenciaPagoArrendamiento | null;
  real_pago_inicio: string | null;
  real_pago_fin: string | null;
  real_pago_inicio_monto: number | null;
  real_pago_inicio_tipo: TipoMontoPagoArrendamiento | null;
  real_pago_fin_monto: number | null;
  real_pago_fin_tipo: TipoMontoPagoArrendamiento | null;
  destacada: boolean;
  creado_en: string;
}

export interface VentaArrendamientoRealInput {
  fecha_inicio: string;
  fecha_fin: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas?: string | null;
  pago_frecuencia: FrecuenciaPagoArrendamiento;
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: TipoMontoPagoArrendamiento;
  pago_fin_monto: number;
  pago_fin_tipo: TipoMontoPagoArrendamiento;
}

export interface VentaArrendamientoInput {
  empresa: EmpresaArrendamiento;
  fecha_inicio: string;
  fecha_fin: string;
  departamento: DepartamentoArrendamiento;
  padron: string;
  hectareas: number;
  precio_usd_ha: number;
  total_usd: number;
  notas: string | null;
  pago_frecuencia: FrecuenciaPagoArrendamiento;
  pago_inicio: string;
  pago_fin: string;
  pago_inicio_monto: number;
  pago_inicio_tipo: TipoMontoPagoArrendamiento;
  pago_fin_monto: number;
  pago_fin_tipo: TipoMontoPagoArrendamiento;
}

export interface VentaArrendamientoFilters {
  empresa?: string;
  empresas?: string[];
  cuenta_id?: number;
  departamento?: string;
  busqueda?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fraccionAnualArrendamiento(fechaInicio: string, fechaFin: string): number {
  const start = new Date(`${fechaInicio}T12:00:00`);
  const end = new Date(`${fechaFin}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Fechas inválidas para calcular el período");
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) {
    throw new Error("La fecha final debe ser posterior o igual a la fecha de inicio");
  }
  return days / 365;
}

export function calcularTotalArrendamientoEsperado(
  hectareas: number,
  precioUsdHa: number,
  fechaInicio: string,
  fechaFin: string
): number {
  return hectareas * precioUsdHa * fraccionAnualArrendamiento(fechaInicio, fechaFin);
}

function parseIsoDate(value: string, label: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) {
    throw new Error(`${label} inválida`);
  }
  const d = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${label} inválida`);
  }
  return trimmed;
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

export async function initVentasArrendamientosTable(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS VENTAS_ARRENDAMIENTO (
      id SERIAL PRIMARY KEY,
      empresa TEXT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      departamento TEXT NOT NULL CHECK (departamento IN ('RIVERA', 'RIO_NEGRO')),
      padron TEXT NOT NULL,
      hectareas DOUBLE PRECISION NOT NULL,
      precio_usd_ha DOUBLE PRECISION NOT NULL,
      total_usd DOUBLE PRECISION NOT NULL,
      notas TEXT,
      pago_frecuencia TEXT NOT NULL DEFAULT 'ANUAL' CHECK (pago_frecuencia IN ('MENSUAL', 'ANUAL')),
      pago_inicio DATE NOT NULL,
      pago_fin DATE NOT NULL,
      pago_inicio_monto DOUBLE PRECISION,
      pago_inicio_tipo TEXT CHECK (pago_inicio_tipo IN ('VALOR', 'PORCENTAJE')),
      pago_fin_monto DOUBLE PRECISION,
      pago_fin_tipo TEXT CHECK (pago_fin_tipo IN ('VALOR', 'PORCENTAJE')),
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )`
  ).run();

  try {
    await db.prepare("ALTER TABLE VENTAS_ARRENDAMIENTO ADD COLUMN notas TEXT").run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }

  for (const [col, ddl] of [
    ["pago_frecuencia", "TEXT DEFAULT 'ANUAL'"],
    ["pago_inicio", "DATE"],
    ["pago_fin", "DATE"],
    ["pago_inicio_monto", "DOUBLE PRECISION"],
    ["pago_inicio_tipo", "TEXT"],
    ["pago_fin_monto", "DOUBLE PRECISION"],
    ["pago_fin_tipo", "TEXT"],
    ["venta_realizada", "INTEGER NOT NULL DEFAULT 0"],
    ["venta_realizada_en", "TIMESTAMPTZ"],
    ["pago_inicio_cobrado", "INTEGER NOT NULL DEFAULT 0"],
    ["pago_inicio_cobrado_en", "TIMESTAMPTZ"],
    ["pago_fin_cobrado", "INTEGER NOT NULL DEFAULT 0"],
    ["pago_fin_cobrado_en", "TIMESTAMPTZ"],
    ["destacada", "INTEGER NOT NULL DEFAULT 0"],
    ["real_fecha_inicio", "DATE"],
    ["real_fecha_fin", "DATE"],
    ["real_hectareas", "DOUBLE PRECISION"],
    ["real_precio_usd_ha", "DOUBLE PRECISION"],
    ["real_total_usd", "DOUBLE PRECISION"],
    ["real_notas", "TEXT"],
    ["real_pago_frecuencia", "TEXT"],
    ["real_pago_inicio", "DATE"],
    ["real_pago_fin", "DATE"],
    ["real_pago_inicio_monto", "DOUBLE PRECISION"],
    ["real_pago_inicio_tipo", "TEXT"],
    ["real_pago_fin_monto", "DOUBLE PRECISION"],
    ["real_pago_fin_tipo", "TEXT"],
  ] as const) {
    try {
      await db.prepare(`ALTER TABLE VENTAS_ARRENDAMIENTO ADD COLUMN ${col} ${ddl}`).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }

  await db.prepare(
    `UPDATE VENTAS_ARRENDAMIENTO
     SET pago_frecuencia = COALESCE(pago_frecuencia, 'ANUAL'),
         pago_inicio = COALESCE(pago_inicio, fecha_inicio),
         pago_fin = COALESCE(pago_fin, fecha_fin)
     WHERE pago_frecuencia IS NULL OR pago_inicio IS NULL OR pago_fin IS NULL`
  ).run();

  // Contratos ya cerrados: se consideran cobrados por completo (histórico).
  await db.prepare(
    `UPDATE VENTAS_ARRENDAMIENTO
     SET pago_inicio_cobrado = 1,
         pago_inicio_cobrado_en = COALESCE(pago_inicio_cobrado_en, venta_realizada_en, NOW()),
         pago_fin_cobrado = 1,
         pago_fin_cobrado_en = COALESCE(pago_fin_cobrado_en, venta_realizada_en, NOW())
     WHERE COALESCE(venta_realizada, 0) = 1
       AND COALESCE(pago_inicio_cobrado, 0) = 0
       AND COALESCE(pago_fin_cobrado, 0) = 0`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ventas_arr_periodo
     ON VENTAS_ARRENDAMIENTO(fecha_inicio DESC, creado_en DESC)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ventas_arr_empresa
     ON VENTAS_ARRENDAMIENTO(empresa, fecha_inicio DESC)`
  ).run();

  await migrateAddCuentaIdColumn(db, "VENTAS_ARRENDAMIENTO");
  await backfillCuentaIdPorEmpresa(db, "VENTAS_ARRENDAMIENTO");
}

function mapRow(row: Record<string, unknown>): VentaArrendamientoRow {
  const fechaInicio = rowDateToIso(row.fecha_inicio);
  const fechaFin = rowDateToIso(row.fecha_fin);
  return {
    id: Number(row.id),
    empresa: String(row.empresa) as EmpresaArrendamiento,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    departamento: String(row.departamento) as DepartamentoArrendamiento,
    padron: String(row.padron),
    hectareas: Number(row.hectareas),
    precio_usd_ha: Number(row.precio_usd_ha),
    total_usd: Number(row.total_usd),
    notas: row.notas != null ? String(row.notas) : null,
    pago_frecuencia: String(row.pago_frecuencia ?? "ANUAL") as FrecuenciaPagoArrendamiento,
    pago_inicio: rowDateToIso(row.pago_inicio),
    pago_fin: rowDateToIso(row.pago_fin),
    pago_inicio_monto: Number(row.pago_inicio_monto ?? 0),
    pago_inicio_tipo: String(row.pago_inicio_tipo ?? "VALOR") as TipoMontoPagoArrendamiento,
    pago_fin_monto: Number(row.pago_fin_monto ?? 0),
    pago_fin_tipo: String(row.pago_fin_tipo ?? "VALOR") as TipoMontoPagoArrendamiento,
    venta_realizada: Number(row.venta_realizada ?? 0) === 1,
    venta_realizada_en: toIsoTimestampOrNull(row.venta_realizada_en),
    pago_inicio_cobrado: Number(row.pago_inicio_cobrado ?? 0) === 1,
    pago_inicio_cobrado_en: toIsoTimestampOrNull(row.pago_inicio_cobrado_en),
    pago_fin_cobrado: Number(row.pago_fin_cobrado ?? 0) === 1,
    pago_fin_cobrado_en: toIsoTimestampOrNull(row.pago_fin_cobrado_en),
    real_fecha_inicio: row.real_fecha_inicio != null ? rowDateToIso(row.real_fecha_inicio) : null,
    real_fecha_fin: row.real_fecha_fin != null ? rowDateToIso(row.real_fecha_fin) : null,
    real_hectareas: row.real_hectareas != null ? Number(row.real_hectareas) : null,
    real_precio_usd_ha: row.real_precio_usd_ha != null ? Number(row.real_precio_usd_ha) : null,
    real_total_usd: row.real_total_usd != null ? Number(row.real_total_usd) : null,
    real_notas: row.real_notas != null ? String(row.real_notas) : null,
    real_pago_frecuencia:
      row.real_pago_frecuencia != null
        ? (String(row.real_pago_frecuencia) as FrecuenciaPagoArrendamiento)
        : null,
    real_pago_inicio: row.real_pago_inicio != null ? rowDateToIso(row.real_pago_inicio) : null,
    real_pago_fin: row.real_pago_fin != null ? rowDateToIso(row.real_pago_fin) : null,
    real_pago_inicio_monto:
      row.real_pago_inicio_monto != null ? Number(row.real_pago_inicio_monto) : null,
    real_pago_inicio_tipo:
      row.real_pago_inicio_tipo != null
        ? (String(row.real_pago_inicio_tipo) as TipoMontoPagoArrendamiento)
        : null,
    real_pago_fin_monto: row.real_pago_fin_monto != null ? Number(row.real_pago_fin_monto) : null,
    real_pago_fin_tipo:
      row.real_pago_fin_tipo != null
        ? (String(row.real_pago_fin_tipo) as TipoMontoPagoArrendamiento)
        : null,
    destacada: Number(row.destacada ?? 0) === 1,
    creado_en: toIsoTimestamp(row.creado_en) || "",
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

function toIsoTimestampOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const iso = toIsoTimestamp(value);
  return iso || null;
}

function esPagoAnualFraccionadoArrendamiento(row: {
  pago_frecuencia: FrecuenciaPagoArrendamiento;
  pago_inicio: string;
  pago_fin: string;
  real_pago_frecuencia: FrecuenciaPagoArrendamiento | null;
  real_pago_inicio: string | null;
  real_pago_fin: string | null;
}): boolean {
  const freq = row.real_pago_frecuencia ?? row.pago_frecuencia;
  if (freq !== "ANUAL") return false;
  const ini = row.real_pago_inicio ?? row.pago_inicio;
  const fin = row.real_pago_fin ?? row.pago_fin;
  return Boolean(ini && fin && ini !== fin);
}

function normalizeInput(data: VentaArrendamientoInput): VentaArrendamientoInput {
  if (!String(data.empresa ?? "").trim()) {
    throw new Error("La empresa es obligatoria");
  }
  if (!DEPARTAMENTOS_ARRENDAMIENTO.includes(data.departamento)) {
    throw new Error("Departamento inválido");
  }

  const fecha_inicio = parseIsoDate(data.fecha_inicio, "Fecha de inicio");
  const fecha_fin = parseIsoDate(data.fecha_fin, "Fecha final");
  if (fecha_fin < fecha_inicio) {
    throw new Error("La fecha final debe ser posterior o igual a la fecha de inicio");
  }

  const padron = String(data.padron ?? "").trim();
  if (!padron) {
    throw new Error("El padrón es obligatorio");
  }

  const hectareas = Number(data.hectareas);
  const precio_usd_ha = Number(data.precio_usd_ha);
  const total_usd = Number(data.total_usd);

  if (!Number.isFinite(hectareas) || hectareas <= 0) {
    throw new Error("Las hectáreas deben ser mayores a cero");
  }
  if (!Number.isFinite(precio_usd_ha) || precio_usd_ha <= 0) {
    throw new Error("El precio por hectárea debe ser mayor a cero");
  }
  if (!Number.isFinite(total_usd) || total_usd <= 0) {
    throw new Error("El total de arrendamiento es inválido");
  }

  const expected = calcularTotalArrendamientoEsperado(
    hectareas,
    precio_usd_ha,
    fecha_inicio,
    fecha_fin
  );
  if (Math.abs(expected - total_usd) > 0.02) {
    throw new Error("El total no coincide con hectáreas × precio × período");
  }

  const notasRaw = data.notas != null ? String(data.notas).trim() : "";
  const notas = notasRaw || null;
  if (notas && notas.length > 500) {
    throw new Error("Las notas no pueden superar 500 caracteres");
  }

  if (!FRECUENCIAS_PAGO_ARRENDAMIENTO.includes(data.pago_frecuencia)) {
    throw new Error("Frecuencia de pago inválida");
  }
  const pago_inicio = parseIsoDate(data.pago_inicio, "Pago inicio");
  const pago_fin = parseIsoDate(data.pago_fin, "Pago final");
  if (pago_fin < pago_inicio) {
    throw new Error("El pago final debe ser posterior o igual al pago inicio");
  }

  const pago_inicio_monto = Number(data.pago_inicio_monto);
  const pago_fin_monto = Number(data.pago_fin_monto);
  if (!TIPOS_MONTO_PAGO_ARRENDAMIENTO.includes(data.pago_inicio_tipo)) {
    throw new Error("Tipo de monto de pago inicio inválido");
  }
  if (!TIPOS_MONTO_PAGO_ARRENDAMIENTO.includes(data.pago_fin_tipo)) {
    throw new Error("Tipo de monto de pago final inválido");
  }
  if (!Number.isFinite(pago_inicio_monto) || pago_inicio_monto <= 0) {
    throw new Error("El monto de pago inicio debe ser mayor a cero");
  }
  if (!Number.isFinite(pago_fin_monto) || pago_fin_monto <= 0) {
    throw new Error("El monto de pago final debe ser mayor a cero");
  }
  if (data.pago_inicio_tipo === "PORCENTAJE" && pago_inicio_monto > 100) {
    throw new Error("El porcentaje de pago inicio no puede superar 100");
  }
  if (data.pago_fin_tipo === "PORCENTAJE" && pago_fin_monto > 100) {
    throw new Error("El porcentaje de pago final no puede superar 100");
  }

  return {
    empresa: data.empresa,
    fecha_inicio,
    fecha_fin,
    departamento: data.departamento,
    padron,
    hectareas,
    precio_usd_ha,
    total_usd,
    notas,
    pago_frecuencia: data.pago_frecuencia,
    pago_inicio,
    pago_fin,
    pago_inicio_monto,
    pago_inicio_tipo: data.pago_inicio_tipo,
    pago_fin_monto,
    pago_fin_tipo: data.pago_fin_tipo,
  };
}

export async function listVentasArrendamientos(
  db: Db,
  filters: VentaArrendamientoFilters = {}
): Promise<VentaArrendamientoRow[]> {
  let sql = "SELECT * FROM VENTAS_ARRENDAMIENTO WHERE 1=1";
  const params: Record<string, string | number> = {};
  const scope: ResumenEmpresaScope = {
    empresa: filters.empresa,
    empresas: filters.empresas,
    cuenta_id: filters.cuenta_id,
  };
  sql = appendPresupuestoScope(sql, params, scope);

  if (filters.departamento) {
    sql += " AND departamento = @departamento";
    params.departamento = filters.departamento;
  }
  if (filters.busqueda?.trim()) {
    sql += ` AND (
      empresa ILIKE @busqueda OR
      departamento ILIKE @busqueda OR
      padron ILIKE @busqueda OR
      COALESCE(notas, '') ILIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }

  sql += " ORDER BY fecha_inicio DESC, creado_en DESC, id DESC";
  const rows = (await db.prepare(sql).all(params)) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function insertVentaArrendamiento(
  db: Db,
  data: VentaArrendamientoInput,
  cuentaId?: number | null,
): Promise<number> {
  const row = normalizeInput(data);
  const resolvedCuentaId =
    cuentaId ?? (await resolveCuentaIdForEmpresaNombre(db, row.empresa, cuentaId));
  const result = await db.prepare(
    `INSERT INTO VENTAS_ARRENDAMIENTO (
      empresa, fecha_inicio, fecha_fin, departamento, padron,
      hectareas, precio_usd_ha, total_usd, notas,
      pago_frecuencia, pago_inicio, pago_fin,
      pago_inicio_monto, pago_inicio_tipo, pago_fin_monto, pago_fin_tipo, cuenta_id
    ) VALUES (
      @empresa, @fecha_inicio, @fecha_fin, @departamento, @padron,
      @hectareas, @precio_usd_ha, @total_usd, @notas,
      @pago_frecuencia, @pago_inicio, @pago_fin,
      @pago_inicio_monto, @pago_inicio_tipo, @pago_fin_monto, @pago_fin_tipo, @cuenta_id
    )`
  ).run({ ...row, cuenta_id: resolvedCuentaId });
  const id = Number(result.lastInsertRowid);
  if (!id) throw new Error("No se pudo guardar el registro");
  return id;
}

export async function getVentaArrendamientoById(
  db: Db,
  id: number,
  cuentaId?: number | null,
): Promise<VentaArrendamientoRow | undefined> {
  let sql = "SELECT * FROM VENTAS_ARRENDAMIENTO WHERE id = @id";
  const params: Record<string, number> = { id };
  if (cuentaId != null && cuentaId > 0) {
    sql += " AND cuenta_id = @cuenta_id";
    params.cuenta_id = cuentaId;
  }
  const row = (await db.prepare(sql).get(params)) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export async function updateVentaArrendamiento(
  db: Db,
  id: number,
  data: VentaArrendamientoInput,
  cuentaId?: number | null,
): Promise<VentaArrendamientoRow> {
  const existing = await getVentaArrendamientoById(db, id, cuentaId);
  if (!existing) throw new Error("Simulación no encontrada");
  if (existing.venta_realizada) {
    throw new Error("No se puede editar una simulación con operación confirmada");
  }

  const row = normalizeInput(data);
  const resolvedCuentaId =
    cuentaId ?? (await resolveCuentaIdForEmpresaNombre(db, row.empresa, cuentaId));
  const result = await db.prepare(
    `UPDATE VENTAS_ARRENDAMIENTO SET
      empresa = @empresa,
      fecha_inicio = @fecha_inicio,
      fecha_fin = @fecha_fin,
      departamento = @departamento,
      padron = @padron,
      hectareas = @hectareas,
      precio_usd_ha = @precio_usd_ha,
      total_usd = @total_usd,
      notas = @notas,
      pago_frecuencia = @pago_frecuencia,
      pago_inicio = @pago_inicio,
      pago_fin = @pago_fin,
      pago_inicio_monto = @pago_inicio_monto,
      pago_inicio_tipo = @pago_inicio_tipo,
      pago_fin_monto = @pago_fin_monto,
      pago_fin_tipo = @pago_fin_tipo,
      cuenta_id = @cuenta_id
     WHERE id = @id`
  ).run({ ...row, id, cuenta_id: resolvedCuentaId });

  if (result.changes === 0) throw new Error("No se pudo actualizar el registro");
  const updated = await getVentaArrendamientoById(db, id, cuentaId);
  if (!updated) throw new Error("No se pudo actualizar el registro");
  return updated;
}

export async function deleteVentaArrendamiento(
  db: Db,
  id: number,
  cuentaId?: number | null,
): Promise<boolean> {
  const existing = await getVentaArrendamientoById(db, id, cuentaId);
  if (!existing) return false;
  return (await db.prepare("DELETE FROM VENTAS_ARRENDAMIENTO WHERE id = ?").run(id)).changes > 0;
}

function normalizeRealInput(data: VentaArrendamientoRealInput): VentaArrendamientoRealInput {
  const fecha_inicio = parseIsoDate(data.fecha_inicio, "Fecha de inicio real");
  const fecha_fin = parseIsoDate(data.fecha_fin, "Fecha final real");
  if (fecha_fin < fecha_inicio) {
    throw new Error("La fecha final real debe ser posterior o igual a la fecha de inicio");
  }

  const hectareas = Number(data.hectareas);
  const precio_usd_ha = Number(data.precio_usd_ha);
  const total_usd = Number(data.total_usd);

  if (!Number.isFinite(hectareas) || hectareas <= 0) {
    throw new Error("Las hectáreas reales deben ser mayores a cero");
  }
  if (!Number.isFinite(precio_usd_ha) || precio_usd_ha <= 0) {
    throw new Error("El precio real por hectárea debe ser mayor a cero");
  }
  if (!Number.isFinite(total_usd) || total_usd <= 0) {
    throw new Error("El total real de arrendamiento es inválido");
  }

  const expected = calcularTotalArrendamientoEsperado(
    hectareas,
    precio_usd_ha,
    fecha_inicio,
    fecha_fin
  );
  if (Math.abs(expected - total_usd) > 0.02) {
    throw new Error("El total real no coincide con hectáreas × precio × período");
  }

  const notasRaw = data.notas != null ? String(data.notas).trim() : "";
  const notas = notasRaw || null;
  if (notas && notas.length > 500) {
    throw new Error("Las notas reales no pueden superar 500 caracteres");
  }

  if (!FRECUENCIAS_PAGO_ARRENDAMIENTO.includes(data.pago_frecuencia)) {
    throw new Error("Frecuencia de pago real inválida");
  }
  const pago_inicio = parseIsoDate(data.pago_inicio, "Pago inicio real");
  const pago_fin = parseIsoDate(data.pago_fin, "Pago final real");
  if (pago_fin < pago_inicio) {
    throw new Error("El pago final real debe ser posterior o igual al pago inicio");
  }

  const pago_inicio_monto = Number(data.pago_inicio_monto);
  const pago_fin_monto = Number(data.pago_fin_monto);
  if (!TIPOS_MONTO_PAGO_ARRENDAMIENTO.includes(data.pago_inicio_tipo)) {
    throw new Error("Tipo de monto de pago inicio real inválido");
  }
  if (!TIPOS_MONTO_PAGO_ARRENDAMIENTO.includes(data.pago_fin_tipo)) {
    throw new Error("Tipo de monto de pago final real inválido");
  }
  if (!Number.isFinite(pago_inicio_monto) || pago_inicio_monto <= 0) {
    throw new Error("El monto real de pago inicio debe ser mayor a cero");
  }
  if (!Number.isFinite(pago_fin_monto) || pago_fin_monto <= 0) {
    throw new Error("El monto real de pago final debe ser mayor a cero");
  }

  return {
    fecha_inicio,
    fecha_fin,
    hectareas,
    precio_usd_ha,
    total_usd,
    notas,
    pago_frecuencia: data.pago_frecuencia,
    pago_inicio,
    pago_fin,
    pago_inicio_monto,
    pago_inicio_tipo: data.pago_inicio_tipo,
    pago_fin_monto,
    pago_fin_tipo: data.pago_fin_tipo,
  };
}

export async function patchVentaArrendamiento(
  db: Db,
  id: number,
  patch: {
    venta_realizada?: boolean;
    valores_reales?: VentaArrendamientoRealInput | null;
    destacada?: boolean;
    pago_inicio_cobrado?: boolean;
    pago_fin_cobrado?: boolean;
  },
  cuentaId?: number | null,
): Promise<VentaArrendamientoRow> {
  const existing = await getVentaArrendamientoById(db, id, cuentaId);
  if (!existing) throw new Error("Simulación no encontrada");

  let venta_realizada = patch.venta_realizada ?? existing.venta_realizada;
  let venta_realizada_en = existing.venta_realizada_en;
  let destacada = patch.destacada ?? existing.destacada;

  if (patch.venta_realizada === true && !existing.venta_realizada) {
    venta_realizada_en = new Date().toISOString();
  } else if (patch.venta_realizada === false) {
    venta_realizada_en = null;
  }

  let real_fecha_inicio = existing.real_fecha_inicio;
  let real_fecha_fin = existing.real_fecha_fin;
  let real_hectareas = existing.real_hectareas;
  let real_precio_usd_ha = existing.real_precio_usd_ha;
  let real_total_usd = existing.real_total_usd;
  let real_notas = existing.real_notas;
  let real_pago_frecuencia = existing.real_pago_frecuencia;
  let real_pago_inicio = existing.real_pago_inicio;
  let real_pago_fin = existing.real_pago_fin;
  let real_pago_inicio_monto = existing.real_pago_inicio_monto;
  let real_pago_inicio_tipo = existing.real_pago_inicio_tipo;
  let real_pago_fin_monto = existing.real_pago_fin_monto;
  let real_pago_fin_tipo = existing.real_pago_fin_tipo;

  let pago_inicio_cobrado = existing.pago_inicio_cobrado;
  let pago_inicio_cobrado_en = existing.pago_inicio_cobrado_en;
  let pago_fin_cobrado = existing.pago_fin_cobrado;
  let pago_fin_cobrado_en = existing.pago_fin_cobrado_en;

  if (patch.venta_realizada === false) {
    venta_realizada = false;
    venta_realizada_en = null;
    real_fecha_inicio = null;
    real_fecha_fin = null;
    real_hectareas = null;
    real_precio_usd_ha = null;
    real_total_usd = null;
    real_notas = null;
    real_pago_frecuencia = null;
    real_pago_inicio = null;
    real_pago_fin = null;
    real_pago_inicio_monto = null;
    real_pago_inicio_tipo = null;
    real_pago_fin_monto = null;
    real_pago_fin_tipo = null;
    pago_inicio_cobrado = false;
    pago_inicio_cobrado_en = null;
    pago_fin_cobrado = false;
    pago_fin_cobrado_en = null;
  } else if (patch.valores_reales) {
    const v = normalizeRealInput(patch.valores_reales);
    real_fecha_inicio = v.fecha_inicio;
    real_fecha_fin = v.fecha_fin;
    real_hectareas = v.hectareas;
    real_precio_usd_ha = v.precio_usd_ha;
    real_total_usd = v.total_usd;
    real_notas = v.notas ?? null;
    real_pago_frecuencia = v.pago_frecuencia;
    real_pago_inicio = v.pago_inicio;
    real_pago_fin = v.pago_fin;
    real_pago_inicio_monto = v.pago_inicio_monto;
    real_pago_inicio_tipo = v.pago_inicio_tipo;
    real_pago_fin_monto = v.pago_fin_monto;
    real_pago_fin_tipo = v.pago_fin_tipo;
    venta_realizada = true;
    if (!venta_realizada_en) venta_realizada_en = new Date().toISOString();

    const fraccionado = esPagoAnualFraccionadoArrendamiento({
      pago_frecuencia: v.pago_frecuencia,
      pago_inicio: v.pago_inicio,
      pago_fin: v.pago_fin,
      real_pago_frecuencia: v.pago_frecuencia,
      real_pago_inicio: v.pago_inicio,
      real_pago_fin: v.pago_fin,
    });
    pago_inicio_cobrado_en = toIsoTimestampOrNull(pago_inicio_cobrado_en);
    pago_fin_cobrado_en = toIsoTimestampOrNull(pago_fin_cobrado_en);
    // Cerrar no implica cobrar el saldo futuro si hay 2 pagos anuales.
    if (!fraccionado) {
      pago_inicio_cobrado = true;
      pago_inicio_cobrado_en =
        toIsoTimestampOrNull(pago_inicio_cobrado_en) ?? new Date().toISOString();
      pago_fin_cobrado = true;
      pago_fin_cobrado_en =
        toIsoTimestampOrNull(pago_fin_cobrado_en) ?? new Date().toISOString();
    }
  }

  if (patch.venta_realizada === true && !patch.valores_reales && existing.real_total_usd == null) {
    throw new Error("Completá los valores reales de la operación");
  }

  if (typeof patch.pago_inicio_cobrado === "boolean") {
    if (pago_fin_cobrado && !patch.pago_inicio_cobrado) {
      throw new Error("No se puede anular el pago inicial si el pago final ya está cobrado");
    }
    pago_inicio_cobrado = patch.pago_inicio_cobrado;
    pago_inicio_cobrado_en = pago_inicio_cobrado
      ? toIsoTimestampOrNull(existing.pago_inicio_cobrado_en) ?? new Date().toISOString()
      : null;
  }

  if (typeof patch.pago_fin_cobrado === "boolean") {
    if (patch.pago_fin_cobrado && !pago_inicio_cobrado) {
      throw new Error("Primero debe cobrarse el pago inicial");
    }
    const fraccionado = esPagoAnualFraccionadoArrendamiento({
      pago_frecuencia: real_pago_frecuencia ?? existing.pago_frecuencia,
      pago_inicio: real_pago_inicio ?? existing.pago_inicio,
      pago_fin: real_pago_fin ?? existing.pago_fin,
      real_pago_frecuencia: real_pago_frecuencia ?? existing.real_pago_frecuencia,
      real_pago_inicio: real_pago_inicio ?? existing.real_pago_inicio,
      real_pago_fin: real_pago_fin ?? existing.real_pago_fin,
    });
    if (patch.pago_fin_cobrado && !fraccionado) {
      throw new Error("El cobro del pago final solo aplica a arrendamientos con 2 pagos anuales");
    }
    pago_fin_cobrado = patch.pago_fin_cobrado;
    pago_fin_cobrado_en = pago_fin_cobrado
      ? toIsoTimestampOrNull(existing.pago_fin_cobrado_en) ?? new Date().toISOString()
      : null;
  }

  await db.prepare(
    `UPDATE VENTAS_ARRENDAMIENTO SET
      venta_realizada = @venta_realizada,
      venta_realizada_en = @venta_realizada_en,
      destacada = @destacada,
      pago_inicio_cobrado = @pago_inicio_cobrado,
      pago_inicio_cobrado_en = @pago_inicio_cobrado_en,
      pago_fin_cobrado = @pago_fin_cobrado,
      pago_fin_cobrado_en = @pago_fin_cobrado_en,
      real_fecha_inicio = @real_fecha_inicio,
      real_fecha_fin = @real_fecha_fin,
      real_hectareas = @real_hectareas,
      real_precio_usd_ha = @real_precio_usd_ha,
      real_total_usd = @real_total_usd,
      real_notas = @real_notas,
      real_pago_frecuencia = @real_pago_frecuencia,
      real_pago_inicio = @real_pago_inicio,
      real_pago_fin = @real_pago_fin,
      real_pago_inicio_monto = @real_pago_inicio_monto,
      real_pago_inicio_tipo = @real_pago_inicio_tipo,
      real_pago_fin_monto = @real_pago_fin_monto,
      real_pago_fin_tipo = @real_pago_fin_tipo
     WHERE id = @id`
  ).run({
    id,
    venta_realizada: venta_realizada ? 1 : 0,
    venta_realizada_en: toIsoTimestampOrNull(venta_realizada_en),
    destacada: destacada ? 1 : 0,
    pago_inicio_cobrado: pago_inicio_cobrado ? 1 : 0,
    pago_inicio_cobrado_en: toIsoTimestampOrNull(pago_inicio_cobrado_en),
    pago_fin_cobrado: pago_fin_cobrado ? 1 : 0,
    pago_fin_cobrado_en: toIsoTimestampOrNull(pago_fin_cobrado_en),
    real_fecha_inicio,
    real_fecha_fin,
    real_hectareas,
    real_precio_usd_ha,
    real_total_usd,
    real_notas,
    real_pago_frecuencia,
    real_pago_inicio,
    real_pago_fin,
    real_pago_inicio_monto,
    real_pago_inicio_tipo,
    real_pago_fin_monto,
    real_pago_fin_tipo,
  });

  const updated = await getVentaArrendamientoById(db, id, cuentaId);
  if (!updated) throw new Error("No se pudo actualizar el registro");
  return updated;
}
