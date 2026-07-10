import type { Db } from "./db/pg-client.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import * as stockGanadero from "./stock-ganadero-db.js";
import type { StockGanaderaDispositivo } from "./stock-ganadero-db.js";
import * as stockEquino from "./stock-equino-db.js";
import type { StockEquinaDispositivo } from "./stock-equino-db.js";
import { listClavesDispositivosEnVentasCerradas } from "./simulador-venta-dispositivos-db.js";

export type CategoriaStockMonitorKey =
  | "TERNERA"
  | "VAQUILLONA_1_2"
  | "VAQUILLONA_MAS_2"
  | "VACA"
  | "TERNERO"
  | "MACHO_1_2"
  | "MACHO_MAS_2"
  | "SIN_SEXO"
  | "SIN_EDAD";

export interface CategoriaStockMonitorFila {
  key: CategoriaStockMonitorKey;
  label: string;
  grupo: "hembra" | "macho" | "otro";
  machos: number;
  hembras: number;
  sin_definir: number;
  total: number;
}

export interface StockEspecieMonitorResumen {
  total: number;
  machos: number;
  hembras: number;
  sin_definir: number;
  categorias: CategoriaStockMonitorFila[];
}

export interface CuentaStockGanaderoMonitorResumen {
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  /** Ganadero activo (compatibilidad con UI existente). */
  total: number;
  machos: number;
  hembras: number;
  sin_definir: number;
  categorias: CategoriaStockMonitorFila[];
  equino: StockEspecieMonitorResumen;
  total_animales: number;
}

export interface HomeLayoutMonitorStockGanaderoSnapshot {
  generado_en: string;
  totales: {
    total: number;
    machos: number;
    hembras: number;
    sin_definir: number;
    cuentas_con_stock: number;
    categorias: CategoriaStockMonitorFila[];
    equino: StockEspecieMonitorResumen & { cuentas_con_stock: number };
    total_animales: number;
  };
  cuentas: CuentaStockGanaderoMonitorResumen[];
}

export interface HomeLayoutMonitorStockCuentaDetalle {
  generado_en: string;
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  ganadero: StockEspecieMonitorResumen;
  equino: StockEspecieMonitorResumen;
  total_animales: number;
}

const MACHO_FRONTERA_TERNERO = 12;
const MACHO_FRONTERA_NOVILLO = 24;
const HEMBRA_FRONTERA_TERNERA = 12;
const HEMBRA_FRONTERA_VAQUILLONA = 24;
const HEMBRA_FRONTERA_VAQUILLONA_MAS_2 = 36;

const CATEGORIA_META: {
  key: CategoriaStockMonitorKey;
  label: string;
  grupo: CategoriaStockMonitorFila["grupo"];
}[] = [
  { key: "TERNERA", label: "Ternera", grupo: "hembra" },
  { key: "VAQUILLONA_1_2", label: "Vaquillona 1–2", grupo: "hembra" },
  { key: "VAQUILLONA_MAS_2", label: "Vaquillona +2", grupo: "hembra" },
  { key: "VACA", label: "Vaca", grupo: "hembra" },
  { key: "TERNERO", label: "Ternero", grupo: "macho" },
  { key: "MACHO_1_2", label: "Novillo / Toro 1–2", grupo: "macho" },
  { key: "MACHO_MAS_2", label: "Novillo / Toro +2", grupo: "macho" },
  { key: "SIN_SEXO", label: "Sin sexo definido", grupo: "otro" },
  { key: "SIN_EDAD", label: "Sin fecha de nacimiento", grupo: "otro" },
];

type SexoBucket = { machos: number; hembras: number; sin_definir: number };

type DispositivoStockMonitor = {
  sexo: string;
  edad: number | null;
  nacimiento_mes: number | null;
  nacimiento_anio: number | null;
};

function emptySexo(): SexoBucket {
  return { machos: 0, hembras: 0, sin_definir: 0 };
}

function emptyEspecie(): StockEspecieMonitorResumen {
  return { total: 0, machos: 0, hembras: 0, sin_definir: 0, categorias: [] };
}

function addSexo(bucket: SexoBucket, sexo: string): void {
  if (sexo === "MACHO") bucket.machos += 1;
  else if (sexo === "HEMBRA") bucket.hembras += 1;
  else bucket.sin_definir += 1;
}

