import type { Db } from "./db/pg-client.js";

export type StockDispositivoModulo = "ganadero" | "equino";

const TABLE: Record<StockDispositivoModulo, string> = {
  ganadero: "STOCK_GANADERO_CONTROL_SANITARIO",
  equino: "STOCK_EQUINO_CONTROL_SANITARIO",
};

export interface StockControlSanitarioRecord {
  id: number;
  clave: string;
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  admin_observaciones: string;
  producto_nombre: string;
  producto_formula: string;
  producto_cantidad: string;
  producto_forma: string;
  producto_espera: string;
  animal_categoria_lote: string;
  animal_id: string;
  control_motivo: string;
  control_funcionario: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioInput {
  admin_fecha_inicio?: string;
  admin_fecha_fin?: string;
  admin_periodo_nota?: string;
  admin_observaciones?: string;
  producto_nombre?: string;
  producto_formula?: string;
  producto_cantidad?: string;
  producto_forma?: string;
  producto_espera?: string;
  animal_categoria_lote?: string;
  animal_id?: string;
  control_motivo?: string;
  control_funcionario?: string;
}

function normalizeClave(clave: string): string {
  const norm = clave.replace(/\D/g, "");
  if (!norm) throw new Error("Clave de dispositivo inválida");
  return norm;
}

function trimField(val: unknown, max: number): string {
  return String(val ?? "")
    .trim()
    .slice(0, max);
}

function normalizeIsoDate(val: string): string {
  const t = val.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  throw new Error("Fecha inválida. Use formato AAAA-MM-DD.");
}

export async function migrateStockControlSanitarioTable(
  db: Db,
  modulo: StockDispositivoModulo
): Promise<void> {
  const table = TABLE[modulo];
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${table} (
         id SERIAL PRIMARY KEY,
         clave TEXT NOT NULL,
         admin_fecha_inicio TEXT NOT NULL DEFAULT '',
         admin_fecha_fin TEXT NOT NULL DEFAULT '',
         admin_periodo_nota TEXT NOT NULL DEFAULT '',
         admin_observaciones TEXT NOT NULL DEFAULT '',
         producto_nombre TEXT NOT NULL DEFAULT '',
         producto_formula TEXT NOT NULL DEFAULT '',
         producto_cantidad TEXT NOT NULL DEFAULT '',
         producto_forma TEXT NOT NULL DEFAULT '',
         producto_espera TEXT NOT NULL DEFAULT '',
         animal_categoria_lote TEXT NOT NULL DEFAULT '',
         animal_id TEXT NOT NULL DEFAULT '',
         control_motivo TEXT NOT NULL DEFAULT '',
         control_funcionario TEXT NOT NULL DEFAULT '',
         creado_en TEXT NOT NULL,
         creado_por TEXT NOT NULL DEFAULT ''
       )`
    )
    .run();

  try {
    await db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_${table.toLowerCase()}_clave
         ON ${table} (clave)`
      )
      .run();
  } catch {
    /* índice ya existe */
  }

  try {
    await db
      .prepare(
        `ALTER TABLE ${table} ADD COLUMN producto_cantidad TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  for (const ddl of [
    `ALTER TABLE ${table} ADD COLUMN producto_formula TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE ${table} ADD COLUMN admin_observaciones TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(ddl).run();
    } catch {
      /* columna ya existe */
    }
  }

  try {
    await db
      .prepare(`ALTER TABLE ${table} RENAME COLUMN producto_marca TO producto_formula`)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `UPDATE ${table}
           SET producto_formula = producto_marca
           WHERE producto_formula = '' AND COALESCE(producto_marca, '') <> ''`
        )
        .run();
    } catch {
      /* producto_marca no existe */
    }
  }
}

