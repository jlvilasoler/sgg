import type { Db } from "./db/pg-client.js";
import type { StockGanaderoRowInput } from "./parse-stock-ganadero-txt.js";
import { migrateAddCuentaIdColumn, getEmpresaCodigosActivosPorCuenta } from "./empresas-cuenta-db.js";
import {
  castradoDesdeCategoria,
  categoriaDesdeSexoYEdad,
  CATEGORIA_EQUINO_LABELS,
  EQUINO_FRONTERA_ADULTO,
  EQUINO_ID_SEED_ULTIMO,
  labelCategoriaSalidaDispositivo,
  splitEquinoIdInterno,
  type CategoriaEquino,
} from "./stock-equina-categoria.js";
import { dispositivoClave, eidClave, splitEidVid } from "./stock-ganadero-id.js";
import * as stockFoto from "./stock-dispositivo-foto-db.js";
import * as stockControlSanitario from "./stock-control-sanitario-db.js";
import * as potreroDb from "./stock-ganadero-potrero-db.js";
import { syncStockDispositivoPotreroEnMapa } from "./campo-mapa-sync-stock-db.js";

export { dispositivoClave, eidClave, splitEidVid } from "./stock-ganadero-id.js";
export type { CategoriaEquino } from "./stock-equina-categoria.js";

export type StockEquinoRowInput = StockGanaderoRowInput;

export interface StockEquinoLote {
  id: number;
  nombre_archivo: string;
  filas: number;
  importado_en: string;
  cuenta_id?: number | null;
}

export interface StockEquinoRegistro {
  id: number;
  lote_id: number;
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
  creado_en?: string;
  /** Clave interna (secuencia 600…). */
  clave?: string;
  sexo?: string;
  categoria?: string;
  castrado?: boolean | null;
  origen_alta?: string;
  rp?: string;
  nombre_animal?: string;
  registro?: string;
  premios?: string;
  empresa?: string;
  potrero?: string;
  grupo?: string;
  edad?: number | null;
  nacimiento_mes?: number | null;
  nacimiento_anio?: number | null;
  estado?: string;
}

export interface StockEquinoFilters {
  lote_id?: number;
  busqueda?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  /** Solo filas cuyo EID aparece más de una vez en el conjunto filtrado. */
  solo_repetidos?: boolean;
  /** Solo dispositivos dados de baja (MUERTO, VENDIDO, FRIGORIFICO). */
  solo_bajas?: boolean;
  /** Filtrar por estado del dispositivo en stock. */
  estado_dispositivo?: DispositivoEstado;
  /** Empresas operativas permitidas (multi-tenant). undefined = sin filtro. */
  empresas?: string[];
  /** Cuenta madre dueña de la importación. undefined = sin filtro (super admin). */
  cuenta_id?: number;
}

export interface StockEquinoEidRepetido {
  eid: string;
  vid: string;
  clave: string;
  cantidad: number;
}

export interface StockEquinoEstadisticas {
  total_lecturas: number;
  eids_activos: number;
  eids_repetidos: number;
  lecturas_en_repetidos: number;
  detalle_repetidos: StockEquinoEidRepetido[];
}

function appendRegistroFilters(
  sql: string,
  params: Record<string, string | number>,
  filters?: StockEquinoFilters,
  alias = ""
): string {
  const p = alias ? `${alias}.` : "";
  if (filters?.lote_id) {
    sql += ` AND ${p}lote_id = @lote_id`;
    params.lote_id = filters.lote_id;
  }
  if (filters?.fecha_desde) {
    sql += ` AND ${p}fecha >= @fecha_desde`;
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters?.fecha_hasta) {
    sql += ` AND ${p}fecha <= @fecha_hasta`;
    params.fecha_hasta = filters.fecha_hasta;
  }
  if (filters?.busqueda?.trim()) {
    sql += ` AND (
      ${p}eid LIKE @busqueda OR
      ${p}vid LIKE @busqueda OR
      ${p}condicion LIKE @busqueda OR
      EXISTS (
        SELECT 1 FROM STOCK_EQUINO_DISPOSITIVO d
        WHERE d.clave = regexp_replace(COALESCE(${p}eid, '') || COALESCE(${p}vid, ''), '[^0-9]', '', 'g')
          AND (
            d.sexo LIKE @busqueda OR
            d.categoria LIKE @busqueda OR
            d.origen_alta LIKE @busqueda OR
            d.rp LIKE @busqueda OR
            d.nombre_animal LIKE @busqueda OR
            d.registro LIKE @busqueda OR
            d.premios LIKE @busqueda OR
            d.empresa LIKE @busqueda OR
            d.potrero LIKE @busqueda OR
            d.grupo LIKE @busqueda
          )
      )
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }
  if (filters?.cuenta_id != null) {
    sql += ` AND ${p}lote_id IN (SELECT id FROM STOCK_EQUINO_LOTE WHERE cuenta_id = @cuenta_id)`;
    params.cuenta_id = filters.cuenta_id;
  }
  return sql;
}

async function clavesEidRepetidas(
  db: Db,
  filters?: StockEquinoFilters
): Promise<Set<string>> {
  let sql = `SELECT eid, vid FROM STOCK_EQUINO_REGISTRO WHERE 1=1`;
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);

  const rows = await db.prepare(sql).all(params) as { eid: string; vid: string }[];
  const counts = new Map<string, { eid: string; vid: string; n: number }>();
  for (const row of rows) {
    const split = splitEidVid(row.eid, row.vid);
    const clave = dispositivoClave(split.eid, split.vid);
    if (!clave) continue;
    const prev = counts.get(clave);
    if (!prev) counts.set(clave, { eid: split.eid, vid: split.vid, n: 1 });
    else prev.n += 1;
  }
  const repetidas = new Set<string>();
  for (const [clave, info] of counts) {
    if (info.n > 1) repetidas.add(clave);
  }
  return repetidas;
}

export async function initStockEquinoTables(db: Db): Promise<void> {
  await ensureStockEquinoBaseTables(db);
  await migrateStockEquinoLoteCuenta(db);
  await migrateGrupoLibreColumn(db);
  await migrateBajaMetaColumns(db);
  await stockFoto.migrateStockDispositivoFotoColumns(db, "equino");
  await stockFoto.migrateStockDispositivoFotosGallery(db, "equino");
  await stockFoto.migrateStockDispositivoFotosBlobColumns(db, "equino");
  await stockControlSanitario.migrateStockControlSanitarioTable(db, "equino");
  await stockControlSanitario.migrateStockControlSanitarioCantidadCatalog(db);
  await stockControlSanitario.migrateStockControlSanitarioEsperaCatalog(db);
  await stockControlSanitario.migrateStockControlSanitarioProductoFicha(db);
  await migrateFechasSlashLatam(db);
  await migrateStockEquinoDispositivoHistorial(db);
  await migrateHistorialAutorColumns(db);
  await potreroDb.migrateEquinoPotreroColumn(db);
  await migrateEquinoAltaGenericaColumns(db);
  await migrateEquinoCabanaColumns(db);
  await ensureStockEquinoIdSeq(db);
}

async function migrateEquinoAltaGenericaColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'alta_generica_cols_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const sql of [
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN categoria TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN castrado INTEGER`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN origen_alta TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'alta_generica_cols_v1', '', '', '')`
    )
    .run();
}

async function migrateEquinoCabanaColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'alta_cabana_cols_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const sql of [
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN rp TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN nombre_animal TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN registro TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN premios TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(sql).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'alta_cabana_cols_v1', '', '', '')`
    )
    .run();
}

async function ensureStockEquinoIdSeq(db: Db): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_EQUINO_ID_SEQ (
         id INTEGER PRIMARY KEY CHECK (id = 1),
         ultimo TEXT NOT NULL
       )`
    )
    .run();

  const row = (await db
    .prepare(`SELECT ultimo FROM STOCK_EQUINO_ID_SEQ WHERE id = 1`)
    .get()) as { ultimo: string } | undefined;
  if (!row) {
    await db
      .prepare(`INSERT INTO STOCK_EQUINO_ID_SEQ (id, ultimo) VALUES (1, ?)`)
      .run(EQUINO_ID_SEED_ULTIMO);
  }
}

/** Reserva IDs correlativos globales (prefijo 600). Misma secuencia para genéricos y cabaña. */
async function reservarIdsEquinos(tx: Db, cantidad: number): Promise<string[]> {
  await ensureStockEquinoIdSeq(tx);
  const seqRow = (await tx
    .prepare(`SELECT ultimo FROM STOCK_EQUINO_ID_SEQ WHERE id = 1 FOR UPDATE`)
    .get()) as { ultimo: string } | undefined;
  if (!seqRow?.ultimo) {
    throw new Error("No se pudo reservar la secuencia de IDs equinos.");
  }
  const claves: string[] = [];
  let cursor = seqRow.ultimo;
  for (let i = 0; i < cantidad; i++) {
    cursor = incrementarIdDecimal(cursor, 1);
    claves.push(cursor);
  }
  await tx
    .prepare(`UPDATE STOCK_EQUINO_ID_SEQ SET ultimo = ? WHERE id = 1`)
    .run(cursor);
  return claves;
}

async function ensureStockEquinoBaseTables(db: Db): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS STOCK_EQUINO_LOTE (
      id SERIAL PRIMARY KEY,
      nombre_archivo TEXT NOT NULL DEFAULT '',
      filas INTEGER NOT NULL DEFAULT 0,
      importado_en TIMESTAMPTZ DEFAULT NOW(),
      cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS STOCK_EQUINO_REGISTRO (
      id SERIAL PRIMARY KEY,
      lote_id INTEGER NOT NULL REFERENCES STOCK_EQUINO_LOTE(id) ON DELETE CASCADE,
      eid TEXT NOT NULL,
      vid TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL DEFAULT '',
      condicion TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_lote ON STOCK_EQUINO_REGISTRO(lote_id)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_eid ON STOCK_EQUINO_REGISTRO(eid)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_equino_reg_fecha ON STOCK_EQUINO_REGISTRO(fecha)
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS STOCK_EQUINO_DISPOSITIVO (
      clave TEXT PRIMARY KEY,
      eid TEXT NOT NULL DEFAULT '',
      sexo TEXT NOT NULL DEFAULT '',
      edad INTEGER,
      nacimiento_mes INTEGER,
      nacimiento_anio INTEGER,
      observaciones TEXT NOT NULL DEFAULT '',
      empresa TEXT NOT NULL DEFAULT '',
      grupo TEXT NOT NULL DEFAULT '',
      grupo_libre TEXT NOT NULL DEFAULT '',
      estado TEXT NOT NULL DEFAULT '',
      tipo_baja TEXT NOT NULL DEFAULT '',
      numero_guia TEXT NOT NULL DEFAULT '',
      baja_mes INTEGER,
      baja_anio INTEGER,
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS STOCK_EQUINO_DISPOSITIVO_HISTORIAL (
      id SERIAL PRIMARY KEY,
      clave TEXT NOT NULL,
      campo TEXT NOT NULL,
      etiqueta TEXT NOT NULL DEFAULT '',
      valor_anterior TEXT NOT NULL DEFAULT '',
      valor_nuevo TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      user_id INTEGER,
      user_email TEXT NOT NULL DEFAULT '',
      user_nombre TEXT NOT NULL DEFAULT '',
      origen TEXT NOT NULL DEFAULT ''
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_equino_disp_hist_clave
      ON STOCK_EQUINO_DISPOSITIVO_HISTORIAL(clave)
  `).run();
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_stock_equino_disp_hist_fecha
      ON STOCK_EQUINO_DISPOSITIVO_HISTORIAL(creado_en)
  `).run();
}

async function migrateStockEquinoLoteCuenta(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "STOCK_EQUINO_LOTE");
}

async function migrateHistorialAutorColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'historial_autor_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const col of [
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO_HISTORIAL ADD COLUMN user_id INTEGER`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO_HISTORIAL ADD COLUMN user_email TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO_HISTORIAL ADD COLUMN user_nombre TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO_HISTORIAL ADD COLUMN origen TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'historial_autor_v1', '', '', '')`
    )
    .run();
}

async function migrateBajaMetaColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'baja_meta_cols' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const col of [
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN tipo_baja TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN numero_guia TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'baja_meta_cols', '', '', '')`
    )
    .run();
}

async function migrateGrupoLibreColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'grupo_libre_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN grupo_libre TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'grupo_libre_col', '', '', '')`
    )
    .run();
}

async function migrateFechasSlashLatam(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'fechas_ddmm_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  await corregirFechasSlashInvertidas(db);

  await db
    .prepare(
      `DELETE FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL WHERE campo = 'condicion'`
    )
    .run();
  await db
    .prepare(
      `DELETE FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'backfill_condicion'`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'fechas_ddmm_v1', '', '', '')`
    )
    .run();
}

function fechasSonIntercambioMesDia(f1: string, f2: string): boolean {
  const m1 = f1.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = f2.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m1 || !m2 || m1[1] !== m2[1]) return false;
  return m1[2] === m2[3] && m1[3] === m2[2] && m1[2] !== m2[2];
}

/** De un par invertido, la fecha DD/MM correcta es la mayor en orden ISO (ej. dic > ago). */
function fechaCorrectaEnPar(f1: string, f2: string): string {
  return f1 > f2 ? f1 : f2;
}

async function corregirFechasSlashInvertidas(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT id, eid, vid, fecha, hora FROM STOCK_EQUINO_REGISTRO ORDER BY id`
    )
    .all()) as Pick<StockEquinoRegistro, "id" | "eid" | "vid" | "fecha" | "hora">[];

  const porHora = new Map<string, Pick<StockEquinoRegistro, "id" | "eid" | "vid" | "fecha" | "hora">[]>();
  for (const r of rows) {
    const key = `${r.eid}\0${r.vid}\0${r.hora}`;
    const list = porHora.get(key) ?? [];
    list.push(r);
    porHora.set(key, list);
  }

  const upd = await db.prepare(
    `UPDATE STOCK_EQUINO_REGISTRO SET fecha = @fecha WHERE id = @id`
  );

  for (const list of porHora.values()) {
    const fechas = [...new Set(list.map((r) => r.fecha))];
    if (fechas.length < 2) continue;

    for (let i = 0; i < fechas.length; i++) {
      for (let j = i + 1; j < fechas.length; j++) {
        const f1 = fechas[i];
        const f2 = fechas[j];
        if (!fechasSonIntercambioMesDia(f1, f2)) continue;

        const correcta = fechaCorrectaEnPar(f1, f2);
        const incorrecta = f1 === correcta ? f2 : f1;

        for (const r of list) {
          if (r.fecha === incorrecta) {
            await upd.run({ fecha: correcta, id: r.id });
          }
        }
      }
    }
  }
}

async function migrateSyncGrupoDesdeNacimiento(_db: Db): Promise<void> {}