function categoriaKey(d: DispositivoStockMonitor): CategoriaStockMonitorKey {
  if (!d.sexo) return "SIN_SEXO";
  if (!d.nacimiento_mes || !d.nacimiento_anio) return "SIN_EDAD";
  if (d.edad === null || d.edad === undefined) return "SIN_EDAD";

  const meses = d.edad;
  if (d.sexo === "HEMBRA") {
    if (meses < HEMBRA_FRONTERA_TERNERA) return "TERNERA";
    if (meses < HEMBRA_FRONTERA_VAQUILLONA) return "VAQUILLONA_1_2";
    if (meses < HEMBRA_FRONTERA_VAQUILLONA_MAS_2) return "VAQUILLONA_MAS_2";
    return "VACA";
  }
  if (d.sexo === "MACHO") {
    if (meses < MACHO_FRONTERA_TERNERO) return "TERNERO";
    if (meses < MACHO_FRONTERA_NOVILLO) return "MACHO_1_2";
    return "MACHO_MAS_2";
  }
  return "SIN_SEXO";
}

function buildCategorias(
  buckets: Map<CategoriaStockMonitorKey, SexoBucket>,
  onlyWithStock: boolean,
): CategoriaStockMonitorFila[] {
  const rows: CategoriaStockMonitorFila[] = [];
  for (const meta of CATEGORIA_META) {
    const b = buckets.get(meta.key) ?? emptySexo();
    const total = b.machos + b.hembras + b.sin_definir;
    if (onlyWithStock && total === 0) continue;
    rows.push({
      ...meta,
      machos: b.machos,
      hembras: b.hembras,
      sin_definir: b.sin_definir,
      total,
    });
  }
  return rows;
}

function aggregateActivos(dispositivos: DispositivoStockMonitor[]): {
  sexo: SexoBucket & { total: number };
  categorias: CategoriaStockMonitorFila[];
  catBuckets: Map<CategoriaStockMonitorKey, SexoBucket>;
} {
  const sexo = emptySexo();
  const catBuckets = new Map<CategoriaStockMonitorKey, SexoBucket>();
  for (const meta of CATEGORIA_META) catBuckets.set(meta.key, emptySexo());

  for (const d of dispositivos) {
    addSexo(sexo, d.sexo);
    const key = categoriaKey(d);
    const bucket = catBuckets.get(key) ?? emptySexo();
    addSexo(bucket, d.sexo);
    catBuckets.set(key, bucket);
  }

  return {
    sexo: {
      ...sexo,
      total: sexo.machos + sexo.hembras + sexo.sin_definir,
    },
    categorias: buildCategorias(catBuckets, true),
    catBuckets,
  };
}

function toEspecieResumen(agg: ReturnType<typeof aggregateActivos>): StockEspecieMonitorResumen {
  return {
    total: agg.sexo.total,
    machos: agg.sexo.machos,
    hembras: agg.sexo.hembras,
    sin_definir: agg.sexo.sin_definir,
    categorias: agg.categorias,
  };
}

function mergeCatBuckets(
  into: Map<CategoriaStockMonitorKey, SexoBucket>,
  from: Map<CategoriaStockMonitorKey, SexoBucket>,
): void {
  for (const [key, b] of from) {
    const cur = into.get(key) ?? emptySexo();
    cur.machos += b.machos;
    cur.hembras += b.hembras;
    cur.sin_definir += b.sin_definir;
    into.set(key, cur);
  }
}

function mergeEspecieTotales(
  into: StockEspecieMonitorResumen & { cuentas_con_stock: number },
  from: StockEspecieMonitorResumen,
  cuentaTieneStock: boolean,
): void {
  into.machos += from.machos;
  into.hembras += from.hembras;
  into.sin_definir += from.sin_definir;
  into.total += from.total;
  if (cuentaTieneStock) into.cuentas_con_stock += 1;
}

async function listActivosGanaderoPorCuenta(
  db: Db,
  cuentaId: number,
  ventas: Set<string>,
): Promise<StockGanaderaDispositivo[]> {
  const dispositivos = await stockGanadero.listStockGanaderaDispositivosPorCuenta(db, cuentaId);
  return dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
}

async function listActivosEquinoPorCuenta(
  db: Db,
  cuentaId: number,
): Promise<StockEquinaDispositivo[]> {
  const dispositivos = await stockEquino.listStockEquinaDispositivosPorCuenta(db, cuentaId);
  return dispositivos.filter((d) => d.estado === "VIVO");
}

async function summarizeStockPorCuenta(
  db: Db,
  cuentaId: number,
  ventas: Set<string>,
): Promise<{
  ganadero: StockEspecieMonitorResumen;
  equino: StockEspecieMonitorResumen;
  ganaderoCatBuckets: Map<CategoriaStockMonitorKey, SexoBucket>;
}> {
  const [ganaderoActivos, equinoActivos] = await Promise.all([
    listActivosGanaderoPorCuenta(db, cuentaId, ventas),
    listActivosEquinoPorCuenta(db, cuentaId),
  ]);
  const ganaderoAgg = aggregateActivos(ganaderoActivos);
  const equinoAgg = aggregateActivos(equinoActivos);
  return {
    ganadero: toEspecieResumen(ganaderoAgg),
    equino: toEspecieResumen(equinoAgg),
    ganaderoCatBuckets: ganaderoAgg.catBuckets,
  };
}

