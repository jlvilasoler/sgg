import type { Db } from "./db/pg-client.js";
import { PRODUCTO_FICHAS_SEED } from "./stock-control-sanitario-producto-fichas-seed.js";
import { PRODUCTO_FICHAS_SEED_EQUINO } from "./stock-control-sanitario-producto-fichas-seed-equino.js";
import { productoVisibleEnModuloSanitario } from "./stock-control-sanitario-marcas-equino.js";
import {
  esFotoProductoAceptable,
  sanitizeProductoFichaFoto,
} from "./stock-producto-ficha-foto.js";

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
      control_funcionario:
        trimField(creadoPor, 120) || trimField(input.control_funcionario, 120),
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
const RESUMEN_ULTIMOS = 24;

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

const FECHAS_APLICACION_MAX_CLAVES = 300;

function isoDateOrEmpty(val: string): string {
  const t = val.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

function resolveFechaAplicacion(admin_fecha_inicio: string, creado_en: string): string {
  return isoDateOrEmpty(admin_fecha_inicio) || isoDateOrEmpty(String(creado_en).slice(0, 10));
}

export async function getUltimaFechaAplicacionPorClaves(
  db: Db,
  modulo: StockDispositivoModulo,
  clavesInput: string[]
): Promise<Record<string, string>> {
  const claves = normalizeClavesResumen(clavesInput);
  if (claves.length === 0) return {};
  if (claves.length > FECHAS_APLICACION_MAX_CLAVES) {
    throw new Error(
      `Máximo ${FECHAS_APLICACION_MAX_CLAVES} dispositivos por consulta de fechas de aplicación.`
    );
  }

  const table = TABLE[modulo];
  const placeholders = claves.map((_, i) => `@c${i}`).join(", ");
  const params: Record<string, unknown> = {};
  claves.forEach((c, i) => {
    params[`c${i}`] = c;
  });

  const rows = (await db
    .prepare(
      `SELECT DISTINCT ON (clave) clave, admin_fecha_inicio, creado_en
       FROM ${table}
       WHERE clave IN (${placeholders})
       ORDER BY clave, creado_en DESC, id DESC`
    )
    .all(params)) as { clave: string; admin_fecha_inicio: string; creado_en: string }[];

  const out: Record<string, string> = {};
  for (const row of rows) {
    const fecha = resolveFechaAplicacion(row.admin_fecha_inicio, row.creado_en);
    if (fecha) out[row.clave] = fecha;
  }
  return out;
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

const ESPERA_CATALOGO_TABLE = "STOCK_CONTROL_SANITARIO_ESPERA_OPCION";

const ESPERAS_CATALOGO_SEED: readonly string[] = [
  "30 DIAS",
  "40 DIAS",
  "50 DIAS",
  "60 DIAS",
];

export interface StockControlSanitarioEsperaOpcion {
  id: number;
  valor: string;
  creado_en: string;
  creado_por: string;
}

function normalizeEsperaValor(val: unknown): string {
  return String(val ?? "")
    .trim()
    .slice(0, 80);
}

export async function migrateStockControlSanitarioEsperaCatalog(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${ESPERA_CATALOGO_TABLE} (
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
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${ESPERA_CATALOGO_TABLE.toLowerCase()}_valor
         ON ${ESPERA_CATALOGO_TABLE} (LOWER(valor))`
      )
      .run();
  } catch {
    /* índice ya existe */
  }

  const creadoEn = new Date().toISOString();
  for (const valor of ESPERAS_CATALOGO_SEED) {
    const existente = (await db
      .prepare(
        `SELECT id FROM ${ESPERA_CATALOGO_TABLE}
         WHERE LOWER(valor) = LOWER(@valor)
         LIMIT 1`
      )
      .get({ valor })) as { id: number } | undefined;
    if (existente) continue;
    await db
      .prepare(
        `INSERT INTO ${ESPERA_CATALOGO_TABLE} (valor, creado_en, creado_por)
         VALUES (@valor, @creado_en, @creado_por)`
      )
      .run({ valor, creado_en: creadoEn, creado_por: "sistema" });
  }
}

export async function listStockControlSanitarioEsperaCatalog(
  db: Db
): Promise<StockControlSanitarioEsperaOpcion[]> {
  const rows = (await db
    .prepare(
      `SELECT id, valor, creado_en, creado_por
       FROM ${ESPERA_CATALOGO_TABLE}
       ORDER BY LOWER(valor), id`
    )
    .all()) as StockControlSanitarioEsperaOpcion[];
  return rows;
}

export async function createStockControlSanitarioEsperaCatalog(
  db: Db,
  valorInput: string,
  creadoPor = ""
): Promise<StockControlSanitarioEsperaOpcion> {
  const valor = normalizeEsperaValor(valorInput);
  if (!valor) throw new Error("Indicá el tiempo de espera.");

  const existente = (await db
    .prepare(
      `SELECT id, valor, creado_en, creado_por
       FROM ${ESPERA_CATALOGO_TABLE}
       WHERE LOWER(valor) = LOWER(@valor)
       LIMIT 1`
    )
    .get({ valor })) as StockControlSanitarioEsperaOpcion | undefined;

  if (existente) return existente;

  const creadoEn = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO ${ESPERA_CATALOGO_TABLE} (valor, creado_en, creado_por)
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
       FROM ${ESPERA_CATALOGO_TABLE} WHERE id = @id`
    )
    .get({ id })) as StockControlSanitarioEsperaOpcion | undefined;

  if (!row) throw new Error("No se pudo guardar el tiempo de espera.");
  return row;
}

const PRODUCTO_FICHA_TABLE = "STOCK_CONTROL_SANITARIO_PRODUCTO_FICHA";
const MAX_FICHA_FOTO_LEN = 900_000;

export interface StockControlSanitarioProductoFicha {
  id: number;
  nombre: string;
  laboratorio: string;
  principio_activo: string;
  presentacion: string;
  via_administracion: string;
  especie: string;
  tiempo_espera_carne: string;
  tiempo_espera_leche: string;
  detalles_tecnicos: string;
  caracteristicas: string;
  foto_data: string;
  creado_en: string;
  actualizado_en: string;
  actualizado_por: string;
  creado_por: string;
}

export interface StockControlSanitarioProductoFichaInput {
  nombre: string;
  laboratorio?: string;
  principio_activo?: string;
  presentacion?: string;
  via_administracion?: string;
  especie?: string;
  tiempo_espera_carne?: string;
  tiempo_espera_leche?: string;
  detalles_tecnicos?: string;
  caracteristicas?: string;
  foto_data?: string;
}

function trimFichaField(val: unknown, max: number): string {
  return String(val ?? "")
    .trim()
    .slice(0, max);
}

function normalizeFichaNombre(val: unknown): string {
  return trimFichaField(val, 120);
}

export async function migrateStockControlSanitarioProductoFicha(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${PRODUCTO_FICHA_TABLE} (
         id SERIAL PRIMARY KEY,
         nombre TEXT NOT NULL,
         laboratorio TEXT NOT NULL DEFAULT '',
         principio_activo TEXT NOT NULL DEFAULT '',
         presentacion TEXT NOT NULL DEFAULT '',
         via_administracion TEXT NOT NULL DEFAULT '',
         especie TEXT NOT NULL DEFAULT '',
         tiempo_espera_carne TEXT NOT NULL DEFAULT '',
         tiempo_espera_leche TEXT NOT NULL DEFAULT '',
         detalles_tecnicos TEXT NOT NULL DEFAULT '',
         caracteristicas TEXT NOT NULL DEFAULT '',
         foto_data TEXT NOT NULL DEFAULT '',
         creado_en TEXT NOT NULL,
         actualizado_en TEXT NOT NULL,
         actualizado_por TEXT NOT NULL DEFAULT '',
         creado_por TEXT NOT NULL DEFAULT ''
       )`
    )
    .run();

  try {
    await db
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${PRODUCTO_FICHA_TABLE.toLowerCase()}_nombre
         ON ${PRODUCTO_FICHA_TABLE} (LOWER(nombre))`
      )
      .run();
  } catch {
    /* índice ya existe */
  }

  try {
    await db
      .prepare(
        `ALTER TABLE ${PRODUCTO_FICHA_TABLE} ADD COLUMN creado_por TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  try {
    await db
      .prepare(
        `UPDATE ${PRODUCTO_FICHA_TABLE}
         SET creado_por = actualizado_por
         WHERE TRIM(creado_por) = ''
           AND TRIM(actualizado_por) <> ''
           AND TRIM(laboratorio) = ''
           AND TRIM(principio_activo) = ''
           AND TRIM(foto_data) = ''`
      )
      .run();
  } catch {
    /* backfill opcional */
  }

  await seedStockControlSanitarioProductoFichasIfMissing(db);
  await repairProductoFichasFotosInvalidas(db);
}

export async function repairProductoFichasFotosInvalidas(db: Db): Promise<void> {
  const rows = (await db
    .prepare(`SELECT id, foto_data FROM ${PRODUCTO_FICHA_TABLE} WHERE TRIM(foto_data) <> ''`)
    .all()) as { id: number; foto_data: string }[];

  for (const row of rows) {
    if (esFotoProductoAceptable(row.foto_data)) continue;
    await db
      .prepare(`UPDATE ${PRODUCTO_FICHA_TABLE} SET foto_data = '' WHERE id = @id`)
      .run({ id: row.id });
  }
}

export async function seedStockControlSanitarioProductoFichasIfMissing(db: Db): Promise<void> {
  for (const seed of [...PRODUCTO_FICHAS_SEED, ...PRODUCTO_FICHAS_SEED_EQUINO]) {
    const existente = await getStockControlSanitarioProductoFicha(db, seed.nombre);
    if (existente?.detalles_tecnicos?.trim()) continue;

    const fotoExistente = existente?.foto_data?.trim() ?? "";
    const fotoSeed = seed.foto ?? "";
    const foto_data =
      fotoExistente && esFotoProductoAceptable(fotoExistente)
        ? fotoExistente
        : fotoSeed || fotoExistente;

    await upsertStockControlSanitarioProductoFicha(
      db,
      {
        nombre: seed.nombre,
        laboratorio: seed.laboratorio,
        principio_activo: seed.principio_activo,
        presentacion: seed.presentacion,
        via_administracion: seed.via_administracion,
        especie: seed.especie,
        tiempo_espera_carne: seed.tiempo_espera_carne,
        tiempo_espera_leche: seed.tiempo_espera_leche,
        detalles_tecnicos: seed.detalles_tecnicos,
        caracteristicas: seed.caracteristicas,
        foto_data,
      },
      "sistema"
    );
  }
}

export async function getStockControlSanitarioProductoFicha(
  db: Db,
  nombreInput: string
): Promise<StockControlSanitarioProductoFicha | null> {
  const nombre = normalizeFichaNombre(nombreInput);
  if (!nombre) return null;
  const row = (await db
    .prepare(
      `SELECT id, nombre, laboratorio, principio_activo, presentacion, via_administracion,
              especie, tiempo_espera_carne, tiempo_espera_leche, detalles_tecnicos,
              caracteristicas, foto_data, creado_en, actualizado_en, actualizado_por, creado_por
       FROM ${PRODUCTO_FICHA_TABLE}
       WHERE LOWER(nombre) = LOWER(@nombre)
       LIMIT 1`
    )
    .get({ nombre })) as StockControlSanitarioProductoFicha | undefined;
  if (!row) return null;
  return { ...row, foto_data: sanitizeProductoFichaFoto(row.foto_data) };
}

export async function upsertStockControlSanitarioProductoFicha(
  db: Db,
  input: StockControlSanitarioProductoFichaInput,
  actualizadoPor = ""
): Promise<StockControlSanitarioProductoFicha> {
  const nombre = normalizeFichaNombre(input.nombre);
  if (!nombre) throw new Error("Indicá el nombre del producto.");

  const fotoRaw = String(input.foto_data ?? "");
  const fotoSanitized = sanitizeProductoFichaFoto(fotoRaw);
  const foto_data =
    fotoSanitized.length > MAX_FICHA_FOTO_LEN
      ? fotoSanitized.slice(0, MAX_FICHA_FOTO_LEN)
      : fotoSanitized;

  const payload = {
    nombre,
    laboratorio: trimFichaField(input.laboratorio, 120),
    principio_activo: trimFichaField(input.principio_activo, 200),
    presentacion: trimFichaField(input.presentacion, 200),
    via_administracion: trimFichaField(input.via_administracion, 120),
    especie: trimFichaField(input.especie, 120),
    tiempo_espera_carne: trimFichaField(input.tiempo_espera_carne, 80),
    tiempo_espera_leche: trimFichaField(input.tiempo_espera_leche, 80),
    detalles_tecnicos: trimFichaField(input.detalles_tecnicos, 4000),
    caracteristicas: trimFichaField(input.caracteristicas, 4000),
    foto_data,
  };

  const existente = await getStockControlSanitarioProductoFicha(db, nombre);
  const ahora = new Date().toISOString();
  const autor = trimField(actualizadoPor, 120);

  if (existente) {
    await db
      .prepare(
        `UPDATE ${PRODUCTO_FICHA_TABLE}
         SET laboratorio = @laboratorio,
             principio_activo = @principio_activo,
             presentacion = @presentacion,
             via_administracion = @via_administracion,
             especie = @especie,
             tiempo_espera_carne = @tiempo_espera_carne,
             tiempo_espera_leche = @tiempo_espera_leche,
             detalles_tecnicos = @detalles_tecnicos,
             caracteristicas = @caracteristicas,
             foto_data = @foto_data,
             actualizado_en = @actualizado_en,
             actualizado_por = @actualizado_por
         WHERE id = @id`
      )
      .run({
        id: existente.id,
        ...payload,
        actualizado_en: ahora,
        actualizado_por: autor,
      });
  } else {
    await db
      .prepare(
        `INSERT INTO ${PRODUCTO_FICHA_TABLE} (
           nombre, laboratorio, principio_activo, presentacion, via_administracion,
           especie, tiempo_espera_carne, tiempo_espera_leche, detalles_tecnicos,
           caracteristicas, foto_data, creado_en, actualizado_en, actualizado_por, creado_por
         ) VALUES (
           @nombre, @laboratorio, @principio_activo, @presentacion, @via_administracion,
           @especie, @tiempo_espera_carne, @tiempo_espera_leche, @detalles_tecnicos,
           @caracteristicas, @foto_data, @creado_en, @actualizado_en, @actualizado_por, @creado_por
         )`
      )
      .run({
        ...payload,
        creado_en: ahora,
        actualizado_en: ahora,
        actualizado_por: autor,
        creado_por: autor,
      });
  }

  const row = await getStockControlSanitarioProductoFicha(db, nombre);
  if (!row) throw new Error("No se pudo guardar la ficha del producto.");
  return row;
}

export interface StockControlSanitarioProductoFichaResumen {
  id: number;
  nombre: string;
  laboratorio: string;
  principio_activo: string;
  via_administracion: string;
  especie: string;
  creado_en: string;
  creado_por: string;
  actualizado_en: string;
  actualizado_por: string;
  tiene_foto: boolean;
}

export async function listStockControlSanitarioProductoFichas(
  db: Db
): Promise<StockControlSanitarioProductoFichaResumen[]> {
  const rows = (await db
    .prepare(
      `SELECT id, nombre, laboratorio, principio_activo, via_administracion, especie,
              actualizado_en, actualizado_por, creado_en, creado_por,
              CASE WHEN TRIM(foto_data) <> '' THEN 1 ELSE 0 END AS tiene_foto
       FROM ${PRODUCTO_FICHA_TABLE}
       ORDER BY LOWER(nombre), id`
    )
    .all()) as (Omit<StockControlSanitarioProductoFichaResumen, "tiene_foto"> & {
    tiene_foto: number | boolean;
  })[];

  return rows.map((row) => ({
    id: Number(row.id),
    nombre: String(row.nombre ?? "").trim(),
    laboratorio: String(row.laboratorio ?? "").trim(),
    principio_activo: String(row.principio_activo ?? "").trim(),
    via_administracion: String(row.via_administracion ?? "").trim(),
    especie: String(row.especie ?? "").trim(),
    actualizado_en: String(row.actualizado_en ?? "").trim(),
    actualizado_por: String(row.actualizado_por ?? "").trim(),
    creado_en: String(row.creado_en ?? "").trim(),
    creado_por: String(row.creado_por ?? "").trim(),
    tiene_foto: Boolean(row.tiene_foto),
  }));
}

function esFichaStubProducto(row: {
  laboratorio: string;
  principio_activo: string;
  foto_data?: string;
  tiene_foto?: boolean;
}): boolean {
  const tieneFoto = Boolean(row.tiene_foto) || Boolean(String(row.foto_data ?? "").trim());
  return !tieneFoto && !row.laboratorio.trim() && !row.principio_activo.trim();
}

function autorEtiquetaCoincide(a: string, b: string): boolean {
  const na = a.trim().toLocaleLowerCase("es");
  const nb = b.trim().toLocaleLowerCase("es");
  return Boolean(na && nb && na === nb);
}

export interface StockControlSanitarioProductoNombreGlobal {
  nombre: string;
  creado_en: string;
  creado_por: string;
  en_ficha: boolean;
  laboratorio: string;
  principio_activo: string;
  tiene_foto: boolean;
  especie: string;
  usos: number;
  usos_cuenta: number;
}

export async function listStockControlSanitarioProductoNombresGlobales(
  db: Db,
  autoresCuenta: string[] = [],
  modulo?: StockDispositivoModulo
): Promise<StockControlSanitarioProductoNombreGlobal[]> {
  const map = new Map<string, StockControlSanitarioProductoNombreGlobal>();

  const autoresNorm = [
    ...new Set(
      autoresCuenta
        .map((a) => a.trim().toLocaleLowerCase("es"))
        .filter(Boolean)
    ),
  ];

  const tablaUsos =
    modulo === "equino" ? TABLE.equino : modulo === "ganadero" ? TABLE.ganadero : null;

  const usosCuentaMap = new Map<string, number>();
  if (autoresNorm.length > 0) {
    const autoresPlaceholders = autoresNorm.map((_, i) => `@a${i}`).join(", ");
    const autoresParams: Record<string, unknown> = {};
    autoresNorm.forEach((a, i) => {
      autoresParams[`a${i}`] = a;
    });

    const usosCuentaFrom = tablaUsos
      ? `SELECT producto_nombre, creado_por FROM ${tablaUsos} WHERE TRIM(producto_nombre) <> ''`
      : `SELECT producto_nombre, creado_por
           FROM ${TABLE.ganadero}
           WHERE TRIM(producto_nombre) <> ''
           UNION ALL
           SELECT producto_nombre, creado_por
           FROM ${TABLE.equino}
           WHERE TRIM(producto_nombre) <> ''`;

    const usosCuentaRows = (await db
      .prepare(
        `SELECT TRIM(producto_nombre) AS nombre, COUNT(*) AS usos
         FROM (${usosCuentaFrom}) AS registros
         WHERE LOWER(TRIM(creado_por)) IN (${autoresPlaceholders})
         GROUP BY LOWER(TRIM(producto_nombre)), TRIM(producto_nombre)`
      )
      .all(autoresParams)) as { nombre: string; usos: number }[];

    for (const row of usosCuentaRows) {
      const nombre = String(row.nombre ?? "").trim();
      if (!nombre) continue;
      usosCuentaMap.set(nombre.toLocaleLowerCase("es-UY"), Number(row.usos ?? 0));
    }
  }

  const fichas = await listStockControlSanitarioProductoFichas(db);
  for (const f of fichas) {
    const key = f.nombre.toLocaleLowerCase("es-UY");
    map.set(key, {
      nombre: f.nombre,
      creado_en: String(f.creado_en || f.actualizado_en || "").trim(),
      creado_por: String(f.creado_por || f.actualizado_por || "").trim(),
      en_ficha: true,
      laboratorio: String(f.laboratorio ?? "").trim(),
      principio_activo: String(f.principio_activo ?? "").trim(),
      tiene_foto: Boolean(f.tiene_foto),
      especie: String(f.especie ?? "").trim(),
      usos: 0,
      usos_cuenta: usosCuentaMap.get(key) ?? 0,
    });
  }

  const usosFrom = tablaUsos
    ? `SELECT producto_nombre FROM ${tablaUsos} WHERE TRIM(producto_nombre) <> ''`
    : `SELECT producto_nombre
         FROM ${TABLE.ganadero}
         WHERE TRIM(producto_nombre) <> ''
         UNION ALL
         SELECT producto_nombre
         FROM ${TABLE.equino}
         WHERE TRIM(producto_nombre) <> ''`;

  const usosRows = (await db
    .prepare(
      `SELECT TRIM(producto_nombre) AS nombre, COUNT(*) AS usos
       FROM (${usosFrom}) AS usos
       GROUP BY LOWER(TRIM(producto_nombre)), TRIM(producto_nombre)`
    )
    .all()) as { nombre: string; usos: number }[];

  for (const row of usosRows) {
    const nombre = String(row.nombre ?? "").trim();
    if (!nombre) continue;
    const key = nombre.toLocaleLowerCase("es-UY");
    const usos = Number(row.usos ?? 0);
    const existente = map.get(key);
    if (existente) {
      existente.usos = usos;
      continue;
    }
    map.set(key, {
      nombre,
      creado_en: "",
      creado_por: "",
      en_ficha: false,
      laboratorio: "",
      principio_activo: "",
      tiene_foto: false,
      especie: "",
      usos,
      usos_cuenta: usosCuentaMap.get(key) ?? 0,
    });
  }

  const creadoFrom = tablaUsos
    ? `SELECT producto_nombre, creado_en FROM ${tablaUsos} WHERE TRIM(producto_nombre) <> ''`
    : `SELECT producto_nombre, creado_en
         FROM ${TABLE.ganadero}
         WHERE TRIM(producto_nombre) <> ''
         UNION ALL
         SELECT producto_nombre, creado_en
         FROM ${TABLE.equino}
         WHERE TRIM(producto_nombre) <> ''`;

  const rows = (await db
    .prepare(
      `SELECT TRIM(producto_nombre) AS nombre, MAX(creado_en) AS creado_en
       FROM (${creadoFrom}) AS usos
       GROUP BY LOWER(TRIM(producto_nombre)), TRIM(producto_nombre)`
    )
    .all()) as { nombre: string; creado_en: string }[];

  for (const row of rows) {
    const nombre = String(row.nombre ?? "").trim();
    if (!nombre) continue;
    const key = nombre.toLocaleLowerCase("es-UY");
    const creadoEn = String(row.creado_en ?? "").trim();
    const existente = map.get(key);
    if (existente) {
      if (!existente.en_ficha && creadoEn && !existente.creado_en) {
        existente.creado_en = creadoEn;
      }
      continue;
    }
    map.set(key, {
      nombre,
      creado_en: creadoEn,
      creado_por: "",
      en_ficha: false,
      laboratorio: "",
      principio_activo: "",
      tiene_foto: false,
      especie: "",
      usos: 0,
      usos_cuenta: usosCuentaMap.get(key) ?? 0,
    });
  }

  for (const [key, entry] of map) {
    if (entry.usos_cuenta === 0 && usosCuentaMap.has(key)) {
      entry.usos_cuenta = usosCuentaMap.get(key) ?? 0;
    }
  }

  return [...map.values()]
    .filter((entry) =>
      productoVisibleEnModuloSanitario(modulo, {
        nombre: entry.nombre,
        especie: entry.especie,
        en_ficha: entry.en_ficha,
      })
    )
    .sort((a, b) => {
      if (b.usos !== a.usos) return b.usos - a.usos;
      return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
    });
}

export async function deleteStockControlSanitarioProductoFicha(
  db: Db,
  nombreInput: string
): Promise<string> {
  const nombre = normalizeFichaNombre(nombreInput);
  if (!nombre) throw new Error("Indicá el nombre del producto.");

  const result = await db
    .prepare(`DELETE FROM ${PRODUCTO_FICHA_TABLE} WHERE LOWER(nombre) = LOWER(@nombre)`)
    .run({ nombre });

  const changes = Number((result as { changes?: number }).changes ?? 0);
  if (changes < 1) throw new Error("Producto no encontrado en el catálogo.");
  return nombre;
}

export async function deleteStockControlSanitarioProductoFichaForUser(
  db: Db,
  nombreInput: string,
  opts: { esSuperAdmin: boolean; autorLabel: string }
): Promise<string> {
  const nombre = normalizeFichaNombre(nombreInput);
  if (!nombre) throw new Error("Indicá el nombre del producto.");

  const ficha = await getStockControlSanitarioProductoFicha(db, nombre);
  if (!ficha) throw new Error("Producto no encontrado en el catálogo.");

  const stub = esFichaStubProducto(ficha);
  if (stub) {
    if (!opts.esSuperAdmin) {
      const creador = (ficha.creado_por || ficha.actualizado_por).trim();
      if (!creador || !autorEtiquetaCoincide(creador, opts.autorLabel)) {
        throw new Error(
          "Solo quien agregó esta marca o el superadministrador de SAG puede eliminarla."
        );
      }
    }
  } else if (!opts.esSuperAdmin) {
    throw new Error(
      "Solo el superadministrador de SAG puede eliminar productos del catálogo central."
    );
  }

  return deleteStockControlSanitarioProductoFicha(db, nombre);
}