async function migrateStockEquinoDispositivoHistorial(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'backfill_condicion' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  await backfillHistorialCondicionDesdeLecturas(db);

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'backfill_condicion', '', '', '')`
    )
    .run();
}

async function migrateSplitEidVid(_db: Db): Promise<void> {}

async function migrateStockEquinoDispositivoMeta(_db: Db): Promise<void> {}

const GRUPO_ANIO_MIN = 2000;
const GRUPO_RE = /^GEN(\d{4})(?:-(\d{4}))?$/;

function validarGrupo(grupo: string): string {
  const t = grupo.trim().toUpperCase();
  if (!t) return "";
  const m = t.match(GRUPO_RE);
  if (!m) throw new Error("Grupo inválido. Use GEN y un año o rango (ej. GEN2025-2026).");
  const anioInicio = Number(m[1]);
  const anioFin = m[2] ? Number(m[2]) : null;
  const maxAnio = new Date().getFullYear() + 1;
  if (!Number.isInteger(anioInicio) || anioInicio < GRUPO_ANIO_MIN || anioInicio > maxAnio) {
    throw new Error(`Año de grupo inválido (${GRUPO_ANIO_MIN}–${maxAnio}).`);
  }
  if (anioFin !== null) {
    if (!Number.isInteger(anioFin) || anioFin !== anioInicio + 1 || anioFin > maxAnio) {
      throw new Error("Rango de generación inválido. Debe ser GENaaaa-(aaaa+1).");
    }
    return `GEN${anioInicio}-${anioFin}`;
  }
  if (anioInicio > new Date().getFullYear()) {
    throw new Error(`Año de grupo inválido (${GRUPO_ANIO_MIN}–${new Date().getFullYear()}).`);
  }
  return `GEN${anioInicio}`;
}

function normalizarGrupoAlmacenado(grupo: string | undefined): string {
  if (!grupo?.trim()) return "";
  try {
    return validarGrupo(grupo);
  } catch {
    return "";
  }
}

/** Grupo GEN según nacimiento (1 jul → 30 jun del año siguiente). */
function grupoDesdeNacimiento(mes: number | null, anio: number | null): string {
  if (anio === null) return "";
  if (mes !== null && Number.isInteger(mes) && mes >= 1 && mes <= 12) {
    if (mes >= 7) return validarGrupo(`GEN${anio}-${anio + 1}`);
    return validarGrupo(`GEN${anio - 1}-${anio}`);
  }
  return validarGrupo(`GEN${anio}`);
}

export type DispositivoSexo = "" | "MACHO" | "HEMBRA";
export type DispositivoEmpresa = string;
export type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

export type TipoBaja =
  | "VENTA_FRIGORIFICO"
  | "FRIGORIFICO"
  | "VENTA_PRODUCTOR"
  | "MUERTE"
  | "PERDIDO";

const SEXOS_VALIDOS = new Set<DispositivoSexo>(["", "MACHO", "HEMBRA"]);
const ESTADOS_VALIDOS = new Set<DispositivoEstado>([
  "VIVO",
  "MUERTO",
  "VENDIDO",
  "FRIGORIFICO",
  "PERDIDO",
]);
const TIPOS_BAJA_VALIDOS = new Set<TipoBaja>([
  "VENTA_FRIGORIFICO",
  "FRIGORIFICO",
  "VENTA_PRODUCTOR",
  "MUERTE",
  "PERDIDO",
]);

function esEstadoConBaja(estado: DispositivoEstado): boolean {
  return (
    estado === "MUERTO" ||
    estado === "VENDIDO" ||
    estado === "FRIGORIFICO" ||
    estado === "PERDIDO"
  );
}

export function estadoDesdeTipoBaja(tipo: TipoBaja): DispositivoEstado {
  switch (tipo) {
    case "VENTA_FRIGORIFICO":
    case "VENTA_PRODUCTOR":
      return "VENDIDO";
    case "FRIGORIFICO":
      return "FRIGORIFICO";
    case "MUERTE":
      return "MUERTO";
    case "PERDIDO":
      return "PERDIDO";
  }
}

export function tipoBajaDesdeEstadoImport(estado: "VENDIDO" | "FRIGORIFICO"): TipoBaja {
  return estado === "VENDIDO" ? "VENTA_FRIGORIFICO" : "FRIGORIFICO";
}

function normalizarTipoBaja(raw: string | undefined | null): TipoBaja | "" {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "VENDIDO" || v === "VENTA") return "VENTA_FRIGORIFICO";
  if (TIPOS_BAJA_VALIDOS.has(v as TipoBaja)) return v as TipoBaja;
  return "";
}

function normalizarNumeroGuia(raw: string | undefined | null): string {
  return String(raw ?? "")
    .trim()
    .slice(0, 64);
}

export function parseTipoBaja(raw: unknown): TipoBaja {
  const tipo = normalizarTipoBaja(String(raw ?? ""));
  if (!tipo) {
    throw new Error(
      "Tipo de baja inválido. Use VENTA_FRIGORIFICO, VENTA_PRODUCTOR, MUERTE o PERDIDO."
    );
  }
  return tipo;
}

function normalizarEmpresaDispositivo(raw: string | null | undefined): DispositivoEmpresa {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (!v) return "";
  if (/^[A-Z0-9_]+$/.test(v)) return v;
  return "";
}

function esEmpresaDispositivoValida(raw: string | null | undefined): boolean {
  const v = String(raw ?? "").trim();
  if (!v) return true;
  return normalizarEmpresaDispositivo(raw).length > 0;
}

const GRUPO_LIBRE_MAX = 48;

function normalizarGrupoLibre(val: string | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, "")
    .slice(0, GRUPO_LIBRE_MAX);
}

export interface DispositivoMetaInput {
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
  rp?: string;
  nombre_animal?: string;
  registro?: string;
  premios?: string;
}

export interface DispositivoMetaGuardada extends DispositivoMetaInput {
  /** Edad en meses, calculada desde nacimiento y la fecha actual. */
  edad: number | null;
}

/** Edad en meses desde mes/año de nacimiento hasta hoy. */
export function calcularEdadMeses(
  mes: number | null,
  anio: number | null
): number | null {
  if (!mes || !anio) return null;
  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();
  return Math.max(0, (anioActual - anio) * 12 + (mesActual - mes));
}

function aplicarEdadCalculada(meta: DispositivoMetaGuardada): DispositivoMetaGuardada {
  return {
    ...meta,
    edad: calcularEdadMeses(meta.nacimiento_mes, meta.nacimiento_anio),
  };
}

interface DispositivoMetaRow {
  clave: string;
  eid?: string;
  sexo: string;
  empresa: string;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  categoria?: string;
  castrado?: number | boolean | null;
  origen_alta?: string;
  rp?: string;
  nombre_animal?: string;
  registro?: string;
  premios?: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: string;
  tipo_baja: string;
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
}

type DispositivoMetaEnriquecida = DispositivoMetaGuardada & {
  categoria: string;
  castrado: boolean | null;
  origen_alta: string;
  rp: string;
  nombre_animal: string;
  registro: string;
  premios: string;
};

async function mapMetaDispositivos(
  db: Db
): Promise<Map<string, DispositivoMetaEnriquecida>> {
  const rows = (await db
    .prepare(
      `SELECT clave, sexo, empresa, grupo, grupo_libre, potrero, categoria, castrado, origen_alta,
              rp, nombre_animal, registro, premios,
              edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_EQUINO_DISPOSITIVO`
    )
    .all()) as DispositivoMetaRow[];
  const map = new Map<string, DispositivoMetaEnriquecida>();
  for (const row of rows) {
    const meta = aplicarEdadCalculada(normalizarMetaDispositivo(row));
    map.set(row.clave, {
      ...meta,
      categoria: String(row.categoria ?? "").trim().toUpperCase(),
      castrado:
        row.castrado === null || row.castrado === undefined
          ? null
          : Boolean(Number(row.castrado)),
      origen_alta: String(row.origen_alta ?? "").trim(),
      rp: String(row.rp ?? "").trim(),
      nombre_animal: String(row.nombre_animal ?? "").trim(),
      registro: String(row.registro ?? "").trim(),
      premios: String(row.premios ?? "").trim(),
    });
  }
  return map;
}

function normalizarMetaDispositivo(row: Partial<DispositivoMetaRow>): DispositivoMetaGuardada {
  const sexo = SEXOS_VALIDOS.has(row.sexo as DispositivoSexo)
    ? (row.sexo as DispositivoSexo)
    : "";
  const empresa = normalizarEmpresaDispositivo(row.empresa);
  const mes =
    row.nacimiento_mes === null || row.nacimiento_mes === undefined
      ? null
      : Number.isInteger(row.nacimiento_mes) &&
          row.nacimiento_mes >= 1 &&
          row.nacimiento_mes <= 12
        ? row.nacimiento_mes
        : null;
  const anio =
    row.nacimiento_anio === null || row.nacimiento_anio === undefined
      ? null
      : Number.isInteger(row.nacimiento_anio)
        ? row.nacimiento_anio
        : null;
  const grupo = anio ? grupoDesdeNacimiento(mes, anio) : "";
  const estadoRaw = String(row.estado ?? "VIVO").toUpperCase();
  const estado = ESTADOS_VALIDOS.has(estadoRaw as DispositivoEstado)
    ? (estadoRaw as DispositivoEstado)
    : "VIVO";
  const bajaMes =
    row.baja_mes === null || row.baja_mes === undefined
      ? null
      : Number.isInteger(row.baja_mes) && row.baja_mes >= 1 && row.baja_mes <= 12
        ? row.baja_mes
        : null;
  const bajaAnio =
    row.baja_anio === null || row.baja_anio === undefined
      ? null
      : Number.isInteger(row.baja_anio)
        ? row.baja_anio
        : null;
  const baja =
    esEstadoConBaja(estado)
      ? { baja_mes: bajaMes, baja_anio: bajaAnio }
      : { baja_mes: null, baja_anio: null };
  const tipo_baja = esEstadoConBaja(estado) ? normalizarTipoBaja(row.tipo_baja) : "";
  return aplicarEdadCalculada({
    sexo,
    empresa,
    grupo,
    grupo_libre: normalizarGrupoLibre(row.grupo_libre),
    potrero: potreroDb.normalizarPotrero(row.potrero),
    nacimiento_mes: mes,
    nacimiento_anio: anio,
    observaciones: String(row.observaciones ?? "").trim(),
    estado,
    tipo_baja,
    numero_guia: normalizarNumeroGuia(row.numero_guia),
    ...baja,
    edad: null,
  });
}

async function enrichDispositivosWithMeta(
  db: Db,
  dispositivos: StockEquinaDispositivo[]
): Promise<StockEquinaDispositivo[]> {
  if (!dispositivos.length) return dispositivos;
  const meta = await mapMetaDispositivos(db);
  const fotos = await stockFoto.mapStockDispositivoFotos(db, "equino");
  for (const d of dispositivos) {
    const info = meta.get(d.clave);
    d.sexo = info?.sexo ?? "";
    d.empresa = info?.empresa ?? "";
    d.grupo = info?.grupo ?? "";
    d.grupo_libre = info?.grupo_libre ?? "";
    d.potrero = info?.potrero ?? "";
    d.categoria = info?.categoria ?? "";
    d.castrado = info?.castrado ?? null;
    d.origen_alta = info?.origen_alta ?? "";
    d.rp = info?.rp ?? "";
    d.nombre_animal = info?.nombre_animal ?? "";
    d.registro = info?.registro ?? "";
    d.premios = info?.premios ?? "";
    d.edad = info?.edad ?? null;
    d.nacimiento_mes = info?.nacimiento_mes ?? null;
    d.nacimiento_anio = info?.nacimiento_anio ?? null;
    d.observaciones = info?.observaciones ?? "";
    d.estado = info?.estado ?? "VIVO";
    d.tipo_baja = info?.tipo_baja ?? "";
    d.numero_guia = info?.numero_guia ?? "";
    d.baja_mes = info?.baja_mes ?? null;
    d.baja_anio = info?.baja_anio ?? null;
    const foto = fotos.get(d.clave);
    d.tiene_foto = foto?.tiene_foto ?? false;
    d.foto_url = foto?.foto_url ?? null;
    d.foto_actualizado_en = foto?.foto_actualizado_en ?? "";
  }
  return dispositivos;
}

async function assertDispositivoExiste(db: Db, claveNorm: string): Promise<void> {
  const eids = (await db
    .prepare(`SELECT eid, vid FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { eid: string; vid: string }[];
  const existe = eids.some(
    (r) => dispositivoClave(r.eid, r.vid) === claveNorm
  );
  if (!existe) throw new Error("Dispositivo no encontrado");
}

function normalizarClaveDispositivo(clave: string): string {
  const claveNorm = eidClave(clave) || clave.replace(/\D/g, "");
  if (!claveNorm) throw new Error("Clave de dispositivo inválida");
  return claveNorm;
}

function validarNacimiento(
  mes: number | null,
  anio: number | null
): { nacimiento_mes: number | null; nacimiento_anio: number | null } {
  if (mes === null && anio === null) {
    return { nacimiento_mes: null, nacimiento_anio: null };
  }
  if (mes === null || anio === null) {
    throw new Error("Ingresá mes y año de nacimiento, o dejá ambos vacíos.");
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error("Mes de nacimiento inválido.");
  }
  const maxAnio = new Date().getFullYear();
  if (!Number.isInteger(anio) || anio < 2020 || anio > maxAnio) {
    throw new Error(`Año de nacimiento inválido (2020–${maxAnio}).`);
  }
  return { nacimiento_mes: mes, nacimiento_anio: anio };
}

function validarFechaBaja(
  estado: DispositivoEstado,
  mes: number | null,
  anio: number | null,
  nacimiento_mes: number | null,
  nacimiento_anio: number | null
): { baja_mes: number | null; baja_anio: number | null } {
  if (!esEstadoConBaja(estado)) {
    return { baja_mes: null, baja_anio: null };
  }
  if (mes === null || anio === null) {
    const etiqueta =
      estado === "MUERTO"
        ? "muerte"
        : estado === "PERDIDO"
          ? "pérdida"
          : estado === "VENDIDO"
            ? "venta"
            : "frigorífico";
    throw new Error(`Ingresá mes y año de ${etiqueta}.`);
  }
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error("Mes de baja inválido.");
  }
  const maxAnio = new Date().getFullYear();
  if (!Number.isInteger(anio) || anio < 2020 || anio > maxAnio) {
    throw new Error(`Año de baja inválido (2020–${maxAnio}).`);
  }
  if (nacimiento_mes && nacimiento_anio) {
    const mesesBaja = (anio - nacimiento_anio) * 12 + (mes - nacimiento_mes);
    if (mesesBaja < 0) {
      throw new Error(
        "La fecha de muerte, venta o frigorífico no puede ser anterior al nacimiento."
      );
    }
  }
  return { baja_mes: mes, baja_anio: anio };
}

