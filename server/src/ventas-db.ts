import type { Db } from "./db/pg-client.js";
import { migrateAddCuentaIdColumn } from "./empresas-cuenta-db.js";

export interface IngresoVenta {
  id: number;
  cuenta_id?: number | null;
  nro_registro: number;
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  tc_usd: number;
  total_usd: number;
  creado_en?: string;
}

export interface IngresoVentaInput {
  fecha: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  tc_usd: number;
  total_usd: number;
}

export interface IngresoVentaFilters {
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}

export function calcularTotalUsdVenta(
  pesos: number,
  dolares_usd: number,
  tc_usd: number
): number {
  const fromPesos = pesos > 0 && tc_usd > 0 ? pesos / tc_usd : 0;
  const usd = dolares_usd > 0 ? dolares_usd : 0;
  const total = fromPesos + usd;
  return Math.round(total * 10000) / 10000;
}

export async function initVentasTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "INGRESOS_VENTAS");
}

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null
): string {
  if (cuentaId != null) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  }
  return query;
}

async function allocNroRegistro(db: Db): Promise<number> {
  return db.transaction(async (tx) => {
    const row = (await tx
      .prepare("SELECT ultimo FROM INGRESOS_VENTAS_SEQ WHERE id = 1")
      .get()) as { ultimo: number };
    const next = row.ultimo + 1;
    await tx.prepare("UPDATE INGRESOS_VENTAS_SEQ SET ultimo = ? WHERE id = 1").run(next);
    return next;
  });
}

export async function peekNextNroRegistroVenta(db: Db): Promise<number> {
  const row = (await db
    .prepare("SELECT ultimo FROM INGRESOS_VENTAS_SEQ WHERE id = 1")
    .get()) as { ultimo: number };
  return row.ultimo + 1;
}

export function formatNumeroOperacionVenta(nro: number): string {
  return String(Math.max(1, Math.floor(nro))).padStart(10, "0");
}

function normalizeInput(data: IngresoVentaInput): IngresoVentaInput {
  const pesos = Number(data.pesos) || 0;
  const dolares_usd = Number(data.dolares_usd) || 0;
  const tc_usd = Number(data.tc_usd) || 0;
  const total_usd = calcularTotalUsdVenta(pesos, dolares_usd, tc_usd);
  return {
    fecha: String(data.fecha ?? "").trim(),
    codigo_proveedor: String(data.codigo_proveedor ?? "").trim(),
    razon_social_proveedor: String(data.razon_social_proveedor ?? "").trim(),
    concepto: String(data.concepto ?? "").trim(),
    nro_factura: String(data.nro_factura ?? "").trim(),
    pesos,
    dolares_usd,
    tc_usd,
    total_usd,
  };
}

export async function listIngresosVentas(
  db: Db,
  filters?: IngresoVentaFilters,
  cuentaId?: number | null
): Promise<IngresoVenta[]> {
  let sql = "SELECT * FROM INGRESOS_VENTAS WHERE 1=1";
  const params: Record<string, string | number> = {};
  sql = scopeCuenta(sql, params, cuentaId);

  if (filters?.fecha_desde) {
    sql += " AND fecha >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters?.fecha_hasta) {
    sql += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  if (filters?.busqueda?.trim()) {
    sql += ` AND (
      concepto LIKE @busqueda OR
      razon_social_proveedor LIKE @busqueda OR
      codigo_proveedor LIKE @busqueda OR
      nro_factura LIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }

  sql += " ORDER BY fecha DESC, nro_registro DESC";
  return (await db.prepare(sql).all(params)) as IngresoVenta[];
}

export async function getIngresoVentaById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<IngresoVenta | undefined> {
  let sql = "SELECT * FROM INGRESOS_VENTAS WHERE id = @id";
  const params: Record<string, string | number> = { id };
  sql = scopeCuenta(sql, params, cuentaId);
  return (await db.prepare(sql).get(params)) as IngresoVenta | undefined;
}

export async function insertIngresoVenta(
  db: Db,
  data: IngresoVentaInput,
  cuentaId?: number | null
): Promise<number> {
  const row = normalizeInput(data);
  if (!row.fecha) throw new Error("La fecha es obligatoria.");
  if (!row.concepto) throw new Error("El concepto es obligatorio.");
  if (row.pesos <= 0 && row.dolares_usd <= 0) {
    throw new Error("Ingresá un importe en pesos o en dólares.");
  }
  if (row.pesos > 0 && row.tc_usd <= 0) {
    throw new Error("Ingresá el tipo de cambio (TC) para convertir pesos a USD.");
  }

  const nro_registro = await allocNroRegistro(db);
  const result = await db
    .prepare(
      `INSERT INTO INGRESOS_VENTAS (
        nro_registro, fecha, codigo_proveedor, razon_social_proveedor,
        concepto, nro_factura, pesos, dolares_usd, tc_usd, total_usd, cuenta_id
      ) VALUES (
        @nro_registro, @fecha, @codigo_proveedor, @razon_social_proveedor,
        @concepto, @nro_factura, @pesos, @dolares_usd, @tc_usd, @total_usd, @cuenta_id
      )`
    )
    .run({ ...row, nro_registro, cuenta_id: cuentaId ?? null });
  return Number(result.lastInsertRowid);
}

export async function updateIngresoVenta(
  db: Db,
  id: number,
  data: IngresoVentaInput,
  cuentaId?: number | null
): Promise<boolean> {
  const row = normalizeInput(data);
  if (!row.fecha) throw new Error("La fecha es obligatoria.");
  if (!row.concepto) throw new Error("El concepto es obligatorio.");
  if (row.pesos <= 0 && row.dolares_usd <= 0) {
    throw new Error("Ingresá un importe en pesos o en dólares.");
  }
  if (row.pesos > 0 && row.tc_usd <= 0) {
    throw new Error("Ingresá el tipo de cambio (TC) para convertir pesos a USD.");
  }

  let sql = `UPDATE INGRESOS_VENTAS SET
          fecha = @fecha,
          codigo_proveedor = @codigo_proveedor,
          razon_social_proveedor = @razon_social_proveedor,
          concepto = @concepto,
          nro_factura = @nro_factura,
          pesos = @pesos,
          dolares_usd = @dolares_usd,
          tc_usd = @tc_usd,
          total_usd = @total_usd
         WHERE id = @id`;
  const params: Record<string, string | number> = { ...row, id } as Record<
    string,
    string | number
  >;
  sql = scopeCuenta(sql, params, cuentaId);
  return (await db.prepare(sql).run(params)).changes > 0;
}

export async function deleteIngresoVenta(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  let sql = "DELETE FROM INGRESOS_VENTAS WHERE id = @id";
  const params: Record<string, string | number> = { id };
  sql = scopeCuenta(sql, params, cuentaId);
  return (await db.prepare(sql).run(params)).changes > 0;
}
