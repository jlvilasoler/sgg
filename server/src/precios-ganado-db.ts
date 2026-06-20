import type { Db } from "./db/pg-client.js";

export const SEGMENTOS_PRECIOS_GANADO = ["GORDO", "REPOSICION"] as const;
export type SegmentoPreciosGanado = (typeof SEGMENTOS_PRECIOS_GANADO)[number];

export const CATEGORIAS_GANADO_GORDO = ["NOVILLO", "VACA", "VAQUILLONA"] as const;
export type CategoriaGanadoGordo = (typeof CATEGORIAS_GANADO_GORDO)[number];

export const CATEGORIAS_GANADO_REPOSICION = [
  "TERNERO",
  "TERNERA",
  "VACA_INVERNADA",
] as const;
export type CategoriaGanadoReposicion = (typeof CATEGORIAS_GANADO_REPOSICION)[number];

export type CategoriaPrecioGanado = CategoriaGanadoGordo | CategoriaGanadoReposicion;

export const CATEGORIA_GANADO_GORDO_LABELS: Record<CategoriaGanadoGordo, string> = {
  NOVILLO: "Novillo",
  VACA: "Vaca",
  VAQUILLONA: "Vaquillona",
};

export const CATEGORIA_GANADO_REPOSICION_LABELS: Record<
  CategoriaGanadoReposicion,
  string
> = {
  TERNERO: "Ternero",
  TERNERA: "Ternera",
  VACA_INVERNADA: "Vaca de invernada",
};

/** @deprecated usar CATEGORIA_GANADO_GORDO_LABELS */
export const CATEGORIA_GANADO_LABELS = CATEGORIA_GANADO_GORDO_LABELS;

export const UNIDAD_GANADO_GORDO = "USD_KG_CUARTA_BALANZA";
export const UNIDAD_GANADO_REPOSICION = "USD_KG_EN_PIE";

export interface PrecioGanado {
  id: number;
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  segmento: SegmentoPreciosGanado;
  categoria: CategoriaPrecioGanado;
  valor: number;
  unidad: string;
  fuente: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface PrecioGanadoSyncLog {
  id: number;
  segmento: SegmentoPreciosGanado;
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  novillo: number | null;
  vaca: number | null;
  vaquillona: number | null;
  ternero: number | null;
  ternera: number | null;
  vaca_invernada: number | null;
  resultado: "insertado" | "actualizado" | "sin_cambios" | "error";
  detalle: string;
  creado_en: string;
}

export interface PrecioGanadoResumenLocal {
  total_semanas: number;
  total_registros: number;
  ultima_sincronizacion: string | null;
  ultima_semana_guardada: { anio: number; semana: number; fecha_hasta: string } | null;
}

export interface PrecioGanadoInput {
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  segmento: SegmentoPreciosGanado;
  categoria: CategoriaPrecioGanado;
  valor: number;
  unidad?: string;
  fuente?: string;
}

export interface SemanaPreciosGanado {
  anio: number;
  semana: number;
  fecha_desde: string;
  fecha_hasta: string;
  segmento: SegmentoPreciosGanado;
  fuente: string;
  precios: Partial<Record<CategoriaPrecioGanado, number>>;
}

const ALL_CATEGORIAS = [
  ...CATEGORIAS_GANADO_GORDO,
  ...CATEGORIAS_GANADO_REPOSICION,
] as const;

export async function initPreciosGanadoTable(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS PRECIOS_GANADO_ACG (
      id SERIAL PRIMARY KEY,
      anio INTEGER NOT NULL,
      semana INTEGER NOT NULL,
      fecha_desde TEXT NOT NULL,
      fecha_hasta TEXT NOT NULL,
      segmento TEXT NOT NULL DEFAULT 'GORDO' CHECK (segmento IN ('GORDO', 'REPOSICION')),
      categoria TEXT NOT NULL CHECK (categoria IN ('NOVILLO', 'VACA', 'VAQUILLONA', 'TERNERO', 'TERNERA', 'VACA_INVERNADA')),
      valor DOUBLE PRECISION NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'USD_KG_CUARTA_BALANZA',
      fuente TEXT NOT NULL DEFAULT 'ACG',
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (anio, semana, segmento, categoria)
    )`
  ).run();
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS PRECIOS_GANADO_ACG_SYNC (
      id SERIAL PRIMARY KEY,
      segmento TEXT NOT NULL DEFAULT 'GORDO' CHECK (segmento IN ('GORDO', 'REPOSICION')),
      anio INTEGER NOT NULL,
      semana INTEGER NOT NULL,
      fecha_desde TEXT NOT NULL,
      fecha_hasta TEXT NOT NULL,
      novillo DOUBLE PRECISION,
      vaca DOUBLE PRECISION,
      vaquillona DOUBLE PRECISION,
      ternero DOUBLE PRECISION,
      ternera DOUBLE PRECISION,
      vaca_invernada DOUBLE PRECISION,
      resultado TEXT NOT NULL CHECK (resultado IN ('insertado', 'actualizado', 'sin_cambios', 'error')),
      detalle TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )`
  ).run();
  await migratePreciosGanadoTimestamps(db);
  await migratePreciosGanadoSegmento(db);
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_precios_ganado_fecha_hasta
     ON PRECIOS_GANADO_ACG(fecha_hasta DESC)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_precios_ganado_segmento
     ON PRECIOS_GANADO_ACG(segmento, fecha_hasta DESC)`
  ).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_precios_ganado_sync_creado
     ON PRECIOS_GANADO_ACG_SYNC(creado_en DESC)`
  ).run();
}