export async function saveStockEquinaDispositivo(
  db: Db,
  clave: string,
  input: DispositivoMetaInput,
  eid = "",
  autor?: HistorialAutor
): Promise<DispositivoMetaGuardada> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);

  const sexo = SEXOS_VALIDOS.has(input.sexo) ? input.sexo : "";
  if (!SEXOS_VALIDOS.has(sexo)) throw new Error("Sexo inválido. Use MACHO o HEMBRA.");

  const empresa = normalizarEmpresaDispositivo(input.empresa);
  if (!esEmpresaDispositivoValida(input.empresa)) {
    throw new Error("Empresa inválida.");
  }

  const nacimiento = validarNacimiento(input.nacimiento_mes, input.nacimiento_anio);
  const grupo = grupoDesdeNacimiento(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  const edad = calcularEdadMeses(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  const observaciones = String(input.observaciones ?? "").trim().slice(0, 2000);
  const grupo_libre = normalizarGrupoLibre(input.grupo_libre);
  const estadoRaw = String(input.estado ?? "VIVO").toUpperCase();
  if (!ESTADOS_VALIDOS.has(estadoRaw as DispositivoEstado)) {
    throw new Error("Estado inválido. Use VIVO, MUERTO, VENDIDO, FRIGORIFICO o PERDIDO.");
  }
  const estado = estadoRaw as DispositivoEstado;
  const baja = validarFechaBaja(
    estado,
    input.baja_mes,
    input.baja_anio,
    nacimiento.nacimiento_mes,
    nacimiento.nacimiento_anio
  );
  const tipo_bajaRaw = esEstadoConBaja(estado)
    ? normalizarTipoBaja(input.tipo_baja) ||
      (estado === "MUERTO"
        ? "MUERTE"
        : estado === "PERDIDO"
          ? "PERDIDO"
          : estado === "FRIGORIFICO"
            ? "FRIGORIFICO"
            : "VENTA_FRIGORIFICO")
    : "";
  const tipoBajaGuardar: TipoBaja | "" = tipo_bajaRaw || "";
  const numero_guia = esEstadoConBaja(estado)
    ? normalizarNumeroGuia(input.numero_guia)
    : "";
  const eidGuardar = eid.trim() || claveNorm;
  const potrero = potreroDb.normalizarPotrero(input.potrero);
  const rp = String(input.rp ?? "").trim().replace(/\s+/g, " ").slice(0, 64);
  const nombre_animal = String(input.nombre_animal ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
  const registro = String(input.registro ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const premios = String(input.premios ?? "").trim().slice(0, 2000);

  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, grupo_libre, potrero, rp, nombre_animal, registro, premios,
              nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anteriorBase = anteriorRow ? normalizarMetaDispositivo(anteriorRow) : null;
  const anterior: DispositivoMetaGuardada | null = anteriorBase
    ? {
        ...anteriorBase,
        rp: String(anteriorRow?.rp ?? "").trim(),
        nombre_animal: String(anteriorRow?.nombre_animal ?? "").trim(),
        registro: String(anteriorRow?.registro ?? "").trim(),
        premios: String(anteriorRow?.premios ?? "").trim(),
      }
    : null;
  const nuevo: DispositivoMetaGuardada = {
    sexo,
    empresa,
    grupo,
    grupo_libre,
    potrero,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    tipo_baja: tipoBajaGuardar,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    edad,
    rp,
    nombre_animal,
    registro,
    premios,
  };

  await db.prepare(
    `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, grupo_libre, potrero, rp, nombre_animal, registro, premios,
       edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @grupo_libre, @potrero, @rp, @nombre_animal, @registro, @premios,
       @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       empresa = excluded.empresa,
       grupo = excluded.grupo,
       grupo_libre = excluded.grupo_libre,
       potrero = excluded.potrero,
       rp = excluded.rp,
       nombre_animal = excluded.nombre_animal,
       registro = excluded.registro,
       premios = excluded.premios,
       edad = excluded.edad,
       nacimiento_mes = excluded.nacimiento_mes,
       nacimiento_anio = excluded.nacimiento_anio,
       observaciones = excluded.observaciones,
       estado = excluded.estado,
       tipo_baja = excluded.tipo_baja,
       numero_guia = excluded.numero_guia,
       baja_mes = excluded.baja_mes,
       baja_anio = excluded.baja_anio,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_EQUINO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({
    clave: claveNorm,
    eid: eidGuardar,
    sexo,
    empresa,
    grupo,
    grupo_libre,
    potrero,
    rp,
    nombre_animal,
    registro,
    premios,
    edad,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    tipo_baja: tipoBajaGuardar,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
  });

  const cuentaId = await potreroDb.getCuentaIdPorEmpresaCodigo(db, empresa);
  await potreroDb.ensurePotreroEnCatalogo(db, cuentaId, potrero);

  const prevPotrero = anterior?.potrero ?? "";
  if (prevPotrero !== potrero) {
    await syncStockDispositivoPotreroEnMapa(
      db,
      cuentaId,
      claveNorm,
      "equino",
      potrero,
      prevPotrero,
    );
  }

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo, autor);

  return {
    sexo,
    empresa,
    grupo,
    grupo_libre,
    potrero,
    edad,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    tipo_baja: tipoBajaGuardar,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    rp,
    nombre_animal,
    registro,
    premios,
  };
}

export type DispositivoMetaPatch = Partial<DispositivoMetaInput>;

export interface BulkPatchDispositivosResult {
  actualizados: number;
  errores: { clave: string; mensaje: string }[];
}

function mergeMetaConPatch(
  prev: DispositivoMetaGuardada | null,
  patch: DispositivoMetaPatch
): DispositivoMetaInput {
  const merged: DispositivoMetaInput = {
    sexo: prev?.sexo ?? "",
    empresa: prev?.empresa ?? "",
    grupo: prev?.grupo ?? "",
    grupo_libre: prev?.grupo_libre ?? "",
    potrero: prev?.potrero ?? "",
    nacimiento_mes: prev?.nacimiento_mes ?? null,
    nacimiento_anio: prev?.nacimiento_anio ?? null,
    observaciones: prev?.observaciones ?? "",
    estado: prev?.estado ?? "VIVO",
    tipo_baja: prev?.tipo_baja ?? "",
    numero_guia: prev?.numero_guia ?? "",
    baja_mes: prev?.baja_mes ?? null,
    baja_anio: prev?.baja_anio ?? null,
    rp: prev?.rp ?? "",
    nombre_animal: prev?.nombre_animal ?? "",
    registro: prev?.registro ?? "",
    premios: prev?.premios ?? "",
  };
  if (patch.sexo !== undefined) merged.sexo = patch.sexo;
  if (patch.empresa !== undefined) merged.empresa = patch.empresa;
  if (patch.grupo_libre !== undefined) merged.grupo_libre = patch.grupo_libre;
  if (patch.potrero !== undefined) merged.potrero = patch.potrero;
  if (patch.nacimiento_mes !== undefined) merged.nacimiento_mes = patch.nacimiento_mes;
  if (patch.nacimiento_anio !== undefined) merged.nacimiento_anio = patch.nacimiento_anio;
  if (patch.observaciones !== undefined) merged.observaciones = patch.observaciones;
  if (patch.estado !== undefined) merged.estado = patch.estado;
  if (patch.tipo_baja !== undefined) merged.tipo_baja = patch.tipo_baja;
  if (patch.numero_guia !== undefined) merged.numero_guia = patch.numero_guia;
  if (patch.baja_mes !== undefined) merged.baja_mes = patch.baja_mes;
  if (patch.baja_anio !== undefined) merged.baja_anio = patch.baja_anio;
  if (patch.rp !== undefined) merged.rp = patch.rp;
  if (patch.nombre_animal !== undefined) merged.nombre_animal = patch.nombre_animal;
  if (patch.registro !== undefined) merged.registro = patch.registro;
  if (patch.premios !== undefined) merged.premios = patch.premios;
  return merged;
}

export async function bulkPatchStockEquinaDispositivos(
  db: Db,
  claves: string[],
  patch: DispositivoMetaPatch,
  eids: Record<string, string> = {},
  autor?: HistorialAutor
): Promise<BulkPatchDispositivosResult> {
  const keys = [...new Set(claves.map((c) => c.trim()).filter(Boolean))];
  if (!keys.length) throw new Error("Seleccioná al menos un dispositivo.");
  if (!Object.keys(patch).length) {
    throw new Error("Marcá al menos un campo para aplicar.");
  }

  const errores: { clave: string; mensaje: string }[] = [];
  let actualizados = 0;

  await db.transaction(async (tx) => {
    const meta = await mapMetaDispositivos(tx);
    for (const clave of keys) {
      try {
        const claveNorm = normalizarClaveDispositivo(clave);
        const prev = meta.get(claveNorm) ?? null;
        const input = mergeMetaConPatch(prev, patch);
        const eid = eids[clave] ?? eids[claveNorm] ?? "";
        await saveStockEquinaDispositivo(tx, claveNorm, input, eid, autor);
        actualizados += 1;
      } catch (e) {
        errores.push({
          clave,
          mensaje: e instanceof Error ? e.message : "Error al guardar",
        });
      }
    }
  });

  if (actualizados === 0) {
    const msg = errores[0]?.mensaje ?? "No se pudo actualizar ningún dispositivo.";
    throw new Error(msg);
  }

  return { actualizados, errores };
}

export interface DeleteDispositivosResult {
  eliminados: number;
  lecturas_eliminadas: number;
  no_encontrados: string[];
}

/** Elimina dispositivos del sistema (lecturas, metadatos e historial). Solo uso administrativo. */
export async function deleteStockEquinaDispositivos(
  db: Db,
  claves: string[]
): Promise<DeleteDispositivosResult> {
  const keys = [...new Set(claves.map((c) => c.trim()).filter(Boolean))];
  if (!keys.length) throw new Error("Seleccioná al menos un dispositivo.");

  const registradas = await clavesRegistradasSet(db);
  const clavesNorm = keys.map((c) => normalizarClaveDispositivo(c));

  let eliminados = 0;
  let lecturas_eliminadas = 0;
  const no_encontrados: string[] = [];

  await db.transaction(async (tx) => {
    const regRows = (await tx
      .prepare(`SELECT id, eid, vid FROM STOCK_EQUINO_REGISTRO`)
      .all()) as { id: number; eid: string; vid: string }[];

    const delRegistro = tx.prepare(`DELETE FROM STOCK_EQUINO_REGISTRO WHERE id = ?`);
    const delHistorial = tx.prepare(
      `DELETE FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL WHERE clave = ?`
    );
    const delDispositivo = tx.prepare(`DELETE FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`);
    const delSimVenta = tx.prepare(
      `DELETE FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO WHERE clave = ?`
    );

    for (const clave of clavesNorm) {
      if (!registradas.has(clave)) {
        no_encontrados.push(clave);
        continue;
      }

      for (const r of regRows) {
        if (dispositivoClave(r.eid, r.vid) !== clave) continue;
        await delRegistro.run(r.id);
        lecturas_eliminadas += 1;
      }

      await delHistorial.run(clave);
      await delDispositivo.run(clave);
      await delSimVenta.run(clave);
      eliminados += 1;
      registradas.delete(clave);
    }
  });

  if (eliminados === 0) {
    throw new Error(
      no_encontrados.length
        ? "Ningún dispositivo seleccionado existe en el sistema."
        : "No se eliminó ningún dispositivo."
    );
  }

  return { eliminados, lecturas_eliminadas, no_encontrados };
}

export interface VaciarStockEquinaResult {
  dispositivos_eliminados: number;
  lecturas_eliminadas: number;
  vinculos_sim_venta: number;
}

export interface StockEquinaBackupInfo {
  disponible: boolean;
  creado_en: string | null;
  dispositivos: number;
  lecturas: number;
  historial: number;
  vinculos_sim: number;
}

export interface RestaurarStockEquinaResult {
  dispositivos_restaurados: number;
  lecturas_restauradas: number;
  historial_restaurado: number;
  vinculos_sim_restaurados: number;
}

interface StockEquinaBackupPayload {
  v: 2;
  cuenta_id: number;
  registros: {
    lote_id: number;
    eid: string;
    vid: string;
    fecha: string;
    hora: string;
    condicion: string;
  }[];
  dispositivos: {
    clave: string;
    eid: string;
    sexo: string;
    empresa: string;
    grupo: string;
    grupo_libre: string;
    edad: number | null;
    nacimiento_mes: number | null;
    nacimiento_anio: number | null;
    observaciones: string;
    estado: string;
    baja_mes: number | null;
    baja_anio: number | null;
    tipo_baja: string;
    numero_guia: string;
  }[];
  historial: {
    clave: string;
    campo: string;
    etiqueta: string;
    valor_anterior: string;
    valor_nuevo: string;
    creado_en: string;
    user_id: number | null;
    user_email: string;
    user_nombre: string;
    origen: string;
  }[];
  sim_dispositivos: {
    simulacion_id: number;
    clave: string;
    eid: string;
    vid: string;
  }[];
}

async function migrateStockEquinaBackupTableSchema(db: Db): Promise<void> {
  const legacy = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'stock_equino_backup'
         AND column_name = 'id'
       LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (legacy) {
    await db.prepare(`DROP TABLE IF EXISTS STOCK_EQUINO_BACKUP`).run();
  }
}

async function ensureStockEquinaBackupTable(db: Db): Promise<void> {
  await migrateStockEquinaBackupTableSchema(db);
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_EQUINO_BACKUP (
         cuenta_id INTEGER PRIMARY KEY,
         payload TEXT NOT NULL,
         creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    )
    .run();
}

async function loteIdsPorCuenta(db: Db, cuentaId: number): Promise<Set<number>> {
  const rows = (await db
    .prepare(`SELECT id FROM STOCK_EQUINO_LOTE WHERE cuenta_id = ?`)
    .all(cuentaId)) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

async function empresaCodigosSetPorCuenta(db: Db, cuentaId: number): Promise<Set<string>> {
  const codigos = await getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  return new Set(codigos.map((c) => c.trim().toUpperCase()).filter(Boolean));
}

function dispositivoPerteneceCuenta(
  d: { clave: string; empresa: string },
  empresaSet: Set<string>,
  clavesLecturas: Set<string>
): boolean {
  if (d.clave === "__meta__") return false;
  const emp = String(d.empresa ?? "").trim().toUpperCase();
  if (emp && empresaSet.has(emp)) return true;
  return clavesLecturas.has(d.clave);
}

export interface StockEquinoCuentaScope {
  empresaSet: Set<string>;
  clavesLecturas: Set<string>;
}

async function clavesLecturasEquinoPorCuenta(db: Db, cuentaId: number): Promise<Set<string>> {
  const rows = (await db
    .prepare(
      `SELECT r.eid, r.vid
       FROM STOCK_EQUINO_REGISTRO r
       INNER JOIN STOCK_EQUINO_LOTE l ON l.id = r.lote_id
       WHERE l.cuenta_id = ?`,
    )
    .all(cuentaId)) as { eid: string; vid: string }[];
  const claves = new Set<string>();
  for (const r of rows) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) claves.add(k);
  }
  return claves;
}

export async function getStockEquinoCuentaScope(
  db: Db,
  cuentaId: number,
): Promise<StockEquinoCuentaScope> {
  return {
    empresaSet: await empresaCodigosSetPorCuenta(db, cuentaId),
    clavesLecturas: await clavesLecturasEquinoPorCuenta(db, cuentaId),
  };
}

export function stockEquinoDispositivoEnCuenta(
  d: { clave: string; empresa: string },
  scope: StockEquinoCuentaScope,
): boolean {
  return dispositivoPerteneceCuenta(d, scope.empresaSet, scope.clavesLecturas);
}

/** Dispositivos del stock equino que pertenecen a una cuenta (lotes + empresas operativas). */
export async function listStockEquinaDispositivosPorCuenta(
  db: Db,
  cuentaId: number,
): Promise<StockEquinaDispositivo[]> {
  const scope = await getStockEquinoCuentaScope(db, cuentaId);
  if (scope.empresaSet.size === 0 && scope.clavesLecturas.size === 0) return [];
  const dispositivos = await listStockEquinaDispositivos(db);
  return dispositivos.filter((d) => stockEquinoDispositivoEnCuenta(d, scope));
}

async function gatherBackupPayloadForCuenta(
  db: Db,
  cuentaId: number
): Promise<StockEquinaBackupPayload | null> {
  const loteIds = await loteIdsPorCuenta(db, cuentaId);
  const empresaSet = await empresaCodigosSetPorCuenta(db, cuentaId);

  const allRegistros = (await db
    .prepare(`SELECT lote_id, eid, vid, fecha, hora, condicion FROM STOCK_EQUINO_REGISTRO`)
    .all()) as StockEquinaBackupPayload["registros"];
  const registros = allRegistros.filter((r) => loteIds.has(r.lote_id));

  const clavesLecturas = new Set<string>();
  for (const r of registros) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) clavesLecturas.add(k);
  }

  const allDispositivos = (await db
    .prepare(
      `SELECT clave, eid, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio,
              observaciones, estado, baja_mes, baja_anio, tipo_baja, numero_guia
       FROM STOCK_EQUINO_DISPOSITIVO`
    )
    .all()) as StockEquinaBackupPayload["dispositivos"];
  const dispositivos = allDispositivos.filter((d) =>
    dispositivoPerteneceCuenta(d, empresaSet, clavesLecturas)
  );

  const clavesScope = new Set(dispositivos.map((d) => d.clave));
  for (const k of clavesLecturas) clavesScope.add(k);

  const allHistorial = (await db
    .prepare(
      `SELECT clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en,
              user_id, user_email, user_nombre, origen
       FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL`
    )
    .all()) as StockEquinaBackupPayload["historial"];
  const historial = allHistorial.filter(
    (h) => h.clave !== "__meta__" && clavesScope.has(h.clave)
  );

  const allSim = (await db
    .prepare(
      `SELECT simulacion_id, clave, eid, vid FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO`
    )
    .all()) as StockEquinaBackupPayload["sim_dispositivos"];
  const sim_dispositivos = allSim.filter((s) => clavesScope.has(s.clave));

  if (registros.length === 0 && dispositivos.length === 0) return null;

  return {
    v: 2,
    cuenta_id: cuentaId,
    registros,
    dispositivos,
    historial,
    sim_dispositivos,
  };
}

async function crearBackupStockEquina(tx: Db, cuentaId: number): Promise<void> {
  await ensureStockEquinaBackupTable(tx);
  const payload = await gatherBackupPayloadForCuenta(tx, cuentaId);
  if (!payload) return;

  await tx
    .prepare(
      `INSERT INTO STOCK_EQUINO_BACKUP (cuenta_id, payload, creado_en)
       VALUES (?, ?, NOW())
       ON CONFLICT (cuenta_id) DO UPDATE SET
         payload = excluded.payload,
         creado_en = NOW()`
    )
    .run(cuentaId, JSON.stringify(payload));
}

async function countRegistrosEnCuenta(db: Db, cuentaId: number): Promise<number> {
  const loteIds = await loteIdsPorCuenta(db, cuentaId);
  if (loteIds.size === 0) return 0;
  const rows = (await db
    .prepare(`SELECT lote_id FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { lote_id: number }[];
  return rows.filter((r) => loteIds.has(r.lote_id)).length;
}

async function countDispositivosEnCuenta(db: Db, cuentaId: number): Promise<number> {
  const empresas = await getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  const filters: StockEquinoFilters = {
    empresas: empresas.length > 0 ? empresas : [SIN_EMPRESAS_SCOPE],
  };
  return countStockEquinaDispositivos(db, filters);
}

async function vaciarStockEquinaDeCuenta(
  tx: Db,
  cuentaId: number
): Promise<VaciarStockEquinaResult> {
  const payload = await gatherBackupPayloadForCuenta(tx, cuentaId);
  if (!payload) {
    return {
      dispositivos_eliminados: 0,
      lecturas_eliminadas: 0,
      vinculos_sim_venta: 0,
    };
  }

  const clavesScope = new Set(payload.dispositivos.map((d) => d.clave));
  for (const r of payload.registros) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) clavesScope.add(k);
  }
  const loteIds = await loteIdsPorCuenta(tx, cuentaId);

  let lecturas_eliminadas = 0;
  const regRows = (await tx
    .prepare(`SELECT id, lote_id FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { id: number; lote_id: number }[];
  for (const row of regRows) {
    if (!loteIds.has(row.lote_id)) continue;
    await tx.prepare(`DELETE FROM STOCK_EQUINO_REGISTRO WHERE id = ?`).run(row.id);
    lecturas_eliminadas += 1;
  }

  let vinculos_sim_venta = 0;
  for (const clave of clavesScope) {
    const res = await tx
      .prepare(`DELETE FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO WHERE clave = ?`)
      .run(clave);
    vinculos_sim_venta += res.changes ?? 0;
  }

  let historial_eliminado = 0;
  for (const clave of clavesScope) {
    const res = await tx
      .prepare(`DELETE FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL WHERE clave = ?`)
      .run(clave);
    historial_eliminado += res.changes ?? 0;
  }

  let dispositivos_eliminados = 0;
  for (const clave of clavesScope) {
    const res = await tx
      .prepare(`DELETE FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`)
      .run(clave);
    dispositivos_eliminados += res.changes ?? 0;
  }

  return {
    dispositivos_eliminados,
    lecturas_eliminadas,
    vinculos_sim_venta,
  };
}

function infoDesdePayload(
  payload: StockEquinaBackupPayload | null,
  creado_en: string | null
): StockEquinaBackupInfo {
  if (!payload || !payload.registros.length) {
    return {
      disponible: false,
      creado_en: null,
      dispositivos: 0,
      lecturas: 0,
      historial: 0,
      vinculos_sim: 0,
    };
  }
  const claves = new Set<string>();
  for (const r of payload.registros) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) claves.add(k);
  }
  return {
    disponible: true,
    creado_en,
    dispositivos: payload.dispositivos.length || claves.size,
    lecturas: payload.registros.length,
    historial: payload.historial.length,
    vinculos_sim: payload.sim_dispositivos.length,
  };
}

export async function infoStockEquinaBackup(
  db: Db,
  cuentaId: number
): Promise<StockEquinaBackupInfo> {
  await ensureStockEquinaBackupTable(db);
  const row = (await db
    .prepare(`SELECT payload, creado_en FROM STOCK_EQUINO_BACKUP WHERE cuenta_id = ?`)
    .get(cuentaId)) as { payload: string; creado_en: string } | undefined;
  if (!row?.payload) {
    return infoDesdePayload(null, null);
  }
  try {
    const payload = JSON.parse(row.payload) as StockEquinaBackupPayload;
    if (payload.cuenta_id != null && payload.cuenta_id !== cuentaId) {
      return infoDesdePayload(null, null);
    }
    return infoDesdePayload(payload, row.creado_en ?? null);
  } catch {
    return infoDesdePayload(null, null);
  }
}

export async function restaurarStockEquinaDesdeBackup(
  db: Db,
  cuentaId: number
): Promise<RestaurarStockEquinaResult> {
  return db.transaction(async (tx) => {
    await ensureStockEquinaBackupTable(tx);
    const row = (await tx
      .prepare(`SELECT payload FROM STOCK_EQUINO_BACKUP WHERE cuenta_id = ?`)
      .get(cuentaId)) as { payload: string } | undefined;
    if (!row?.payload) {
      throw new Error("No hay respaldo disponible para restaurar.");
    }

    const payload = JSON.parse(row.payload) as StockEquinaBackupPayload;
    if (payload.cuenta_id != null && payload.cuenta_id !== cuentaId) {
      throw new Error("El respaldo no corresponde a esta cuenta.");
    }
    if (!payload.registros?.length) {
      throw new Error("El respaldo está vacío.");
    }

    const lecturasCuenta = await countRegistrosEnCuenta(tx, cuentaId);
    const dispositivosCuenta = await countDispositivosEnCuenta(tx, cuentaId);
    if (lecturasCuenta > 0 || dispositivosCuenta > 0) {
      throw new Error(
        "Esta cuenta ya tiene dispositivos. Solo se puede restaurar cuando la base de la cuenta está vacía."
      );
    }

    const lotesValidos = new Set(
      (
        (await tx.prepare(`SELECT id FROM STOCK_EQUINO_LOTE`).all()) as { id: number }[]
      ).map((l) => l.id)
    );

    const CHUNK = 200;
    const enBloques = <T,>(arr: T[]): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
      return out;
    };

    const registrosValidos = payload.registros.filter((r) =>
      lotesValidos.has(r.lote_id)
    );
    let lecturas_restauradas = 0;
    for (const grupo of enBloques(registrosValidos)) {
      const valores: unknown[] = [];
      const filas = grupo.map((r) => {
        valores.push(r.lote_id, r.eid, r.vid, r.fecha, r.hora, r.condicion);
        return "(?, ?, ?, ?, ?, ?)";
      });
      await tx
        .prepare(
          `INSERT INTO STOCK_EQUINO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
           VALUES ${filas.join(", ")}`
        )
        .run(valores);
      lecturas_restauradas += grupo.length;
    }
    if (lecturas_restauradas === 0) {
      throw new Error(
        "No se pudo restaurar: los lotes de importación del respaldo ya no existen."
      );
    }

    const dispositivosValidos = payload.dispositivos.filter(
      (d) => d.clave && d.clave !== "__meta__"
    );
    let dispositivos_restaurados = 0;
    for (const grupo of enBloques(dispositivosValidos)) {
      const valores: unknown[] = [];
      const filas = grupo.map((d) => {
        valores.push(
          d.clave,
          d.eid,
          d.sexo,
          d.empresa,
          d.grupo,
          d.grupo_libre,
          d.edad,
          d.nacimiento_mes,
          d.nacimiento_anio,
          d.observaciones,
          d.estado,
          d.baja_mes,
          d.baja_anio,
          d.tipo_baja,
          d.numero_guia
        );
        return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
      });
      await tx
        .prepare(
          `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
             clave, eid, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio,
             observaciones, estado, baja_mes, baja_anio, tipo_baja, numero_guia, actualizado_en
           ) VALUES ${filas.join(", ")}
           ON CONFLICT (clave) DO UPDATE SET
             eid = excluded.eid,
             sexo = excluded.sexo,
             empresa = excluded.empresa,
             grupo = excluded.grupo,
             grupo_libre = excluded.grupo_libre,
             edad = excluded.edad,
             nacimiento_mes = excluded.nacimiento_mes,
             nacimiento_anio = excluded.nacimiento_anio,
             observaciones = excluded.observaciones,
             estado = excluded.estado,
             baja_mes = excluded.baja_mes,
             baja_anio = excluded.baja_anio,
             tipo_baja = excluded.tipo_baja,
             numero_guia = excluded.numero_guia,
             actualizado_en = NOW()`
        )
        .run(valores);
      dispositivos_restaurados += grupo.length;
    }

    const historialValido = payload.historial.filter(
      (h) => h.clave && h.clave !== "__meta__"
    );
    let historial_restaurado = 0;
    for (const grupo of enBloques(historialValido)) {
      const valores: unknown[] = [];
      const filas = grupo.map((h) => {
        valores.push(
          h.clave,
          h.campo,
          h.etiqueta,
          h.valor_anterior,
          h.valor_nuevo,
          h.creado_en,
          h.user_id,
          h.user_email,
          h.user_nombre,
          h.origen
        );
        return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      });
      await tx
        .prepare(
          `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
             (clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en, user_id, user_email, user_nombre, origen)
           VALUES ${filas.join(", ")}`
        )
        .run(valores);
      historial_restaurado += grupo.length;
    }

    let vinculos_sim_restaurados = 0;
    for (const grupo of enBloques(payload.sim_dispositivos)) {
      const valores: unknown[] = [];
      const filas = grupo.map((s) => {
        valores.push(s.simulacion_id, s.clave, s.eid, s.vid);
        return "(?, ?, ?, ?)";
      });
      const res = await tx
        .prepare(
          `INSERT INTO SIMULADOR_VENTA_GANADO_DISPOSITIVO (simulacion_id, clave, eid, vid)
           VALUES ${filas.join(", ")}
           ON CONFLICT (simulacion_id, clave) DO NOTHING`
        )
        .run(valores);
      vinculos_sim_restaurados += res.changes;
    }

    return {
      dispositivos_restaurados,
      lecturas_restauradas,
      historial_restaurado,
      vinculos_sim_restaurados,
    };
  });
}

/** Elimina todo el stock equino de una cuenta (o global si cuentaId es null). */
export async function vaciarStockEquinaCompleto(
  db: Db,
  cuentaId: number | null
): Promise<VaciarStockEquinaResult> {
  if (cuentaId != null) {
    return db.transaction(async (tx) => {
      const payload = await gatherBackupPayloadForCuenta(tx, cuentaId);
      if (payload) {
        await crearBackupStockEquina(tx, cuentaId);
      }
      return vaciarStockEquinaDeCuenta(tx, cuentaId);
    });
  }

  return db.transaction(async (tx) => {
    const counts = (await tx.prepare(
      `SELECT
         (SELECT COUNT(*)::int FROM STOCK_EQUINO_REGISTRO) AS lecturas,
         (SELECT COUNT(*)::int FROM STOCK_EQUINO_DISPOSITIVO WHERE clave <> '__meta__') AS dispositivos,
         (SELECT COUNT(*)::int FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO) AS sim`
    ).get()) as { lecturas: number; dispositivos: number; sim: number };

    await tx.prepare(`TRUNCATE TABLE SIMULADOR_VENTA_GANADO_DISPOSITIVO`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_EQUINO_REGISTRO`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_EQUINO_DISPOSITIVO_HISTORIAL`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_EQUINO_DISPOSITIVO`).run();

    return {
      dispositivos_eliminados: counts.dispositivos,
      lecturas_eliminadas: counts.lecturas,
      vinculos_sim_venta: counts.sim,
    };
  });
}

