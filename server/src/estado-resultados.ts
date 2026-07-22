import type { Db } from "./db/pg-client.js";
import { appendCuentaScope, appendEmpresaScope, type ResumenEmpresaScope } from "./empresa-scope.js";
import type {
  EstadoResultadosClasificacionDetalle,
  EstadoResultadosPayload,
  EstadoResultadosRubroLinea,
  EstadoResultadosVentasDetalle,
} from "./types.js";
import {
  type ClasificacionResultado,
  CLASIFICACIONES_RESULTADO,
  clasificarRubroEnResultado,
  parseClasificacionResultado,
} from "./clasificacion-resultado.js";

type ClasificacionEr = (typeof CLASIFICACIONES_RESULTADO)[number];

/** Equivalente USD por fila de PRESUPUESTO (misma regla que TOTAL USD del listado). */
const PRESUPUESTO_FILA_USD_SQL = `
  CASE
    WHEN COALESCE(p.dolares_usd, 0) > 0 THEN p.dolares_usd
    WHEN COALESCE(p.pesos, 0) > 0 AND COALESCE(p.tc_usd, 0) > 0 THEN p.pesos / p.tc_usd
    WHEN COALESCE(p.reales, 0) > 0 AND COALESCE(p.tc_reales, 0) > 0 THEN p.reales / p.tc_reales
    ELSE COALESCE(p.saldo_usd, 0)
  END
`;

interface GastoFila {
  rubro: string;
  sub_rubro: string;
  total: number;
  proveedor_rubro: string | null;
  clasificacion_resultado: string | null;
}

function clasificarGastoEnResultado(fila: GastoFila): ClasificacionResultado {
  const manual = parseClasificacionResultado(fila.clasificacion_resultado);
  if (manual) return manual;
  const rubroProveedor = String(fila.proveedor_rubro ?? "").trim();
  if (rubroProveedor) return clasificarRubroEnResultado(rubroProveedor);
  return clasificarRubroEnResultado(fila.rubro);
}

function detalleVacio(): Record<ClasificacionEr, EstadoResultadosClasificacionDetalle> {
  return {
    COSTOS_PRODUCCION: { total: 0, rubros: [] },
    GASTOS_ADMINISTRATIVOS: { total: 0, rubros: [] },
    GASTOS_COMERCIALES: { total: 0, rubros: [] },
  };
}

function construirDetalleGastos(
  filas: GastoFila[]
): Record<ClasificacionEr, EstadoResultadosClasificacionDetalle> {
  const buckets = detalleVacio();
  const rubroMap = new Map<
    ClasificacionEr,
    Map<string, Map<string, number>>
  >();

  for (const clase of CLASIFICACIONES_RESULTADO) {
    rubroMap.set(clase, new Map());
  }

  for (const row of filas) {
    const monto = row.total;
    if (!Number.isFinite(monto) || monto === 0) continue;
    const clase = clasificarGastoEnResultado(row);
    buckets[clase].total += monto;
    const rubro = row.rubro.trim() || "(Sin rubro)";
    const sub = row.sub_rubro.trim() || "(Sin sub-rubro)";
    const byRubro = rubroMap.get(clase)!;
    let bySub = byRubro.get(rubro);
    if (!bySub) {
      bySub = new Map();
      byRubro.set(rubro, bySub);
    }
    bySub.set(sub, (bySub.get(sub) ?? 0) + monto);
  }

  for (const clase of CLASIFICACIONES_RESULTADO) {
    const rubros: EstadoResultadosRubroLinea[] = [];
    for (const [rubro, subs] of rubroMap.get(clase)!) {
      const sub_rubros = [...subs.entries()]
        .map(([sub_rubro, total]) => ({
          sub_rubro,
          total: Math.round(total * 100) / 100,
        }))
        .filter((s) => Math.abs(s.total) > 0.0001)
        .sort((a, b) => a.sub_rubro.localeCompare(b.sub_rubro, "es"));
      const total = sub_rubros.reduce((acc, s) => acc + s.total, 0);
      if (Math.abs(total) <= 0.0001 && sub_rubros.length === 0) continue;
      rubros.push({
        rubro,
        total: Math.round(total * 100) / 100,
        sub_rubros,
      });
    }
    rubros.sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.rubro.localeCompare(b.rubro, "es"));
    buckets[clase].total = Math.round(buckets[clase].total * 100) / 100;
    buckets[clase].rubros = rubros;
  }

  return buckets;
}