export async function listStockControlSanitario(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string
): Promise<StockControlSanitarioRecord[]> {
  const claveNorm = normalizeClave(clave);
  const table = TABLE[modulo];
  const rows = (await db
    .prepare(
      `SELECT id, clave, admin_fecha_inicio, admin_fecha_fin, admin_periodo_nota, admin_observaciones,
              producto_nombre, producto_formula, producto_cantidad, producto_forma, producto_espera,
              animal_categoria_lote, animal_id, control_motivo, control_funcionario,
              creado_en, creado_por
       FROM ${table}
       WHERE clave = @clave
       ORDER BY creado_en DESC, id DESC`
    )
    .all({ clave: claveNorm })) as StockControlSanitarioRecord[];
  return rows;
}

export async function createStockControlSanitario(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  input: StockControlSanitarioInput,
  creadoPor = ""
): Promise<StockControlSanitarioRecord> {
  const claveNorm = normalizeClave(clave);
  const table = TABLE[modulo];

  const productoNombre = trimField(input.producto_nombre, 120);
  if (!productoNombre) {
    throw new Error("Ingresá el nombre comercial del producto.");
  }

  const adminInicio = normalizeIsoDate(trimField(input.admin_fecha_inicio, 10));
  const adminFin = normalizeIsoDate(trimField(input.admin_fecha_fin, 10));
  const periodoNota = trimField(input.admin_periodo_nota, 200);

  if (!adminInicio && !adminFin && !periodoNota) {
    throw new Error("Indicá la fecha o el período de administración.");
  }
  if (adminInicio && adminFin && adminFin < adminInicio) {
    throw new Error("La fecha fin no puede ser anterior a la fecha inicio.");
  }

  const creadoEn = new Date().toISOString();

  const result = await db
    .prepare(
      `INSERT INTO ${table} (
         clave, admin_fecha_inicio, admin_fecha_fin, admin_periodo_nota, admin_observaciones,
         producto_nombre, producto_formula, producto_cantidad, producto_forma, producto_espera,
         animal_categoria_lote, animal_id, control_motivo, control_funcionario,
         creado_en, creado_por
       ) VALUES (
         @clave, @admin_fecha_inicio, @admin_fecha_fin, @admin_periodo_nota, @admin_observaciones,
         @producto_nombre, @producto_formula, @producto_cantidad, @producto_forma, @producto_espera,
         @animal_categoria_lote, @animal_id, @control_motivo, @control_funcionario,
         @creado_en, @creado_por
       ) RETURNING id`
    )
    .run({
      clave: claveNorm,
      admin_fecha_inicio: adminInicio,
      admin_fecha_fin: adminFin,
      admin_periodo_nota: periodoNota,
      admin_observaciones: trimField(input.admin_observaciones, 500),
      producto_nombre: productoNombre,
      producto_formula: trimField(input.producto_formula, 80),
      producto_cantidad: trimField(input.producto_cantidad, 80),
      producto_forma: trimField(input.producto_forma, 80),
      producto_espera: trimField(input.producto_espera, 80),
      animal_categoria_lote: trimField(input.animal_categoria_lote, 80),
      animal_id: trimField(input.animal_id, 64),
      control_motivo: trimField(input.control_motivo, 500),
      control_funcionario: trimField(input.control_funcionario, 120),
      creado_en: creadoEn,
      creado_por: trimField(creadoPor, 120),
    });

  const id = result.lastInsertRowid;

  const row = (await db
    .prepare(
      `SELECT id, clave, admin_fecha_inicio, admin_fecha_fin, admin_periodo_nota, admin_observaciones,
              producto_nombre, producto_formula, producto_cantidad, producto_forma, producto_espera,
              animal_categoria_lote, animal_id, control_motivo, control_funcionario,
              creado_en, creado_por
       FROM ${table} WHERE id = @id AND clave = @clave`
    )
    .get({ id, clave: claveNorm })) as StockControlSanitarioRecord | undefined;

  if (!row) throw new Error("No se pudo guardar el registro de control sanitario.");
  return row;
}

export async function deleteStockControlSanitario(
  db: Db,
  modulo: StockDispositivoModulo,
  clave: string,
  id: number
): Promise<void> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Registro inválido.");
  const claveNorm = normalizeClave(clave);
  const table = TABLE[modulo];
  const result = await db
    .prepare(`DELETE FROM ${table} WHERE id = @id AND clave = @clave`)
    .run({ id, clave: claveNorm });
  const changes = Number((result as { changes?: number }).changes ?? 0);
  if (changes < 1) throw new Error("Registro no encontrado.");
}