function fechaIsoAMesAnio(fecha: string): { mes: number; anio: number } | null {
  const m = fecha.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null;
  }
  return { mes, anio };
}

async function clavesRegistradasSet(db: Db): Promise<Set<string>> {
  const rows = (await db
    .prepare(`SELECT eid, vid FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { eid: string; vid: string }[];
  const set = new Set<string>();
  for (const r of rows) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) set.add(k);
  }
  return set;
}

export interface BajaDispositivoSnapshot {
  clave: string;
  eid: string;
  vid: string;
  numero: string;
  primera_fecha: string;
  fecha_baja: string;
  dias_en_sistema: number | null;
  categoria: string;
  tipo_baja: TipoBaja;
}

interface AplicarBajaInput {
  estado: DispositivoEstado;
  tipo_baja: TipoBaja;
  baja_mes: number;
  baja_anio: number;
  fecha_baja_iso?: string;
  observaciones?: string;
  numero_guia?: string;
}

function diasEntreFechasIso(desde: string, hasta: string): number | null {
  const d1 = new Date(`${desde.trim()}T12:00:00`);
  const d2 = new Date(`${hasta.trim()}T12:00:00`);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return null;
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86_400_000));
}

function fechaBajaIsoDesdeMesAnio(mes: number, anio: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

async function registroMetaPorClave(
  db: Db,
  claveNorm: string
): Promise<{ eid: string; vid: string; primera_fecha: string } | null> {
  const rows = (await db
    .prepare(`SELECT eid, vid, fecha FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { eid: string; vid: string; fecha: string }[];

  let primera_fecha = "";
  let eid = "";
  let vid = "";
  for (const r of rows) {
    if (dispositivoClave(r.eid, r.vid) !== claveNorm) continue;
    if (!primera_fecha || r.fecha < primera_fecha) primera_fecha = r.fecha;
    const parts = splitEidVid(r.eid, r.vid);
    if (parts.vid) vid = parts.vid;
    if (parts.eid) eid = parts.eid;
  }
  if (!primera_fecha) return null;
  return { eid, vid, primera_fecha };
}

async function snapshotBajaDispositivo(
  db: Db,
  claveNorm: string,
  fechaBajaIso: string,
  tipo_baja: TipoBaja,
  estado: DispositivoEstado,
  baja_mes: number,
  baja_anio: number,
  edad: number | null,
  sexo: DispositivoSexo,
  nacimiento_mes: number | null,
  nacimiento_anio: number | null,
  eidFallback: string
): Promise<BajaDispositivoSnapshot> {
  const reg = await registroMetaPorClave(db, claveNorm);
  const eid = reg?.eid || eidFallback.trim() || claveNorm.slice(0, 3);
  const vid = reg?.vid || "";
  const primera_fecha = reg?.primera_fecha ?? "";
  const categoria = labelCategoriaSalidaDispositivo({
    sexo,
    edad,
    nacimiento_mes,
    nacimiento_anio,
    estado,
    baja_mes,
    baja_anio,
  });

  return {
    clave: claveNorm,
    eid,
    vid,
    numero: vid || claveNorm,
    primera_fecha,
    fecha_baja: fechaBajaIso,
    dias_en_sistema: primera_fecha
      ? diasEntreFechasIso(primera_fecha, fechaBajaIso)
      : null,
    categoria,
    tipo_baja,
  };
}

/** Reconstruye datos de baja desde el dispositivo ya dado de baja (auditoría histórica). */
export async function buildBajaSnapshotDesdeClave(
  db: Db,
  claveNorm: string
): Promise<BajaDispositivoSnapshot | null> {
  const row = (await db
    .prepare(
      `SELECT eid, sexo, nacimiento_mes, nacimiento_anio, estado, tipo_baja, baja_mes, baja_anio, edad
       FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  if (!row?.baja_mes || !row.baja_anio) return null;

  const meta = normalizarMetaDispositivo(row);
  const tipo_baja = normalizarTipoBaja(meta.tipo_baja) || "MUERTE";
  const fecha_baja = fechaBajaIsoDesdeMesAnio(meta.baja_mes!, meta.baja_anio!);

  return snapshotBajaDispositivo(
    db,
    claveNorm,
    fecha_baja,
    tipo_baja,
    meta.estado,
    meta.baja_mes!,
    meta.baja_anio!,
    meta.edad,
    meta.sexo,
    meta.nacimiento_mes,
    meta.nacimiento_anio,
    String(row.eid ?? "")
  );
}

async function aplicarBajaDispositivo(
  db: Db,
  claveNorm: string,
  eid: string,
  input: AplicarBajaInput,
  autor?: HistorialAutor
): Promise<BajaDispositivoSnapshot> {
  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anterior = anteriorRow ? normalizarMetaDispositivo(anteriorRow) : null;
  const nacimiento_mes = anterior?.nacimiento_mes ?? null;
  const nacimiento_anio = anterior?.nacimiento_anio ?? null;
  const baja = validarFechaBaja(
    input.estado,
    input.baja_mes,
    input.baja_anio,
    nacimiento_mes,
    nacimiento_anio
  );
  const edad = calcularEdadMeses(nacimiento_mes, nacimiento_anio);
  const eidGuardar = eid.trim() || claveNorm;
  const obsNueva = String(input.observaciones ?? "").trim();
  const observaciones = obsNueva || (anterior?.observaciones ?? "");
  const numero_guia = normalizarNumeroGuia(input.numero_guia);

  const nuevo: DispositivoMetaGuardada = {
    sexo: anterior?.sexo ?? "",
    empresa: anterior?.empresa ?? "",
    grupo: anterior?.grupo ?? "",
    grupo_libre: anterior?.grupo_libre ?? "",
    potrero: anterior?.potrero ?? "",
    nacimiento_mes,
    nacimiento_anio,
    observaciones,
    estado: input.estado,
    tipo_baja: input.tipo_baja,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    edad,
  };

  await db.prepare(
    `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       estado = excluded.estado,
       tipo_baja = excluded.tipo_baja,
       numero_guia = excluded.numero_guia,
       observaciones = excluded.observaciones,
       baja_mes = excluded.baja_mes,
       baja_anio = excluded.baja_anio,
       edad = excluded.edad,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_EQUINO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({
    clave: claveNorm,
    eid: eidGuardar,
    sexo: nuevo.sexo,
    empresa: nuevo.empresa,
    grupo: nuevo.grupo,
    edad,
    nacimiento_mes,
    nacimiento_anio,
    observaciones,
    estado: input.estado,
    tipo_baja: input.tipo_baja,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
  });

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo, autor);

  const fechaBajaIso =
    input.fecha_baja_iso?.trim() ||
    fechaBajaIsoDesdeMesAnio(baja.baja_mes ?? input.baja_mes, baja.baja_anio ?? input.baja_anio);

  return snapshotBajaDispositivo(
    db,
    claveNorm,
    fechaBajaIso,
    input.tipo_baja,
    input.estado,
    baja.baja_mes ?? input.baja_mes,
    baja.baja_anio ?? input.baja_anio,
    edad,
    nuevo.sexo,
    nacimiento_mes,
    nacimiento_anio,
    eidGuardar
  );
}

export async function getEstadoDispositivoStock(
  db: Db,
  clave: string
): Promise<DispositivoEstado> {
  const claveNorm = normalizarClaveDispositivo(clave);
  const row = (await db
    .prepare(`SELECT estado FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`)
    .get(claveNorm)) as { estado?: string } | undefined;
  if (!row?.estado) return "VIVO";
  const estadoRaw = String(row.estado).toUpperCase();
  return ESTADOS_VALIDOS.has(estadoRaw as DispositivoEstado)
    ? (estadoRaw as DispositivoEstado)
    : "VIVO";
}

export async function aplicarBajaDispositivoStock(
  db: Db,
  clave: string,
  eid: string,
  opts: {
    tipo_baja: TipoBaja;
    fecha_baja_iso: string;
    observaciones?: string;
    numero_guia?: string;
    autor?: HistorialAutor;
  }
): Promise<BajaDispositivoSnapshot> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);
  const estadoActual = await getEstadoDispositivoStock(db, claveNorm);
  if (estadoActual !== "VIVO") {
    throw new Error(
      `El dispositivo no está activo en stock (estado ${estadoActual}).`
    );
  }
  const fechaBaja = fechaIsoAMesAnio(opts.fecha_baja_iso);
  if (!fechaBaja) {
    throw new Error("Fecha de embarque inválida para registrar la baja.");
  }
  const estado = estadoDesdeTipoBaja(opts.tipo_baja);
  return aplicarBajaDispositivo(db, claveNorm, eid, {
    estado,
    tipo_baja: opts.tipo_baja,
    baja_mes: fechaBaja.mes,
    baja_anio: fechaBaja.anio,
    fecha_baja_iso: opts.fecha_baja_iso,
    observaciones: opts.observaciones,
    numero_guia: opts.numero_guia,
  }, opts.autor);
}

export async function restaurarDispositivoVivoStock(
  db: Db,
  clave: string,
  eid = "",
  autor?: HistorialAutor
): Promise<boolean> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);
  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;

  const eidGuardar = eid.trim() || claveNorm;

  if (!anteriorRow) {
    await db.prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
         clave, eid, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
       ) VALUES (
         @clave, @eid, '', '', '', '', NULL, NULL, NULL, '', 'VIVO', '', '', NULL, NULL,
         datetime('now', 'localtime')
       )`
    ).run({ clave: claveNorm, eid: eidGuardar });
    return true;
  }

  const anterior = normalizarMetaDispositivo(anteriorRow);
  if (anterior.estado === "VIVO" && !anterior.tipo_baja && !anterior.baja_mes && !anterior.baja_anio) {
    return false;
  }

  const nacimiento_mes = anterior.nacimiento_mes;
  const nacimiento_anio = anterior.nacimiento_anio;
  const edad = calcularEdadMeses(nacimiento_mes, nacimiento_anio);
  const nuevo: DispositivoMetaGuardada = {
    ...anterior,
    estado: "VIVO",
    tipo_baja: "",
    numero_guia: "",
    baja_mes: null,
    baja_anio: null,
    edad,
  };

  await db.prepare(
    `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @grupo_libre, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       estado = excluded.estado,
       tipo_baja = excluded.tipo_baja,
       numero_guia = excluded.numero_guia,
       baja_mes = excluded.baja_mes,
       baja_anio = excluded.baja_anio,
       edad = excluded.edad,
       observaciones = excluded.observaciones,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_EQUINO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({
    clave: claveNorm,
    eid: eidGuardar,
    sexo: nuevo.sexo,
    empresa: nuevo.empresa,
    grupo: nuevo.grupo,
    grupo_libre: nuevo.grupo_libre,
    edad,
    nacimiento_mes,
    nacimiento_anio,
    observaciones: nuevo.observaciones,
    estado: "VIVO",
    tipo_baja: "",
    numero_guia: "",
    baja_mes: null,
    baja_anio: null,
  });

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo, autor);
  return true;
}

