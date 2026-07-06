import type { Db } from "./db/pg-client.js";
import type { Presupuesto, PresupuestoInput } from "./types.js";

export const GASTO_AUTO_PENDIENTE_ESTADOS = [
  "pendiente_aprobacion",
  "aprobado",
  "rechazado",
  "omitido",
] as const;

export type GastoAutoPendienteEstado = (typeof GASTO_AUTO_PENDIENTE_ESTADOS)[number];

export interface GastoAutomatizacionRow {
  id: number;
  cuenta_id: number;
  nombre: string;
  presupuesto_origen_id: number | null;
  empresa: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  observaciones: string;
  rubro: string;
  sub_rubro: string;
  responsable_gasto: string;
  funcionario_cedula: string;
  nro_factura: string;
  nro_operacion_origen: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  dia_mes: number;
  /** Cada cuántos meses se repite (1 = mensual). */
  intervalo_meses: number;
  /** Primera fecha desde la cual aplica (AAAA-MM-DD). */
  fecha_inicio: string;
  activo: boolean;
  responsable_user_id: number | null;
  responsable_email: string;
  responsable_nombre: string;
  creado_por_user_id: number | null;
  creado_por_email: string;
  creado_por_nombre: string;
  creado_en: string;
  actualizado_en: string;
}

export interface GastoAutoPendienteRow {
  id: number;
  automatizacion_id: number;
  cuenta_id: number;
  periodo: string;
  fecha_programada: string;
  estado: GastoAutoPendienteEstado;
  presupuesto_id: number | null;
  gestionado_por_email: string;
  gestionado_por_nombre: string;
  gestionado_en: string | null;
  nota_gestion: string;
  creado_en: string;
}

export interface GastoAutoPendienteConPlantilla extends GastoAutoPendienteRow {
  plantilla: GastoAutomatizacionRow;
}

export interface GastoAutomatizacionInput {
  nombre?: string;
  dia_mes?: number;
  empresa?: string;
  codigo_proveedor?: string;
  razon_social_proveedor?: string;
  concepto?: string;
  observaciones?: string;
  rubro?: string;
  sub_rubro?: string;
  responsable_gasto?: string;
  funcionario_cedula?: string;
  nro_factura?: string;
  nro_operacion_origen?: string;
  pesos?: number;
  dolares_usd?: number;
  reales?: number;
  tc_usd?: number;
  tc_reales?: number;
  saldo_usd?: number;
  activo?: boolean;
  intervalo_meses?: number;
  fecha_inicio?: string;
}

export interface GastoAutomatizacionCreateOpts {
  nombre: string;
  dia_mes: number;
  intervalo_meses?: number;
  fecha_inicio?: string;
  responsable_user_id: number;
  responsable_email: string;
  responsable_nombre: string;
  creado_por_user_id: number;
  creado_por_email: string;
  creado_por_nombre: string;
  overrides?: GastoAutomatizacionInput;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentPeriod(): string {
  return todayIso().slice(0, 7);
}

function isEstado(value: string): value is GastoAutoPendienteEstado {
  return (GASTO_AUTO_PENDIENTE_ESTADOS as readonly string[]).includes(value);
}

function normalizeDiaMes(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw new Error("El día del mes debe ser entre 1 y 31.");
  }
  return n;
}

function normalizeIntervaloMeses(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    throw new Error("El intervalo debe ser entre 1 y 12 meses.");
  }
  return n;
}

function normalizeFechaInicio(value: unknown, fallback = todayIso()): string {
  const raw = String(value ?? fallback).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("La fecha de inicio debe tener formato AAAA-MM-DD.");
  }
  return raw;
}