export interface StockControlSanitarioResumenItem {
  id: number;
  clave: string;
  animal_id: string;
  producto_nombre: string;
  producto_formula: string;
  control_motivo: string;
  admin_fecha_inicio: string;
  admin_fecha_fin: string;
  admin_periodo_nota: string;
  creado_en: string;
  creado_por: string;
}

export interface StockControlSanitarioResumenFrecuencia {
  etiqueta: string;
  cantidad: number;
}

export interface StockControlSanitarioResumen {
  total_registros: number;
  dispositivos_consultados: number;
  dispositivos_con_historial: number;
  dispositivos_sin_historial: number;
  productos_frecuentes: StockControlSanitarioResumenFrecuencia[];
  motivos_frecuentes: StockControlSanitarioResumenFrecuencia[];
  ultimos_registros: StockControlSanitarioResumenItem[];
}

const RESUMEN_MAX_CLAVES = 300;
const RESUMEN_TOP_FRECUENCIAS = 6;
const RESUMEN_ULTIMOS = 8;

function normalizeClavesResumen(clavesInput: string[]): string[] {
  const out = new Set<string>();
  for (const raw of clavesInput) {
    try {
      out.add(normalizeClave(raw));
    } catch {
      /* omitir claves inválidas */
    }
  }
  return [...out];
}

function emptyStockControlSanitarioResumen(
  dispositivosConsultados = 0
): StockControlSanitarioResumen {
  return {
    total_registros: 0,
    dispositivos_consultados: dispositivosConsultados,
    dispositivos_con_historial: 0,
    dispositivos_sin_historial: dispositivosConsultados,
    productos_frecuentes: [],
    motivos_frecuentes: [],
    ultimos_registros: [],
  };
}