async function migratePreciosGanadoTimestamps(db: Db): Promise<void> {
  for (const col of ["creado_en", "actualizado_en"] as const) {
    try {
      await db.prepare(
        `ALTER TABLE PRECIOS_GANADO_ACG ADD COLUMN ${col} TIMESTAMPTZ DEFAULT NOW()`
      ).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }
}

async function migratePreciosGanadoSegmento(db: Db): Promise<void> {
  try {
    await db.prepare(
      `ALTER TABLE PRECIOS_GANADO_ACG ADD COLUMN segmento TEXT NOT NULL DEFAULT 'GORDO'`
    ).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }

  for (const sql of [
    `ALTER TABLE PRECIOS_GANADO_ACG DROP CONSTRAINT IF EXISTS precios_ganado_acg_anio_semana_categoria_key`,
    `ALTER TABLE PRECIOS_GANADO_ACG DROP CONSTRAINT IF EXISTS precios_ganado_acg_categoria_check`,
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {
      /* constraint puede no existir */
    }
  }

  try {
    await db.prepare(
      `ALTER TABLE PRECIOS_GANADO_ACG ADD CONSTRAINT precios_ganado_acg_categoria_check
       CHECK (categoria IN ('NOVILLO', 'VACA', 'VAQUILLONA', 'TERNERO', 'TERNERA', 'VACA_INVERNADA'))`
    ).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) {
      /* si falla por datos viejos, la app valida categorías */
    }
  }

  await db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_precios_ganado_seg_unique
     ON PRECIOS_GANADO_ACG(anio, semana, segmento, categoria)`
  ).run();

  for (const col of ["segmento", "ternero", "ternera", "vaca_invernada"] as const) {
    try {
      await db.prepare(
        `ALTER TABLE PRECIOS_GANADO_ACG_SYNC ADD COLUMN ${col}${
          col === "segmento" ? " TEXT NOT NULL DEFAULT 'GORDO'" : " DOUBLE PRECISION"
        }`
      ).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already exists|duplicate column/i.test(msg)) throw err;
    }
  }
}

export async function listPreciosGanado(
  db: Db,
  filters: {
    segmento?: SegmentoPreciosGanado;
    categoria?: CategoriaPrecioGanado;
    anio?: number;
    semana_desde?: number;
    semana_hasta?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  } = {}
): Promise<PrecioGanado[]> {
  let query = "SELECT * FROM PRECIOS_GANADO_ACG WHERE 1=1";
  const params: Record<string, string | number> = {};
  if (filters.segmento) {
    query += " AND segmento = @segmento";
    params.segmento = filters.segmento;
  }
  if (filters.categoria) {
    query += " AND categoria = @categoria";
    params.categoria = filters.categoria;
  }
  if (filters.anio != null) {
    query += " AND anio = @anio";
    params.anio = filters.anio;
  }
  if (filters.semana_desde != null) {
    query += " AND semana >= @semana_desde";
    params.semana_desde = filters.semana_desde;
  }
  if (filters.semana_hasta != null) {
    query += " AND semana <= @semana_hasta";
    params.semana_hasta = filters.semana_hasta;
  }
  if (filters.fecha_desde) {
    query += " AND fecha_hasta >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters.fecha_hasta) {
    query += " AND fecha_hasta <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  query += " ORDER BY fecha_hasta DESC, categoria ASC";
  return (await db.prepare(query).all(params)) as PrecioGanado[];
}

export async function getUltimaSemanaGuardada(
  db: Db,
  segmento: SegmentoPreciosGanado
): Promise<{ anio: number; semana: number; fecha_hasta: string } | undefined> {
  const row = (await db
    .prepare(
      `SELECT anio, semana, fecha_hasta FROM PRECIOS_GANADO_ACG
       WHERE segmento = ?
       ORDER BY fecha_hasta DESC, semana DESC LIMIT 1`
    )
    .get(segmento)) as { anio: number; semana: number; fecha_hasta: string } | undefined;
  return row;
}

export async function semanaYaGuardada(
  db: Db,
  segmento: SegmentoPreciosGanado,
  anio: number,
  semana: number
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT 1 FROM PRECIOS_GANADO_ACG WHERE segmento = ? AND anio = ? AND semana = ? LIMIT 1"
    )
    .get(segmento, anio, semana);
  return row !== undefined;
}

export function pivotSemanas(rows: PrecioGanado[]): SemanaPreciosGanado[] {
  const map = new Map<string, SemanaPreciosGanado>();
  for (const row of rows) {
    const key = `${row.segmento}-${row.anio}-${row.semana}`;
    let item = map.get(key);
    if (!item) {
      item = {
        anio: row.anio,
        semana: row.semana,
        fecha_desde: row.fecha_desde,
        fecha_hasta: row.fecha_hasta,
        segmento: row.segmento,
        fuente: row.fuente,
        precios: {},
      };
      map.set(key, item);
    }
    item.precios[row.categoria] = row.valor;
    item.fecha_desde = row.fecha_desde;
    item.fecha_hasta = row.fecha_hasta;
    item.fuente = row.fuente;
  }
  return [...map.values()].sort((a, b) => {
    const cmp = b.fecha_hasta.localeCompare(a.fecha_hasta);
    if (cmp !== 0) return cmp;
    return b.semana - a.semana;
  });
}

export async function getResumenLocal(
  db: Db,
  segmento: SegmentoPreciosGanado
): Promise<PrecioGanadoResumenLocal> {
  const semanasRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT (anio::text || '-' || semana::text)) AS total_semanas,
              COUNT(*) AS total_registros
       FROM PRECIOS_GANADO_ACG WHERE segmento = @segmento`
    )
    .get({ segmento })) as { total_semanas: number; total_registros: number };

  const syncRow = (await db
    .prepare(
      `SELECT creado_en FROM PRECIOS_GANADO_ACG_SYNC
       WHERE segmento = ? AND resultado != 'error'
       ORDER BY creado_en DESC LIMIT 1`
    )
    .get(segmento)) as { creado_en: string } | undefined;

  const ultimaSemana = await getUltimaSemanaGuardada(db, segmento);

  return {
    total_semanas: Number(semanasRow?.total_semanas ?? 0),
    total_registros: Number(semanasRow?.total_registros ?? 0),
    ultima_sincronizacion: syncRow?.creado_en ?? null,
    ultima_semana_guardada: ultimaSemana ?? null,
  };
}

