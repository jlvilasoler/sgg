import type { Db } from "./db/pg-client.js";

export const CULTIVOS_AGRICULTURA = ["TRIGO", "SOJA", "MAIZ", "COLZA"] as const;
export type CultivoAgricultura = (typeof CULTIVOS_AGRICULTURA)[number];

export const EMPRESAS_AGRICULTURA = ["GANADERA GUAVIYU", "GANADERA CHIVILCOY"] as const;
export type EmpresaAgricultura = (typeof EMPRESAS_AGRICULTURA)[number];

export interface VentaAgriculturaRow {
  id: number;
  empresa: EmpresaAgricultura;
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
  cultivo: CultivoAgricultura;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
  venta_realizada: boolean;
  venta_realizada_en: string | null;
  real_mes_inicio: number | null;
  real_mes_fin: number | null;
  real_anio_inicio: number | null;
  real_anio_fin: number | null;
  real_hectareas: number | null;
  real_rendimiento_ton_ha: number | null;
  real_precio_usd_ton: number | null;
  real_total_ton: number | null;
  real_importe_usd: number | null;
  real_notas: string | null;
  destacada: boolean;
  creado_en: string;
}

export interface VentaAgriculturaRealInput {
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
  hectareas: number;
  rendimiento_ton_ha: number;
  precio_usd_ton: number;
  total_ton: number;
  importe_usd: number;
  notas?: string | null;
}

export interface VentaAgriculturaInput {
  empresa: EmpresaAgricultura;
  mes_inicio: number;
  mes_fin: number;
  anio_inicio: number;
  anio_fin: number;
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