function sumarGastosPorClasificacion(
  detalle: Record<ClasificacionEr, EstadoResultadosClasificacionDetalle>
): Omit<EstadoResultadosPayload, "ventas" | "ventas_detalle" | "utilidad" | "detalle"> {
  return {
    costos_produccion: detalle.COSTOS_PRODUCCION.total,
    gastos_administrativos: detalle.GASTOS_ADMINISTRATIVOS.total,
    gastos_comerciales: detalle.GASTOS_COMERCIALES.total,
  };
}

async function gastosClasificadosUsd(
  db: Db,
  opts: {
    fecha_desde?: string;
    fecha_hasta?: string;
    empresa?: string;
    empresas?: string[];
    cuentaId?: number | null;
    dispositivoClaves?: string[];
  }
): Promise<GastoFila[]> {
  let q = `
    SELECT
      p.rubro,
      COALESCE(NULLIF(trim(p.sub_rubro), ''), '') AS sub_rubro,
      pr.rubro AS proveedor_rubro,
      pr.clasificacion_resultado,
      COALESCE(SUM(${PRESUPUESTO_FILA_USD_SQL}), 0) AS total
    FROM PRESUPUESTO p
    LEFT JOIN PROVEEDORES pr ON pr.cod = (
      CASE
        WHEN trim(COALESCE(p.codigo_proveedor, '')) ~ '^[0-9]+$'
        THEN trim(p.codigo_proveedor)::integer
        ELSE NULL
      END
    )
    AND (p.cuenta_id IS NULL OR pr.cuenta_id IS NULL OR pr.cuenta_id = p.cuenta_id)`;
  const params: Record<string, string | number> = {};
  q += " WHERE 1=1";
  const scope: ResumenEmpresaScope = {
    empresa: opts.empresa,
    empresas: opts.empresas,
    cuenta_id: opts.cuentaId ?? undefined,
  };
  q = appendEmpresaScope(q, params as Record<string, string>, scope, "p.empresa");
  q = appendCuentaScope(q, params, scope.cuenta_id, "p.cuenta_id");
  if (opts.fecha_desde) {
    q += " AND p.fecha >= @fecha_desde";
    params.fecha_desde = opts.fecha_desde;
  }
  if (opts.fecha_hasta) {
    q += " AND p.fecha <= @fecha_hasta";
    params.fecha_hasta = opts.fecha_hasta;
  }
  q += ` GROUP BY p.rubro, COALESCE(NULLIF(trim(p.sub_rubro), ''), ''), pr.rubro, pr.clasificacion_resultado
         ORDER BY p.rubro ASC`;
  const rows = (await db.prepare(q).all(params)) as {
    rubro: string;
    sub_rubro: string;
    proveedor_rubro: string | null;
    total: number;
    clasificacion_resultado: string | null;
  }[];
  return rows.map((r) => ({
    rubro: String(r.rubro ?? ""),
    sub_rubro: String(r.sub_rubro ?? ""),
    proveedor_rubro: r.proveedor_rubro != null ? String(r.proveedor_rubro) : null,
    total: Number(r.total ?? 0),
    clasificacion_resultado:
      r.clasificacion_resultado != null ? String(r.clasificacion_resultado) : null,
  }));
}

