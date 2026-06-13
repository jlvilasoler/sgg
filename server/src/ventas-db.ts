import type Database from "better-sqlite3";

export interface IngresoVenta {
  id: number;
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

export function initVentasTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS INGRESOS_VENTAS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nro_registro INTEGER UNIQUE,
      fecha TEXT NOT NULL,
      codigo_proveedor TEXT NOT NULL DEFAULT '',
      razon_social_proveedor TEXT NOT NULL DEFAULT '',
      concepto TEXT NOT NULL,
      nro_factura TEXT NOT NULL DEFAULT '',
      pesos REAL NOT NULL DEFAULT 0,
      dolares_usd REAL NOT NULL DEFAULT 0,
      tc_usd REAL NOT NULL DEFAULT 0,
      total_usd REAL NOT NULL DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON INGRESOS_VENTAS(fecha);
    CREATE INDEX IF NOT EXISTS idx_ventas_nro_registro ON INGRESOS_VENTAS(nro_registro);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS INGRESOS_VENTAS_SEQ (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ultimo INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO INGRESOS_VENTAS_SEQ (id, ultimo) VALUES (1, 0);
  `);

  const maxRow = db
    .prepare("SELECT COALESCE(MAX(nro_registro), 0) AS m FROM INGRESOS_VENTAS")
    .get() as { m: number };
  const seqRow = db
    .prepare("SELECT ultimo FROM INGRESOS_VENTAS_SEQ WHERE id = 1")
    .get() as { ultimo: number } | undefined;
  const ultimo = Math.max(maxRow.m, seqRow?.ultimo ?? 0);
  db.prepare("UPDATE INGRESOS_VENTAS_SEQ SET ultimo = ? WHERE id = 1").run(ultimo);
}

function allocNroRegistro(db: Database.Database): number {
  const tx = db.transaction(() => {
    const row = db
      .prepare("SELECT ultimo FROM INGRESOS_VENTAS_SEQ WHERE id = 1")
      .get() as { ultimo: number };
    const next = row.ultimo + 1;
    db.prepare("UPDATE INGRESOS_VENTAS_SEQ SET ultimo = ? WHERE id = 1").run(next);
    return next;
  });
  return tx();
}

export function peekNextNroRegistroVenta(db: Database.Database): number {
  const row = db
    .prepare("SELECT ultimo FROM INGRESOS_VENTAS_SEQ WHERE id = 1")
    .get() as { ultimo: number };
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

export function listIngresosVentas(
  db: Database.Database,
  filters?: IngresoVentaFilters
): IngresoVenta[] {
  let sql = "SELECT * FROM INGRESOS_VENTAS WHERE 1=1";
  const params: Record<string, string> = {};

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
  return db.prepare(sql).all(params) as IngresoVenta[];
}

export function getIngresoVentaById(
  db: Database.Database,
  id: number
): IngresoVenta | undefined {
  return db
    .prepare("SELECT * FROM INGRESOS_VENTAS WHERE id = ?")
    .get(id) as IngresoVenta | undefined;
}

export function insertIngresoVenta(
  db: Database.Database,
  data: IngresoVentaInput
): number {
  const row = normalizeInput(data);
  if (!row.fecha) throw new Error("La fecha es obligatoria.");
  if (!row.concepto) throw new Error("El concepto es obligatorio.");
  if (row.pesos <= 0 && row.dolares_usd <= 0) {
    throw new Error("Ingresá un importe en pesos o en dólares.");
  }
  if (row.pesos > 0 && row.tc_usd <= 0) {
    throw new Error("Ingresá el tipo de cambio (TC) para convertir pesos a USD.");
  }

  const nro_registro = allocNroRegistro(db);
  const result = db
    .prepare(
      `INSERT INTO INGRESOS_VENTAS (
        nro_registro, fecha, codigo_proveedor, razon_social_proveedor,
        concepto, nro_factura, pesos, dolares_usd, tc_usd, total_usd
      ) VALUES (
        @nro_registro, @fecha, @codigo_proveedor, @razon_social_proveedor,
        @concepto, @nro_factura, @pesos, @dolares_usd, @tc_usd, @total_usd
      )`
    )
    .run({ ...row, nro_registro });
  return Number(result.lastInsertRowid);
}

export function updateIngresoVenta(
  db: Database.Database,
  id: number,
  data: IngresoVentaInput
): boolean {
  const row = normalizeInput(data);
  if (!row.fecha) throw new Error("La fecha es obligatoria.");
  if (!row.concepto) throw new Error("El concepto es obligatorio.");
  if (row.pesos <= 0 && row.dolares_usd <= 0) {
    throw new Error("Ingresá un importe en pesos o en dólares.");
  }
  if (row.pesos > 0 && row.tc_usd <= 0) {
    throw new Error("Ingresá el tipo de cambio (TC) para convertir pesos a USD.");
  }

  return (
    db
      .prepare(
        `UPDATE INGRESOS_VENTAS SET
          fecha = @fecha,
          codigo_proveedor = @codigo_proveedor,
          razon_social_proveedor = @razon_social_proveedor,
          concepto = @concepto,
          nro_factura = @nro_factura,
          pesos = @pesos,
          dolares_usd = @dolares_usd,
          tc_usd = @tc_usd,
          total_usd = @total_usd
         WHERE id = @id`
      )
      .run({ ...row, id }).changes > 0
  );
}

export function deleteIngresoVenta(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM INGRESOS_VENTAS WHERE id = ?").run(id).changes > 0;
}