export async function summarizeStockGanaderoMonitorPlataforma(
  db: Db,
): Promise<HomeLayoutMonitorStockGanaderoSnapshot> {
  const [cuentas, ventasClaves, allGanaderoRaw, allEquinoRaw] = await Promise.all([
    empresasCuenta.listEmpresasCuenta(db),
    listClavesDispositivosEnVentasCerradas(db),
    stockGanadero.listStockGanaderaDispositivos(db),
    stockEquino.listStockEquinaDispositivos(db),
  ]);
  const ventas = new Set(ventasClaves);
  const allGanadero = allGanaderoRaw.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
  const allEquino = allEquinoRaw.filter((d) => d.estado === "VIVO");

  const scopes = await Promise.all(
    cuentas.map(async (cuenta) => ({
      cuenta,
      ganadero: await stockGanadero.getStockGanaderoCuentaScope(db, cuenta.id),
      equino: await stockEquino.getStockEquinoCuentaScope(db, cuenta.id),
    })),
  );

  const filas: CuentaStockGanaderoMonitorResumen[] = [];
  const totalesSexo = emptySexo();
  const totalesCat = new Map<CategoriaStockMonitorKey, SexoBucket>();
  for (const meta of CATEGORIA_META) totalesCat.set(meta.key, emptySexo());
  const totalesEquino: StockEspecieMonitorResumen & { cuentas_con_stock: number } = {
    ...emptyEspecie(),
    cuentas_con_stock: 0,
  };
  let cuentasConStock = 0;

  for (const { cuenta, ganadero: gScope, equino: eScope } of scopes) {
    const ganaderoActivos = allGanadero.filter((d) =>
      stockGanadero.stockGanaderoDispositivoEnCuenta(d, gScope),
    );
    const equinoActivos = allEquino.filter((d) =>
      stockEquino.stockEquinoDispositivoEnCuenta(d, eScope),
    );
    const ganaderoAgg = aggregateActivos(ganaderoActivos);
    const equinoAgg = aggregateActivos(equinoActivos);
    const ganadero = toEspecieResumen(ganaderoAgg);
    const equino = toEspecieResumen(equinoAgg);

    const tieneStock = ganadero.total > 0 || equino.total > 0;
    if (tieneStock) cuentasConStock += 1;

    filas.push({
      cuenta_id: cuenta.id,
      cuenta_numero: cuenta.cuenta_numero,
      nombre: cuenta.nombre,
      codigo: cuenta.codigo,
      activo: cuenta.activo,
      total: ganadero.total,
      machos: ganadero.machos,
      hembras: ganadero.hembras,
      sin_definir: ganadero.sin_definir,
      categorias: ganadero.categorias,
      equino,
      total_animales: ganadero.total + equino.total,
    });

    totalesSexo.machos += ganadero.machos;
    totalesSexo.hembras += ganadero.hembras;
    totalesSexo.sin_definir += ganadero.sin_definir;
    mergeCatBuckets(totalesCat, ganaderoAgg.catBuckets);
    mergeEspecieTotales(totalesEquino, equino, equino.total > 0);
  }

  filas.sort(
    (a, b) =>
      b.total_animales - a.total_animales ||
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  const totalGanadero = totalesSexo.machos + totalesSexo.hembras + totalesSexo.sin_definir;

  return {
    generado_en: new Date().toISOString(),
    totales: {
      total: totalGanadero,
      machos: totalesSexo.machos,
      hembras: totalesSexo.hembras,
      sin_definir: totalesSexo.sin_definir,
      cuentas_con_stock: cuentasConStock,
      categorias: buildCategorias(totalesCat, true),
      equino: totalesEquino,
      total_animales: totalGanadero + totalesEquino.total,
    },
    cuentas: filas,
  };
}

export async function getHomeLayoutMonitorStockCuenta(
  db: Db,
  cuentaId: number,
): Promise<HomeLayoutMonitorStockCuentaDetalle | null> {
  const cuenta = await empresasCuenta.getEmpresaCuentaById(db, cuentaId);
  if (!cuenta) return null;

  const ventasClaves = await listClavesDispositivosEnVentasCerradas(db);
  const ventas = new Set(ventasClaves);
  const { ganadero, equino } = await summarizeStockPorCuenta(db, cuentaId, ventas);

  return {
    generado_en: new Date().toISOString(),
    cuenta_id: cuenta.id,
    cuenta_numero: cuenta.cuenta_numero,
    nombre: cuenta.nombre,
    codigo: cuenta.codigo,
    activo: cuenta.activo,
    ganadero,
    equino,
    total_animales: ganadero.total + equino.total,
  };
}