export async function registrarSyncPreciosGanado(
  db: Db,
  input: {
    segmento: SegmentoPreciosGanado;
    anio: number;
    semana: number;
    fecha_desde: string;
    fecha_hasta: string;
    precios: Partial<Record<CategoriaPrecioGanado, number>>;
    resultado: PrecioGanadoSyncLog["resultado"];
    detalle?: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO PRECIOS_GANADO_ACG_SYNC
       (segmento, anio, semana, fecha_desde, fecha_hasta,
        novillo, vaca, vaquillona, ternero, ternera, vaca_invernada, resultado, detalle)
       VALUES (@segmento, @anio, @semana, @fecha_desde, @fecha_hasta,
        @novillo, @vaca, @vaquillona, @ternero, @ternera, @vaca_invernada, @resultado, @detalle)`
    )
    .run({
      segmento: input.segmento,
      anio: input.anio,
      semana: input.semana,
      fecha_desde: input.fecha_desde,
      fecha_hasta: input.fecha_hasta,
      novillo: input.precios.NOVILLO ?? null,
      vaca: input.precios.VACA ?? null,
      vaquillona: input.precios.VAQUILLONA ?? null,
      ternero: input.precios.TERNERO ?? null,
      ternera: input.precios.TERNERA ?? null,
      vaca_invernada: input.precios.VACA_INVERNADA ?? null,
      resultado: input.resultado,
      detalle: input.detalle ?? "",
    });
}

export async function importBatchPreciosGanado(
  db: Db,
  rows: PrecioGanadoInput[],
  options?: { solo_nuevos?: boolean }
): Promise<{ insertados: number; actualizados: number; ignorados: number; sin_cambios: number }> {
  const soloNuevos = options?.solo_nuevos === true;
  return db.transaction(async (tx) => {
    const existsStmt = await tx.prepare(
      `SELECT id, valor FROM PRECIOS_GANADO_ACG
       WHERE segmento = ? AND anio = ? AND semana = ? AND categoria = ?`
    );
    const insertStmt = await tx.prepare(
      `INSERT INTO PRECIOS_GANADO_ACG
       (anio, semana, fecha_desde, fecha_hasta, segmento, categoria, valor, unidad, fuente)
       VALUES (@anio, @semana, @fecha_desde, @fecha_hasta, @segmento, @categoria, @valor, @unidad, @fuente)`
    );
    const updateStmt = await tx.prepare(
      `UPDATE PRECIOS_GANADO_ACG SET
         fecha_desde = @fecha_desde,
         fecha_hasta = @fecha_hasta,
         valor = @valor,
         unidad = @unidad,
         fuente = @fuente,
         actualizado_en = NOW()
       WHERE segmento = @segmento AND anio = @anio AND semana = @semana AND categoria = @categoria`
    );

    let insertados = 0;
    let actualizados = 0;
    let ignorados = 0;
    let sin_cambios = 0;

    for (const row of rows) {
      const defaultUnidad =
        row.segmento === "REPOSICION" ? UNIDAD_GANADO_REPOSICION : UNIDAD_GANADO_GORDO;
      const payload = {
        ...row,
        unidad: row.unidad ?? defaultUnidad,
        fuente: row.fuente ?? "ACG",
      };
      const prev = (await existsStmt.get(
        row.segmento,
        row.anio,
        row.semana,
        row.categoria
      )) as { id: number; valor: number } | undefined;

      if (!prev) {
        await insertStmt.run(payload);
        insertados++;
        continue;
      }

      if (soloNuevos) {
        ignorados++;
        continue;
      }

      if (Math.abs(Number(prev.valor) - Number(payload.valor)) < 0.0001) {
        sin_cambios++;
        continue;
      }

      await updateStmt.run(payload);
      actualizados++;
    }

    return { insertados, actualizados, ignorados, sin_cambios };
  });
}

export function categoriasPorSegmento(
  segmento: SegmentoPreciosGanado
): readonly CategoriaPrecioGanado[] {
  return segmento === "REPOSICION" ? CATEGORIAS_GANADO_REPOSICION : CATEGORIAS_GANADO_GORDO;
}

export function labelsPorSegmento(
  segmento: SegmentoPreciosGanado
): Record<string, string> {
  return segmento === "REPOSICION"
    ? CATEGORIA_GANADO_REPOSICION_LABELS
    : CATEGORIA_GANADO_GORDO_LABELS;
}