async function ventasIngresosSeccionUsd(
  db: Db,
  opts: {
    fecha_desde?: string;
    fecha_hasta?: string;
    empresa?: string;
    empresas?: string[];
    cuentaId?: number | null;
    dispositivoClaves?: string[];
  }
): Promise<EstadoResultadosVentasDetalle> {
  const scope: ResumenEmpresaScope | undefined =
    opts.empresas?.length || opts.empresa
      ? { empresa: opts.empresa, empresas: opts.empresas }
      : undefined;

  const paramsSim: Record<string, string | number> = {};
  let qSim = `
    SELECT COALESCE(SUM(real_total_usd), 0) AS total
    FROM SIMULADOR_VENTA_GANADO
    WHERE venta_realizada = 1 AND real_total_usd IS NOT NULL`;
  if (opts.cuentaId != null) {
    qSim += " AND cuenta_id = @cuentaId";
    paramsSim.cuentaId = opts.cuentaId;
  }
  if (opts.dispositivoClaves) {
    if (opts.dispositivoClaves.length === 0) {
      qSim += " AND 1 = 0";
    } else {
      const placeholders = opts.dispositivoClaves.map((clave, index) => {
        const key = `sim_clave_${index}`;
        paramsSim[key] = clave;
        return `@${key}`;
      });
      qSim += ` AND EXISTS (
        SELECT 1
        FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO sd
        WHERE sd.simulacion_id = SIMULADOR_VENTA_GANADO.id
          AND sd.clave IN (${placeholders.join(", ")})
      )`;
    }
  }
  if (opts.fecha_desde) {
    qSim += " AND venta_realizada_en >= @fecha_desde";
    paramsSim.fecha_desde = opts.fecha_desde;
  }
  if (opts.fecha_hasta) {
    qSim += " AND venta_realizada_en < (@fecha_hasta::date + INTERVAL '1 day')";
    paramsSim.fecha_hasta = opts.fecha_hasta;
  }
  const sim = (await db.prepare(qSim).get(paramsSim)) as { total: number };
  const ganado = Math.round(Number(sim?.total ?? 0) * 100) / 100;

  // Agricultura: FRACCIONADO suma cuota 1 (40%) y cuota 2 (60%) por su fecha de cobro;
  // AL_FINAL solo cuenta venta_realizada (no el total al cerrar sin cobro de cuotas).
  const paramsAgri: Record<string, string | number> = {};
  let qAgri = `
    SELECT COALESCE(SUM(parte), 0) AS total
    FROM (
      SELECT
        CASE
          WHEN forma_pago_agricultura = 'FRACCIONADO' AND COALESCE(pago_ingreso_cobrado, 0) = 1
            THEN COALESCE(real_importe_usd, GREATEST(0, importe_usd)) * 0.4
          ELSE 0
        END AS parte
      FROM VENTAS_AGRICULTURA
      WHERE forma_pago_agricultura = 'FRACCIONADO'
        AND COALESCE(pago_ingreso_cobrado, 0) = 1`;
  qAgri = appendEmpresaScope(qAgri, paramsAgri as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qAgri += " AND cuenta_id = @cuentaId";
    paramsAgri.cuentaId = opts.cuentaId;
  }
  if (opts.fecha_desde) {
    qAgri += " AND pago_ingreso_cobrado_en >= @fecha_desde";
    paramsAgri.fecha_desde = opts.fecha_desde;
  }
  if (opts.fecha_hasta) {
    qAgri += " AND pago_ingreso_cobrado_en < (@fecha_hasta::date + INTERVAL '1 day')";
    paramsAgri.fecha_hasta = opts.fecha_hasta;
  }
  qAgri += `
      UNION ALL
      SELECT
        CASE
          WHEN forma_pago_agricultura = 'FRACCIONADO' AND COALESCE(pago_saldo_cobrado, 0) = 1
            THEN COALESCE(real_importe_usd, GREATEST(0, importe_usd)) * 0.6
          ELSE 0
        END AS parte
      FROM VENTAS_AGRICULTURA
      WHERE forma_pago_agricultura = 'FRACCIONADO'
        AND COALESCE(pago_saldo_cobrado, 0) = 1`;
  qAgri = appendEmpresaScope(qAgri, paramsAgri as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qAgri += " AND cuenta_id = @cuentaId";
  }
  if (opts.fecha_desde) {
    qAgri += " AND pago_saldo_cobrado_en >= @fecha_desde";
  }
  if (opts.fecha_hasta) {
    qAgri += " AND pago_saldo_cobrado_en < (@fecha_hasta::date + INTERVAL '1 day')";
  }
  qAgri += `
      UNION ALL
      SELECT COALESCE(real_importe_usd, GREATEST(0, importe_usd)) AS parte
      FROM VENTAS_AGRICULTURA
      WHERE COALESCE(forma_pago_agricultura, 'FRACCIONADO') <> 'FRACCIONADO'
        AND COALESCE(venta_realizada, 0) = 1`;
  qAgri = appendEmpresaScope(qAgri, paramsAgri as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qAgri += " AND cuenta_id = @cuentaId";
  }
  if (opts.fecha_desde) {
    qAgri += " AND venta_realizada_en >= @fecha_desde";
  }
  if (opts.fecha_hasta) {
    qAgri += " AND venta_realizada_en < (@fecha_hasta::date + INTERVAL '1 day')";
  }
  qAgri += `
    ) cobros`;
  const agri = (await db.prepare(qAgri).get(paramsAgri)) as { total: number };
  const agricultura = Math.round(Number(agri?.total ?? 0) * 100) / 100;

  // Arrendamientos: 2 pagos anuales suman por fecha de cobro; resto = venta_realizada.
  const paramsArr: Record<string, string | number> = {};
  let qArr = `
    SELECT COALESCE(SUM(parte), 0) AS total
    FROM (
      SELECT
        CASE
          WHEN COALESCE(real_pago_inicio_tipo, pago_inicio_tipo) = 'PORCENTAJE'
            THEN COALESCE(real_total_usd, total_usd)
              * COALESCE(real_pago_inicio_monto, pago_inicio_monto) / 100.0
          ELSE COALESCE(real_pago_inicio_monto, pago_inicio_monto)
        END AS parte
      FROM VENTAS_ARRENDAMIENTO
      WHERE COALESCE(venta_realizada, 0) = 1
        AND COALESCE(pago_inicio_cobrado, 0) = 1
        AND COALESCE(real_pago_frecuencia, pago_frecuencia) = 'ANUAL'
        AND COALESCE(real_pago_inicio, pago_inicio) IS DISTINCT FROM COALESCE(real_pago_fin, pago_fin)`;
  qArr = appendEmpresaScope(qArr, paramsArr as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qArr += " AND cuenta_id = @cuentaId";
    paramsArr.cuentaId = opts.cuentaId;
  }
  if (opts.fecha_desde) {
    qArr += " AND pago_inicio_cobrado_en >= @fecha_desde";
    paramsArr.fecha_desde = opts.fecha_desde;
  }
  if (opts.fecha_hasta) {
    qArr += " AND pago_inicio_cobrado_en < (@fecha_hasta::date + INTERVAL '1 day')";
    paramsArr.fecha_hasta = opts.fecha_hasta;
  }
  qArr += `
      UNION ALL
      SELECT
        CASE
          WHEN COALESCE(real_pago_fin_tipo, pago_fin_tipo) = 'PORCENTAJE'
            THEN COALESCE(real_total_usd, total_usd)
              * COALESCE(real_pago_fin_monto, pago_fin_monto) / 100.0
          ELSE COALESCE(real_pago_fin_monto, pago_fin_monto)
        END AS parte
      FROM VENTAS_ARRENDAMIENTO
      WHERE COALESCE(venta_realizada, 0) = 1
        AND COALESCE(pago_fin_cobrado, 0) = 1
        AND COALESCE(real_pago_frecuencia, pago_frecuencia) = 'ANUAL'
        AND COALESCE(real_pago_inicio, pago_inicio) IS DISTINCT FROM COALESCE(real_pago_fin, pago_fin)`;
  qArr = appendEmpresaScope(qArr, paramsArr as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qArr += " AND cuenta_id = @cuentaId";
  }
  if (opts.fecha_desde) {
    qArr += " AND pago_fin_cobrado_en >= @fecha_desde";
  }
  if (opts.fecha_hasta) {
    qArr += " AND pago_fin_cobrado_en < (@fecha_hasta::date + INTERVAL '1 day')";
  }
  qArr += `
      UNION ALL
      SELECT COALESCE(real_total_usd, 0) AS parte
      FROM VENTAS_ARRENDAMIENTO
      WHERE venta_realizada = 1 AND real_total_usd IS NOT NULL
        AND NOT (
          COALESCE(real_pago_frecuencia, pago_frecuencia) = 'ANUAL'
          AND COALESCE(real_pago_inicio, pago_inicio) IS DISTINCT FROM COALESCE(real_pago_fin, pago_fin)
        )`;
  qArr = appendEmpresaScope(qArr, paramsArr as Record<string, string>, scope);
  if (opts.cuentaId != null) {
    qArr += " AND cuenta_id = @cuentaId";
  }
  if (opts.fecha_desde) {
    qArr += " AND venta_realizada_en >= @fecha_desde";
  }
  if (opts.fecha_hasta) {
    qArr += " AND venta_realizada_en < (@fecha_hasta::date + INTERVAL '1 day')";
  }
  qArr += `
    ) cobros`;
  const arr = (await db.prepare(qArr).get(paramsArr)) as { total: number };
  const arrendamientos = Math.round(Number(arr?.total ?? 0) * 100) / 100;

  return { ganado, agricultura, arrendamientos };
}

export async function buildEstadoResultados(
  db: Db,
  opts: {
    fecha_desde?: string;
    fecha_hasta?: string;
    empresa?: string;
    empresas?: string[];
    cuentaId?: number | null;
    dispositivoClaves?: string[];
  }
): Promise<EstadoResultadosPayload> {
  const filas = await gastosClasificadosUsd(db, opts);
  const detalle = construirDetalleGastos(filas);
  const gastos = sumarGastosPorClasificacion(detalle);
  const ventas_detalle = await ventasIngresosSeccionUsd(db, opts);
  const ventas =
    Math.round(
      (ventas_detalle.ganado + ventas_detalle.agricultura + ventas_detalle.arrendamientos) * 100
    ) / 100;
  const utilidad =
    ventas -
    gastos.costos_produccion -
    gastos.gastos_administrativos -
    gastos.gastos_comerciales;

  return {
    ventas,
    ventas_detalle,
    ...gastos,
    detalle,
    utilidad: Math.round(utilidad * 100) / 100,
  };
}
