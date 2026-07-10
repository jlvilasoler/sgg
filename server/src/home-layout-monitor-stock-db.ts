import type { Db } from "./db/pg-client.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import * as stockGanadero from "./stock-ganadero-db.js";
import { SIN_EMPRESAS_SCOPE } from "./stock-ganadero-db.js";
import type { StockGanaderaDispositivo } from "./stock-ganadero-db.js";
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

export interface CuentaStockGanaderoMonitorResumen {
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  total: number;
  machos: number;
  hembras: number;
  sin_definir: number;
  categorias: CategoriaStockMonitorFila[];
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
  };
  cuentas: CuentaStockGanaderoMonitorResumen[];
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

function emptySexo(): SexoBucket {
  return { machos: 0, hembras: 0, sin_definir: 0 };
}

function addSexo(bucket: SexoBucket, sexo: string): void {
  if (sexo === "MACHO") bucket.machos += 1;
  else if (sexo === "HEMBRA") bucket.hembras += 1;
  else bucket.sin_definir += 1;
}

function categoriaKey(d: StockGanaderaDispositivo): CategoriaStockMonitorKey {
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

function aggregateActivos(dispositivos: StockGanaderaDispositivo[]): {
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

export async function summarizeStockGanaderoMonitorPlataforma(
  db: Db,
): Promise<HomeLayoutMonitorStockGanaderoSnapshot> {
  const [cuentas, ventasClaves] = await Promise.all([
    empresasCuenta.listEmpresasCuenta(db),
    listClavesDispositivosEnVentasCerradas(db),
  ]);
  const ventas = new Set(ventasClaves);

  const filas: CuentaStockGanaderoMonitorResumen[] = [];
  const totalesSexo = emptySexo();
  const totalesCat = new Map<CategoriaStockMonitorKey, SexoBucket>();
  for (const meta of CATEGORIA_META) totalesCat.set(meta.key, emptySexo());
  let cuentasConStock = 0;

  for (const cuenta of cuentas) {
    const empresas = await empresasCuenta.getEmpresaCodigosActivosPorCuenta(db, cuenta.id);
    const dispositivos = await stockGanadero.listStockGanaderaDispositivos(db, {
      empresas: empresas.length > 0 ? empresas : [SIN_EMPRESAS_SCOPE],
    });
    const activos = dispositivos.filter((d) => d.estado === "VIVO" && !ventas.has(d.clave));
    const agg = aggregateActivos(activos);

    if (agg.sexo.total > 0) cuentasConStock += 1;

    filas.push({
      cuenta_id: cuenta.id,
      cuenta_numero: cuenta.cuenta_numero,
      nombre: cuenta.nombre,
      codigo: cuenta.codigo,
      activo: cuenta.activo,
      total: agg.sexo.total,
      machos: agg.sexo.machos,
      hembras: agg.sexo.hembras,
      sin_definir: agg.sexo.sin_definir,
      categorias: agg.categorias,
    });

    totalesSexo.machos += agg.sexo.machos;
    totalesSexo.hembras += agg.sexo.hembras;
    totalesSexo.sin_definir += agg.sexo.sin_definir;
    mergeCatBuckets(totalesCat, agg.catBuckets);
  }

  filas.sort(
    (a, b) =>
      b.total - a.total ||
      a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  );

  const total = totalesSexo.machos + totalesSexo.hembras + totalesSexo.sin_definir;

  return {
    generado_en: new Date().toISOString(),
    totales: {
      total,
      machos: totalesSexo.machos,
      hembras: totalesSexo.hembras,
      sin_definir: totalesSexo.sin_definir,
      cuentas_con_stock: cuentasConStock,
      categorias: buildCategorias(totalesCat, true),
    },
    cuentas: filas,
  };
}