export async function countStockEquinaDispositivosActivos(
  db: Db,
  filters?: StockEquinoFilters
): Promise<number> {
  const [dispositivos, ventasClaves] = await Promise.all([
    listStockEquinaDispositivos(db, filters),
    Promise.resolve([] as string[]),
  ]);
  const ventas = new Set(ventasClaves);
  return dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave)).length;
}

export interface ImportBajaDispositivosResult {
  actualizados: number;
  no_encontrados: number;
  duplicados_omitidos: number;
  ambiguos: number;
  muestra_no_encontrados: string[];
  muestra_ambiguos: string[];
  dispositivos_bajados: BajaDispositivoSnapshot[];
}

export async function importBajaDispositivos(
  db: Db,
  rows: StockEquinoRowInput[],
  tipo_baja: TipoBaja,
  autor?: HistorialAutor
): Promise<ImportBajaDispositivosResult> {
  if (!rows.length) throw new Error("El archivo no contiene dispositivos válidos.");
  if (tipo_baja === "FRIGORIFICO" || !TIPOS_BAJA_VALIDOS.has(tipo_baja)) {
    throw new Error(
      "Tipo de baja inválido. Use VENTA_FRIGORIFICO, VENTA_PRODUCTOR, MUERTE o PERDIDO."
    );
  }

  const estado = estadoDesdeTipoBaja(tipo_baja);

  const registradas = await clavesRegistradasSet(db);
  const vistos = new Set<string>();
  let actualizados = 0;
  let no_encontrados = 0;
  let duplicados_omitidos = 0;
  const muestra_no_encontrados: string[] = [];
  const dispositivos_bajados: BajaDispositivoSnapshot[] = [];

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const claveNorm = dispositivoClave(row.eid, row.vid);
      if (!claveNorm) continue;

      if (vistos.has(claveNorm)) {
        duplicados_omitidos += 1;
        continue;
      }
      vistos.add(claveNorm);

      if (!registradas.has(claveNorm)) {
        no_encontrados += 1;
        const ref = row.vid || row.eid;
        if (muestra_no_encontrados.length < 8) muestra_no_encontrados.push(ref);
        continue;
      }

      const fechaBaja = fechaIsoAMesAnio(row.fecha);
      if (!fechaBaja) {
        throw new Error(
          `Fecha inválida para ${row.vid || row.eid}. Use columna Date en el archivo.`
        );
      }

      const snap = await aplicarBajaDispositivo(tx, claveNorm, row.eid, {
        estado,
        tipo_baja,
        baja_mes: fechaBaja.mes,
        baja_anio: fechaBaja.anio,
        fecha_baja_iso: row.fecha.trim(),
      }, autor ?? { origen: "IMPORT", user_nombre: "Importación de bajas" });
      dispositivos_bajados.push(snap);
      actualizados += 1;
    }
  });

  if (actualizados === 0 && no_encontrados === 0) {
    throw new Error("No se procesó ningún dispositivo del archivo.");
  }

  return {
    actualizados,
    no_encontrados,
    duplicados_omitidos,
    ambiguos: 0,
    muestra_no_encontrados,
    muestra_ambiguos: [],
    dispositivos_bajados,
  };
}

function fechaHoyIsoLocal(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export async function claveRegistradaPorNumero(
  db: Db,
  numero: string
): Promise<string | null> {
  const registradas = await clavesRegistradasSet(db);
  const claves = await resolverClavesRegistradasPorNumero(db, registradas, numero);
  return claves.length === 1 ? claves[0]! : null;
}

async function resolverClavesRegistradasPorNumero(
  db: Db,
  registradas: Set<string>,
  numero: string
): Promise<string[]> {
  const trimmed = numero.trim();
  if (!trimmed) return [];

  const candidatos = new Set<string>();
  const claveDirecta = dispositivoClave(trimmed, "");
  if (claveDirecta && registradas.has(claveDirecta)) {
    candidatos.add(claveDirecta);
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits) {
    for (const clave of registradas) {
      if (clave === digits || clave.endsWith(digits)) {
        candidatos.add(clave);
      }
    }
  }

  const q = `%${trimmed.replace(/\s/g, "")}%`;
  const rows = (await db
    .prepare(
      `SELECT DISTINCT eid, vid FROM STOCK_EQUINO_REGISTRO
       WHERE eid LIKE @q OR vid LIKE @q`
    )
    .all({ q })) as { eid: string; vid: string }[];

  for (const r of rows) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k && registradas.has(k)) candidatos.add(k);
  }

  return [...candidatos];
}

async function eidParaClaveRegistrada(
  db: Db,
  claveNorm: string
): Promise<string> {
  const dispositivo = (await db
    .prepare(`SELECT eid FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`)
    .get(claveNorm)) as { eid?: string } | undefined;
  if (dispositivo?.eid?.trim()) return dispositivo.eid.trim();

  const rows = (await db
    .prepare(`SELECT eid, vid FROM STOCK_EQUINO_REGISTRO`)
    .all()) as { eid: string; vid: string }[];
  for (const r of rows) {
    if (dispositivoClave(r.eid, r.vid) === claveNorm) {
      return splitEidVid(r.eid, r.vid).eid || r.eid.trim();
    }
  }
  return claveNorm.slice(0, 3);
}

/** Baja manual por número de dispositivo con detalle completo. */
export interface BajaDispositivoItemInput {
  numero: string;
  tipo_baja: TipoBaja;
  fecha: string;
  numero_guia?: string;
  observaciones?: string;
}

export async function importBajaDetalle(
  db: Db,
  items: BajaDispositivoItemInput[],
  autor?: HistorialAutor
): Promise<ImportBajaDispositivosResult> {
  const lista = items
    .map((item) => ({
      numero: item.numero.trim(),
      tipo_baja: item.tipo_baja,
      fecha: item.fecha.trim(),
      numero_guia: item.numero_guia,
      observaciones: item.observaciones,
    }))
    .filter((item) => item.numero);
  if (!lista.length) throw new Error("Ingresá al menos un número de dispositivo.");

  const registradas = await clavesRegistradasSet(db);
  const vistos = new Set<string>();
  let actualizados = 0;
  let no_encontrados = 0;
  let duplicados_omitidos = 0;
  let ambiguos = 0;
  const muestra_no_encontrados: string[] = [];
  const muestra_ambiguos: string[] = [];
  const dispositivos_bajados: BajaDispositivoSnapshot[] = [];

  await db.transaction(async (tx) => {
    for (const item of lista) {
      const tipo_baja = parseTipoBaja(item.tipo_baja);
      const estado = estadoDesdeTipoBaja(tipo_baja);
      const fechaBaja = fechaIsoAMesAnio(item.fecha);
      if (!fechaBaja) {
        throw new Error(`Fecha inválida para ${item.numero}. Use formato AAAA-MM-DD.`);
      }

      const claves = await resolverClavesRegistradasPorNumero(tx, registradas, item.numero);
      if (claves.length === 0) {
        no_encontrados += 1;
        if (muestra_no_encontrados.length < 8) muestra_no_encontrados.push(item.numero);
        continue;
      }
      if (claves.length > 1) {
        ambiguos += 1;
        if (muestra_ambiguos.length < 8) muestra_ambiguos.push(item.numero);
        continue;
      }

      const claveNorm = claves[0]!;
      if (vistos.has(claveNorm)) {
        duplicados_omitidos += 1;
        continue;
      }
      vistos.add(claveNorm);

      const eid = await eidParaClaveRegistrada(tx, claveNorm);
      const snap = await aplicarBajaDispositivo(tx, claveNorm, eid, {
        estado,
        tipo_baja,
        baja_mes: fechaBaja.mes,
        baja_anio: fechaBaja.anio,
        fecha_baja_iso: item.fecha,
        numero_guia: item.numero_guia,
        observaciones: item.observaciones,
      }, autor ?? { origen: "IMPORT", user_nombre: "Importación de bajas" });
      dispositivos_bajados.push(snap);
      actualizados += 1;
    }
  });

  if (actualizados === 0 && no_encontrados === 0 && ambiguos === 0) {
    throw new Error("No se procesó ningún dispositivo.");
  }

  return {
    actualizados,
    no_encontrados,
    duplicados_omitidos,
    ambiguos,
    muestra_no_encontrados,
    muestra_ambiguos,
    dispositivos_bajados,
  };
}

/** Baja manual por número (legado: fecha de hoy). */
export async function importBajaPorNumeros(
  db: Db,
  numeros: string[],
  tipo_baja: TipoBaja,
  autor?: HistorialAutor
): Promise<ImportBajaDispositivosResult> {
  const lista = numeros.map((n) => n.trim()).filter(Boolean);
  if (!lista.length) throw new Error("Ingresá al menos un número de dispositivo.");
  if (tipo_baja === "FRIGORIFICO" || !TIPOS_BAJA_VALIDOS.has(tipo_baja)) {
    throw new Error(
      "Tipo de baja inválido. Use VENTA_FRIGORIFICO, VENTA_PRODUCTOR, MUERTE o PERDIDO."
    );
  }

  return importBajaDetalle(
    db,
    lista.map((numero) => ({
      numero,
      tipo_baja,
      fecha: fechaHoyIsoLocal(),
    })),
    autor
  );
}

