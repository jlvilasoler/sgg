import type { Db } from "./db/pg-client.js";

export const CULTIVOS_AGRICULTURA = ["TRIGO", "SOJA", "MAIZ", "COLZA"] as const;
export type CultivoAgricultura = (typeof CULTIVOS_AGRICULTURA)[number];

export const EMPRESAS_AGRICULTURA = ["GANADERA GUAVIYU", "GANADERA CHIVILCOY"] as const;
export type EmpresaAgricultura = (typeof EMPRESAS_AGRICULTURA)[number];

export interface VentaAgriculturaRow {
  id: number;
  empresa: EmpresaAgricultura;
  mes: number;
  anio: number;
  cultivo: CultivoAgricultura;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
  creado_en: string;
}

export interface VentaAgriculturaInput {
  empresa: EmpresaAgricultura;
  mes: number;
  anio: number;
  cultivo: CultivoAgricultura;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
}

export interface VentaAgriculturaFilters {
  empresa?: string;
  mes?: number;
  anio?: number;
  cultivo?: string;
  busqueda?: string;
}

export async function initVentasAgriculturaTable(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS VENTAS_AGRICULTURA (
      id SERIAL PRIMARY KEY,
      empresa TEXT NOT NULL CHECK (empresa IN ('GANADERA GUAVIYU', 'GANADERA CHIVILCOY')),
      mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
      anio INTEGER NOT NULL CHECK (anio >= 2025 AND anio <= 2040),
      cultivo TEXT NOT NULL CHECK (cultivo IN ('TRIGO', 'SOJA', 'MAIZ', 'COLZA')),
      hectareas DOUBLE PRECISION NOT NULL,
      rendimiento_ton_ha DOUBLE PRECISION NOT NULL,
      precio_usd_ton DOUBLE PRECISION NOT NULL,
      total_ton DOUBLE PRECISION NOT NULL,
      importe_usd DOUBLE PRECISION NOT NULL,
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ventas_agri_periodo
     ON VENTAS_AGRICULTURA(anio DESC, mes DESC, creado_en DESC)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_ventas_agri_empresa
     ON VENTAS_AGRICULTURA(empresa, anio DESC, mes DESC)`
  ).run();
}

function mapRow(row: Record<string, unknown>): VentaAgriculturaRow {
  return {
    id: Number(row.id),
    empresa: String(row.empresa) as EmpresaAgricultura,
    mes: Number(row.mes),
    anio: Number(row.anio),
    cultivo: String(row.cultivo) as CultivoAgricultura,
    hectareas: Number(row.hectareas),
    rendimiento_ton_ha: Number(row.rendimiento_ton_ha),
    precio_usd_ton: Number(row.precio_usd_ton),
    total_ton: Number(row.total_ton),
    importe_usd: Number(row.importe_usd),
    creado_en: row.creado_en != null ? String(row.creado_en) : "",
  };
}

function normalizeInput(data: VentaAgriculturaInput): VentaAgriculturaInput {
  const hectareas = Number(data.hectareas);
  const rendimiento_ton_ha = Number(data.rendimiento_ton_ha);
  const precio_usd_ton = Number(data.precio_usd_ton);
  const total_ton = Number(data.total_ton);
  const importe_usd = Number(data.importe_usd);
  const mes = Number(data.mes);
  const anio = Number(data.anio);

  if (!EMPRESAS_AGRICULTURA.includes(data.empresa)) {
    throw new Error("Empresa inválida");
  }
  if (!CULTIVOS_AGRICULTURA.includes(data.cultivo)) {
    throw new Error("Cultivo inválido");
  }
  if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
    throw new Error("Mes inválido");
  }
  if (!Number.isFinite(anio) || anio < 2025 || anio > 2040) {
    throw new Error("Año inválido");
  }
  if (!Number.isFinite(hectareas) || hectareas <= 0) {
    throw new Error("Las hectáreas deben ser mayores a cero");
  }
  if (!Number.isFinite(rendimiento_ton_ha) || rendimiento_ton_ha <= 0) {
    throw new Error("El rendimiento debe ser mayor a cero");
  }
  if (!Number.isFinite(precio_usd_ton) || precio_usd_ton <= 0) {
    throw new Error("El precio debe ser mayor a cero");
  }
  if (!Number.isFinite(total_ton) || total_ton <= 0) {
    throw new Error("El total en toneladas es inválido");
  }
  if (!Number.isFinite(importe_usd) || importe_usd <= 0) {
    throw new Error("El importe estimado es inválido");
  }

  return {
    empresa: data.empresa,
    mes,
    anio,
    cultivo: data.cultivo,
    hectareas,
    rendimiento_ton_ha,
    precio_usd_ton,
    total_ton,
    importe_usd,
  };
}

export async function listVentasAgricultura(
  db: Db,
  filters: VentaAgriculturaFilters = {}
): Promise<VentaAgriculturaRow[]> {
  let sql = "SELECT * FROM VENTAS_AGRICULTURA WHERE 1=1";
  const params: Record<string, string | number> = {};

  if (filters.empresa) {
    sql += " AND empresa = @empresa";
    params.empresa = filters.empresa;
  }
  if (filters.mes != null && Number.isFinite(filters.mes)) {
    sql += " AND mes = @mes";
    params.mes = filters.mes;
  }
  if (filters.anio != null && Number.isFinite(filters.anio)) {
    sql += " AND anio = @anio";
    params.anio = filters.anio;
  }
  if (filters.cultivo) {
    sql += " AND cultivo = @cultivo";
    params.cultivo = filters.cultivo;
  }
  if (filters.busqueda?.trim()) {
    sql += ` AND (
      empresa ILIKE @busqueda OR
      cultivo ILIKE @busqueda OR
      CAST(anio AS TEXT) ILIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }

  sql += " ORDER BY anio DESC, mes DESC, creado_en DESC, id DESC";
  const rows = (await db.prepare(sql).all(params)) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function insertVentaAgricultura(
  db: Db,
  data: VentaAgriculturaInput
): Promise<number> {
  const row = normalizeInput(data);
  const result = await db.prepare(
    `INSERT INTO VENTAS_AGRICULTURA (
      empresa, mes, anio, cultivo, hectareas, rendimiento_ton_ha,
      precio_usd_ton, total_ton, importe_usd
    ) VALUES (
      @empresa, @mes, @anio, @cultivo, @hectareas, @rendimiento_ton_ha,
      @precio_usd_ton, @total_ton, @importe_usd
    )`
  ).run(row);
  const id = Number(result.lastInsertRowid);
  if (!id) throw new Error("No se pudo guardar el registro");
  return id;
}

export async function getVentaAgriculturaById(
  db: Db,
  id: number
): Promise<VentaAgriculturaRow | undefined> {
  const row = (await db
    .prepare("SELECT * FROM VENTAS_AGRICULTURA WHERE id = ?")
    .get(id)) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : undefined;
}

export async function deleteVentaAgricultura(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM VENTAS_AGRICULTURA WHERE id = ?").run(id)).changes > 0;
}
