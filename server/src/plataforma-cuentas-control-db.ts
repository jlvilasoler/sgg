import type { Db } from "./db/pg-client.js";
import * as empresasCuenta from "./empresas-cuenta-db.js";
import * as stockGanadero from "./stock-ganadero-db.js";
import { SIN_EMPRESAS_SCOPE } from "./stock-ganadero-db.js";
import * as stockEquino from "./stock-equino-db.js";

export interface CuentaControlResumen {
  cuenta_id: number;
  cuenta_numero: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  animales_ganadero: number;
  animales_equino: number;
  animales_total: number;
  gastos_registros: number;
  gastos_pesos: number;
}

export interface CuentasControlPlataformaResumen {
  cuentas: CuentaControlResumen[];
  totales: {
    animales_ganadero: number;
    animales_equino: number;
    animales_total: number;
    gastos_registros: number;
    gastos_pesos: number;
  };
}

function pgNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getEmpresaNombresPorCuenta(db: Db, cuentaId: number): Promise<string[]> {
  const rows = (await db
    .prepare(`SELECT nombre FROM EMPRESAS_OPERATIVAS WHERE cuenta_id = ? ORDER BY LOWER(nombre) ASC`)
    .all(cuentaId)) as { nombre: string }[];
  return rows.map((r) => String(r.nombre ?? "").trim()).filter(Boolean);
}

async function countGastosPorEmpresas(
  db: Db,
  empresasNombres: string[]
): Promise<{ registros: number; pesos: number }> {
  if (empresasNombres.length === 0) return { registros: 0, pesos: 0 };
  const placeholders = empresasNombres.map(() => "?").join(", ");
  const row = (await db
    .prepare(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(pesos), 0) AS pesos
       FROM PRESUPUESTO WHERE empresa IN (${placeholders})`
    )
    .get(...empresasNombres)) as { n: number; pesos: number } | undefined;
  return {
    registros: pgNum(row?.n),
    pesos: pgNum(row?.pesos),
  };
}

async function countAnimalesGanadero(db: Db, cuentaId: number): Promise<number> {
  const empresas = await empresasCuenta.getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  return stockGanadero.countStockGanaderaDispositivos(db, {
    empresas: empresas.length > 0 ? empresas : [SIN_EMPRESAS_SCOPE],
  });
}

async function countAnimalesEquino(db: Db, cuentaId: number): Promise<number> {
  const empresas = await empresasCuenta.getEmpresaCodigosActivosPorCuenta(db, cuentaId);
  return stockEquino.countStockEquinaDispositivos(db, {
    empresas: empresas.length > 0 ? empresas : [SIN_EMPRESAS_SCOPE],
  });
}

export async function summarizeCuentasControlPlataforma(
  db: Db
): Promise<CuentasControlPlataformaResumen> {
  const cuentas = await empresasCuenta.listEmpresasCuenta(db);
  const filas: CuentaControlResumen[] = [];

  let animales_ganadero = 0;
  let animales_equino = 0;
  let gastos_registros = 0;
  let gastos_pesos = 0;

  for (const cuenta of cuentas) {
    const [ganadero, equino, gastos] = await Promise.all([
      countAnimalesGanadero(db, cuenta.id),
      countAnimalesEquino(db, cuenta.id),
      countGastosPorEmpresas(db, await getEmpresaNombresPorCuenta(db, cuenta.id)),
    ]);

    const animales_total = ganadero + equino;
    filas.push({
      cuenta_id: cuenta.id,
      cuenta_numero: cuenta.cuenta_numero,
      nombre: cuenta.nombre,
      codigo: cuenta.codigo,
      activo: cuenta.activo,
      animales_ganadero: ganadero,
      animales_equino: equino,
      animales_total,
      gastos_registros: gastos.registros,
      gastos_pesos: gastos.pesos,
    });

    animales_ganadero += ganadero;
    animales_equino += equino;
    gastos_registros += gastos.registros;
    gastos_pesos += gastos.pesos;
  }

  return {
    cuentas: filas,
    totales: {
      animales_ganadero,
      animales_equino,
      animales_total: animales_ganadero + animales_equino,
      gastos_registros,
      gastos_pesos,
    },
  };
}
