import type { Db } from "./db/pg-client.js";
import type { StockGanaderoRowInput } from "./parse-stock-ganadero-txt.js";
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

export async function initStockGanaderoTables(_db: Db): Promise<void> {}

async function migrateSyncGrupoDesdeNacimiento(_db: Db): Promise<void> {}

async function migrateStockGanaderoDispositivoHistorial(_db: Db): Promise<void> {}

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
export type DispositivoEstado = "VIVO" | "MUERTO" | "VENDIDO" | "FRIGORIFICO";

const SEXOS_VALIDOS = new Set<DispositivoSexo>(["", "MACHO", "HEMBRA"]);
const EMPRESAS_VALIDAS = new Set<DispositivoEmpresa>(["", "GUAVIYU", "CHIVILCOY"]);
const ESTADOS_VALIDOS = new Set<DispositivoEstado>([
  "VIVO",
  "MUERTO",
  "VENDIDO",
  "FRIGORIFICO",
]);

export interface DispositivoMetaInput {
  sexo: DispositivoSexo;
  empresa: DispositivoEmpresa;
  grupo: string;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
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
  sexo: string;
  empresa: string;
  grupo: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: string;
  baja_mes: number | null;
  baja_anio: number | null;
}

async function mapMetaDispositivos(
  db: Db
): Promise<Map<string, DispositivoMetaGuardada>> {
  const rows = (await db
    .prepare(
      `SELECT clave, sexo, empresa, grupo, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio
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
    estado === "MUERTO" || estado === "VENDIDO" || estado === "FRIGORIFICO"
      ? { baja_mes: bajaMes, baja_anio: bajaAnio }
      : { baja_mes: null, baja_anio: null };
  return aplicarEdadCalculada({
    sexo,
    empresa,
    grupo,
    nacimiento_mes: mes,
    nacimiento_anio: anio,
    observaciones: String(row.observaciones ?? "").trim(),
    estado,
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
    d.edad = info?.edad ?? null;
    d.nacimiento_mes = info?.nacimiento_mes ?? null;
    d.nacimiento_anio = info?.nacimiento_anio ?? null;
    d.observaciones = info?.observaciones ?? "";
    d.estado = info?.estado ?? "VIVO";
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
  if (estado !== "MUERTO" && estado !== "VENDIDO" && estado !== "FRIGORIFICO") {
    return { baja_mes: null, baja_anio: null };
  }
  if (mes === null || anio === null) {
    const etiqueta =
      estado === "MUERTO"
        ? "muerte"
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
  eid = ""
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
  const estadoRaw = String(input.estado ?? "VIVO").toUpperCase();
  if (!ESTADOS_VALIDOS.has(estadoRaw as DispositivoEstado)) {
    throw new Error("Estado inválido. Use VIVO, MUERTO, VENDIDO o FRIGORIFICO.");
  }
  const estado = estadoRaw as DispositivoEstado;
  const baja = validarFechaBaja(
    estado,
    input.baja_mes,
    input.baja_anio,
    nacimiento.nacimiento_mes,
    nacimiento.nacimiento_anio
  );
  const eidGuardar = eid.trim() || claveNorm;

  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio
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
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    edad,
  };

  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       sexo = excluded.sexo,
       empresa = excluded.empresa,
       grupo = excluded.grupo,
       edad = excluded.edad,
       nacimiento_mes = excluded.nacimiento_mes,
       nacimiento_anio = excluded.nacimiento_anio,
       observaciones = excluded.observaciones,
       estado = excluded.estado,
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
    edad,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
  });

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo);

  return {
    sexo,
    empresa,
    grupo,
    edad,
    nacimiento_mes: nacimiento.nacimiento_mes,
    nacimiento_anio: nacimiento.nacimiento_anio,
    observaciones,
    estado,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
  };
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

async function aplicarBajaDispositivo(
  db: Db,
  claveNorm: string,
  eid: string,
  estado: "VENDIDO" | "FRIGORIFICO",
  baja_mes: number,
  baja_anio: number
): Promise<void> {
  const anteriorRow = (await db
    .prepare(
      `SELECT sexo, empresa, grupo, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio
       FROM STOCK_GANADERO_DISPOSITIVO WHERE clave = ?`
    )
    .get(claveNorm)) as Partial<DispositivoMetaRow> | undefined;
  const anterior = anteriorRow ? normalizarMetaDispositivo(anteriorRow) : null;
  const nacimiento_mes = anterior?.nacimiento_mes ?? null;
  const nacimiento_anio = anterior?.nacimiento_anio ?? null;
  const baja = validarFechaBaja(
    estado,
    baja_mes,
    baja_anio,
    nacimiento_mes,
    nacimiento_anio
  );
  const edad = calcularEdadMeses(nacimiento_mes, nacimiento_anio);
  const eidGuardar = eid.trim() || claveNorm;

  const nuevo: DispositivoMetaGuardada = {
    sexo: anterior?.sexo ?? "",
    empresa: anterior?.empresa ?? "",
    grupo: anterior?.grupo ?? "",
    nacimiento_mes,
    nacimiento_anio,
    observaciones: anterior?.observaciones ?? "",
    estado,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
    edad,
  };

  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO (
       clave, eid, sexo, empresa, grupo, edad, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio, actualizado_en
     ) VALUES (
       @clave, @eid, @sexo, @empresa, @grupo, @edad, @nacimiento_mes, @nacimiento_anio, @observaciones, @estado, @baja_mes, @baja_anio,
       datetime('now', 'localtime')
     )
     ON CONFLICT(clave) DO UPDATE SET
       estado = excluded.estado,
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
    observaciones: nuevo.observaciones,
    estado,
    baja_mes: baja.baja_mes,
    baja_anio: baja.baja_anio,
  });

  await registrarHistorialCambiosDispositivo(db, claveNorm, anterior, nuevo);
}

export interface ImportBajaDispositivosResult {
  actualizados: number;
  no_encontrados: number;
  duplicados_omitidos: number;
  muestra_no_encontrados: string[];
}

export async function importBajaDispositivos(
  db: Db,
  rows: StockGanaderoRowInput[],
  estado: "VENDIDO" | "FRIGORIFICO"
): Promise<ImportBajaDispositivosResult> {
  if (!rows.length) throw new Error("El archivo no contiene dispositivos válidos.");
  if (estado !== "VENDIDO" && estado !== "FRIGORIFICO") {
    throw new Error("Estado inválido. Use VENDIDO o FRIGORIFICO.");
  }

  const registradas = await clavesRegistradasSet(db);
  const vistos = new Set<string>();
  let actualizados = 0;
  let no_encontrados = 0;
  let duplicados_omitidos = 0;
  const muestra_no_encontrados: string[] = [];

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

      await aplicarBajaDispositivo(
        tx,
        claveNorm,
        row.eid,
        estado,
        fechaBaja.mes,
        fechaBaja.anio
      );
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
    muestra_no_encontrados,
  };
}

export async function updateStockGanaderaDispositivoSexo(
  db: Db,
  clave: string,
  sexo: DispositivoSexo,
  eid = ""
): Promise<DispositivoSexo> {
  const claveNorm = normalizarClaveDispositivo(clave);
  if (!SEXOS_VALIDOS.has(sexo)) throw new Error("Sexo inválido. Use MACHO o HEMBRA.");
  await assertDispositivoExiste(db, claveNorm);

  const anteriorRow = (await db
    .prepare(`SELECT sexo, empresa, grupo, nacimiento_mes, nacimiento_anio, observaciones, estado, baja_mes, baja_anio
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
      edad: anterior?.edad ?? null,
      nacimiento_mes: anterior?.nacimiento_mes ?? null,
      nacimiento_anio: anterior?.nacimiento_anio ?? null,
      observaciones: anterior?.observaciones ?? "",
      estado: anterior?.estado ?? "VIVO",
      baja_mes: anterior?.baja_mes ?? null,
      baja_anio: anterior?.baja_anio ?? null,
    });
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
    for (const r of rows) {
      await ins.run({
        lote_id,
        eid: r.eid,
        vid: r.vid,
        fecha: r.fecha,
        hora: r.hora,
        condicion: r.condicion,
      });
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
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
  observaciones: string;
  estado: DispositivoEstado;
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

function compareFechaHora(
  a: { fecha: string; hora: string },
  b: { fecha: string; hora: string }
): number {
  const fa = a.fecha || "";
  const fb = b.fecha || "";
  if (fa !== fb) return fa.localeCompare(fb);
  return (a.hora || "").localeCompare(b.hora || "");
}

function buildDispositivosFromRegistros(
  registros: StockGanaderoRegistro[],
  repetidasClaves: Set<string>
): StockGanaderaDispositivo[] {
  const map = new Map<string, StockGanaderaDispositivo>();

  for (const r of registros) {
    const { eid, vid } = splitEidVid(r.eid, r.vid);
    const clave = dispositivoClave(eid, vid);
    if (!clave) continue;

    const prev = map.get(clave);
    if (!prev) {
      map.set(clave, {
        clave,
        eid,
        vid,
        sexo: "",
        empresa: "",
        grupo: "",
        edad: null,
        nacimiento_mes: null,
        nacimiento_anio: null,
        observaciones: "",
        estado: "VIVO",
        baja_mes: null,
        baja_anio: null,
        primera_fecha: r.fecha,
        ultima_fecha: r.fecha,
        ultima_hora: r.hora,
        ultima_condicion: r.condicion,
        total_lecturas: 1,
        es_repetido: repetidasClaves.has(clave),
      });
      continue;
    }

    prev.total_lecturas += 1;
    if (vid && !prev.vid) prev.vid = vid;

    if (compareFechaHora(r, { fecha: prev.primera_fecha, hora: "" }) < 0) {
      prev.primera_fecha = r.fecha;
    }

    if (
      compareFechaHora(r, {
        fecha: prev.ultima_fecha,
        hora: prev.ultima_hora,
      }) >= 0
    ) {
      prev.ultima_fecha = r.fecha;
      prev.ultima_hora = r.hora;
      prev.ultima_condicion = r.condicion;
      if (vid) prev.vid = vid;
      prev.eid = eid;
    }

    prev.es_repetido = repetidasClaves.has(clave);
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

function fmtHistorialFechaBaja(
  estado: DispositivoEstado,
  mes: number | null,
  anio: number | null
): string {
  if (estado !== "MUERTO" && estado !== "VENDIDO" && estado !== "FRIGORIFICO") {
    return "—";
  }
  if (!mes || !anio) return "—";
  const nombre = MESES_HISTORIAL[mes] ?? String(mes);
  const pref =
    estado === "MUERTO"
      ? "Muerte"
      : estado === "VENDIDO"
        ? "Venta"
        : "Frigorífico";
  return `${pref}: ${nombre} ${anio}`;
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

async function insertHistorialFila(
  db: Db,
  clave: string,
  campo: string,
  etiqueta: string,
  valorAnterior: string,
  valorNuevo: string
): Promise<void> {
  if (valorAnterior === valorNuevo) return;
  await db.prepare(
    `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       (clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en)
     VALUES (@clave, @campo, @etiqueta, @valor_anterior, @valor_nuevo,
             datetime('now', 'localtime'))`
  ).run({
    clave,
    campo,
    etiqueta,
    valor_anterior: valorAnterior,
    valor_nuevo: valorNuevo,
  });
}

async function registrarHistorialCambiosDispositivo(
  db: Db,
  clave: string,
  anterior: DispositivoMetaGuardada | null,
  nuevo: DispositivoMetaGuardada
): Promise<void> {
  const prevEmpresa = fmtHistorialEmpresa(anterior?.empresa ?? "");
  const prevGrupo = fmtHistorialGrupo(anterior?.grupo ?? "");
  const prevSexo = fmtHistorialSexo(anterior?.sexo ?? "");
  const prevNac = fmtHistorialNacimiento(
    anterior?.nacimiento_mes ?? null,
    anterior?.nacimiento_anio ?? null
  );
  const prevObs = fmtHistorialObs(anterior?.observaciones ?? "");
  const prevEstado = fmtHistorialEstado(anterior?.estado ?? "VIVO");
  const prevBaja = fmtHistorialFechaBaja(
    anterior?.estado ?? "VIVO",
    anterior?.baja_mes ?? null,
    anterior?.baja_anio ?? null
  );

  const nextEmpresa = fmtHistorialEmpresa(nuevo.empresa);
  const nextGrupo = fmtHistorialGrupo(nuevo.grupo);
  const nextSexo = fmtHistorialSexo(nuevo.sexo);
  const nextNac = fmtHistorialNacimiento(
    nuevo.nacimiento_mes,
    nuevo.nacimiento_anio
  );
  const nextObs = fmtHistorialObs(nuevo.observaciones);
  const nextEstado = fmtHistorialEstado(nuevo.estado);
  const nextBaja = fmtHistorialFechaBaja(
    nuevo.estado,
    nuevo.baja_mes,
    nuevo.baja_anio
  );

  await insertHistorialFila(db, clave, "empresa", "Empresa", prevEmpresa, nextEmpresa);
  await insertHistorialFila(db, clave, "grupo", "Grupo", prevGrupo, nextGrupo);
  await insertHistorialFila(db, clave, "sexo", "Sexo", prevSexo, nextSexo);
  await insertHistorialFila(
    db,
    clave,
    "nacimiento",
    "Fecha de nacimiento",
    prevNac,
    nextNac
  );
  await insertHistorialFila(
    db,
    clave,
    "observaciones",
    "Observaciones",
    prevObs,
    nextObs
  );
  await insertHistorialFila(db, clave, "estado", "Estado", prevEstado, nextEstado);
  await insertHistorialFila(
    db,
    clave,
    "fecha_baja",
    "Muerte / Venta / Frigorífico",
    prevBaja,
    nextBaja
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
      `SELECT id, clave, campo, etiqueta, valor_anterior, valor_nuevo, creado_en
       FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = ?
       ORDER BY creado_en DESC, id DESC`
    )
    .all(claveNorm)) as StockGanaderaDispositivoHistorial[];
}