export async function updateStockEquinaDispositivoSexo(
  db: Db,
  clave: string,
  sexo: DispositivoSexo,
  eid = "",
  autor?: HistorialAutor
): Promise<DispositivoSexo> {
  const claveNorm = normalizarClaveDispositivo(clave);
  if (!SEXOS_VALIDOS.has(sexo)) throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  await assertDispositivoExiste(db, claveNorm);

  const anteriorRow = (await db
    .prepare(`SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio
              FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`)
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anterior = anteriorRow
    ? normalizarMetaDispositivo(anteriorRow)
    : null;

  const eidGuardar = eid.trim() || claveNorm;
  await db.prepare(
    `INSERT INTO STOCK_EQUINO_DISPOSITIVO (clave, eid, sexo, actualizado_en)
     VALUES (@clave, @eid, @sexo, datetime('now', 'localtime'))
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_EQUINO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({ clave: claveNorm, eid: eidGuardar, sexo });

  if (anterior?.sexo !== sexo) {
    await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, {
      sexo,
      empresa: anterior?.empresa ?? "",
      grupo: anterior?.grupo ?? "",
      grupo_libre: anterior?.grupo_libre ?? "",
      potrero: anterior?.potrero ?? "",
      edad: anterior?.edad ?? null,
      nacimiento_mes: anterior?.nacimiento_mes ?? null,
      nacimiento_anio: anterior?.nacimiento_anio ?? null,
      observaciones: anterior?.observaciones ?? "",
      estado: anterior?.estado ?? "VIVO",
      tipo_baja: anterior?.tipo_baja ?? "",
      numero_guia: anterior?.numero_guia ?? "",
      baja_mes: anterior?.baja_mes ?? null,
      baja_anio: anterior?.baja_anio ?? null,
    }, autor);
  }

  return sexo;
}

export async function updateStockEquinaDispositivoEdad(
  db: Db,
  clave: string,
  _edad: number | null,
  eid = ""
): Promise<number | null> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);

  const row = (await db
    .prepare(
      `SELECT nacimiento_mes, nacimiento_anio FROM STOCK_EQUINO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as
    | { nacimiento_mes: number | null; nacimiento_anio: number | null }
    | undefined;

  const edadNorm = calcularEdadMeses(
    row?.nacimiento_mes ?? null,
    row?.nacimiento_anio ?? null
  );

  const eidGuardar = eid.trim() || claveNorm;
  await db.prepare(
    `INSERT INTO STOCK_EQUINO_DISPOSITIVO (clave, eid, edad, actualizado_en)
     VALUES (@clave, @eid, @edad, datetime('now', 'localtime'))
     ON CONFLICT(clave) DO UPDATE SET
       edad = excluded.edad,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_EQUINO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({ clave: claveNorm, eid: eidGuardar, edad: edadNorm });

  return edadNorm;
}

export async function listStockEquinoLotes(
  db: Db,
  filters?: StockEquinoFilters
): Promise<StockEquinoLote[]> {
  let sql = `SELECT * FROM STOCK_EQUINO_LOTE WHERE 1=1`;
  const params: Record<string, number> = {};
  if (filters?.cuenta_id != null) {
    sql += ` AND cuenta_id = @cuenta_id`;
    params.cuenta_id = filters.cuenta_id;
  }
  sql += ` ORDER BY importado_en DESC, id DESC`;
  return (await db.prepare(sql).all(params)) as StockEquinoLote[];
}

export async function getStockEquinoLoteById(
  db: Db,
  id: number
): Promise<StockEquinoLote | undefined> {
  return (await db
    .prepare("SELECT * FROM STOCK_EQUINO_LOTE WHERE id = ?")
    .get(id)) as StockEquinoLote | undefined;
}

export async function listStockEquinoRegistros(
  db: Db,
  filters?: StockEquinoFilters
): Promise<StockEquinoRegistro[]> {
  let sql = "SELECT * FROM STOCK_EQUINO_REGISTRO WHERE 1=1";
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);

  sql += " ORDER BY fecha DESC, hora DESC, id DESC";
  let rows = (await db.prepare(sql).all(params)) as StockEquinoRegistro[];

  if (filters?.solo_repetidos) {
    const repetidas = await clavesEidRepetidas(db, {
      lote_id: filters.lote_id,
      busqueda: filters.busqueda,
      fecha_desde: filters.fecha_desde,
      fecha_hasta: filters.fecha_hasta,
      cuenta_id: filters.cuenta_id,
    });
    rows = rows.filter((r) => repetidas.has(dispositivoClave(r.eid, r.vid)));
  }

  const meta = await mapMetaDispositivos(db);

  return rows.map((r) => {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    const info = meta.get(clave);
    return {
      ...r,
      eid,
      vid,
      clave,
      sexo: info?.sexo ?? "",
      categoria: info?.categoria ?? "",
      castrado: info?.castrado ?? null,
      origen_alta: info?.origen_alta ?? "",
      rp: info?.rp ?? "",
      nombre_animal: info?.nombre_animal ?? "",
      registro: info?.registro ?? "",
      premios: info?.premios ?? "",
      empresa: info?.empresa ?? "",
      potrero: info?.potrero ?? "",
      grupo: info?.grupo ?? "",
      edad: info?.edad ?? null,
      nacimiento_mes: info?.nacimiento_mes ?? null,
      nacimiento_anio: info?.nacimiento_anio ?? null,
      estado: info?.estado ?? "",
    };
  });
}

export async function getStockEquinoEstadisticas(
  db: Db,
  filters?: StockEquinoFilters
): Promise<StockEquinoEstadisticas> {
  let sql = `SELECT eid, vid FROM STOCK_EQUINO_REGISTRO WHERE 1=1`;
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);

  const rows = await db.prepare(sql).all(params) as { eid: string; vid: string }[];
  const counts = new Map<string, { eid: string; vid: string; n: number }>();

  for (const row of rows) {
    const split = splitEidVid(row.eid, row.vid);
    const clave = dispositivoClave(split.eid, split.vid);
    if (!clave) continue;
    const prev = counts.get(clave);
    if (!prev) counts.set(clave, { eid: split.eid, vid: split.vid, n: 1 });
    else {
      prev.n += 1;
    }
  }

  let eids_activos = 0;
  let eids_repetidos = 0;
  let lecturas_en_repetidos = 0;
  const detalle_repetidos: StockEquinoEidRepetido[] = [];

  for (const [clave, info] of counts) {
    if (info.n === 1) {
      eids_activos += 1;
    } else {
      eids_repetidos += 1;
      lecturas_en_repetidos += info.n;
      detalle_repetidos.push({
        eid: info.eid,
        vid: info.vid,
        clave,
        cantidad: info.n,
      });
    }
  }

  detalle_repetidos.sort(
    (a, b) =>
      b.cantidad - a.cantidad ||
      a.vid.localeCompare(b.vid, "es") ||
      a.eid.localeCompare(b.eid, "es")
  );

  return {
    total_lecturas: rows.length,
    eids_activos,
    eids_repetidos,
    lecturas_en_repetidos,
    detalle_repetidos,
  };
}

export async function importStockEquinoRows(
  db: Db,
  nombreArchivo: string,
  rows: StockEquinoRowInput[],
  cuentaId?: number | null
): Promise<{ lote_id: number; insertados: number }> {
  if (!rows.length) throw new Error("El archivo no contiene lecturas válidas.");

  return db.transaction(async (tx) => {
    const ultimaLecturaPorClave = await mapUltimaLecturaPorClave(tx);

    const lote = await tx
      .prepare(
        `INSERT INTO STOCK_EQUINO_LOTE (nombre_archivo, filas, cuenta_id) VALUES (@nombre_archivo, @filas, @cuenta_id)`
      )
      .run({
        nombre_archivo: nombreArchivo.trim() || "import.txt",
        filas: rows.length,
        cuenta_id: cuentaId ?? null,
      });
    const lote_id = Number(lote.lastInsertRowid);

    const ins = await tx.prepare(
      `INSERT INTO STOCK_EQUINO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
       VALUES (@lote_id, @eid, @vid, @fecha, @hora, @condicion)`
    );
    const upsertEmpresaDispositivo = await tx.prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO (clave, eid, empresa, sexo, estado)
       VALUES (@clave, @eid, @empresa, @sexo, 'VIVO')
       ON CONFLICT (clave) DO UPDATE SET
         eid = excluded.eid,
         empresa = CASE WHEN excluded.empresa <> '' THEN excluded.empresa
                        ELSE STOCK_EQUINO_DISPOSITIVO.empresa END,
         sexo = CASE WHEN excluded.sexo <> '' THEN excluded.sexo
                     ELSE STOCK_EQUINO_DISPOSITIVO.sexo END,
         actualizado_en = NOW()`
    );
    for (const r of rows) {
      const clave = dispositivoClave(r.eid, r.vid);
      const prev = clave ? ultimaLecturaPorClave.get(clave) : undefined;

      const inserted = await ins.run({
        lote_id,
        eid: r.eid,
        vid: r.vid,
        fecha: r.fecha,
        hora: r.hora,
        condicion: r.condicion,
      });

      const empresaImport = normalizarEmpresaDispositivo(r.empresa);
      const sexoImport = r.sexo === "MACHO" || r.sexo === "HEMBRA" ? r.sexo : "";
      if (clave && (empresaImport || sexoImport)) {
        await upsertEmpresaDispositivo.run({
          clave,
          eid: r.eid,
          empresa: empresaImport,
          sexo: sexoImport,
        });
      }

      if (clave && prev) {
        const prevCondicion = prev.condicion ?? "";
        const nuevaCondicion = r.condicion ?? "";
        if (
          fmtHistorialCondicion(prevCondicion) !== fmtHistorialCondicion(nuevaCondicion)
        ) {
          await registrarHistorialCondicionLectura(
            tx,
            clave,
            prevCondicion,
            nuevaCondicion,
            r.fecha,
            r.hora
          );
        }
      }

      if (clave) {
        const nuevaLectura: LecturaResumen = {
          id: inserted.lastInsertRowid,
          fecha: r.fecha,
          hora: r.hora,
          condicion: r.condicion ?? "",
        };
        if (!prev || esLecturaMasReciente(nuevaLectura, prev)) {
          ultimaLecturaPorClave.set(clave, nuevaLectura);
        }
      }
    }
    return { lote_id, insertados: rows.length };
  });
}

export interface AltaEquinoGenericaInput {
  cantidad: number;
  sexo: DispositivoSexo;
  /** Fecha ISO YYYY-MM-DD. La categoría se deriva de esta fecha. */
  fecha_nacimiento: string;
  /**
   * Solo requerido si el animal es macho adulto (≥36 meses):
   * true = Caballo, false = Padrillo.
   */
  castrado?: boolean | null;
  potrero: string;
  empresa: string;
}

export interface AltaEquinoGenericaResult {
  creados: number;
  claves: string[];
  desde: string;
  hasta: string;
  lote_id: number;
  categoria: CategoriaEquino;
}

function incrementarIdDecimal(ultimo: string, by: number): string {
  return (BigInt(ultimo.replace(/\D/g, "") || "0") + BigInt(by)).toString();
}