export async function summarizeStockControlSanitarioByClaves(
  db: Db,
  modulo: StockDispositivoModulo,
  clavesInput: string[]
): Promise<StockControlSanitarioResumen> {
  const claves = normalizeClavesResumen(clavesInput);
  if (claves.length === 0) return emptyStockControlSanitarioResumen(0);
  if (claves.length > RESUMEN_MAX_CLAVES) {
    throw new Error(`Máximo ${RESUMEN_MAX_CLAVES} dispositivos por consulta de resumen.`);
  }

  const table = TABLE[modulo];
  const placeholders = claves.map((_, i) => `@c${i}`).join(", ");
  const params: Record<string, unknown> = {};
  claves.forEach((c, i) => {
    params[`c${i}`] = c;
  });

  const totalRow = (await db
    .prepare(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT clave) AS con_historial
       FROM ${table}
       WHERE clave IN (${placeholders})`
    )
    .get(params)) as { total?: number; con_historial?: number } | undefined;

  const totalRegistros = Number(totalRow?.total ?? 0);
  const conHistorial = Number(totalRow?.con_historial ?? 0);

  if (totalRegistros === 0) {
    return emptyStockControlSanitarioResumen(claves.length);
  }

  const productos = (await db
    .prepare(
      `SELECT TRIM(producto_nombre) AS etiqueta, COUNT(*) AS cantidad
       FROM ${table}
       WHERE clave IN (${placeholders}) AND TRIM(producto_nombre) <> ''
       GROUP BY LOWER(TRIM(producto_nombre)), TRIM(producto_nombre)
       ORDER BY cantidad DESC, etiqueta ASC
       LIMIT ${RESUMEN_TOP_FRECUENCIAS}`
    )
    .all(params)) as StockControlSanitarioResumenFrecuencia[];

  const motivos = (await db
    .prepare(
      `SELECT TRIM(control_motivo) AS etiqueta, COUNT(*) AS cantidad
       FROM ${table}
       WHERE clave IN (${placeholders}) AND TRIM(control_motivo) <> ''
       GROUP BY LOWER(TRIM(control_motivo)), TRIM(control_motivo)
       ORDER BY cantidad DESC, etiqueta ASC
       LIMIT ${RESUMEN_TOP_FRECUENCIAS}`
    )
    .all(params)) as StockControlSanitarioResumenFrecuencia[];

  const ultimos = (await db
    .prepare(
      `SELECT id, clave, animal_id, producto_nombre, producto_formula, control_motivo,
              admin_fecha_inicio, admin_fecha_fin, admin_periodo_nota, creado_en, creado_por
       FROM ${table}
       WHERE clave IN (${placeholders})
       ORDER BY creado_en DESC, id DESC
       LIMIT ${RESUMEN_ULTIMOS}`
    )
    .all(params)) as StockControlSanitarioResumenItem[];

  return {
    total_registros: totalRegistros,
    dispositivos_consultados: claves.length,
    dispositivos_con_historial: conHistorial,
    dispositivos_sin_historial: Math.max(0, claves.length - conHistorial),
    productos_frecuentes: productos.map((r) => ({
      etiqueta: r.etiqueta,
      cantidad: Number(r.cantidad),
    })),
    motivos_frecuentes: motivos.map((r) => ({
      etiqueta: r.etiqueta,
      cantidad: Number(r.cantidad),
    })),
    ultimos_registros: ultimos,
  };
}

const CANTIDAD_CATALOGO_TABLE = "STOCK_CONTROL_SANITARIO_CANTIDAD_OPCION";

export interface StockControlSanitarioCantidadOpcion {
  id: number;
  valor: string;
  creado_en: string;
  creado_por: string;
}

function normalizeCantidadValor(val: unknown): string {
  return String(val ?? "")
    .trim()
    .slice(0, 80);
}

export async function migrateStockControlSanitarioCantidadCatalog(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${CANTIDAD_CATALOGO_TABLE} (
         id SERIAL PRIMARY KEY,
         valor TEXT NOT NULL,
         creado_en TEXT NOT NULL,
         creado_por TEXT NOT NULL DEFAULT ''
       )`
    )
    .run();

  try {
    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${CANTIDAD_CATALOGO_TABLE.toLowerCase()}_valor
         ON ${CANTIDAD_CATALOGO_TABLE} (LOWER(valor))`
      )
      .run();
  } catch {
    /* índice ya existe */
  }
}

export async function listStockControlSanitarioCantidadCatalog(
  db: Db
): Promise<StockControlSanitarioCantidadOpcion[]> {
  const rows = (await db
    .prepare(
      `SELECT id, valor, creado_en, creado_por
       FROM ${CANTIDAD_CATALOGO_TABLE}
       ORDER BY LOWER(valor), id`
    )
    .all()) as StockControlSanitarioCantidadOpcion[];
  return rows;
}

export async function createStockControlSanitarioCantidadCatalog(
  db: Db,
  valorInput: string,
  creadoPor = ""
): Promise<StockControlSanitarioCantidadOpcion> {
  const valor = normalizeCantidadValor(valorInput);
  if (!valor) throw new Error("Indicá la cantidad.");

  const existente = (await db
    .prepare(
      `SELECT id, valor, creado_en, creado_por
       FROM ${CANTIDAD_CATALOGO_TABLE}
       WHERE LOWER(valor) = LOWER(@valor)
       LIMIT 1`
    )
    .get({ valor })) as StockControlSanitarioCantidadOpcion | undefined;

  if (existente) return existente;

  const creadoEn = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO ${CANTIDAD_CATALOGO_TABLE} (valor, creado_en, creado_por)
       VALUES (@valor, @creado_en, @creado_por)
       RETURNING id`
    )
    .run({
      valor,
      creado_en: creadoEn,
      creado_por: trimField(creadoPor, 120),
    });

  const id = result.lastInsertRowid;
  const row = (await db
    .prepare(
      `SELECT id, valor, creado_en, creado_por
       FROM ${CANTIDAD_CATALOGO_TABLE} WHERE id = @id`
    )
    .get({ id })) as StockControlSanitarioCantidadOpcion | undefined;

  if (!row) throw new Error("No se pudo guardar la cantidad.");
  return row;
}
