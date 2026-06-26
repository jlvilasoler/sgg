import type { Db } from "./db/pg-client.js";
import type { StockGanaderoRowInput } from "./parse-stock-ganadero-txt.js";
import { listClavesDispositivosEnVentasCerradas } from "./simulador-venta-dispositivos-db.js";
import { labelCategoriaSalidaDispositivo } from "./stock-ganadera-categoria.js";
import { dispositivoClave, eidClave, splitEidVid } from "./stock-ganadero-id.js";

export { dispositivoClave, eidClave, splitEidVid } from "./stock-ganadero-id.js";

export type { StockGanaderoRowInput };

export interface StockGanaderoLote {
  id: number;
  nombre_archivo: string;
  filas: number;
  importado_en: string;
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

export async function initStockGanaderoTables(db: Db): Promise<void> {
  await migrateGrupoLibreColumn(db);
  await migrateBajaMetaColumns(db);
  await migrateFechasSlashLatam(db);
  await migrateStockGanaderoDispositivoHistorial(db);
  await migrateHistorialAutorColumns(db);
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
const GRUPO_RE = /^GEN(\d{4})$/;

function validarGrupo(grupo: string): string {
  const t = grupo.trim().toUpperCase();
  if (!t) return "";
  const m = t.match(GRUPO_RE);
  if (!m) throw new Error("Grupo inválido. Use GEN y un año (2000–actual).");
  const anio = Number(m[1]);
  const maxAnio = new Date().getFullYear();
  if (!Number.isInteger(anio) || anio < GRUPO_ANIO_MIN || anio > maxAnio) {
    throw new Error(`Año de grupo inválido (${GRUPO_ANIO_MIN}–${maxAnio}).`);
  }
  return `GEN${anio}`;
}

function normalizarGrupoAlmacenado(grupo: string | undefined): string {
  if (!grupo?.trim()) return "";
  try {
    return validarGrupo(grupo);
  } catch {
    return "";
  }
}

/** Grupo GEN + año de nacimiento (vacío si no hay año). */
function grupoDesdeNacimiento(anio: number | null): string {
  if (anio === null) return "";
  return validarGrupo(`GEN${anio}`);
}

export type DispositivoSexo = "" | "MACHO" | "HEMBRA";
export type DispositivoEmpresa = "" | "GUAVIYU" | "CHIVILCOY";
export type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO" | "PERDIDO";

export type TipoBaja =
  | "VENTA_FRIGORIFICO"
  | "FRIGORIFICO"
  | "VENTA_PRODUCTOR"
  | "MUERTE"
  | "PERDIDO";

const SEXOS_VALIDOS = new Set<DispositivoSexo>(["", "MACHO", "HEMBRA"]);
const EMPRESAS_VALIDAS = new Set<DispositivoEmpresa>(["", "GUAVIYU", "CHIVILCOY"]);
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

async function mapMetaDispositivos(
  db: Db
): Promise<Map<string, DispositivoMetaGuardada>> {
  const rows = (await db
    .prepare(
      `SELECT clave, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
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
  const empresa = EMPRESAS_VALIDAS.has(row.empresa as DispositivoEmpresa)
    ? (row.empresa as DispositivoEmpresa)
    : "";
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
  const grupo = anio ? grupoDesdeNacimiento(anio) : "";
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
  for (const d of dispositivos) {
    const info = meta.get(d.clave);
    d.sexo = info?.sexo ?? "";
    d.empresa = info?.empresa ?? "";
    d.grupo = info?.grupo ?? "";
    d.grupo_libre = info?.grupo_libre ?? "";
    d.edad = info?.edad ?? null;
    d.nacimiento_mes = info?.nacimiento_mes ?? null;
    d.nacimiento_anio = info?.nacimiento_anio ?? null;
    d.observaciones = info?.observaciones ?? "";
    d.estado = info?.estado ?? "VIVO";
    d.tipo_baja = info?.tipo_baja ?? "";
    d.numero_guia = info?.numero_guia ?? "";
    d.baja_mes = info?.baja_mes ?? null;
    d.baja_anio = info?.baja_anio ?? null;
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

  const empresa = EMPRESAS_VALIDAS.has(input.empresa) ? input.empresa : "";
  if (!EMPRESAS_VALIDAS.has(empresa)) {
    throw new Error("Empresa inválida. Use GUAVIYU o CHIVILCOY.");
  }

  const nacimiento = validarNacimiento(input.nacimiento_mes, input.nacimiento_anio);
  const grupo = grupoDesdeNacimiento(nacimiento.nacimiento_anio);
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

  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
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
       clave, eid, sexo, empresa, grupo, grupo_libre, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @grupo_libre, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @tipo_baja, @numero_guia, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       empresa = excluded.empresa,
       grupo = excluded.grupo,
       grupo_libre = excluded.grupo_libre,
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

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo, autor);

  return {
    sexo,
    empresa,
    grupo,
    grupo_libre,
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

/** Elimina todo el stock ganadero (lecturas, metadatos, historial y vínculos con ventas). */
export async function vaciarStockGanaderaCompleto(db: Db): Promise<VaciarStockGanaderaResult> {
  return db.transaction(async (tx) => {
    const lecturasRow = (await tx
      .prepare(`SELECT COUNT(*) AS n FROM STOCK_GANADERO_REGISTRO`)
      .get()) as { n: number };
    const dispositivosRow = (await tx
      .prepare(
        `SELECT COUNT(*) AS n FROM STOCK_GANADERO_DISPOSITIVO WHERE clave <> '__meta__'`
      )
      .get()) as { n: number };
    const simRow = (await tx
      .prepare(`SELECT COUNT(*) AS n FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO`)
      .get()) as { n: number };

    await tx.prepare(`DELETE FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO`).run();
    await tx.prepare(`DELETE FROM STOCK_GANADERO_REGISTRO`).run();
    await tx
      .prepare(
        `DELETE FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL WHERE clave <> '__meta__'`
      )
      .run();
    await tx
      .prepare(`DELETE FROM STOCK_GANADERO_DISPOSITIVO WHERE clave <> '__meta__'`)
      .run();

    return {
      dispositivos_eliminados: dispositivosRow.n,
      lecturas_eliminadas: lecturasRow.n,
      vinculos_sim_venta: simRow.n,
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
      `SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
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
      `SELECT sexo, empresa, grupo, grupo_libre, nacimiento_mes, nacimiento_anio, observaciones, estado, tipo_baja, numero_guia, baja_mes, baja_anio
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
       eid = CASE WHEN excluded.eid != '' THEN excluded.eid ELSE STOCK_GANADERO_DISPOSITIVO.eid END,
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

export async function countStockGanaderaDispositivosActivos(db: Db): Promise<number> {
  const [dispositivos, ventasClaves] = await Promise.all([
    listStockGanaderaDispositivos(db),
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

export async function listStockGanaderoLotes(db: Db): Promise<StockGanaderoLote[]> {
  return (await db
    .prepare(
      `SELECT * FROM STOCK_GANADERO_LOTE ORDER BY importado_en DESC, id DESC`
    )
    .all()) as StockGanaderoLote[];
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
  rows: StockGanaderoRowInput[]
): Promise<{ lote_id: number; insertados: number }> {
  if (!rows.length) throw new Error("El archivo no contiene lecturas válidas.");

  return db.transaction(async (tx) => {
    const ultimaLecturaPorClave = await mapUltimaLecturaPorClave(tx);

    const lote = await tx
      .prepare(
        `INSERT INTO STOCK_GANADERO_LOTE (nombre_archivo, filas) VALUES (@nombre_archivo, @filas)`
      )
      .run({ nombre_archivo: nombreArchivo.trim() || "import.txt", filas: rows.length });
    const lote_id = Number(lote.lastInsertRowid);

    const ins = await tx.prepare(
      `INSERT INTO STOCK_GANADERO_REGISTRO (lote_id, eid, vid, fecha, hora, condicion)
       VALUES (@lote_id, @eid, @vid, @fecha, @hora, @condicion)`
    );
    const upsertEmpresaDispositivo = await tx.prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO (clave, eid, empresa, sexo, estado)
       VALUES (@clave, @eid, @empresa, @sexo, 'VIVO')
       ON CONFLICT (clave) DO UPDATE SET
         eid = excluded.eid,
         empresa = CASE WHEN excluded.empresa <> '' THEN excluded.empresa
                        ELSE STOCK_GANADERO_DISPOSITIVO.empresa END,
         sexo = CASE WHEN excluded.sexo <> '' THEN excluded.sexo
                     ELSE STOCK_GANADERO_DISPOSITIVO.sexo END,
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

      const empresaImport =
        EMPRESAS_VALIDAS.has(r.empresa as DispositivoEmpresa) && r.empresa
          ? r.empresa
          : "";
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

export async function deleteStockGanaderoLote(db: Db, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.prepare("DELETE FROM STOCK_GANADERO_REGISTRO WHERE lote_id = ?").run(id);
    return (await tx.prepare("DELETE FROM STOCK_GANADERO_LOTE WHERE id = ?").run(id)).changes > 0;
  });
}

export async function countStockGanaderoRegistros(db: Db): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS n FROM STOCK_GANADERO_REGISTRO")
    .get()) as { n: number };
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
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
  tipo_baja: TipoBaja | "";
  numero_guia: string;
  baja_mes: number | null;
  baja_anio: number | null;
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
        edad: null,
        nacimiento_mes: null,
        nacimiento_anio: null,
        observaciones: "",
        estado: "VIVO",
        tipo_baja: "",
        numero_guia: "",
        baja_mes: null,
        baja_anio: null,
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
  return filtrarYOrdenarBajas(dispositivos, filters);
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

  return {
    ...enriquecido,
    lecturas,
    lotes_distintos: lotes.size,
  };
}

export async function countStockGanaderaDispositivos(db: Db): Promise<number> {
  const rows = (await db
    .prepare(`SELECT eid, vid FROM STOCK_GANADERO_REGISTRO`)
    .all()) as { eid: string; vid: string }[];
  const claves = new Set<string>();
  for (const r of rows) {
    const k = dispositivoClave(r.eid, r.vid);
    if (k) claves.add(k);
  }
  return claves.size;
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
