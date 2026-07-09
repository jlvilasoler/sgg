import type { Db } from "./db/pg-client.js";
import type { Presupuesto } from "./types.js";
import {
  formatCedulaDisplay,
  getFuncionarioByCedula,
  listFuncionarios,
  normalizeCedula,
  type Funcionario,
} from "./funcionarios-db.js";

export type VinculoPago = "explicito" | "rubro" | "concepto";

export interface PagoFuncionario {
  id: number;
  nro_registro: number;
  fecha: string;
  empresa: string;
  codigo_proveedor: string;
  razon_social_proveedor: string;
  concepto: string;
  rubro: string;
  sub_rubro: string;
  nro_factura: string;
  pesos: number;
  dolares_usd: number;
  reales: number;
  tc_usd: number;
  tc_reales: number;
  saldo_usd: number;
  vinculo: VinculoPago;
}

export interface ResumenRubroPago {
  rubro: string;
  sub_rubro: string;
  cantidad: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
}

export interface ResumenAnioPago {
  anio: string;
  cantidad: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
}

export interface ResumenPagosFuncionario {
  cedula: string;
  cedula_display: string;
  funcionario: Funcionario | null;
  total_registros: number;
  total_pesos: number;
  total_usd: number;
  total_reales: number;
  total_saldo_usd: number;
  por_rubro: ResumenRubroPago[];
  por_anio: ResumenAnioPago[];
  pagos: PagoFuncionario[];
}

const RUBRO_SUELDO_SQL = `(
  lower(rubro) LIKE '%sueldo%' OR lower(rubro) LIKE '%jornal%'
  OR lower(rubro) LIKE '%remunerac%' OR lower(rubro) LIKE '%carga%social%'
  OR lower(rubro) LIKE '%personal%'
  OR lower(sub_rubro) LIKE '%sueldo%' OR lower(sub_rubro) LIKE '%jornal%'
  OR lower(sub_rubro) LIKE '%aguinald%' OR lower(sub_rubro) LIKE '%bonific%'
  OR lower(sub_rubro) LIKE '%vacacional%' OR lower(sub_rubro) LIKE '%salario%'
)`;

function clasificarVinculo(
  row: Presupuesto,
  cedulaNorm: string,
  funcionario: Funcionario | null
): VinculoPago | null {
  const fc = normalizeCedula(row.funcionario_cedula ?? "");
  if (fc && fc === cedulaNorm) return "explicito";

  const concepto = (row.concepto ?? "").toLowerCase();
  const razon = (row.razon_social_proveedor ?? "").toLowerCase();
  const rubro = (row.rubro ?? "").toLowerCase();
  const sub = (row.sub_rubro ?? "").toLowerCase();

  const esRubroSueldo =
    rubro.includes("sueldo") ||
    rubro.includes("jornal") ||
    rubro.includes("remunerac") ||
    rubro.includes("carga") ||
    rubro.includes("personal") ||
    sub.includes("sueldo") ||
    sub.includes("jornal") ||
    sub.includes("aguinald") ||
    sub.includes("bonific") ||
    sub.includes("vacacional") ||
    sub.includes("salario");

  if (concepto.includes(cedulaNorm)) return "concepto";

  if (funcionario) {
    const nom = funcionario.nombre.toLowerCase();
    const ape = funcionario.apellido.toLowerCase();
    const full = `${nom} ${ape}`;
    const fullRev = `${ape} ${nom}`;
    if (
      concepto.includes(full) ||
      concepto.includes(fullRev) ||
      razon.includes(full) ||
      razon.includes(fullRev) ||
      razon.includes(ape)
    ) {
      return "concepto";
    }
  }

  if (esRubroSueldo && fc === cedulaNorm) return "explicito";
  if (esRubroSueldo && concepto.includes(cedulaNorm)) return "concepto";

  return null;
}

function appendPresupuestoCuentaFilter(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null,
): string {
  if (cuentaId != null && cuentaId > 0) {
    params.cuenta_id = cuentaId;
    return `${query} AND cuenta_id = @cuenta_id`;
  }
  return query;
}