function parseFechaNacimientoAlta(raw: string): {
  nacimiento_mes: number;
  nacimiento_anio: number;
  fechaIso: string;
} {
  const s = String(raw ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new Error("Fecha de nacimiento inválida. Usá el formato AAAA-MM-DD.");
  }
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const maxAnio = new Date().getFullYear();
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error("Mes de nacimiento inválido.");
  }
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new Error("Día de nacimiento inválido.");
  }
  if (!Number.isInteger(anio) || anio < 1990 || anio > maxAnio) {
    throw new Error(`Año de nacimiento inválido (1990–${maxAnio}).`);
  }
  const d = new Date(anio, mes - 1, dia);
  if (
    d.getFullYear() !== anio ||
    d.getMonth() !== mes - 1 ||
    d.getDate() !== dia
  ) {
    throw new Error("Fecha de nacimiento inválida.");
  }
  const hoy = new Date();
  const hoySolo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (d > hoySolo) {
    throw new Error("La fecha de nacimiento no puede ser futura.");
  }
  return {
    nacimiento_mes: mes,
    nacimiento_anio: anio,
    fechaIso: `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
  };
}

export async function crearEquinosGenericos(
  db: Db,
  input: AltaEquinoGenericaInput,
  cuentaId?: number | null,
  autor?: HistorialAutor
): Promise<AltaEquinoGenericaResult> {
  const cantidad = Math.floor(Number(input.cantidad));
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 500) {
    throw new Error("La cantidad debe ser un entero entre 1 y 500.");
  }

  const sexo = SEXOS_VALIDOS.has(input.sexo) ? input.sexo : "";
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }

  const nacimiento = parseFechaNacimientoAlta(input.fecha_nacimiento);
  const edad = calcularEdadMeses(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  if (edad === null) {
    throw new Error("No se pudo calcular la edad desde la fecha de nacimiento.");
  }

  let castradoOpt: boolean | null =
    input.castrado === true ? true : input.castrado === false ? false : null;
  if (sexo === "MACHO" && edad >= EQUINO_FRONTERA_ADULTO && castradoOpt === null) {
    throw new Error(
      "Para machos de 36 meses o más indicá si es Caballo (castrado) o Padrillo."
    );
  }
  if (sexo !== "MACHO" || edad < EQUINO_FRONTERA_ADULTO) {
    castradoOpt = null;
  }

  const categoria = categoriaDesdeSexoYEdad(sexo, edad, castradoOpt);
  const potrero = potreroDb.normalizarPotrero(input.potrero);
  if (!potrero) {
    throw new Error("Seleccioná un potrero.");
  }

  const empresa = normalizarEmpresaDispositivo(input.empresa);
  if (!empresa) {
    throw new Error("Seleccioná la empresa de los animales.");
  }

  const grupo = grupoDesdeNacimiento(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  const castrado = castradoDesdeCategoria(categoria);
  const castradoDb = castrado === null ? null : castrado ? 1 : 0;

  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10);
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:${String(ahora.getSeconds()).padStart(2, "0")}`;

  return db.transaction(async (tx) => {
    const claves = await reservarIdsEquinos(tx, cantidad);

    const lote = await tx
      .prepare(
        `INSERT INTO STOCK_EQUINO_LOTE (nombre_archivo, filas, cuenta_id) VALUES (@nombre_archivo, @filas, @cuenta_id)`
      )
      .run({
        nombre_archivo: `alta-generica-${categoria.toLowerCase()}`,
        filas: cantidad,
        cuenta_id: cuentaId ?? null,
      });
    const lote_id = Number(lote.lastInsertRowid);

    const insReg = await tx.prepare(
      `INSERT INTO STOCK_EQUINO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
       VALUES (@lote_id, @eid, @vid, @fecha, @hora, @condicion)`
    );
    const insDisp = await tx.prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
         clave, eid, sexo, empresa, grupo, grupo_libre, potrero, categoria, castrado, origen_alta,
         edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia,
         baja_mes, baja_anio, actualizado_en
       ) VALUES (
         @clave, @eid, @sexo, @empresa, @grupo, '', @potrero, @categoria, @castrado, 'generico',
         @edad, @nacimiento_mes, @nacimiento_anio, '', 'VIVO', '', '',
         NULL, NULL, NOW()
       )
       ON CONFLICT (clave) DO UPDATE SET
         eid = excluded.eid,
         sexo = excluded.sexo,
         empresa = excluded.empresa,
         grupo = excluded.grupo,
         potrero = excluded.potrero,
         categoria = excluded.categoria,
         castrado = excluded.castrado,
         origen_alta = excluded.origen_alta,
         edad = excluded.edad,
         nacimiento_mes = excluded.nacimiento_mes,
         nacimiento_anio = excluded.nacimiento_anio,
         estado = 'VIVO',
         actualizado_en = NOW()`
    );

    for (const clave of claves) {
      const { eid, vid } = splitEquinoIdInterno(clave);
      await insReg.run({
        lote_id,
        eid,
        vid,
        fecha,
        hora,
        condicion: CATEGORIA_EQUINO_LABELS[categoria],
      });
      await insDisp.run({
        clave,
        eid,
        sexo,
        empresa,
        grupo,
        potrero,
        categoria,
        castrado: castradoDb,
        edad,
        nacimiento_mes: nacimiento.nacimiento_mes,
        nacimiento_anio: nacimiento.nacimiento_anio,
      });
    }

    const cuentaPotrero =
      cuentaId ?? (await potreroDb.getCuentaIdPorEmpresaCodigo(tx, empresa));
    await potreroDb.ensurePotreroEnCatalogo(tx, cuentaPotrero, potrero);

    for (const clave of claves) {
      await syncStockDispositivoPotreroEnMapa(
        tx,
        cuentaPotrero,
        clave,
        "equino",
        potrero,
        ""
      );
      if (autor) {
        await tx
          .prepare(
            `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
               (clave, campo, etiqueta, valor_anterior, valor_nuevo, user_id, user_email, user_nombre, origen)
             VALUES (?, 'alta_generica', 'Alta genérica', '', ?, ?, ?, ?, 'alta_generica')`
          )
          .run(
            clave,
            `${categoria} · ${nacimiento.fechaIso} · ${potrero}`,
            autor.user_id ?? null,
            autor.user_email ?? "",
            autor.user_nombre ?? ""
          );
      }
    }

    return {
      creados: cantidad,
      claves,
      desde: claves[0]!,
      hasta: claves[claves.length - 1]!,
      lote_id,
      categoria,
    };
  });
}

function normalizarTextoCabana(val: string | undefined | null, max: number): string {
  return String(val ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

export interface AltaEquinoCabanaInput {
  rp: string;
  nombre_animal: string;
  fecha_nacimiento: string;
  sexo: DispositivoSexo;
  registro: string;
  premios?: string;
  castrado?: boolean | null;
  potrero: string;
  empresa: string;
}

export interface AltaEquinoCabanaResult {
  clave: string;
  lote_id: number;
  categoria: CategoriaEquino;
  rp: string;
  nombre_animal: string;
}

export async function crearEquinoCabana(
  db: Db,
  input: AltaEquinoCabanaInput,
  cuentaId?: number | null,
  autor?: HistorialAutor
): Promise<AltaEquinoCabanaResult> {
  const rp = normalizarTextoCabana(input.rp, 64);
  if (!rp) {
    throw new Error("Indicá el RP (registro particular).");
  }
  const nombre_animal = normalizarTextoCabana(input.nombre_animal, 120);
  if (!nombre_animal) {
    throw new Error("Indicá el nombre del animal.");
  }
  const registro = normalizarTextoCabana(input.registro, 120);
  if (!registro) {
    throw new Error("Indicá el registro.");
  }
  const premios = normalizarTextoCabana(input.premios, 2000);

  const sexo = SEXOS_VALIDOS.has(input.sexo) ? input.sexo : "";
  if (sexo !== "MACHO" && sexo !== "HEMBRA") {
    throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  }

  const nacimiento = parseFechaNacimientoAlta(input.fecha_nacimiento);
  const edad = calcularEdadMeses(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  if (edad === null) {
    throw new Error("No se pudo calcular la edad desde la fecha de nacimiento.");
  }

  let castradoOpt: boolean | null =
    input.castrado === true ? true : input.castrado === false ? false : null;
  if (sexo === "MACHO" && edad >= EQUINO_FRONTERA_ADULTO && castradoOpt === null) {
    throw new Error(
      "Para machos de 36 meses o más indicá si es Caballo (castrado) o Padrillo."
    );
  }
  if (sexo !== "MACHO" || edad < EQUINO_FRONTERA_ADULTO) {
    castradoOpt = null;
  }

  const categoria = categoriaDesdeSexoYEdad(sexo, edad, castradoOpt);
  const potrero = potreroDb.normalizarPotrero(input.potrero);
  if (!potrero) {
    throw new Error("Seleccioná un potrero.");
  }
  const empresa = normalizarEmpresaDispositivo(input.empresa);
  if (!empresa) {
    throw new Error("Seleccioná la empresa del animal.");
  }

  const grupo = grupoDesdeNacimiento(nacimiento.nacimiento_mes, nacimiento.nacimiento_anio);
  const castrado = castradoDesdeCategoria(categoria);
  const castradoDb = castrado === null ? null : castrado ? 1 : 0;

  const ahora = new Date();
  const fecha = ahora.toISOString().slice(0, 10);
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:${String(ahora.getSeconds()).padStart(2, "0")}`;

  return db.transaction(async (tx) => {
    const claves = await reservarIdsEquinos(tx, 1);
    const clave = claves[0]!;
    const { eid, vid } = splitEquinoIdInterno(clave);

    const lote = await tx
      .prepare(
        `INSERT INTO STOCK_EQUINO_LOTE (nombre_archivo, filas, cuenta_id) VALUES (@nombre_archivo, @filas, @cuenta_id)`
      )
      .run({
        nombre_archivo: `alta-cabana-${nombre_animal.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
        filas: 1,
        cuenta_id: cuentaId ?? null,
      });
    const lote_id = Number(lote.lastInsertRowid);

    await tx
      .prepare(
        `INSERT INTO STOCK_EQUINO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
         VALUES (@lote_id, @eid, @vid, @fecha, @hora, @condicion)`
      )
      .run({
        lote_id,
        eid,
        vid,
        fecha,
        hora,
        condicion: `Cabaña · ${CATEGORIA_EQUINO_LABELS[categoria]}`,
      });

    await tx
      .prepare(
        `INSERT INTO STOCK_EQUINO_DISPOSITIVO (
           clave, eid, sexo, empresa, grupo, grupo_libre, potrero, categoria, castrado, origen_alta,
           rp, nombre_animal, registro, premios,
           edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia,
           baja_mes, baja_anio, actualizado_en
         ) VALUES (
           @clave, @eid, @sexo, @empresa, @grupo, '', @potrero, @categoria, @castrado, 'cabana',
           @rp, @nombre_animal, @registro, @premios,
           @edad, @nacimiento_mes, @nacimiento_anio, '', 'VIVO', '', '',
           NULL, NULL, NOW()
         )
         ON CONFLICT (clave) DO UPDATE SET
           eid = excluded.eid,
           sexo = excluded.sexo,
           empresa = excluded.empresa,
           grupo = excluded.grupo,
           potrero = excluded.potrero,
           categoria = excluded.categoria,
           castrado = excluded.castrado,
           origen_alta = 'cabana',
           rp = excluded.rp,
           nombre_animal = excluded.nombre_animal,
           registro = excluded.registro,
           premios = excluded.premios,
           edad = excluded.edad,
           nacimiento_mes = excluded.nacimiento_mes,
           nacimiento_anio = excluded.nacimiento_anio,
           estado = 'VIVO',
           actualizado_en = NOW()`
      )
      .run({
        clave,
        eid,
        sexo,
        empresa,
        grupo,
        potrero,
        categoria,
        castrado: castradoDb,
        rp,
        nombre_animal,
        registro,
        premios,
        edad,
        nacimiento_mes: nacimiento.nacimiento_mes,
        nacimiento_anio: nacimiento.nacimiento_anio,
      });

    const cuentaPotrero =
      cuentaId ?? (await potreroDb.getCuentaIdPorEmpresaCodigo(tx, empresa));
    await potreroDb.ensurePotreroEnCatalogo(tx, cuentaPotrero, potrero);
    await syncStockDispositivoPotreroEnMapa(
      tx,
      cuentaPotrero,
      clave,
      "equino",
      potrero,
      ""
    );

    if (autor) {
      await tx
        .prepare(
          `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
             (clave, campo, etiqueta, valor_anterior, valor_nuevo, user_id, user_email, user_nombre, origen)
           VALUES (?, 'alta_cabana', 'Alta cabaña', '', ?, ?, ?, ?, 'alta_cabana')`
        )
        .run(
          clave,
          `${nombre_animal} · RP ${rp} · ${categoria}`,
          autor.user_id ?? null,
          autor.user_email ?? "",
          autor.user_nombre ?? ""
        );
    }

    return { clave, lote_id, categoria, rp, nombre_animal };
  });
}

export async function deleteStockEquinoLote(db: Db, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM STOCK_EQUINO_REGISTRO WHERE lote_id = ?").run(id);
    return (await tx.prepare("DELETE FROM STOCK_EQUINO_LOTE WHERE id = ?").run(id)).changes > 0;
  });
}

export async function countStockEquinoRegistros(
  db: Db,
  filters?: StockEquinoFilters
): Promise<number> {
  let sql = `SELECT COUNT(*) AS n FROM STOCK_EQUINO_REGISTRO WHERE 1=1`;
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);
  const row = (await db.prepare(sql).get(params)) as { n: number };
  return row.n;
}

export interface StockEquinaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  categoria: string;
  castrado: boolean | null;
  origen_alta: string;
  rp: string;
  nombre_animal: string;
  registro: string;
  premios: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
  tiene_foto: boolean;
  foto_url: string | null;
  foto_actualizado_en: string;
  primera_fecha: string;
  ultima_fecha: string;
  ultima_hora: string;
  ultima_condicion: string;
  total_lecturas: number;
  es_repetido: boolean;
}

export interface StockEquinaLecturaDetalle extends StockEquinoRegistro {
  nombre_archivo: string;
}

export interface StockEquinaDispositivoDetalle extends StockEquinaDispositivo {
  lecturas: StockEquinaLecturaDetalle[];
  lotes_distintos: number;
}

interface LecturaPunto {
  fecha: string;
  hora: string;
  id?: number;
}

interface LecturaResumen extends LecturaPunto {
  condicion: string;
}

function compareFechaHora(
  a: { fecha: string; hora: string },
  b: { fecha: string; hora: string }
): number {
  const fa = a.fecha || "";
  const fb = b.fecha || "";
  if (fa !== fb) return fa.localeCompare(fb);
  return (a.hora || "").localeCompare(b.hora || "");
}

/** La lectura más reciente gana; si empatan fecha/hora, gana el id mayor; si aún empatan, gana condición no vacía. */
function esLecturaMasReciente(
  a: LecturaPunto & { condicion?: string },
  b: LecturaPunto & { condicion?: string }
): boolean {
  const cmp = compareFechaHora(a, b);
  if (cmp > 0) return true;
  if (cmp < 0) return false;
  const idA = a.id ?? 0;
  const idB = b.id ?? 0;
  if (idA !== idB) return idA > idB;
  const condA = String(a.condicion ?? "").trim();
  const condB = String(b.condicion ?? "").trim();
  if (condA && !condB) return true;
  if (!condA && condB) return false;
  return false;
}

function esLecturaMasAntigua(a: LecturaPunto, b: LecturaPunto): boolean {
  const cmp = compareFechaHora(a, b);
  if (cmp < 0) return true;
  if (cmp > 0) return false;
  return (a.id ?? 0) < (b.id ?? 0);
}

async function mapUltimaLecturaPorClave(db: Db): Promise<Map<string, LecturaResumen>> {
  const rows = (await db
    .prepare(
      `SELECT id, eid, vid, fecha, hora, condicion FROM STOCK_EQUINO_REGISTRO`
    )
    .all()) as StockEquinoRegistro[];

  const map = new Map<string, LecturaResumen>();
  for (const r of rows) {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    if (!clave) continue;

    const lectura: LecturaResumen = {
      id: r.id,
      fecha: r.fecha,
      hora: r.hora,
      condicion: r.condicion ?? "",
    };
    const prev = map.get(clave);
    if (!prev || esLecturaMasReciente(lectura, prev)) {
      map.set(clave, lectura);
    }
  }
  return map;
}

async function backfillHistorialCondicionDesdeLecturas(db: Db): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT id, eid, vid, fecha, hora, condicion
       FROM STOCK_EQUINO_REGISTRO
       ORDER BY fecha ASC, hora ASC, id ASC`
    )
    .all()) as StockEquinoRegistro[];

  const ultimaCondicionPorClave = new Map<string, string>();

  for (const r of rows) {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    if (!clave) continue;

    const condicion = String(r.condicion ?? "");
    const prev = ultimaCondicionPorClave.get(clave);
    if (prev !== undefined) {
      const prevFmt = fmtHistorialCondicion(prev);
      const nextFmt = fmtHistorialCondicion(condicion);
      if (prevFmt !== nextFmt) {
        await insertHistorialFila(
          db,
          clave,
          "condicion",
          "Condición (lectura)",
          prevFmt,
          nextFmt,
          timestampLectura(r.fecha, r.hora),
          HISTORIAL_AUTOR_LECTURA
        );
      }
    }
    ultimaCondicionPorClave.set(clave, condicion);
  }
}

function buildDispositivosFromRegistros(
  registros: StockEquinoRegistro[],
  repetidasClaves: Set<string>
): StockEquinaDispositivo[] {
  const map = new Map<string, StockEquinaDispositivo>();
  const ultimaIdPorClave = new Map<string, number>();
  const primeraIdPorClave = new Map<string, number>();

  for (const r of registros) {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    if (!clave) continue;

    const lectura: LecturaResumen = {
      id: r.id,
      fecha: r.fecha,
      hora: r.hora,
      condicion: r.condicion ?? "",
    };

    const prev = map.get(clave);
    if (!prev) {
      map.set(clave, {
        clave,
        eid,
        vid,
        sexo: "",
        empresa: "",
        grupo: "",
        grupo_libre: "",
        potrero: "",
        categoria: "",
        castrado: null,
        origen_alta: "",
        rp: "",
        nombre_animal: "",
        registro: "",
        premios: "",
        edad: null,
        nacimiento_mes: null,
        nacimiento_anio: null,
        observaciones: "",
        estado: "VIVO",
        tipo_baja: "",
        numero_guia: "",
        baja_mes: null,
        baja_anio: null,
        tiene_foto: false,
        foto_url: null,
        foto_actualizado_en: "",
        primera_fecha: r.fecha,
        ultima_fecha: r.fecha,
        ultima_hora: r.hora,
        ultima_condicion: r.condicion,
        total_lecturas: 1,
        es_repetido: repetidasClaves.has(clave),
      });
      ultimaIdPorClave.set(clave, r.id);
      primeraIdPorClave.set(clave, r.id);
      continue;
    }

    prev.total_lecturas += 1;
    if (vid && !prev.vid) prev.vid = vid;

    const primeraId = primeraIdPorClave.get(clave) ?? r.id;
    const primeraLectura: LecturaPunto = {
      id: primeraId,
      fecha: prev.primera_fecha,
      hora: "",
    };
    if (esLecturaMasAntigua(lectura, primeraLectura)) {
      prev.primera_fecha = r.fecha;
      primeraIdPorClave.set(clave, r.id);
    }

    const ultimaId = ultimaIdPorClave.get(clave) ?? r.id;
    const ultimaLectura: LecturaResumen = {
      id: ultimaId,
      fecha: prev.ultima_fecha,
      hora: prev.ultima_hora,
      condicion: prev.ultima_condicion ?? "",
    };
    if (esLecturaMasReciente(lectura, ultimaLectura)) {
      prev.ultima_fecha = r.fecha;
      prev.ultima_hora = r.hora;
      prev.ultima_condicion = r.condicion;
      ultimaIdPorClave.set(clave, r.id);
      if (vid) prev.vid = vid;
      prev.eid = eid;
    }

    prev.es_repetido = repetidasClaves.has(clave);
  }

  const mejorCondicionPorClave = new Map<string, LecturaResumen>();
  for (const r of registros) {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    if (!clave || !String(r.condicion ?? "").trim()) continue;

    const lectura: LecturaResumen = {
      id: r.id,
      fecha: r.fecha,
      hora: r.hora,
      condicion: r.condicion ?? "",
    };
    const prev = mejorCondicionPorClave.get(clave);
    if (!prev || esLecturaMasReciente(lectura, prev)) {
      mejorCondicionPorClave.set(clave, lectura);
    }
  }

  for (const d of map.values()) {
    if (String(d.ultima_condicion ?? "").trim()) continue;
    const mejor = mejorCondicionPorClave.get(d.clave);
    if (mejor) d.ultima_condicion = mejor.condicion;
  }

  return [...map.values()].sort(
    (a, b) =>
      compareFechaHora(
        { fecha: b.ultima_fecha, hora: b.ultima_hora },
        { fecha: a.ultima_fecha, hora: a.ultima_hora }
      ) || a.vid.localeCompare(b.vid, "es")
  );
}

const ESTADOS_BAJA = new Set<DispositivoEstado>([
  "MUERTO",
  "VENDIDO",
  "FRIGORIFICO",
  "PERDIDO",
]);

export const SIN_EMPRESAS_SCOPE = "__sin_empresas__";

function filtrarDispositivosPorEmpresas(
  dispositivos: StockEquinaDispositivo[],
  empresas?: string[]
): StockEquinaDispositivo[] {
  if (!empresas) return dispositivos;
  if (empresas.length === 1 && empresas[0] === SIN_EMPRESAS_SCOPE) return [];
  const set = new Set(empresas);
  return dispositivos.filter((d) => {
    const emp = (d.empresa || "").trim();
    if (!emp) return true;
    return set.has(emp);
  });
}

function filtrarYOrdenarBajas(
  dispositivos: StockEquinaDispositivo[],
  filters?: StockEquinoFilters
): StockEquinaDispositivo[] {
  let rows = dispositivos;

  if (filters?.solo_bajas) {
    rows = rows.filter((d) => ESTADOS_BAJA.has(d.estado));
  }
  if (
    filters?.estado_dispositivo &&
    ESTADOS_BAJA.has(filters.estado_dispositivo)
  ) {
    rows = rows.filter((d) => d.estado === filters.estado_dispositivo);
  }

  if (filters?.solo_bajas || filters?.estado_dispositivo) {
    rows = [...rows].sort((a, b) => {
      const bKey = (b.baja_anio ?? 0) * 100 + (b.baja_mes ?? 0);
      const aKey = (a.baja_anio ?? 0) * 100 + (a.baja_mes ?? 0);
      if (bKey !== aKey) return bKey - aKey;
      return (
        compareFechaHora(
          { fecha: b.ultima_fecha, hora: b.ultima_hora },
          { fecha: a.ultima_fecha, hora: a.ultima_hora }
        ) || a.vid.localeCompare(b.vid, "es")
      );
    });
  }

  return rows;
}

export async function listStockEquinaDispositivos(
  db: Db,
  filters?: StockEquinoFilters
): Promise<StockEquinaDispositivo[]> {
  const registros = await listStockEquinoRegistros(db, filters);
  const repetidas = await clavesEidRepetidas(db, filters);
  let dispositivos = buildDispositivosFromRegistros(registros, repetidas);

  if (filters?.solo_repetidos) {
    dispositivos = dispositivos.filter((d) => d.es_repetido);
  }

  dispositivos = await enrichDispositivosWithMeta(db, dispositivos);
  dispositivos = filtrarDispositivosPorEmpresas(dispositivos, filters?.empresas);
  return filtrarYOrdenarBajas(dispositivos, filters);
}

export async function getStockEquinaDispositivoDetalle(
  db: Db,
  clave: string,
  filters?: StockEquinoFilters
): Promise<StockEquinaDispositivoDetalle | undefined> {
  const claveNorm = clave.replace(/\D/g, "");
  if (!claveNorm) return undefined;

  const rows = (await db
    .prepare(
      `SELECT r.*, l.nombre_archivo
       FROM STOCK_EQUINO_REGISTRO r
       JOIN STOCK_EQUINO_LOTE l ON l.id = r.lote_id
       WHERE 1=1`
    )
    .all()) as StockEquinaLecturaDetalle[];

  let lecturas = rows.filter(
    (r) => dispositivoClave(r.eid, r.vid) === claveNorm
  );

  if (filters?.lote_id) {
    lecturas = lecturas.filter((r) => r.lote_id === filters.lote_id);
  }
  if (filters?.fecha_desde) {
    lecturas = lecturas.filter((r) => r.fecha >= filters.fecha_desde!);
  }
  if (filters?.fecha_hasta) {
    lecturas = lecturas.filter((r) => r.fecha <= filters.fecha_hasta!);
  }
  if (filters?.busqueda?.trim()) {
    const q = filters.busqueda.trim().toLowerCase();
    lecturas = lecturas.filter(
      (r) =>
        r.eid.toLowerCase().includes(q) ||
        r.vid.toLowerCase().includes(q) ||
        r.condicion.toLowerCase().includes(q)
    );
  }

  if (!lecturas.length) return undefined;

  lecturas = lecturas.map((r) => {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    return { ...r, eid, vid };
  });

  lecturas.sort(
    (a, b) =>
      -compareFechaHora(
        { fecha: a.fecha, hora: a.hora },
        { fecha: b.fecha, hora: b.hora }
      ) || b.id - a.id
  );

  const repetidas = await clavesEidRepetidas(db, filters);
  const [resumen] = buildDispositivosFromRegistros(lecturas, repetidas);
  if (!resumen) return undefined;

  const lotes = new Set(lecturas.map((l) => l.lote_id));
  const [enriquecido] = await enrichDispositivosWithMeta(db, [resumen]);
  if (!enriquecido) return undefined;

  const [scoped] = filtrarDispositivosPorEmpresas([enriquecido], filters?.empresas);
  if (!scoped) return undefined;

  return {
    ...scoped,
    lecturas,
    lotes_distintos: lotes.size,
  };
}

export async function countStockEquinaDispositivos(
  db: Db,
  filters?: StockEquinoFilters
): Promise<number> {
  return (await listStockEquinaDispositivos(db, filters)).length;
}

const MESES_HISTORIAL = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export interface StockEquinaDispositivoHistorial {
  id: number;
  clave: string;
  campo: string;
  etiqueta: string;
  valor_anterior: string;
  valor_nuevo: string;
  creado_en: string;
  user_id: number | null;
  user_email: string;
  user_nombre: string;
  origen: string;
}

export type HistorialOrigen =
  | "FICHA"
  | "MASIVO"
  | "BAJA"
  | "IMPORT"
  | "LECTURA"
  | "VENTA"
  | "SISTEMA"
  | "";

export interface HistorialAutor {
  user_id?: number | null;
  user_email?: string;
  user_nombre?: string;
  origen?: HistorialOrigen | string;
}

export const HISTORIAL_AUTOR_LECTURA: HistorialAutor = {
  user_id: null,
  user_email: "",
  user_nombre: "Importación de lecturas",
  origen: "LECTURA",
};

export const HISTORIAL_AUTOR_VENTA: HistorialAutor = {
  user_id: null,
  user_email: "",
  user_nombre: "Simulador de ventas",
  origen: "VENTA",
};

export const HISTORIAL_AUTOR_SISTEMA: HistorialAutor = {
  user_id: null,
  user_email: "",
  user_nombre: "Sistema",
  origen: "SISTEMA",
};

function fmtHistorialPotrero(v: string): string {
  return v.trim() || "—";
}

function fmtHistorialSexo(v: DispositivoSexo): string {
  return v || "—";
}

function fmtHistorialEmpresa(v: DispositivoEmpresa): string {
  return v || "—";
}

function fmtHistorialGrupo(v: string): string {
  return v.trim() || "—";
}

function fmtHistorialGrupoLibre(v: string): string {
  return v.trim() || "—";
}

function fmtHistorialFechaBaja(
  estado: DispositivoEstado,
  mes: number | null,
  anio: number | null,
  tipoBaja?: TipoBaja | ""
): string {
  if (!esEstadoConBaja(estado)) {
    return "—";
  }
  if (!mes || !anio) return "—";
  const nombre = MESES_HISTORIAL[mes] ?? String(mes);
  const pref = tipoBaja
    ? fmtHistorialTipoBaja(tipoBaja)
    : estado === "MUERTO"
      ? "Muerte"
      : estado === "PERDIDO"
        ? "Extraviado"
        : estado === "VENDIDO"
          ? "Venta"
          : "Frigorífico";
  return `${pref}: ${nombre} ${anio}`;
}

function fmtHistorialTipoBaja(tipo: TipoBaja | ""): string {
  switch (tipo) {
    case "VENTA_FRIGORIFICO":
      return "Venta Frigorífico";
    case "VENTA_PRODUCTOR":
      return "Venta productor";
    case "FRIGORIFICO":
      return "Frigorífico";
    case "MUERTE":
      return "Muerte";
    case "PERDIDO":
      return "Extraviado";
    default:
      return "—";
  }
}

function fmtHistorialNumeroGuia(v: string): string {
  return v.trim() || "—";
}

function fmtHistorialEstado(v: DispositivoEstado): string {
  switch (v) {
    case "VIVO":
      return "Vivo";
    case "MUERTO":
      return "Muerto";
    case "VENDIDO":
      return "Vendido";
    case "FRIGORIFICO":
      return "Frigorífico";
    case "PERDIDO":
      return "Extraviado";
    default:
      return "Vivo";
  }
}

function fmtHistorialNacimiento(mes: number | null, anio: number | null): string {
  if (!mes || !anio) return "—";
  const nombre = MESES_HISTORIAL[mes] ?? String(mes);
  return `${nombre} ${anio}`;
}

function fmtHistorialObs(v: string): string {
  const t = v.trim();
  return t || "—";
}

function fmtHistorialCondicion(v: string): string {
  const t = String(v ?? "").trim();
  return t || "—";
}

function timestampLectura(fecha: string, hora: string): string {
  const f = fecha.trim();
  if (!f) return "";
  return `${f} ${hora.trim() || "00:00:00"}`;
}

function fmtHistorialEdad(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v} meses`;
}

async function insertHistorialFila(
  db: Db,
  clave: string,
  campo: string,
  etiqueta: string,
  valorAnterior: string,
  valorNuevo: string,
  creadoEn?: string,
  autor?: HistorialAutor
): Promise<void> {
  if (valorAnterior === valorNuevo) return;
  const user_id = autor?.user_id ?? null;
  const user_email = String(autor?.user_email ?? "").trim().slice(0, 200);
  const user_nombre = String(autor?.user_nombre ?? "").trim().slice(0, 120);
  const origen = String(autor?.origen ?? "").trim().slice(0, 32);
  if (creadoEn?.trim()) {
    await db
      .prepare(
        `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
           (clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en, user_id, user_email, user_nombre, origen)
         VALUES (@clave, @campo, @etiqueta, @valor_anterior, @valor_nuevo, @creado_en, @user_id, @user_email, @user_nombre, @origen)`
      )
      .run({
        clave,
        campo,
        etiqueta,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        creado_en: creadoEn.trim(),
        user_id,
        user_email,
        user_nombre,
        origen,
      });
    return;
  }
  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en, user_id, user_email, user_nombre, origen)
       VALUES (@clave, @campo, @etiqueta, @valor_anterior, @valor_nuevo,
               datetime('now', 'localtime'), @user_id, @user_email, @user_nombre, @origen)`
    )
    .run({
      clave,
      campo,
      etiqueta,
      valor_anterior: valorAnterior,
      valor_nuevo: valorNuevo,
      user_id,
      user_email,
      user_nombre,
      origen,
    });
}

async function registrarHistorialCondicionLectura(
  db: Db,
  clave: string,
  condicionAnterior: string,
  condicionNueva: string,
  fecha: string,
  hora: string
): Promise<void> {
  await insertHistorialFila(
    db,
    clave,
    "condicion",
    "Condición (lectura)",
    fmtHistorialCondicion(condicionAnterior),
    fmtHistorialCondicion(condicionNueva),
    timestampLectura(fecha, hora),
    HISTORIAL_AUTOR_LECTURA
  );
}

async function registrarHistorialCambiosDispositivo(
  db: Db,
  clave: string,
  anterior: DispositivoMetaGuardada | null,
  nuevo: DispositivoMetaGuardada,
  autor?: HistorialAutor
): Promise<void> {
  const prevEmpresa = fmtHistorialEmpresa(anterior?.empresa ?? "");
  const prevGrupo = fmtHistorialGrupo(anterior?.grupo ?? "");
  const prevGrupoLibre = fmtHistorialGrupoLibre(anterior?.grupo_libre ?? "");
  const prevPotrero = fmtHistorialPotrero(anterior?.potrero ?? "");
  const prevSexo = fmtHistorialSexo(anterior?.sexo ?? "");
  const prevNac = fmtHistorialNacimiento(
    anterior?.nacimiento_mes ?? null,
    anterior?.nacimiento_anio ?? null
  );
  const prevObs = fmtHistorialObs(anterior?.observaciones ?? "");
  const prevEstado = fmtHistorialEstado(anterior?.estado ?? "VIVO");
  const prevEdad = fmtHistorialEdad(anterior?.edad ?? null);
  const prevBaja = fmtHistorialFechaBaja(
    anterior?.estado ?? "VIVO",
    anterior?.baja_mes ?? null,
    anterior?.baja_anio ?? null,
    anterior?.tipo_baja ?? ""
  );
  const prevTipoBaja = fmtHistorialTipoBaja(anterior?.tipo_baja ?? "");
  const prevGuia = fmtHistorialNumeroGuia(anterior?.numero_guia ?? "");

  const nextEmpresa = fmtHistorialEmpresa(nuevo.empresa);
  const nextGrupo = fmtHistorialGrupo(nuevo.grupo);
  const nextGrupoLibre = fmtHistorialGrupoLibre(nuevo.grupo_libre);
  const nextPotrero = fmtHistorialPotrero(nuevo.potrero);
  const nextSexo = fmtHistorialSexo(nuevo.sexo);
  const nextNac = fmtHistorialNacimiento(
    nuevo.nacimiento_mes,
    nuevo.nacimiento_anio
  );
  const nextObs = fmtHistorialObs(nuevo.observaciones);
  const nextEstado = fmtHistorialEstado(nuevo.estado);
  const nextEdad = fmtHistorialEdad(nuevo.edad);
  const nextBaja = fmtHistorialFechaBaja(
    nuevo.estado,
    nuevo.baja_mes,
    nuevo.baja_anio,
    nuevo.tipo_baja
  );
  const nextTipoBaja = fmtHistorialTipoBaja(nuevo.tipo_baja);
  const nextGuia = fmtHistorialNumeroGuia(nuevo.numero_guia);

  await insertHistorialFila(db, clave, "empresa", "Empresa", prevEmpresa, nextEmpresa, undefined, autor);
  await insertHistorialFila(db, clave, "grupo", "Generación", prevGrupo, nextGrupo, undefined, autor);
  await insertHistorialFila(
    db,
    clave,
    "grupo_libre",
    "Grupo",
    prevGrupoLibre,
    nextGrupoLibre,
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "potrero",
    "Potrero",
    prevPotrero,
    nextPotrero,
    undefined,
    autor
  );
  await insertHistorialFila(db, clave, "sexo", "Sexo", prevSexo, nextSexo, undefined, autor);
  await insertHistorialFila(
    db,
    clave,
    "nacimiento",
    "Fecha de nacimiento",
    prevNac,
    nextNac,
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "rp",
    "RP",
    (anterior?.rp ?? "").trim() || "—",
    (nuevo.rp ?? "").trim() || "—",
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "nombre_animal",
    "Nombre animal",
    (anterior?.nombre_animal ?? "").trim() || "—",
    (nuevo.nombre_animal ?? "").trim() || "—",
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "registro",
    "Registro",
    (anterior?.registro ?? "").trim() || "—",
    (nuevo.registro ?? "").trim() || "—",
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "premios",
    "Premios",
    (anterior?.premios ?? "").trim() || "—",
    (nuevo.premios ?? "").trim() || "—",
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "edad",
    "Edad calculada",
    prevEdad,
    nextEdad,
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "observaciones",
    "Observaciones",
    prevObs,
    nextObs,
    undefined,
    autor
  );
  await insertHistorialFila(db, clave, "estado", "Estado", prevEstado, nextEstado, undefined, autor);
  await insertHistorialFila(db, clave, "tipo_baja", "Tipo de baja", prevTipoBaja, nextTipoBaja, undefined, autor);
  await insertHistorialFila(db, clave, "numero_guia", "Número guía", prevGuia, nextGuia, undefined, autor);
  await insertHistorialFila(
    db,
    clave,
    "fecha_baja",
    "Fecha de baja",
    prevBaja,
    nextBaja,
    undefined,
    autor
  );
}

export async function listStockEquinaDispositivoHistorial(
  db: Db,
  clave: string
): Promise<StockEquinaDispositivoHistorial[]> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);

  return (await db
    .prepare(
      `SELECT id, clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en,
              user_id, user_email, user_nombre, origen
       FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = ? AND clave != '__meta__'
       ORDER BY creado_en DESC, id DESC`
    )
    .all(claveNorm)) as StockEquinaDispositivoHistorial[];
}
