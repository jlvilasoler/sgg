import type { Db } from "./db/pg-client.js";
import type { StockGanaderoRowInput } from "./parse-stock-ganadero-txt.js";
import { migrateAddCuentaIdColumn, getEmpresaCodigosActivosPorCuenta, getEmpresaOperativaColorPorCodigo } from "./empresas-cuenta-db.js";
import { listClavesDispositivosEnVentasCerradas } from "./simulador-venta-dispositivos-db.js";
import { labelCategoriaSalidaDispositivo } from "./stock-ganadera-categoria.js";
import { dispositivoClave, eidClave, splitEidVid, coincideBusquedaDispositivo } from "./stock-ganadero-id.js";
import * as stockFoto from "./stock-dispositivo-foto-db.js";
import * as stockControlSanitario from "./stock-control-sanitario-db.js";
import * as potreroDb from "./stock-ganadero-potrero-db.js";
import { syncStockDispositivoPotreroEnMapa } from "./campo-mapa-sync-stock-db.js";
import * as grupoDb from "./stock-ganadero-grupo-db.js";
import * as colorDb from "./stock-dispositivo-color-db.js";

export { dispositivoClave, eidClave, splitEidVid } from "./stock-ganadero-id.js";

export type { StockGanaderoRowInput };

export interface StockGanaderoLote {
  id: number;
  nombre_archivo: string;
  filas: number;
  importado_en: string;
  cuenta_id?: number | null;
}

export interface StockGanaderoRegistro {
  id: number;
  lote_id: number;
  eid: string;
  vid: string;
  fecha: string;
  hora: string;
  condicion: string;
  creado_en?: string;
}

export interface StockGanaderoFilters {
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

export interface StockGanaderoEidRepetido {
  eid: string;
  vid: string;
  clave: string;
  cantidad: number;
}

export interface StockGanaderoEstadisticas {
  total_lecturas: number;
  eids_activos: number;
  eids_repetidos: number;
  lecturas_en_repetidos: number;
  detalle_repetidos: StockGanaderoEidRepetido[];
}

function appendRegistroFilters(
  sql: string,
  params: Record<string, string | number>,
  filters?: StockGanaderoFilters,
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
      ${p}condicion LIKE @busqueda
    )`;
    params.busqueda = `%${filters.busqueda.trim()}%`;
  }
  if (filters?.cuenta_id != null) {
    sql += ` AND ${p}lote_id IN (SELECT id FROM STOCK_GANADERO_LOTE WHERE cuenta_id = @cuenta_id OR cuenta_id IS NULL)`;
    params.cuenta_id = filters.cuenta_id;
  }
  return sql;
}

async function clavesEidRepetidas(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<Set<string>> {
  let sql = `SELECT eid, vid FROM STOCK_GANADERO_REGISTRO WHERE 1=1`;
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

export { normalizarPotrero, POTRERO_MAX } from "./stock-ganadero-potrero-db.js";
export { normalizarGrupoCatalogo, GRUPO_LIBRE_MAX } from "./stock-ganadero-grupo-db.js";
export {
  COLORES_CARAVANA,
  normalizarColorCaravana,
  etiquetaColorCaravana,
} from "./stock-dispositivo-color-db.js";

export async function initStockGanaderoTables(db: Db): Promise<void> {
  await migrateStockGanaderoLoteCuenta(db);
  await migrateGrupoLibreColumn(db);
  await migrateBajaMetaColumns(db);
  await migrateCabanaColumns(db);
  await migrateRazaColumn(db);
  await migrateRazaCatalogTable(db);
  await potreroDb.migratePotreroColumn(db);
  await potreroDb.migratePotreroCatalogTable(db);
  await colorDb.migrateGanaderoColorCaravanaColumn(db);
  await grupoDb.migrateGrupoCatalogTable(db);
  await stockFoto.migrateStockDispositivoFotoColumns(db, "ganadero");
  await stockFoto.migrateStockDispositivoFotosGallery(db, "ganadero");
  await stockFoto.migrateStockDispositivoFotosBlobColumns(db, "ganadero");
  await stockControlSanitario.migrateStockControlSanitarioTable(db, "ganadero");
  await stockControlSanitario.migrateStockControlSanitarioCantidadCatalog(db);
  await stockControlSanitario.migrateStockControlSanitarioEsperaCatalog(db);
  await stockControlSanitario.migrateStockControlSanitarioProductoFicha(db);
  await migrateFechasSlashLatam(db);
  await migrateStockGanaderoDispositivoHistorial(db);
  await migrateHistorialAutorColumns(db);
}

async function migrateStockGanaderoLoteCuenta(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "STOCK_GANADERO_LOTE");
}

async function migrateBajaMetaColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'baja_meta_cols' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const col of [
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN tipo_baja TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN numero_guia TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'baja_meta_cols', '', '', '')`
    )
    .run();
}

async function migrateCabanaColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'cabana_cols' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const col of [
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN cabana_premium INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN nombre_cabana TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'cabana_cols', '', '', '')`
    )
    .run();
}

async function migrateRazaColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'raza_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN raza TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'raza_col', '', '', '')`
    )
    .run();
}

const RAZAS_CATALOGO_INICIALES = ["HEREFORD", "ANGUS", "CARETA", "CRUZA"] as const;

async function migrateRazaCatalogTable(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'raza_catalog_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_GANADERO_RAZA (
         nombre TEXT PRIMARY KEY,
         creado_en TIMESTAMPTZ DEFAULT NOW()
       )`
    )
    .run();

  if (done) return;

  for (const nombre of RAZAS_CATALOGO_INICIALES) {
    await db
      .prepare(
        `INSERT INTO STOCK_GANADERO_RAZA (nombre) VALUES (?) ON CONFLICT(nombre) DO NOTHING`
      )
      .run(nombre);
  }

  const usadas = (await db
    .prepare(
      `SELECT DISTINCT raza FROM STOCK_GANADERO_DISPOSITIVO
       WHERE raza IS NOT NULL AND TRIM(raza) <> ''`
    )
    .all()) as { raza: string }[];
  for (const row of usadas) {
    const nombre = normalizarRaza(row.raza);
    if (!nombre) continue;
    await db
      .prepare(
        `INSERT INTO STOCK_GANADERO_RAZA (nombre) VALUES (?) ON CONFLICT(nombre) DO NOTHING`
      )
      .run(nombre);
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'raza_catalog_v1', '', '', '')`
    )
    .run();
}