  for (const col of [
    "mes_inicio INTEGER",
    "mes_fin INTEGER",
    "anio_inicio INTEGER",
    "anio_fin INTEGER",
    "venta_realizada INTEGER NOT NULL DEFAULT 0",
    "venta_realizada_en TIMESTAMPTZ",
    "real_mes_inicio INTEGER",
    "real_mes_fin INTEGER",
    "real_anio_inicio INTEGER",
    "real_anio_fin INTEGER",
    "real_hectareas DOUBLE PRECISION",
    "real_rendimiento_ton_ha DOUBLE PRECISION",
    "real_precio_usd_ton DOUBLE PRECISION",
    "real_total_ton DOUBLE PRECISION",
    "real_importe_usd DOUBLE PRECISION",
    "real_notas TEXT",
    "destacada INTEGER NOT NULL DEFAULT 0",
  ] as const) {
    try {
      await db.prepare(`ALTER TABLE VENTAS_AGRICULTURA ADD COLUMN ${col}`).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }

  await db.prepare(
    `UPDATE VENTAS_AGRICULTURA
     SET mes_inicio = mes, mes_fin = mes,
         anio_inicio = anio, anio_fin = anio
     WHERE mes_inicio IS NULL OR mes_fin IS NULL
        OR anio_inicio IS NULL OR anio_fin IS NULL`
  ).run();
}

function mapRow(row: Record<string, unknown>): VentaAgriculturaRow {
  const mesLegacy = Number(row.mes);
  const mesInicio =
    row.mes_inicio != null ? Number(row.mes_inicio) : mesLegacy;
  const mesFin = row.mes_fin != null ? Number(row.mes_fin) : mesLegacy;
  const anioLegacy = Number(row.anio);
  const anioInicio =
    row.anio_inicio != null ? Number(row.anio_inicio) : anioLegacy;
  const anioFin = row.anio_fin != null ? Number(row.anio_fin) : anioLegacy;
  return {
    id: Number(row.id),
    empresa: String(row.empresa) as EmpresaAgricultura,
    mes_inicio: mesInicio,
    mes_fin: mesFin,
    anio_inicio: anioInicio,
    anio_fin: anioFin,
    cultivo: String(row.cultivo) as CultivoAgricultura,
    hectareas: Number(row.hectareas),
    rendimiento_ton_ha: Number(row.rendimiento_ton_ha),
    precio_usd_ton: Number(row.precio_usd_ton),
    total_ton: Number(row.total_ton),
    importe_usd: Number(row.importe_usd),
    venta_realizada: Number(row.venta_realizada ?? 0) === 1,
    venta_realizada_en: row.venta_realizada_en != null ? String(row.venta_realizada_en) : null,
    real_mes_inicio: row.real_mes_inicio != null ? Number(row.real_mes_inicio) : null,
    real_mes_fin: row.real_mes_fin != null ? Number(row.real_mes_fin) : null,
    real_anio_inicio: row.real_anio_inicio != null ? Number(row.real_anio_inicio) : null,
    real_anio_fin: row.real_anio_fin != null ? Number(row.real_anio_fin) : null,
    real_hectareas: row.real_hectareas != null ? Number(row.real_hectareas) : null,
    real_rendimiento_ton_ha:
      row.real_rendimiento_ton_ha != null ? Number(row.real_rendimiento_ton_ha) : null,
    real_precio_usd_ton: row.real_precio_usd_ton != null ? Number(row.real_precio_usd_ton) : null,
    real_total_ton: row.real_total_ton != null ? Number(row.real_total_ton) : null,
    real_importe_usd: row.real_importe_usd != null ? Number(row.real_importe_usd) : null,
    real_notas: row.real_notas != null ? String(row.real_notas) : null,
    destacada: Number(row.destacada ?? 0) === 1,
    creado_en: row.creado_en != null ? String(row.creado_en) : "",
  };
}

function normalizeInput(data: VentaAgriculturaInput): VentaAgriculturaInput {
  const hectareas = Number(data.hectareas);
  const rendimiento_ton_ha = Number(data.rendimiento_ton_ha);
  const precio_usd_ton = Number(data.precio_usd_ton);
  const total_ton = Number(data.total_ton);
  const importe_usd = Number(data.importe_usd);
  const mes_inicio = Number(data.mes_inicio);
  const mes_fin = Number(data.mes_fin);
  const anio_inicio = Number(data.anio_inicio);
  const anio_fin = Number(data.anio_fin);

  if (!EMPRESAS_AGRICULTURA.includes(data.empresa)) {
    throw new Error("Empresa inválida");
  }
  if (!CULTIVOS_AGRICULTURA.includes(data.cultivo)) {
    throw new Error("Cultivo inválido");
  }
  if (!Number.isFinite(mes_inicio) || mes_inicio < 1 || mes_inicio > 12) {
    throw new Error("Mes de inicio de zafra inválido");
  }
  if (!Number.isFinite(mes_fin) || mes_fin < 1 || mes_fin > 12) {
    throw new Error("Mes final de zafra inválido");
  }
  if (!Number.isFinite(anio_inicio) || anio_inicio < 2025 || anio_inicio > 2040) {
    throw new Error("Año de inicio de zafra inválido");
  }
  if (!Number.isFinite(anio_fin) || anio_fin < 2025 || anio_fin > 2040) {
    throw new Error("Año final de zafra inválido");
  }
  const inicioOrd = anio_inicio * 12 + mes_inicio;
  const finOrd = anio_fin * 12 + mes_fin;
  if (finOrd < inicioOrd) {
    throw new Error("El mes final debe ser posterior o igual al mes de inicio");
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
    mes_inicio,
    mes_fin,
    anio_inicio,
    anio_fin,
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
    sql += ` AND (
      (COALESCE(mes_inicio, mes) <= COALESCE(mes_fin, mes) AND @mes BETWEEN COALESCE(mes_inicio, mes) AND COALESCE(mes_fin, mes))
      OR (COALESCE(mes_inicio, mes) > COALESCE(mes_fin, mes) AND (@mes >= COALESCE(mes_inicio, mes) OR @mes <= COALESCE(mes_fin, mes)))
    )`;
    params.mes = filters.mes;
  }
  if (filters.anio != null && Number.isFinite(filters.anio)) {
    sql += ` AND @anio BETWEEN COALESCE(anio_inicio, anio) AND COALESCE(anio_fin, anio)`;
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

  sql += " ORDER BY COALESCE(anio_inicio, anio) DESC, COALESCE(mes_inicio, mes) DESC, creado_en DESC, id DESC";
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
      empresa, mes, mes_inicio, mes_fin, anio, anio_inicio, anio_fin, cultivo, hectareas, rendimiento_ton_ha,
      precio_usd_ton, total_ton, importe_usd
    ) VALUES (
      @empresa, @mes_inicio, @mes_inicio, @mes_fin, @anio_inicio, @anio_inicio, @anio_fin, @cultivo, @hectareas, @rendimiento_ton_ha,
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

export async function updateVentaAgricultura(
  db: Db,
  id: number,
  data: VentaAgriculturaInput
): Promise<VentaAgriculturaRow> {
  const existing = await getVentaAgriculturaById(db, id);
  if (!existing) throw new Error("Simulación no encontrada");
  if (existing.venta_realizada) {
    throw new Error("No se puede editar una simulación con venta cerrada");
  }

  const row = normalizeInput(data);
  const result = await db.prepare(
    `UPDATE VENTAS_AGRICULTURA SET
      empresa = @empresa,
      mes = @mes_inicio,
      mes_inicio = @mes_inicio,
      mes_fin = @mes_fin,
      anio = @anio_inicio,
      anio_inicio = @anio_inicio,
      anio_fin = @anio_fin,
      cultivo = @cultivo,
      hectareas = @hectareas,
      rendimiento_ton_ha = @rendimiento_ton_ha,
      precio_usd_ton = @precio_usd_ton,
      total_ton = @total_ton,
      importe_usd = @importe_usd
     WHERE id = @id`
  ).run({ ...row, id });

  if (result.changes === 0) throw new Error("No se pudo actualizar el registro");
  const updated = await getVentaAgriculturaById(db, id);
  if (!updated) throw new Error("No se pudo actualizar el registro");
  return updated;
}

export async function deleteVentaAgricultura(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM VENTAS_AGRICULTURA WHERE id = ?").run(id)).changes > 0;
}

function normalizeRealInput(data: VentaAgriculturaRealInput): VentaAgriculturaRealInput {
  const mes_inicio = Number(data.mes_inicio);
  const mes_fin = Number(data.mes_fin);
  const anio_inicio = Number(data.anio_inicio);
  const anio_fin = Number(data.anio_fin);
  const hectareas = Number(data.hectareas);
  const rendimiento_ton_ha = Number(data.rendimiento_ton_ha);
  const precio_usd_ton = Number(data.precio_usd_ton);
  const total_ton = Number(data.total_ton);
  const importe_usd = Number(data.importe_usd);

  if (!Number.isFinite(mes_inicio) || mes_inicio < 1 || mes_inicio > 12) {
    throw new Error("Mes de inicio real inválido");
  }
  if (!Number.isFinite(mes_fin) || mes_fin < 1 || mes_fin > 12) {
    throw new Error("Mes final real inválido");
  }
  if (!Number.isFinite(anio_inicio) || anio_inicio < 2025 || anio_inicio > 2040) {
    throw new Error("Año de inicio real inválido");
  }
  if (!Number.isFinite(anio_fin) || anio_fin < 2025 || anio_fin > 2040) {
    throw new Error("Año final real inválido");
  }
  if (anio_fin * 12 + mes_fin < anio_inicio * 12 + mes_inicio) {
    throw new Error("La zafra real debe terminar en o después del inicio");
  }
  if (!Number.isFinite(hectareas) || hectareas <= 0) {
    throw new Error("Las hectáreas reales deben ser mayores a cero");
  }
  if (!Number.isFinite(rendimiento_ton_ha) || rendimiento_ton_ha <= 0) {
    throw new Error("El rendimiento real debe ser mayor a cero");
  }
  if (!Number.isFinite(precio_usd_ton) || precio_usd_ton <= 0) {
    throw new Error("El precio real debe ser mayor a cero");
  }
  if (!Number.isFinite(total_ton) || total_ton <= 0) {
    throw new Error("El total real en toneladas es inválido");
  }
  if (!Number.isFinite(importe_usd) || importe_usd <= 0) {
    throw new Error("El importe real es inválido");
  }

  return {
    mes_inicio,
    mes_fin,
    anio_inicio,
    anio_fin,
    hectareas,
    rendimiento_ton_ha,
    precio_usd_ton,
    total_ton,
    importe_usd,
    notas: data.notas?.trim() || null,
  };
}

export async function patchVentaAgricultura(
  db: Db,
  id: number,
  patch: {
    venta_realizada?: boolean;
    valores_reales?: VentaAgriculturaRealInput | null;
    destacada?: boolean;
  }
): Promise<VentaAgriculturaRow> {
  const existing = await getVentaAgriculturaById(db, id);
  if (!existing) throw new Error("Simulación no encontrada");

  let venta_realizada = patch.venta_realizada ?? existing.venta_realizada;
  let venta_realizada_en = existing.venta_realizada_en;
  let destacada = patch.destacada ?? existing.destacada;

  if (patch.venta_realizada === true && !existing.venta_realizada) {
    venta_realizada_en = new Date().toISOString();
  } else if (patch.venta_realizada === false) {
    venta_realizada_en = null;
  }

  let real_mes_inicio = existing.real_mes_inicio;
  let real_mes_fin = existing.real_mes_fin;
  let real_anio_inicio = existing.real_anio_inicio;
  let real_anio_fin = existing.real_anio_fin;
  let real_hectareas = existing.real_hectareas;
  let real_rendimiento_ton_ha = existing.real_rendimiento_ton_ha;
  let real_precio_usd_ton = existing.real_precio_usd_ton;
  let real_total_ton = existing.real_total_ton;
  let real_importe_usd = existing.real_importe_usd;
  let real_notas = existing.real_notas;

  if (patch.venta_realizada === false) {
    venta_realizada = false;
    venta_realizada_en = null;
    real_mes_inicio = null;
    real_mes_fin = null;
    real_anio_inicio = null;
    real_anio_fin = null;
    real_hectareas = null;
    real_rendimiento_ton_ha = null;
    real_precio_usd_ton = null;
    real_total_ton = null;
    real_importe_usd = null;
    real_notas = null;
  } else if (patch.valores_reales) {
    const v = normalizeRealInput(patch.valores_reales);
    real_mes_inicio = v.mes_inicio;
    real_mes_fin = v.mes_fin;
    real_anio_inicio = v.anio_inicio;
    real_anio_fin = v.anio_fin;
    real_hectareas = v.hectareas;
    real_rendimiento_ton_ha = v.rendimiento_ton_ha;
    real_precio_usd_ton = v.precio_usd_ton;
    real_total_ton = v.total_ton;
    real_importe_usd = v.importe_usd;
    real_notas = v.notas ?? null;
    venta_realizada = true;
    if (!venta_realizada_en) venta_realizada_en = new Date().toISOString();
  }

  if (patch.venta_realizada === true && !patch.valores_reales && existing.real_importe_usd == null) {
    throw new Error("Completá los valores reales de la venta");
  }

  await db.prepare(
    `UPDATE VENTAS_AGRICULTURA SET
      venta_realizada = @venta_realizada,
      venta_realizada_en = @venta_realizada_en,
      destacada = @destacada,
      real_mes_inicio = @real_mes_inicio,
      real_mes_fin = @real_mes_fin,
      real_anio_inicio = @real_anio_inicio,
      real_anio_fin = @real_anio_fin,
      real_hectareas = @real_hectareas,
      real_rendimiento_ton_ha = @real_rendimiento_ton_ha,
      real_precio_usd_ton = @real_precio_usd_ton,
      real_total_ton = @real_total_ton,
      real_importe_usd = @real_importe_usd,
      real_notas = @real_notas
     WHERE id = @id`
  ).run({
    id,
    venta_realizada: venta_realizada ? 1 : 0,
    venta_realizada_en,
    destacada: destacada ? 1 : 0,
    real_mes_inicio,
    real_mes_fin,
    real_anio_inicio,
    real_anio_fin,
    real_hectareas,
    real_rendimiento_ton_ha,
    real_precio_usd_ton,
    real_total_ton,
    real_importe_usd,
    real_notas,
  });

  const updated = await getVentaAgriculturaById(db, id);
  if (!updated) throw new Error("No se pudo actualizar el registro");
  return updated;
}