export async function listPagosPorCedula(
  db: Db,
  cedula: string,
  filters?: { fecha_desde?: string; fecha_hasta?: string; empresa?: string },
  cuentaId?: number | null,
): Promise<ResumenPagosFuncionario> {
  const cedulaNorm = normalizeCedula(cedula);
  if (!cedulaNorm) {
    throw new Error("Ingresá una cédula de identidad válida.");
  }

  const funcionario = (await getFuncionarioByCedula(db, cedula, cuentaId)) ?? null;

  let query = "SELECT * FROM PRESUPUESTO WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = appendPresupuestoCuentaFilter(query, params, cuentaId);
  if (filters?.empresa) {
    query += " AND empresa = @empresa";
    params.empresa = filters.empresa;
  }
  if (filters?.fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters?.fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  query += " ORDER BY fecha DESC, id DESC";

  const all = (await db.prepare(query).all(params)) as Presupuesto[];
  const pagos: PagoFuncionario[] = [];

  for (const row of all) {
    const vinculo = clasificarVinculo(row, cedulaNorm, funcionario);
    if (!vinculo) continue;
    pagos.push({
      id: row.id,
      nro_registro: row.nro_registro,
      fecha: row.fecha,
      empresa: row.empresa,
      codigo_proveedor: row.codigo_proveedor ?? "",
      razon_social_proveedor: row.razon_social_proveedor ?? "",
      concepto: row.concepto,
      rubro: row.rubro,
      sub_rubro: row.sub_rubro ?? "",
      nro_factura: row.nro_factura ?? "",
      pesos: Number(row.pesos) || 0,
      dolares_usd: Number(row.dolares_usd) || 0,
      reales: Number(row.reales) || 0,
      tc_usd: Number(row.tc_usd) || 0,
      tc_reales: Number(row.tc_reales) || 0,
      saldo_usd: Number(row.saldo_usd) || 0,
      vinculo,
    });
  }

  const porRubroMap = new Map<string, ResumenRubroPago>();
  const porAnioMap = new Map<string, ResumenAnioPago>();

  let total_pesos = 0;
  let total_usd = 0;
  let total_reales = 0;
  let total_saldo_usd = 0;

  for (const p of pagos) {
    total_pesos += p.pesos;
    total_usd += p.dolares_usd;
    total_reales += p.reales;
    total_saldo_usd += p.saldo_usd;

    const rk = `${p.rubro}|${p.sub_rubro}`;
    const pr = porRubroMap.get(rk) ?? {
      rubro: p.rubro,
      sub_rubro: p.sub_rubro,
      cantidad: 0,
      total_pesos: 0,
      total_usd: 0,
      total_reales: 0,
      total_saldo_usd: 0,
    };
    pr.cantidad += 1;
    pr.total_pesos += p.pesos;
    pr.total_usd += p.dolares_usd;
    pr.total_reales += p.reales;
    pr.total_saldo_usd += p.saldo_usd;
    porRubroMap.set(rk, pr);

    const anio = p.fecha.slice(0, 4) || "—";
    const pa = porAnioMap.get(anio) ?? {
      anio,
      cantidad: 0,
      total_pesos: 0,
      total_usd: 0,
      total_reales: 0,
      total_saldo_usd: 0,
    };
    pa.cantidad += 1;
    pa.total_pesos += p.pesos;
    pa.total_usd += p.dolares_usd;
    pa.total_reales += p.reales;
    pa.total_saldo_usd += p.saldo_usd;
    porAnioMap.set(anio, pa);
  }

  const ordenarPorMonto = (
    a: { total_saldo_usd: number; total_usd: number; total_pesos: number },
    b: { total_saldo_usd: number; total_usd: number; total_pesos: number }
  ) =>
    b.total_saldo_usd - a.total_saldo_usd ||
    b.total_usd - a.total_usd ||
    b.total_pesos - a.total_pesos;

  return {
    cedula: funcionario?.cedula ?? cedulaNorm,
    cedula_display: formatCedulaDisplay(funcionario?.cedula ?? cedulaNorm),
    funcionario,
    total_registros: pagos.length,
    total_pesos,
    total_usd,
    total_reales,
    total_saldo_usd,
    por_rubro: [...porRubroMap.values()].sort(ordenarPorMonto),
    por_anio: [...porAnioMap.values()].sort((a, b) => b.anio.localeCompare(a.anio)),
    pagos,
  };
}

export async function resumenGlobalSueldos(
  db: Db,
  cuentaId?: number | null,
  filters?: { fecha_desde?: string; fecha_hasta?: string }
): Promise<{
  total_registros: number;
  total_pesos: number;
  funcionarios_con_pagos: number;
}> {
  const dash = await resumenDashboardRRHH(db, cuentaId, filters);
  return {
    total_registros: dash.pagos_periodo.total_registros,
    total_pesos: dash.pagos_periodo.total_pesos,
    funcionarios_con_pagos: dash.pagos_periodo.funcionarios_con_pagos,
  };
}

export interface UltimoPagoRRHH {
  id: number;
  fecha: string;
  empresa: string;
  concepto: string;
  rubro: string;
  saldo_usd: number;
  pesos: number;
  funcionario_nombre: string | null;
  cedula: string | null;
  cedula_display: string | null;
}

export interface RrhhDashboardData {
  funcionarios_total: number;
  funcionarios_activos: number;
  funcionarios_inactivos: number;
  funcionarios_sin_banco: number;
  pagos_periodo: {
    total_registros: number;
    total_pesos: number;
    total_saldo_usd: number;
    funcionarios_con_pagos: number;
  };
  ultimos_pagos: UltimoPagoRRHH[];
}

function nombreFuncionario(f: Funcionario): string {
  return `${f.apellido}, ${f.nombre}`.trim();
}

function mapFuncionarioPorCedula(funcionarios: Funcionario[]): Map<string, Funcionario> {
  const map = new Map<string, Funcionario>();
  for (const f of funcionarios) {
    const n = normalizeCedula(f.cedula);
    if (n) map.set(n, f);
  }
  return map;
}

export async function resumenDashboardRRHH(
  db: Db,
  cuentaId?: number | null,
  filters?: { fecha_desde?: string; fecha_hasta?: string }
): Promise<RrhhDashboardData> {
  const funcionarios = await listFuncionarios(db, {}, cuentaId);
  const activos = funcionarios.filter((f) => f.activo).length;
  const sinBanco = funcionarios.filter((f) => !f.banco?.trim() || !f.cuenta?.trim()).length;
  const porCedula = mapFuncionarioPorCedula(funcionarios);
  const porNombre = new Map<string, Funcionario>();
  for (const f of funcionarios) {
    porNombre.set(nombreFuncionario(f).toLowerCase(), f);
    porNombre.set(`${f.nombre} ${f.apellido}`.trim().toLowerCase(), f);
  }

  let queryPeriodo = `SELECT COUNT(*) AS n,
    COALESCE(SUM(pesos),0) AS pesos,
    COALESCE(SUM(saldo_usd),0) AS saldo_usd,
    COUNT(DISTINCT NULLIF(trim(funcionario_cedula), '')) AS funcs_cedula
    FROM PRESUPUESTO WHERE ${RUBRO_SUELDO_SQL}`;
  const params: Record<string, string | number> = {};
  queryPeriodo = appendPresupuestoCuentaFilter(queryPeriodo, params, cuentaId);
  if (filters?.fecha_desde) {
    queryPeriodo += " AND fecha >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters?.fecha_hasta) {
    queryPeriodo += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  const periodo = (await db.prepare(queryPeriodo).get(params)) as {
    n: number;
    pesos: number;
    saldo_usd: number;
    funcs_cedula: number;
  };

  let ultQuery = `SELECT id, fecha, empresa, concepto, rubro, saldo_usd, pesos,
    funcionario_cedula, responsable_gasto
    FROM PRESUPUESTO WHERE ${RUBRO_SUELDO_SQL}`;
  ultQuery = appendPresupuestoCuentaFilter(ultQuery, params, cuentaId);
  if (filters?.fecha_desde) ultQuery += " AND fecha >= @fecha_desde";
  if (filters?.fecha_hasta) ultQuery += " AND fecha <= @fecha_hasta";
  ultQuery += " ORDER BY fecha DESC, id DESC LIMIT 8";

  const ultRows = (await db.prepare(ultQuery).all(params)) as Array<{
    id: number;
    fecha: string;
    empresa: string;
    concepto: string;
    rubro: string;
    saldo_usd: number;
    pesos: number;
    funcionario_cedula: string | null;
    responsable_gasto: string | null;
  }>;

  const ultimos_pagos: UltimoPagoRRHH[] = ultRows.map((row) => {
    const cedNorm = normalizeCedula(row.funcionario_cedula ?? "");
    let func = cedNorm ? porCedula.get(cedNorm) : undefined;
    if (!func && row.responsable_gasto?.trim()) {
      func = porNombre.get(row.responsable_gasto.trim().toLowerCase());
    }
    return {
      id: row.id,
      fecha: row.fecha,
      empresa: row.empresa,
      concepto: row.concepto,
      rubro: row.rubro,
      saldo_usd: Number(row.saldo_usd) || 0,
      pesos: Number(row.pesos) || 0,
      funcionario_nombre: func ? nombreFuncionario(func) : row.responsable_gasto?.trim() || null,
      cedula: func?.cedula ?? (cedNorm || null),
      cedula_display: func ? formatCedulaDisplay(func.cedula) : cedNorm ? formatCedulaDisplay(cedNorm) : null,
    };
  });

  return {
    funcionarios_total: funcionarios.length,
    funcionarios_activos: activos,
    funcionarios_inactivos: funcionarios.length - activos,
    funcionarios_sin_banco: sinBanco,
    pagos_periodo: {
      total_registros: periodo.n,
      total_pesos: periodo.pesos,
      total_saldo_usd: periodo.saldo_usd,
      funcionarios_con_pagos: periodo.funcs_cedula,
    },
    ultimos_pagos,
  };
}