async function migrateHistorialAutorColumns(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'historial_autor_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  for (const col of [
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO_HISTORIAL ADD COLUMN user_id INTEGER`,
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO_HISTORIAL ADD COLUMN user_email TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO_HISTORIAL ADD COLUMN user_nombre TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE STOCK_GANADERO_DISPOSITIVO_HISTORIAL ADD COLUMN origen TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      await db.prepare(col).run();
    } catch {
      /* columna ya existe */
    }
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'historial_autor_v1', '', '', '')`
    )
    .run();
}

async function migrateGrupoLibreColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'grupo_libre_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN grupo_libre TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'grupo_libre_col', '', '', '')`
    )
    .run();
}

async function migrateFechasSlashLatam(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'fechas_ddmm_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  await corregirFechasSlashInvertidas(db);

  await db
    .prepare(
      `DELETE FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL WHERE campo = 'condicion'`
    )
    .run();
  await db
    .prepare(
      `DELETE FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'backfill_condicion'`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
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
      `SELECT id, eid, vid, fecha, hora FROM STOCK_GANADERO_REGISTRO ORDER BY id`
    )
    .all()) as Pick<StockGanaderoRegistro, "id" | "eid" | "vid" | "fecha" | "hora">[];

  const porHora = new Map<string, Pick<StockGanaderoRegistro, "id" | "eid" | "vid" | "fecha" | "hora">[]>();
  for (const r of rows) {
    const key = `${r.eid}\0${r.vid}\0${r.hora}`;
    const list = porHora.get(key) ?? [];
    list.push(r);
    porHora.set(key, list);
  }

  const upd = await db.prepare(
    `UPDATE STOCK_GANADERO_REGISTRO SET fecha = @fecha WHERE id = @id`
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

async function migrateStockGanaderoDispositivoHistorial(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'backfill_condicion' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  await backfillHistorialCondicionDesdeLecturas(db);

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'backfill_condicion', '', '', '')`
    )
    .run();
}

async function migrateSplitEidVid(_db: Db): Promise<void> {}

async function migrateStockGanaderoDispositivoMeta(_db: Db): Promise<void> {}

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

const RAZA_MAX = 32;

function normalizarRaza(val: string | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, "")
    .slice(0, RAZA_MAX)
    .toUpperCase();
}

export interface DispositivoMetaInput {
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  raza: string;
  color_caravana: string;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
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
  raza: string;
  color_caravana?: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: string;
  tipo_baja: string;
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
  cabana_premium?: number | boolean | null;
  nombre_cabana?: string | null;
}

const NOMBRE_CABANA_MAX = 64;

function normalizarNombreCabana(val: string | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, NOMBRE_CABANA_MAX);
}

function cabanaPremiumFromRow(val: number | boolean | null | undefined): boolean {
  if (val === true || val === 1) return true;
  return false;
}

async function mapCabanaDispositivos(
  db: Db
): Promise<Map<string, { cabana_premium: boolean; nombre_cabana: string }>> {
  const rows = (await db
    .prepare(`SELECT clave, cabana_premium, nombre_cabana FROM STOCK_GANADERO_DISPOSITIVO`)
    .all()) as Pick<DispositivoMetaRow, "clave" | "cabana_premium" | "nombre_cabana">[];
  const map = new Map<string, { cabana_premium: boolean; nombre_cabana: string }>();
  for (const row of rows) {
    map.set(row.clave, {
      cabana_premium: cabanaPremiumFromRow(row.cabana_premium),
      nombre_cabana: normalizarNombreCabana(row.nombre_cabana),
    });
  }
  return map;
}

async function mapMetaDispositivos(
  db: Db
): Promise<Map<string, DispositivoMetaGuardada>> {
  const rows = (await db
    .prepare(
      `SELECT clave, sexo, empresa, grupo, grupo_libre, potrero, raza, color_caravana, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_GANADERO_DISPOSITIVO`
    )
    .all()) as DispositivoMetaRow[];
  const map = new Map<string, DispositivoMetaGuardada>();
  for (const row of rows) {
    map.set(row.clave, aplicarEdadCalculada(normalizarMetaDispositivo(row)));
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
    raza: normalizarRaza(row.raza),
    color_caravana: colorDb.normalizarColorCaravana(row.color_caravana),
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
  dispositivos: StockGanaderaDispositivo[]
): Promise<StockGanaderaDispositivo[]> {
  if (!dispositivos.length) return dispositivos;
  const meta = await mapMetaDispositivos(db);
  const cabana = await mapCabanaDispositivos(db);
  const fotos = await stockFoto.mapStockDispositivoFotos(db, "ganadero");
  for (const d of dispositivos) {
    const info = meta.get(d.clave);
    d.sexo = info?.sexo ?? "";
    d.empresa = info?.empresa ?? "";
    d.grupo = info?.grupo ?? "";
    d.grupo_libre = info?.grupo_libre ?? "";
    d.potrero = info?.potrero ?? "";
    d.raza = info?.raza ?? "";
    d.color_caravana = info?.color_caravana ?? "";
    d.edad = info?.edad ?? null;
    d.nacimiento_mes = info?.nacimiento_mes ?? null;
    d.nacimiento_anio = info?.nacimiento_anio ?? null;
    d.observaciones = info?.observaciones ?? "";
    d.estado = info?.estado ?? "VIVO";
    d.tipo_baja = info?.tipo_baja ?? "";
    d.numero_guia = info?.numero_guia ?? "";
    d.baja_mes = info?.baja_mes ?? null;
    d.baja_anio = info?.baja_anio ?? null;
    const cab = cabana.get(d.clave);
    d.cabana_premium = cab?.cabana_premium ?? false;
    d.nombre_cabana = cab?.nombre_cabana ?? "";
    const foto = fotos.get(d.clave);
    d.tiene_foto = foto?.tiene_foto ?? false;
    d.foto_url = foto?.foto_url ?? null;
    d.foto_actualizado_en = foto?.foto_actualizado_en ?? "";
  }
  return dispositivos;
}

async function assertDispositivoExiste(db: Db, claveNorm: string): Promise<void> {
  const eids = (await db
    .prepare(`SELECT eid, vid FROM STOCK_GANADERO_REGISTRO`)
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

export async function saveStockGanaderaDispositivo(
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
  const potrero = potreroDb.normalizarPotrero(input.potrero);
  const raza = normalizarRaza(input.raza);
  const color_caravana = empresa
    ? await getEmpresaOperativaColorPorCodigo(db, empresa)
    : colorDb.normalizarColorCaravana(input.color_caravana);
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

  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, grupo_libre, potrero, raza, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anterior = anteriorRow
    ? normalizarMetaDispositivo(anteriorRow)
    : null;
  const nuevo: DispositivoMetaGuardada = {
    sexo,
    empresa,
    grupo,
    grupo_libre,
    potrero,
    raza,
    color_caravana,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    tipo_baja: tipoBajaGuardar,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    edad,
  };

  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, grupo_libre, potrero, raza, color_caravana, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @grupo_libre, @potrero, @raza, @color_caravana, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       empresa = excluded.empresa,
       grupo = excluded.grupo,
       grupo_libre = excluded.grupo_libre,
       potrero = excluded.potrero,
       raza = excluded.raza,
       color_caravana = excluded.color_caravana,
       edad = excluded.edad,
       nacimiento_mes = excluded.nacimiento_mes,
       nacimiento_anio = excluded.nacimiento_anio,
       observaciones = excluded.observaciones,
       estado = excluded.estado,
       tipo_baja = excluded.tipo_baja,
       numero_guia = excluded.numero_guia,
       baja_mes = excluded.baja_mes,
       baja_anio = excluded.baja_anio,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({
    clave: claveNorm,
    eid: eidGuardar,
    sexo,
    empresa,
    grupo,
    grupo_libre,
    potrero,
    raza,
    color_caravana,
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
  await grupoDb.ensureGrupoEnCatalogo(db, cuentaId, grupo_libre);

  const prevPotrero = anterior?.potrero ?? "";
  if (prevPotrero !== potrero) {
    await syncStockDispositivoPotreroEnMapa(
      db,
      cuentaId,
      claveNorm,
      "ganadero",
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
    raza,
    color_caravana,
    edad,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    tipo_baja: tipoBajaGuardar,
    numero_guia,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
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
    raza: prev?.raza ?? "",
    color_caravana: prev?.color_caravana ?? "",
    nacimiento_mes: prev?.nacimiento_mes ?? null,
    nacimiento_anio: prev?.nacimiento_anio ?? null,
    observaciones: prev?.observaciones ?? "",
    estado: prev?.estado ?? "VIVO",
    tipo_baja: prev?.tipo_baja ?? "",
    numero_guia: prev?.numero_guia ?? "",
    baja_mes: prev?.baja_mes ?? null,
    baja_anio: prev?.baja_anio ?? null,
  };
  if (patch.sexo !== undefined) merged.sexo = patch.sexo;
  if (patch.empresa !== undefined) merged.empresa = patch.empresa;
  if (patch.grupo_libre !== undefined) merged.grupo_libre = patch.grupo_libre;
  if (patch.potrero !== undefined) merged.potrero = patch.potrero;
  if (patch.raza !== undefined) merged.raza = patch.raza;
  if (patch.color_caravana !== undefined) merged.color_caravana = patch.color_caravana;
  if (patch.nacimiento_mes !== undefined) merged.nacimiento_mes = patch.nacimiento_mes;
  if (patch.nacimiento_anio !== undefined) merged.nacimiento_anio = patch.nacimiento_anio;
  if (patch.observaciones !== undefined) merged.observaciones = patch.observaciones;
  if (patch.estado !== undefined) merged.estado = patch.estado;
  if (patch.tipo_baja !== undefined) merged.tipo_baja = patch.tipo_baja;
  if (patch.numero_guia !== undefined) merged.numero_guia = patch.numero_guia;
  if (patch.baja_mes !== undefined) merged.baja_mes = patch.baja_mes;
  if (patch.baja_anio !== undefined) merged.baja_anio = patch.baja_anio;
  return merged;
}

export async function bulkPatchStockGanaderaDispositivos(
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
        await saveStockGanaderaDispositivo(tx, claveNorm, input, eid, autor);
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
export async function deleteStockGanaderaDispositivos(
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
      .prepare(`SELECT id, eid, vid FROM STOCK_GANADERO_REGISTRO`)
      .all()) as { id: number; eid: string; vid: string }[];

    const delRegistro = tx.prepare(`DELETE FROM STOCK_GANADERO_REGISTRO WHERE id = ?`);
    const delHistorial = tx.prepare(
      `DELETE FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL WHERE clave = ?`
    );
    const delDispositivo = tx.prepare(`DELETE FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`);
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

export interface VaciarStockGanaderaResult {
  dispositivos_eliminados: number;
  lecturas_eliminadas: number;
  vinculos_sim_venta: number;
}

export interface StockGanaderaBackupInfo {
  disponible: boolean;
  creado_en: string | null;
  dispositivos: number;
  lecturas: number;
  historial: number;
  vinculos_sim: number;
}

export interface RestaurarStockGanaderaResult {
  dispositivos_restaurados: number;
  lecturas_restauradas: number;
  historial_restaurado: number;
  vinculos_sim_restaurados: number;
}

interface StockGanaderaBackupPayload {
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
    potrero: string;
    raza: string;
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

async function migrateStockGanaderaBackupTableSchema(db: Db): Promise<void> {
  const legacy = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'stock_ganadero_backup'
         AND column_name = 'id'
       LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (legacy) {
    await db.prepare(`DROP TABLE IF EXISTS STOCK_GANADERO_BACKUP`).run();
  }
}

async function ensureStockGanaderaBackupTable(db: Db): Promise<void> {
  await migrateStockGanaderaBackupTableSchema(db);
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_GANADERO_BACKUP (
         cuenta_id INTEGER PRIMARY KEY,
         payload TEXT NOT NULL,
         creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`
    )
    .run();
}