function mesesDesdeInicio(fechaInicio: string, periodo: string): number {
  const ini = fechaInicio.slice(0, 7);
  if (periodo < ini) return -1;
  const [y1, m1] = ini.split("-").map(Number);
  const [y2, m2] = periodo.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function aplicaEnPeriodo(plantilla: GastoAutomatizacionRow, periodo: string): boolean {
  const inicio = (plantilla.fecha_inicio || plantilla.creado_en || todayIso()).slice(0, 10);
  const diff = mesesDesdeInicio(inicio, periodo);
  if (diff < 0) return false;
  const intervalo = Math.max(1, plantilla.intervalo_meses || 1);
  return diff % intervalo === 0;
}

function mergePlantillaDesdePresupuesto(
  presupuesto: Presupuesto,
  overrides?: GastoAutomatizacionInput,
): Omit<PresupuestoInput, "fecha"> {
  const o = overrides ?? {};
  return {
    empresa: String(o.empresa ?? presupuesto.empresa).trim(),
    codigo_proveedor: String(o.codigo_proveedor ?? presupuesto.codigo_proveedor ?? ""),
    razon_social_proveedor: String(
      o.razon_social_proveedor ?? presupuesto.razon_social_proveedor ?? "",
    ),
    concepto: String(o.concepto ?? presupuesto.concepto).trim(),
    observaciones: String(o.observaciones ?? presupuesto.observaciones ?? ""),
    rubro: String(o.rubro ?? presupuesto.rubro).trim(),
    sub_rubro: String(o.sub_rubro ?? presupuesto.sub_rubro ?? ""),
    responsable_gasto: String(o.responsable_gasto ?? presupuesto.responsable_gasto ?? ""),
    funcionario_cedula: String(o.funcionario_cedula ?? presupuesto.funcionario_cedula ?? ""),
    nro_factura: String(o.nro_factura ?? presupuesto.nro_factura ?? ""),
    nro_operacion_origen: String(o.nro_operacion_origen ?? presupuesto.nro_operacion_origen ?? ""),
    pesos: o.pesos != null ? num(o.pesos) : num(presupuesto.pesos),
    dolares_usd: o.dolares_usd != null ? num(o.dolares_usd) : num(presupuesto.dolares_usd),
    reales: o.reales != null ? num(o.reales) : num(presupuesto.reales),
    tc_usd: o.tc_usd != null ? num(o.tc_usd) : num(presupuesto.tc_usd),
    tc_reales: o.tc_reales != null ? num(o.tc_reales) : num(presupuesto.tc_reales),
    saldo_usd: o.saldo_usd != null ? num(o.saldo_usd) : num(presupuesto.saldo_usd),
  };
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fechaProgramada(periodo: string, diaMes: number): string {
  const [yStr, mStr] = periodo.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) throw new Error("Período inválido.");
  const ultimoDia = new Date(y, m, 0).getDate();
  const dia = Math.min(diaMes, ultimoDia);
  return `${yStr}-${mStr}-${String(dia).padStart(2, "0")}`;
}

function rowToPlantilla(row: Record<string, unknown>): GastoAutomatizacionRow {
  return {
    id: Number(row.id),
    cuenta_id: Number(row.cuenta_id),
    nombre: String(row.nombre ?? ""),
    presupuesto_origen_id:
      row.presupuesto_origen_id != null ? Number(row.presupuesto_origen_id) : null,
    empresa: String(row.empresa ?? ""),
    codigo_proveedor: String(row.codigo_proveedor ?? ""),
    razon_social_proveedor: String(row.razon_social_proveedor ?? ""),
    concepto: String(row.concepto ?? ""),
    observaciones: String(row.observaciones ?? ""),
    rubro: String(row.rubro ?? ""),
    sub_rubro: String(row.sub_rubro ?? ""),
    responsable_gasto: String(row.responsable_gasto ?? ""),
    funcionario_cedula: String(row.funcionario_cedula ?? ""),
    nro_factura: String(row.nro_factura ?? ""),
    nro_operacion_origen: String(row.nro_operacion_origen ?? ""),
    pesos: num(row.pesos),
    dolares_usd: num(row.dolares_usd),
    reales: num(row.reales),
    tc_usd: num(row.tc_usd),
    tc_reales: num(row.tc_reales),
    saldo_usd: num(row.saldo_usd),
    dia_mes: Number(row.dia_mes),
    intervalo_meses: Math.max(1, Number(row.intervalo_meses ?? 1) || 1),
    fecha_inicio: String(row.fecha_inicio ?? "").slice(0, 10),
    activo: row.activo === true || row.activo === 1 || row.activo === "t",
    responsable_user_id:
      row.responsable_user_id != null ? Number(row.responsable_user_id) : null,
    responsable_email: String(row.responsable_email ?? ""),
    responsable_nombre: String(row.responsable_nombre ?? ""),
    creado_por_user_id:
      row.creado_por_user_id != null ? Number(row.creado_por_user_id) : null,
    creado_por_email: String(row.creado_por_email ?? ""),
    creado_por_nombre: String(row.creado_por_nombre ?? ""),
    creado_en: String(row.creado_en ?? ""),
    actualizado_en: String(row.actualizado_en ?? ""),
  };
}

function rowToPendiente(row: Record<string, unknown>): GastoAutoPendienteRow {
  const estadoRaw = String(row.estado ?? "pendiente_aprobacion");
  return {
    id: Number(row.id),
    automatizacion_id: Number(row.automatizacion_id),
    cuenta_id: Number(row.cuenta_id),
    periodo: String(row.periodo ?? ""),
    fecha_programada: String(row.fecha_programada ?? "").slice(0, 10),
    estado: isEstado(estadoRaw) ? estadoRaw : "pendiente_aprobacion",
    presupuesto_id: row.presupuesto_id != null ? Number(row.presupuesto_id) : null,
    gestionado_por_email: String(row.gestionado_por_email ?? ""),
    gestionado_por_nombre: String(row.gestionado_por_nombre ?? ""),
    gestionado_en: row.gestionado_en ? String(row.gestionado_en) : null,
    nota_gestion: String(row.nota_gestion ?? ""),
    creado_en: String(row.creado_en ?? ""),
  };
}

function plantillaToPresupuestoInput(p: GastoAutomatizacionRow, fecha: string): PresupuestoInput {
  return {
    empresa: p.empresa,
    fecha,
    codigo_proveedor: p.codigo_proveedor,
    razon_social_proveedor: p.razon_social_proveedor,
    concepto: p.concepto,
    observaciones: p.observaciones,
    rubro: p.rubro,
    sub_rubro: p.sub_rubro,
    responsable_gasto: p.responsable_gasto,
    funcionario_cedula: p.funcionario_cedula,
    nro_factura: p.nro_factura,
    nro_operacion_origen: p.nro_operacion_origen,
    pesos: p.pesos,
    dolares_usd: p.dolares_usd,
    reales: p.reales,
    tc_usd: p.tc_usd,
    tc_reales: p.tc_reales,
    saldo_usd: p.saldo_usd,
  };
}

export async function initGastosAutomatizacionTables(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS GASTO_AUTOMATIZACION (
         id SERIAL PRIMARY KEY,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         nombre TEXT NOT NULL,
         presupuesto_origen_id INTEGER REFERENCES PRESUPUESTO(id) ON DELETE SET NULL,
         empresa TEXT NOT NULL,
         codigo_proveedor TEXT NOT NULL DEFAULT '',
         razon_social_proveedor TEXT NOT NULL DEFAULT '',
         concepto TEXT NOT NULL,
         observaciones TEXT NOT NULL DEFAULT '',
         rubro TEXT NOT NULL,
         sub_rubro TEXT NOT NULL DEFAULT '',
         responsable_gasto TEXT NOT NULL DEFAULT '',
         funcionario_cedula TEXT NOT NULL DEFAULT '',
         nro_factura TEXT NOT NULL DEFAULT '',
         nro_operacion_origen TEXT NOT NULL DEFAULT '',
         pesos DOUBLE PRECISION NOT NULL DEFAULT 0,
         dolares_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
         reales DOUBLE PRECISION NOT NULL DEFAULT 0,
         tc_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
         tc_reales DOUBLE PRECISION NOT NULL DEFAULT 0,
         saldo_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
         dia_mes INTEGER NOT NULL CHECK (dia_mes >= 1 AND dia_mes <= 31),
         activo BOOLEAN NOT NULL DEFAULT TRUE,
         responsable_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
         responsable_email TEXT NOT NULL DEFAULT '',
         responsable_nombre TEXT NOT NULL DEFAULT '',
         creado_por_user_id INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
         creado_por_email TEXT NOT NULL DEFAULT '',
         creado_por_nombre TEXT NOT NULL DEFAULT '',
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         actualizado_en TIMESTAMPTZ DEFAULT NOW()
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_gasto_auto_cuenta
       ON GASTO_AUTOMATIZACION(cuenta_id)`,
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS GASTO_AUTOMATIZACION_PENDIENTE (
         id SERIAL PRIMARY KEY,
         automatizacion_id INTEGER NOT NULL REFERENCES GASTO_AUTOMATIZACION(id) ON DELETE CASCADE,
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         periodo TEXT NOT NULL,
         fecha_programada TEXT NOT NULL,
         estado TEXT NOT NULL DEFAULT 'pendiente_aprobacion',
         presupuesto_id INTEGER REFERENCES PRESUPUESTO(id) ON DELETE SET NULL,
         gestionado_por_email TEXT NOT NULL DEFAULT '',
         gestionado_por_nombre TEXT NOT NULL DEFAULT '',
         gestionado_en TIMESTAMPTZ,
         nota_gestion TEXT NOT NULL DEFAULT '',
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         UNIQUE (automatizacion_id, periodo)
       )`,
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_gasto_auto_pendiente_cuenta_estado
       ON GASTO_AUTOMATIZACION_PENDIENTE(cuenta_id, estado)`,
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE GASTO_AUTOMATIZACION ADD COLUMN IF NOT EXISTS intervalo_meses INTEGER NOT NULL DEFAULT 1`,
    )
    .run();

  await db
    .prepare(
      `ALTER TABLE GASTO_AUTOMATIZACION ADD COLUMN IF NOT EXISTS fecha_inicio TEXT NOT NULL DEFAULT ''`,
    )
    .run();
}

export async function listGastoAutomatizaciones(
  db: Db,
  cuentaId: number,
): Promise<GastoAutomatizacionRow[]> {
  const rows = (await db
    .prepare(
      `SELECT * FROM GASTO_AUTOMATIZACION
       WHERE cuenta_id = ?
       ORDER BY activo DESC, nombre ASC, id ASC`,
    )
    .all(cuentaId)) as Record<string, unknown>[];
  return rows.map(rowToPlantilla);
}

export async function getGastoAutomatizacionById(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<GastoAutomatizacionRow | undefined> {
  const row = (await db
    .prepare(`SELECT * FROM GASTO_AUTOMATIZACION WHERE cuenta_id = ? AND id = ?`)
    .get(cuentaId, id)) as Record<string, unknown> | undefined;
  return row ? rowToPlantilla(row) : undefined;
}

export async function createGastoAutomatizacionFromPresupuesto(
  db: Db,
  cuentaId: number,
  presupuesto: Presupuesto,
  opts: GastoAutomatizacionCreateOpts,
): Promise<GastoAutomatizacionRow> {
  const diaMes = normalizeDiaMes(opts.dia_mes);
  const intervaloMeses = normalizeIntervaloMeses(opts.intervalo_meses ?? 1);
  const fechaInicio = normalizeFechaInicio(opts.fecha_inicio ?? todayIso());
  const nombre = opts.nombre.trim();
  if (!nombre) throw new Error("El nombre de la automatización es obligatorio.");

  const merged = mergePlantillaDesdePresupuesto(presupuesto, opts.overrides);
  if (!merged.empresa) throw new Error("La empresa es obligatoria.");
  if (!merged.concepto) throw new Error("El concepto es obligatorio.");
  if (!merged.rubro) throw new Error("El rubro es obligatorio.");

  const dup = (await db
    .prepare(
      `SELECT id FROM GASTO_AUTOMATIZACION
       WHERE cuenta_id = ? AND presupuesto_origen_id = ? AND activo = TRUE`,
    )
    .get(cuentaId, presupuesto.id)) as { id: number } | undefined;
  if (dup) {
    throw new Error("Ya existe una automatización activa para este gasto.");
  }

  const row = (await db
    .prepare(
      `INSERT INTO GASTO_AUTOMATIZACION (
         cuenta_id, nombre, presupuesto_origen_id,
         empresa, codigo_proveedor, razon_social_proveedor, concepto, observaciones,
         rubro, sub_rubro, responsable_gasto, funcionario_cedula, nro_factura, nro_operacion_origen,
         pesos, dolares_usd, reales, tc_usd, tc_reales, saldo_usd,
         dia_mes, intervalo_meses, fecha_inicio, activo,
         responsable_user_id, responsable_email, responsable_nombre,
         creado_por_user_id, creado_por_email, creado_por_nombre
       ) VALUES (
         @cuenta_id, @nombre, @presupuesto_origen_id,
         @empresa, @codigo_proveedor, @razon_social_proveedor, @concepto, @observaciones,
         @rubro, @sub_rubro, @responsable_gasto, @funcionario_cedula, @nro_factura, @nro_operacion_origen,
         @pesos, @dolares_usd, @reales, @tc_usd, @tc_reales, @saldo_usd,
         @dia_mes, @intervalo_meses, @fecha_inicio, TRUE,
         @responsable_user_id, @responsable_email, @responsable_nombre,
         @creado_por_user_id, @creado_por_email, @creado_por_nombre
       )
       RETURNING *`,
    )
    .get({
      cuenta_id: cuentaId,
      nombre,
      presupuesto_origen_id: presupuesto.id,
      ...merged,
      dia_mes: diaMes,
      intervalo_meses: intervaloMeses,
      fecha_inicio: fechaInicio,
      responsable_user_id: opts.responsable_user_id,
      responsable_email: opts.responsable_email.trim(),
      responsable_nombre: opts.responsable_nombre.trim(),
      creado_por_user_id: opts.creado_por_user_id,
      creado_por_email: opts.creado_por_email.trim(),
      creado_por_nombre: opts.creado_por_nombre.trim(),
    })) as Record<string, unknown>;

  return rowToPlantilla(row);
}

export async function updateGastoAutomatizacion(
  db: Db,
  cuentaId: number,
  id: number,
  input: GastoAutomatizacionInput,
): Promise<GastoAutomatizacionRow | undefined> {
  const prev = await getGastoAutomatizacionById(db, cuentaId, id);
  if (!prev) return undefined;

  const diaMes = input.dia_mes != null ? normalizeDiaMes(input.dia_mes) : prev.dia_mes;
  const intervaloMeses =
    input.intervalo_meses != null
      ? normalizeIntervaloMeses(input.intervalo_meses)
      : prev.intervalo_meses;
  const fechaInicio =
    input.fecha_inicio != null
      ? normalizeFechaInicio(input.fecha_inicio, prev.fecha_inicio || todayIso())
      : prev.fecha_inicio;
  const nombre =
    input.nombre != null ? String(input.nombre).trim() || prev.nombre : prev.nombre;

  const row = (await db
    .prepare(
      `UPDATE GASTO_AUTOMATIZACION SET
         nombre = @nombre,
         dia_mes = @dia_mes,
         empresa = @empresa,
         codigo_proveedor = @codigo_proveedor,
         razon_social_proveedor = @razon_social_proveedor,
         concepto = @concepto,
         observaciones = @observaciones,
         rubro = @rubro,
         sub_rubro = @sub_rubro,
         responsable_gasto = @responsable_gasto,
         funcionario_cedula = @funcionario_cedula,
         nro_factura = @nro_factura,
         nro_operacion_origen = @nro_operacion_origen,
         pesos = @pesos,
         dolares_usd = @dolares_usd,
         reales = @reales,
         tc_usd = @tc_usd,
         tc_reales = @tc_reales,
         saldo_usd = @saldo_usd,
         intervalo_meses = @intervalo_meses,
         fecha_inicio = @fecha_inicio,
         activo = @activo,
         actualizado_en = NOW()
       WHERE cuenta_id = @cuenta_id AND id = @id
       RETURNING *`,
    )
    .get({
      cuenta_id: cuentaId,
      id,
      nombre,
      dia_mes: diaMes,
      empresa: input.empresa ?? prev.empresa,
      codigo_proveedor: input.codigo_proveedor ?? prev.codigo_proveedor,
      razon_social_proveedor: input.razon_social_proveedor ?? prev.razon_social_proveedor,
      concepto: input.concepto ?? prev.concepto,
      observaciones: input.observaciones ?? prev.observaciones,
      rubro: input.rubro ?? prev.rubro,
      sub_rubro: input.sub_rubro ?? prev.sub_rubro,
      responsable_gasto: input.responsable_gasto ?? prev.responsable_gasto,
      funcionario_cedula: input.funcionario_cedula ?? prev.funcionario_cedula,
      nro_factura: input.nro_factura ?? prev.nro_factura,
      nro_operacion_origen: input.nro_operacion_origen ?? prev.nro_operacion_origen,
      pesos: input.pesos != null ? num(input.pesos) : prev.pesos,
      dolares_usd: input.dolares_usd != null ? num(input.dolares_usd) : prev.dolares_usd,
      reales: input.reales != null ? num(input.reales) : prev.reales,
      tc_usd: input.tc_usd != null ? num(input.tc_usd) : prev.tc_usd,
      tc_reales: input.tc_reales != null ? num(input.tc_reales) : prev.tc_reales,
      saldo_usd: input.saldo_usd != null ? num(input.saldo_usd) : prev.saldo_usd,
      intervalo_meses: intervaloMeses,
      fecha_inicio: fechaInicio,
      activo: input.activo != null ? Boolean(input.activo) : prev.activo,
    })) as Record<string, unknown>;

  return rowToPlantilla(row);
}

export async function deleteGastoAutomatizacion(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM GASTO_AUTOMATIZACION WHERE cuenta_id = ? AND id = ?`)
    .run(cuentaId, id);
  return result.changes > 0;
}

export async function syncGastoAutomatizacionPendientes(
  db: Db,
  cuentaId: number,
): Promise<number> {
  const periodo = currentPeriod();
  const hoy = todayIso();
  const plantillas = (await db
    .prepare(`SELECT * FROM GASTO_AUTOMATIZACION WHERE cuenta_id = ? AND activo = TRUE`)
    .all(cuentaId)) as Record<string, unknown>[];

  let creados = 0;
  for (const raw of plantillas) {
    const p = rowToPlantilla(raw);
    if (!aplicaEnPeriodo(p, periodo)) continue;
    const fechaProg = fechaProgramada(periodo, p.dia_mes);
    if (fechaProg > hoy) continue;

    const existe = (await db
      .prepare(
        `SELECT id FROM GASTO_AUTOMATIZACION_PENDIENTE
         WHERE automatizacion_id = ? AND periodo = ?`,
      )
      .get(p.id, periodo)) as { id: number } | undefined;
    if (existe) continue;

    await db
      .prepare(
        `INSERT INTO GASTO_AUTOMATIZACION_PENDIENTE (
           automatizacion_id, cuenta_id, periodo, fecha_programada, estado
         ) VALUES (?, ?, ?, ?, 'pendiente_aprobacion')`,
      )
      .run(p.id, cuentaId, periodo, fechaProg);
    creados += 1;
  }
  return creados;
}

export async function listGastoAutoPendientes(
  db: Db,
  cuentaId: number,
  opts?: { soloPendientes?: boolean; responsableEmail?: string },
): Promise<GastoAutoPendienteConPlantilla[]> {
  let query = `
    SELECT p.*,
      a.id AS pl_id, a.cuenta_id AS pl_cuenta_id, a.nombre AS pl_nombre,
      a.presupuesto_origen_id AS pl_presupuesto_origen_id,
      a.empresa AS pl_empresa, a.codigo_proveedor AS pl_codigo_proveedor,
      a.razon_social_proveedor AS pl_razon_social_proveedor,
      a.concepto AS pl_concepto, a.observaciones AS pl_observaciones,
      a.rubro AS pl_rubro, a.sub_rubro AS pl_sub_rubro,
      a.responsable_gasto AS pl_responsable_gasto,
      a.funcionario_cedula AS pl_funcionario_cedula,
      a.nro_factura AS pl_nro_factura, a.nro_operacion_origen AS pl_nro_operacion_origen,
      a.pesos AS pl_pesos, a.dolares_usd AS pl_dolares_usd, a.reales AS pl_reales,
      a.tc_usd AS pl_tc_usd, a.tc_reales AS pl_tc_reales, a.saldo_usd AS pl_saldo_usd,
      a.dia_mes AS pl_dia_mes,
      a.intervalo_meses AS pl_intervalo_meses,
      a.fecha_inicio AS pl_fecha_inicio,
      a.activo AS pl_activo,
      a.responsable_user_id AS pl_responsable_user_id,
      a.responsable_email AS pl_responsable_email,
      a.responsable_nombre AS pl_responsable_nombre,
      a.creado_por_user_id AS pl_creado_por_user_id,
      a.creado_por_email AS pl_creado_por_email,
      a.creado_por_nombre AS pl_creado_por_nombre,
      a.creado_en AS pl_creado_en, a.actualizado_en AS pl_actualizado_en
    FROM GASTO_AUTOMATIZACION_PENDIENTE p
    JOIN GASTO_AUTOMATIZACION a ON a.id = p.automatizacion_id
    WHERE p.cuenta_id = @cuenta_id
  `;
  const params: Record<string, unknown> = { cuenta_id: cuentaId };

  if (opts?.soloPendientes) {
    query += " AND p.estado = 'pendiente_aprobacion'";
  }
  if (opts?.responsableEmail?.trim()) {
    query += " AND LOWER(a.responsable_email) = LOWER(@responsable_email)";
    params.responsable_email = opts.responsableEmail.trim();
  }

  query += " ORDER BY p.fecha_programada DESC, p.id DESC";

  const rows = (await db.prepare(query).all(params)) as Record<string, unknown>[];

  return rows.map((row) => {
    const pendiente = rowToPendiente(row);
    const plantilla = rowToPlantilla({
      id: row.pl_id,
      cuenta_id: row.pl_cuenta_id,
      nombre: row.pl_nombre,
      presupuesto_origen_id: row.pl_presupuesto_origen_id,
      empresa: row.pl_empresa,
      codigo_proveedor: row.pl_codigo_proveedor,
      razon_social_proveedor: row.pl_razon_social_proveedor,
      concepto: row.pl_concepto,
      observaciones: row.pl_observaciones,
      rubro: row.pl_rubro,
      sub_rubro: row.pl_sub_rubro,
      responsable_gasto: row.pl_responsable_gasto,
      funcionario_cedula: row.pl_funcionario_cedula,
      nro_factura: row.pl_nro_factura,
      nro_operacion_origen: row.pl_nro_operacion_origen,
      pesos: row.pl_pesos,
      dolares_usd: row.pl_dolares_usd,
      reales: row.pl_reales,
      tc_usd: row.pl_tc_usd,
      tc_reales: row.pl_tc_reales,
      saldo_usd: row.pl_saldo_usd,
      dia_mes: row.pl_dia_mes,
      intervalo_meses: row.pl_intervalo_meses,
      fecha_inicio: row.pl_fecha_inicio,
      activo: row.pl_activo,
      responsable_user_id: row.pl_responsable_user_id,
      responsable_email: row.pl_responsable_email,
      responsable_nombre: row.pl_responsable_nombre,
      creado_por_user_id: row.pl_creado_por_user_id,
      creado_por_email: row.pl_creado_por_email,
      creado_por_nombre: row.pl_creado_por_nombre,
      creado_en: row.pl_creado_en,
      actualizado_en: row.pl_actualizado_en,
    });
    return { ...pendiente, plantilla };
  });
}

export async function getGastoAutoPendienteById(
  db: Db,
  cuentaId: number,
  id: number,
): Promise<GastoAutoPendienteConPlantilla | undefined> {
  const items = await listGastoAutoPendientes(db, cuentaId);
  return items.find((p) => p.id === id);
}

/** Solo el administrador de la cuenta aprueba u omite ingresos automáticos mensuales. */
export function esResponsableAutomatizacion(
  _plantilla: GastoAutomatizacionRow,
  user: { id: number; email: string; rol: string },
): boolean {
  return user.rol === "admin";
}

export async function aprobarGastoAutoPendiente(
  db: Db,
  cuentaId: number,
  pendienteId: number,
  insertPresupuesto: (
    data: PresupuestoInput,
    ingresadoPor?: { email: string; nombre: string },
  ) => Promise<Presupuesto>,
  gestor: { email: string; nombre: string },
): Promise<{ pendiente: GastoAutoPendienteRow; presupuesto: Presupuesto }> {
  const item = await getGastoAutoPendienteById(db, cuentaId, pendienteId);
  if (!item) throw new Error("Solicitud no encontrada.");
  if (item.estado !== "pendiente_aprobacion") {
    throw new Error("Esta solicitud ya fue gestionada.");
  }
  if (!item.plantilla.activo) {
    throw new Error("La automatización está pausada.");
  }

  const payload = plantillaToPresupuestoInput(item.plantilla, item.fecha_programada);
  const presupuesto = await insertPresupuesto(payload, {
    email: gestor.email,
    nombre: gestor.nombre,
  });

  const row = (await db
    .prepare(
      `UPDATE GASTO_AUTOMATIZACION_PENDIENTE SET
         estado = 'aprobado',
         presupuesto_id = @presupuesto_id,
         gestionado_por_email = @gestionado_por_email,
         gestionado_por_nombre = @gestionado_por_nombre,
         gestionado_en = NOW()
       WHERE id = @id AND cuenta_id = @cuenta_id AND estado = 'pendiente_aprobacion'
       RETURNING *`,
    )
    .get({
      id: pendienteId,
      cuenta_id: cuentaId,
      presupuesto_id: presupuesto.id,
      gestionado_por_email: gestor.email.trim(),
      gestionado_por_nombre: gestor.nombre.trim(),
    })) as Record<string, unknown> | undefined;

  if (!row) throw new Error("No se pudo confirmar la aprobación.");
  return { pendiente: rowToPendiente(row), presupuesto };
}

export async function rechazarGastoAutoPendiente(
  db: Db,
  cuentaId: number,
  pendienteId: number,
  gestor: { email: string; nombre: string },
  nota?: string,
): Promise<GastoAutoPendienteRow> {
  const row = (await db
    .prepare(
      `UPDATE GASTO_AUTOMATIZACION_PENDIENTE SET
         estado = 'rechazado',
         gestionado_por_email = @gestionado_por_email,
         gestionado_por_nombre = @gestionado_por_nombre,
         gestionado_en = NOW(),
         nota_gestion = @nota_gestion
       WHERE id = @id AND cuenta_id = @cuenta_id AND estado = 'pendiente_aprobacion'
       RETURNING *`,
    )
    .get({
      id: pendienteId,
      cuenta_id: cuentaId,
      gestionado_por_email: gestor.email.trim(),
      gestionado_por_nombre: gestor.nombre.trim(),
      nota_gestion: (nota ?? "").trim(),
    })) as Record<string, unknown> | undefined;

  if (!row) throw new Error("Solicitud no encontrada o ya gestionada.");
  return rowToPendiente(row);
}