async function loteIdsPorCuenta(db: Db, cuentaId: number): Promise<Set<number>> {
  const rows = (await db
    .prepare(`SELECT id FROM STOCK_GANADERO_LOTE WHERE cuenta_id = ?`)
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

export interface StockGanaderoCuentaScope {
  empresaSet: Set<string>;
  clavesLecturas: Set<string>;
}

async function clavesLecturasGanaderoPorCuenta(db: Db, cuentaId: number): Promise<Set<string>> {
  const rows = (await db
    .prepare(
      `SELECT r.eid, r.vid
       FROM STOCK_GANADERO_REGISTRO r
       INNER JOIN STOCK_GANADERO_LOTE l ON l.id = r.lote_id
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

export async function getStockGanaderoCuentaScope(
  db: Db,
  cuentaId: number,
): Promise<StockGanaderoCuentaScope> {
  return {
    empresaSet: await empresaCodigosSetPorCuenta(db, cuentaId),
    clavesLecturas: await clavesLecturasGanaderoPorCuenta(db, cuentaId),
  };
}

export function stockGanaderoDispositivoEnCuenta(
  d: { clave: string; empresa: string },
  scope: StockGanaderoCuentaScope,
): boolean {
  return dispositivoPerteneceCuenta(d, scope.empresaSet, scope.clavesLecturas);
}

/** Dispositivos del stock ganadero que pertenecen a una cuenta (lotes + empresas operativas). */
export async function listStockGanaderaDispositivosPorCuenta(
  db: Db,
  cuentaId: number,
): Promise<StockGanaderaDispositivo[]> {
  const scope = await getStockGanaderoCuentaScope(db, cuentaId);
  if (scope.empresaSet.size === 0 && scope.clavesLecturas.size === 0) return [];
  const dispositivos = await listStockGanaderaDispositivos(db);
  return dispositivos.filter((d) => stockGanaderoDispositivoEnCuenta(d, scope));
}

async function gatherBackupPayloadForCuenta(
  db: Db,
  cuentaId: number
): Promise<StockGanaderaBackupPayload | null> {
  const loteIds = await loteIdsPorCuenta(db, cuentaId);
  const empresaSet = await empresaCodigosSetPorCuenta(db, cuentaId);

  const allRegistros = (await db
    .prepare(`SELECT lote_id, eid, vid, fecha, hora, condicion FROM STOCK_GANADERO_REGISTRO`)
    .all()) as StockGanaderaBackupPayload["registros"];
  const registros = allRegistros.filter((r) => loteIds.has(r.lote_id));

  const clavesLecturas = new Set<string>();
  for (const r of registros) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) clavesLecturas.add(k);
  }

  const allDispositivos = (await db
    .prepare(
      `SELECT clave, eid, sexo, empresa, grupo, grupo_libre, potrero, raza, edad, nacimiento_mes, nacimiento_anio,
              observaciones, estado, baja_mes, baja_anio, tipo_baja, numero_guia
       FROM STOCK_GANADERO_DISPOSITIVO`
    )
    .all()) as StockGanaderaBackupPayload["dispositivos"];
  const dispositivos = allDispositivos.filter((d) =>
    dispositivoPerteneceCuenta(d, empresaSet, clavesLecturas)
  );

  const clavesScope = new Set(dispositivos.map((d) => d.clave));
  for (const k of clavesLecturas) clavesScope.add(k);

  const allHistorial = (await db
    .prepare(
      `SELECT clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en,
              user_id, user_email, user_nombre, origen
       FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL`
    )
    .all()) as StockGanaderaBackupPayload["historial"];
  const historial = allHistorial.filter(
    (h) => h.clave !== "__meta__" && clavesScope.has(h.clave)
  );

  const allSim = (await db
    .prepare(
      `SELECT simulacion_id, clave, eid, vid FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO`
    )
    .all()) as StockGanaderaBackupPayload["sim_dispositivos"];
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

async function crearBackupStockGanadera(tx: Db, cuentaId: number): Promise<void> {
  await ensureStockGanaderaBackupTable(tx);
  const payload = await gatherBackupPayloadForCuenta(tx, cuentaId);
  if (!payload) return;

  await tx
    .prepare(
      `INSERT INTO STOCK_GANADERO_BACKUP (cuenta_id, payload, creado_en)
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
    .prepare(`SELECT lote_id FROM STOCK_GANADERO_REGISTRO`)
    .all()) as { lote_id: number }[];
  return rows.filter((r) => loteIds.has(r.lote_id)).length;
}

async function countDispositivosEnCuenta(db: Db, cuentaId: number): Promise<number> {
  const empresas = await getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  const filters: StockGanaderoFilters = {
    empresas: empresas.length > 0 ? empresas : [SIN_EMPRESAS_SCOPE],
  };
  return countStockGanaderaDispositivos(db, filters);
}

async function vaciarStockGanaderaDeCuenta(
  tx: Db,
  cuentaId: number
): Promise<VaciarStockGanaderaResult> {
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
    .prepare(`SELECT id, lote_id FROM STOCK_GANADERO_REGISTRO`)
    .all()) as { id: number; lote_id: number }[];
  for (const row of regRows) {
    if (!loteIds.has(row.lote_id)) continue;
    await tx.prepare(`DELETE FROM STOCK_GANADERO_REGISTRO WHERE id = ?`).run(row.id);
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
      .prepare(`DELETE FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL WHERE clave = ?`)
      .run(clave);
    historial_eliminado += res.changes ?? 0;
  }

  let dispositivos_eliminados = 0;
  for (const clave of clavesScope) {
    const res = await tx
      .prepare(`DELETE FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`)
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
  payload: StockGanaderaBackupPayload | null,
  creado_en: string | null
): StockGanaderaBackupInfo {
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

export async function infoStockGanaderaBackup(
  db: Db,
  cuentaId: number
): Promise<StockGanaderaBackupInfo> {
  await ensureStockGanaderaBackupTable(db);
  const row = (await db
    .prepare(`SELECT payload, creado_en FROM STOCK_GANADERO_BACKUP WHERE cuenta_id = ?`)
    .get(cuentaId)) as { payload: string; creado_en: string } | undefined;
  if (!row?.payload) {
    return infoDesdePayload(null, null);
  }
  try {
    const payload = JSON.parse(row.payload) as StockGanaderaBackupPayload;
    if (payload.cuenta_id != null && payload.cuenta_id !== cuentaId) {
      return infoDesdePayload(null, null);
    }
    return infoDesdePayload(payload, row.creado_en ?? null);
  } catch {
    return infoDesdePayload(null, null);
  }
}

export async function restaurarStockGanaderaDesdeBackup(
  db: Db,
  cuentaId: number
): Promise<RestaurarStockGanaderaResult> {
  return db.transaction(async (tx) => {
    await ensureStockGanaderaBackupTable(tx);
    const row = (await tx
      .prepare(`SELECT payload FROM STOCK_GANADERO_BACKUP WHERE cuenta_id = ?`)
      .get(cuentaId)) as { payload: string } | undefined;
    if (!row?.payload) {
      throw new Error("No hay respaldo disponible para restaurar.");
    }

    const payload = JSON.parse(row.payload) as StockGanaderaBackupPayload;
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
        (await tx.prepare(`SELECT id FROM STOCK_GANADERO_LOTE`).all()) as { id: number }[]
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
          `INSERT INTO STOCK_GANADERO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
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
          d.potrero ?? "",
          d.raza ?? "",
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
        return "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
      });
      await tx
        .prepare(
          `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
             clave, eid, sexo, empresa, grupo, grupo_libre, potrero, raza, edad, nacimiento_mes, nacimiento_anio,
             observaciones, estado, baja_mes, baja_anio, tipo_baja, numero_guia, actualizado_en
           ) VALUES ${filas.join(", ")}
           ON CONFLICT (clave) DO UPDATE SET
             eid = excluded.eid,
             sexo = excluded.sexo,
             empresa = excluded.empresa,
             grupo = excluded.grupo,
             grupo_libre = excluded.grupo_libre,
             potrero = excluded.potrero,
             raza = excluded.raza,
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
          `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
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

/** Elimina todo el stock ganadero de una cuenta (o global si cuentaId es null). */
export async function vaciarStockGanaderaCompleto(
  db: Db,
  cuentaId: number | null
): Promise<VaciarStockGanaderaResult> {
  if (cuentaId != null) {
    return db.transaction(async (tx) => {
      const payload = await gatherBackupPayloadForCuenta(tx, cuentaId);
      if (payload) {
        await crearBackupStockGanadera(tx, cuentaId);
      }
      return vaciarStockGanaderaDeCuenta(tx, cuentaId);
    });
  }

  return db.transaction(async (tx) => {
    const counts = (await tx.prepare(
      `SELECT
         (SELECT COUNT(*)::int FROM STOCK_GANADERO_REGISTRO) AS lecturas,
         (SELECT COUNT(*)::int FROM STOCK_GANADERO_DISPOSITIVO WHERE clave <> '__meta__') AS dispositivos,
         (SELECT COUNT(*)::int FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO) AS sim`
    ).get()) as { lecturas: number; dispositivos: number; sim: number };

    await tx.prepare(`TRUNCATE TABLE SIMULADOR_VENTA_GANADO_DISPOSITIVO`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_GANADERO_REGISTRO`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_GANADERO_DISPOSITIVO_HISTORIAL`).run();
    await tx.prepare(`TRUNCATE TABLE STOCK_GANADERO_DISPOSITIVO`).run();

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
    .prepare(`SELECT eid, vid FROM STOCK_GANADERO_REGISTRO`)
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
    .prepare(`SELECT eid, vid, fecha FROM STOCK_GANADERO_REGISTRO`)
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
       FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
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
      `SELECT sexo, empresa, grupo, grupo_libre, potrero, raza, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
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
    raza: anterior?.raza ?? "",
    color_caravana: anterior?.color_caravana ?? "",
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
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
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
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
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
    .prepare(`SELECT estado FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`)
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
      `SELECT sexo, empresa, grupo, grupo_libre, potrero, raza, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
       FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;

  const eidGuardar = eid.trim() || claveNorm;

  if (!anteriorRow) {
    await db.prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
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
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
         clave, eid, sexo, empresa, grupo, grupo_libre, potrero, raza, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
       ) VALUES (
         @clave, @eid, @sexo, @empresa, @grupo, @grupo_libre, @potrero, @raza, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
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
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({
    clave: claveNorm,
    eid: eidGuardar,
    sexo: nuevo.sexo,
    empresa: nuevo.empresa,
    grupo: nuevo.grupo,
    grupo_libre: nuevo.grupo_libre,
    potrero: nuevo.potrero,
    raza: nuevo.raza,
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

export async function countStockGanaderaDispositivosActivos(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<number> {
  const [dispositivos, ventasClaves] = await Promise.all([
    listStockGanaderaDispositivos(db, filters),
    listClavesDispositivosEnVentasCerradas(db),
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
  rows: StockGanaderoRowInput[],
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
      `SELECT DISTINCT eid, vid FROM STOCK_GANADERO_REGISTRO
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
    .prepare(`SELECT eid FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`)
    .get(claveNorm)) as { eid?: string } | undefined;
  if (dispositivo?.eid?.trim()) return dispositivo.eid.trim();

  const rows = (await db
    .prepare(`SELECT eid, vid FROM STOCK_GANADERO_REGISTRO`)
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

export async function updateStockGanaderaDispositivoSexo(
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
              FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`)
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anterior = anteriorRow
    ? normalizarMetaDispositivo(anteriorRow)
    : null;

  const eidGuardar = eid.trim() || claveNorm;
  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (clave, eid, sexo, actualizado_en)
     VALUES (@clave, @eid, @sexo, datetime('now', 'localtime'))
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({ clave: claveNorm, eid: eidGuardar, sexo });

  if (anterior?.sexo !== sexo) {
    await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, {
      sexo,
      empresa: anterior?.empresa ?? "",
      grupo: anterior?.grupo ?? "",
      grupo_libre: anterior?.grupo_libre ?? "",
      potrero: anterior?.potrero ?? "",
      raza: anterior?.raza ?? "",
      color_caravana: anterior?.color_caravana ?? "",
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

export async function updateStockGanaderaDispositivoEdad(
  db: Db,
  clave: string,
  _edad: number | null,
  eid = ""
): Promise<number | null> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);

  const row = (await db
    .prepare(
      `SELECT nacimiento_mes, nacimiento_anio FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
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
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (clave, eid, edad, actualizado_en)
     VALUES (@clave, @eid, @edad, datetime('now', 'localtime'))
     ON CONFLICT(clave) DO UPDATE SET
       edad = excluded.edad,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({ clave: claveNorm, eid: eidGuardar, edad: edadNorm });

  return edadNorm;
}

export interface CabanaSeleccionInput {
  clave: string;
  nombre_cabana: string;
  raza?: string;
  observaciones?: string;
}

export interface CabanaSeleccionResult {
  guardados: number;
  errores: { clave: string; mensaje: string }[];
}

export async function saveCabanaSeleccionBulk(
  db: Db,
  items: CabanaSeleccionInput[],
  autor?: HistorialAutor
): Promise<CabanaSeleccionResult> {
  let guardados = 0;
  const errores: { clave: string; mensaje: string }[] = [];

  for (const item of items) {
    try {
      await saveCabanaSeleccionDispositivo(db, item, autor);
      guardados += 1;
    } catch (e) {
      errores.push({
        clave: item.clave,
        mensaje: e instanceof Error ? e.message : "Error al guardar selección",
      });
    }
  }

  return { guardados, errores };
}

export async function saveCabanaSeleccionDispositivo(
  db: Db,
  input: CabanaSeleccionInput,
  autor?: HistorialAutor
): Promise<{ cabana_premium: boolean; nombre_cabana: string; raza: string; observaciones: string }> {
  const claveNorm = normalizarClaveDispositivo(input.clave);
  await assertDispositivoExiste(db, claveNorm);
  const nombre_cabana = normalizarNombreCabana(input.nombre_cabana);
  if (!nombre_cabana) {
    throw new Error("Ingresá un nombre de identificación para el animal de cabaña.");
  }
  const raza = normalizarRaza(input.raza ?? "");
  const observaciones = String(input.observaciones ?? "").trim().slice(0, 2000);

  const anteriorRow = (await db
    .prepare(
      `SELECT cabana_premium, nombre_cabana, raza, observaciones FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as
    | Pick<DispositivoMetaRow, "cabana_premium" | "nombre_cabana" | "raza" | "observaciones">
    | undefined;
  const prevNombre = normalizarNombreCabana(anteriorRow?.nombre_cabana);
  const prevPremium = cabanaPremiumFromRow(anteriorRow?.cabana_premium);
  const prevRaza = normalizarRaza(anteriorRow?.raza ?? "");
  const prevObs = String(anteriorRow?.observaciones ?? "").trim();

  const eidGuardar = claveNorm;
  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (clave, eid, cabana_premium, nombre_cabana, raza, observaciones, actualizado_en)
     VALUES (@clave, @eid, 1, @nombre_cabana, @raza, @observaciones, datetime('now', 'localtime'))
     ON CONFLICT(clave) DO UPDATE SET
       cabana_premium = 1,
       nombre_cabana = excluded.nombre_cabana,
       raza = excluded.raza,
       observaciones = excluded.observaciones,
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
       actualizado_en = datetime('now', 'localtime')`
  ).run({ clave: claveNorm, eid: eidGuardar, nombre_cabana, raza, observaciones });

  if (!prevPremium || prevNombre !== nombre_cabana) {
    await insertHistorialFila(
      db,
      claveNorm,
      "nombre_cabana",
      "Animal de cabaña",
      prevPremium ? prevNombre || "—" : "—",
      nombre_cabana,
      undefined,
      autor
    );
  }

  if (prevRaza !== raza) {
    await insertHistorialFila(
      db,
      claveNorm,
      "raza",
      "Raza",
      fmtHistorialRaza(prevRaza),
      fmtHistorialRaza(raza),
      undefined,
      autor
    );
  }

  if (prevObs !== observaciones) {
    await insertHistorialFila(
      db,
      claveNorm,
      "observaciones",
      "Observaciones",
      fmtHistorialObs(prevObs),
      fmtHistorialObs(observaciones),
      undefined,
      autor
    );
  }

  return { cabana_premium: true, nombre_cabana, raza, observaciones };
}

export async function listStockGanaderoRazas(db: Db): Promise<string[]> {
  const rows = (await db
    .prepare(`SELECT nombre FROM STOCK_GANADERO_RAZA ORDER BY nombre ASC`)
    .all()) as { nombre: string }[];
  return rows.map((r) => normalizarRaza(r.nombre)).filter(Boolean);
}

export async function createStockGanaderoRaza(db: Db, raw: string): Promise<string> {
  const nombre = normalizarRaza(raw);
  if (!nombre) {
    throw new Error("Ingresá un nombre de raza válido (letras y números).");
  }
  const existe = (await db
    .prepare(`SELECT 1 AS ok FROM STOCK_GANADERO_RAZA WHERE nombre = ? LIMIT 1`)
    .get(nombre)) as { ok: number } | undefined;
  if (existe) {
    return nombre;
  }
  await db.prepare(`INSERT INTO STOCK_GANADERO_RAZA (nombre) VALUES (?)`).run(nombre);
  return nombre;
}

export async function deleteStockGanaderoRaza(db: Db, raw: string): Promise<string> {
  const nombre = normalizarRaza(raw);
  if (!nombre) {
    throw new Error("Raza inválida");
  }
  const usos = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM STOCK_GANADERO_DISPOSITIVO WHERE raza = ?`
    )
    .get(nombre)) as { n: number | string };
  const nUsos = Number(usos?.n ?? 0);
  if (nUsos > 0) {
    throw new Error(
      `No se puede eliminar «${nombre}»: está asignada a ${nUsos} dispositivo(s).`
    );
  }
  const result = await db
    .prepare(`DELETE FROM STOCK_GANADERO_RAZA WHERE nombre = ?`)
    .run(nombre);
  if (!result.changes) {
    throw new Error(`La raza «${nombre}» no está en el catálogo`);
  }
  return nombre;
}

export async function quitarCabanaSeleccionBulk(
  db: Db,
  claves: string[],
  autor?: HistorialAutor
): Promise<number> {
  let quitados = 0;
  for (const clave of claves) {
    try {
      const ok = await quitarCabanaSeleccionDispositivo(db, clave, autor);
      if (ok) quitados += 1;
    } catch {
      /* omitir claves inválidas */
    }
  }
  return quitados;
}

async function quitarCabanaSeleccionDispositivo(
  db: Db,
  clave: string,
  autor?: HistorialAutor
): Promise<boolean> {
  const claveNorm = normalizarClaveDispositivo(clave);
  const anteriorRow = (await db
    .prepare(
      `SELECT cabana_premium, nombre_cabana FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as
    | Pick<DispositivoMetaRow, "cabana_premium" | "nombre_cabana">
    | undefined;
  if (!anteriorRow || !cabanaPremiumFromRow(anteriorRow.cabana_premium)) {
    return false;
  }

  const prevNombre = normalizarNombreCabana(anteriorRow.nombre_cabana);
  await db.prepare(
    `UPDATE STOCK_GANADERO_DISPOSITIVO
     SET cabana_premium = 0, nombre_cabana = '', actualizado_en = datetime('now', 'localtime')
     WHERE clave = @clave`
  ).run({ clave: claveNorm });

  await insertHistorialFila(
    db,
    claveNorm,
    "nombre_cabana",
    "Animal de cabaña",
    prevNombre || "Premium",
    "—",
    undefined,
    autor
  );

  return true;
}

export async function listStockGanaderoLotes(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<StockGanaderoLote[]> {
  let sql = `SELECT * FROM STOCK_GANADERO_LOTE WHERE 1=1`;
  const params: Record<string, number> = {};
  if (filters?.cuenta_id != null) {
    sql += ` AND cuenta_id = @cuenta_id`;
    params.cuenta_id = filters.cuenta_id;
  }
  sql += ` ORDER BY importado_en DESC, id DESC`;
  return (await db.prepare(sql).all(params)) as StockGanaderoLote[];
}

export async function getStockGanaderoLoteById(
  db: Db,
  id: number
): Promise<StockGanaderoLote | undefined> {
  return (await db
    .prepare("SELECT * FROM STOCK_GANADERO_LOTE WHERE id = ?")
    .get(id)) as StockGanaderoLote | undefined;
}

export async function listStockGanaderoRegistros(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<StockGanaderoRegistro[]> {
  let sql = "SELECT * FROM STOCK_GANADERO_REGISTRO WHERE 1=1";
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);

  sql += " ORDER BY fecha DESC, hora DESC, id DESC";
  let rows = await db.prepare(sql).all(params) as StockGanaderoRegistro[];

  if (filters?.solo_repetidos) {
    const repetidas = await clavesEidRepetidas(db, {
      lote_id: filters.lote_id,
      busqueda: filters.busqueda,
      fecha_desde: filters.fecha_desde,
      fecha_hasta: filters.fecha_hasta,
    });
    rows = rows.filter((r) =>
      repetidas.has(dispositivoClave(r.eid, r.vid))
    );
  }

  return rows.map((r) => {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    return { ...r, eid, vid };
  });
}

export async function getStockGanaderoEstadisticas(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<StockGanaderoEstadisticas> {
  let sql = `SELECT eid, vid FROM STOCK_GANADERO_REGISTRO WHERE 1=1`;
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
  const detalle_repetidos: StockGanaderoEidRepetido[] = [];

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

export async function importStockGanaderoRows(
  db: Db,
  nombreArchivo: string,
  rows: StockGanaderoRowInput[],
  cuentaId?: number | null
): Promise<{ lote_id: number; insertados: number }> {
  if (!rows.length) throw new Error("El archivo no contiene lecturas válidas.");

  return db.transaction(async (tx) => {
    const ultimaLecturaPorClave = await mapUltimaLecturaPorClave(tx);

    const lote = await tx
      .prepare(
        `INSERT INTO STOCK_GANADERO_LOTE (nombre_archivo, filas, cuenta_id) VALUES (@nombre_archivo, @filas, @cuenta_id)`
      )
      .run({
        nombre_archivo: nombreArchivo.trim() || "import.txt",
        filas: rows.length,
        cuenta_id: cuentaId ?? null,
      });
    const lote_id = Number(lote.lastInsertRowid);

    const ins = await tx.prepare(
      `INSERT INTO STOCK_GANADERO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
       VALUES (@lote_id, @eid, @vid, @fecha, @hora, @condicion)`
    );
    const upsertEmpresaDispositivo = await tx.prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO (clave, eid, empresa, sexo, raza, estado)
       VALUES (@clave, @eid, @empresa, @sexo, @raza, 'VIVO')
       ON CONFLICT (clave) DO UPDATE SET
         eid = excluded.eid,
         empresa = CASE WHEN excluded.empresa <> '' THEN excluded.empresa
                        ELSE STOCK_GANADERO_DISPOSITIVO.empresa END,
         sexo = CASE WHEN excluded.sexo <> '' THEN excluded.sexo
                     ELSE STOCK_GANADERO_DISPOSITIVO.sexo END,
         raza = CASE WHEN excluded.raza <> '' THEN excluded.raza
                     ELSE STOCK_GANADERO_DISPOSITIVO.raza END,
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
      const razaImport = normalizarRaza(r.raza);
      if (clave && (empresaImport || sexoImport || razaImport)) {
        await upsertEmpresaDispositivo.run({
          clave,
          eid: r.eid,
          empresa: empresaImport,
          sexo: sexoImport,
          raza: razaImport,
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

export async function deleteStockGanaderoLote(db: Db, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM STOCK_GANADERO_REGISTRO WHERE lote_id = ?").run(id);
    return (await tx.prepare("DELETE FROM STOCK_GANADERO_LOTE WHERE id = ?").run(id)).changes > 0;
  });
}

export async function countStockGanaderoRegistros(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<number> {
  let sql = `SELECT COUNT(*) AS n FROM STOCK_GANADERO_REGISTRO WHERE 1=1`;
  const params: Record<string, string | number> = {};
  sql = appendRegistroFilters(sql, params, filters);
  const row = (await db.prepare(sql).get(params)) as { n: number };
  return row.n;
}

export interface StockGanaderaDispositivo {
  clave: string;
  eid: string;
  vid: string;
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  grupo_libre: string;
  potrero: string;
  raza: string;
  color_caravana: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
  cabana_premium: boolean;
  nombre_cabana: string;
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

export interface StockGanaderaLecturaDetalle extends StockGanaderoRegistro {
  nombre_archivo: string;
}

export interface StockGanaderaDispositivoDetalle extends StockGanaderaDispositivo {
  lecturas: StockGanaderaLecturaDetalle[];
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
      `SELECT id, eid, vid, fecha, hora, condicion FROM STOCK_GANADERO_REGISTRO`
    )
    .all()) as StockGanaderoRegistro[];

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
       FROM STOCK_GANADERO_REGISTRO
       ORDER BY fecha ASC, hora ASC, id ASC`
    )
    .all()) as StockGanaderoRegistro[];

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
  registros: StockGanaderoRegistro[],
  repetidasClaves: Set<string>
): StockGanaderaDispositivo[] {
  const map = new Map<string, StockGanaderaDispositivo>();
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
        raza: "",
        color_caravana: "",
        edad: null,
        nacimiento_mes: null,
        nacimiento_anio: null,
        observaciones: "",
        estado: "VIVO",
        tipo_baja: "",
        numero_guia: "",
        baja_mes: null,
        baja_anio: null,
        cabana_premium: false,
        nombre_cabana: "",
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
  dispositivos: StockGanaderaDispositivo[],
  empresas?: string[]
): StockGanaderaDispositivo[] {
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
  dispositivos: StockGanaderaDispositivo[],
  filters?: StockGanaderoFilters
): StockGanaderaDispositivo[] {
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

export async function listStockGanaderaDispositivos(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<StockGanaderaDispositivo[]> {
  const registros = await listStockGanaderoRegistros(db, filters);
  const repetidas = await clavesEidRepetidas(db, filters);
  let dispositivos = buildDispositivosFromRegistros(registros, repetidas);

  if (filters?.solo_repetidos) {
    dispositivos = dispositivos.filter((d) => d.es_repetido);
  }

  dispositivos = await enrichDispositivosWithMeta(db, dispositivos);
  dispositivos = filtrarDispositivosPorEmpresas(dispositivos, filters?.empresas);
  dispositivos = filtrarYOrdenarBajas(dispositivos, filters);
  if (filters?.busqueda?.trim()) {
    dispositivos = dispositivos.filter((d) =>
      coincideBusquedaDispositivo(d, filters.busqueda!)
    );
  }
  return dispositivos;
}

export async function getStockGanaderaDispositivoDetalle(
  db: Db,
  clave: string,
  filters?: StockGanaderoFilters
): Promise<StockGanaderaDispositivoDetalle | undefined> {
  const claveNorm = clave.replace(/\D/g, "");
  if (!claveNorm) return undefined;

  const rows = (await db
    .prepare(
      `SELECT r.*, l.nombre_archivo
       FROM STOCK_GANADERO_REGISTRO r
       JOIN STOCK_GANADERO_LOTE l ON l.id = r.lote_id
       WHERE 1=1`
    )
    .all()) as StockGanaderaLecturaDetalle[];

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

export async function countStockGanaderaDispositivos(
  db: Db,
  filters?: StockGanaderoFilters
): Promise<number> {
  return (await listStockGanaderaDispositivos(db, filters)).length;
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

export interface StockGanaderaDispositivoHistorial {
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

function fmtHistorialPotrero(v: string): string {
  return v.trim() || "—";
}

function fmtHistorialRaza(v: string): string {
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
        `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
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
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
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
  const prevRaza = fmtHistorialRaza(anterior?.raza ?? "");
  const prevColor = colorDb.etiquetaColorCaravana(anterior?.color_caravana ?? "");
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
  const nextRaza = fmtHistorialRaza(nuevo.raza);
  const nextColor = colorDb.etiquetaColorCaravana(nuevo.color_caravana);
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
  await insertHistorialFila(
    db,
    clave,
    "raza",
    "Raza",
    prevRaza,
    nextRaza,
    undefined,
    autor
  );
  await insertHistorialFila(
    db,
    clave,
    "color_caravana",
    "Color",
    prevColor,
    nextColor,
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

export async function listStockGanaderaDispositivoHistorial(
  db: Db,
  clave: string
): Promise<StockGanaderaDispositivoHistorial[]> {
  const claveNorm = normalizarClaveDispositivo(clave);
  await assertDispositivoExiste(db, claveNorm);

  return (await db
    .prepare(
      `SELECT id, clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en,
              user_id, user_email, user_nombre, origen
       FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = ? AND clave != '__meta__'
       ORDER BY creado_en DESC, id DESC`
    )
    .all(claveNorm)) as StockGanaderaDispositivoHistorial[];
}

export async function listStockGanaderoPotreros(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  return potreroDb.listStockGanaderoPotreros(db, cuentaId);
}

export async function createStockGanaderoPotrero(
  db: Db,
  cuentaId: number,
  nombre: string
): Promise<string> {
  return potreroDb.createStockGanaderoPotrero(db, cuentaId, nombre);
}

export async function listStockGanaderoGrupos(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  return grupoDb.listStockGanaderoGrupos(db, cuentaId);
}

export async function createStockGanaderoGrupo(
  db: Db,
  cuentaId: number,
  nombre: string
): Promise<string> {
  return grupoDb.createStockGanaderoGrupo(db, cuentaId, nombre);
}
