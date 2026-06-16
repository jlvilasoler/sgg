import type { Db } from "./db/pg-client.js";

export const PARES_DIVISA = ["UYU_USD", "BRL_USD"] as const;
export type ParDivisa = (typeof PARES_DIVISA)[number];

export const PAR_LABELS: Record<ParDivisa, string> = {
  UYU_USD: "Dólares estadounidenses → pesos uruguayos",
  BRL_USD: "Dólares estadounidenses → reales brasileños",
};

export interface TipoCambio {
  id: number;
  fecha: string;
  par: ParDivisa;
  valor: number;
  creado_en?: string;
}

export interface TipoCambioInput {
  fecha: string;
  par: ParDivisa;
  valor: number;
}

export async function initDivisasTable(_db: Db): Promise<void> {}

export async function listDivisas(
  db: Db,
  filters: { par?: ParDivisa; fecha_desde?: string; fecha_hasta?: string } = {}
): Promise<TipoCambio[]> {
  let query = "SELECT * FROM DIVISAS_TC WHERE 1=1";
  const params: Record<string, string> = {};
  if (filters.par) {
    query += " AND par = @par";
    params.par = filters.par;
  }
  if (filters.fecha_desde) {
    query += " AND fecha >= @fecha_desde";
    params.fecha_desde = filters.fecha_desde;
  }
  if (filters.fecha_hasta) {
    query += " AND fecha <= @fecha_hasta";
    params.fecha_hasta = filters.fecha_hasta;
  }
  query += " ORDER BY fecha DESC, par ASC";
  return (await db.prepare(query).all(params)) as TipoCambio[];
}

/** TC vigente en una fecha: exacta o la más reciente anterior. */
export async function getTipoCambioEnFecha(
  db: Db,
  par: ParDivisa,
  fecha: string
): Promise<TipoCambio | undefined> {
  const f = fecha.trim();
  if (!f) return undefined;
  const exact = (await db
    .prepare("SELECT * FROM DIVISAS_TC WHERE par = ? AND fecha = ?")
    .get(par, f)) as TipoCambio | undefined;
  if (exact) return exact;
  return (await db
    .prepare(
      `SELECT * FROM DIVISAS_TC WHERE par = ? AND fecha <= ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par, f)) as TipoCambio | undefined;
}

export async function getUltimosPorPar(db: Db): Promise<TipoCambio[]> {
  return (await db
    .prepare(
      `SELECT d.* FROM DIVISAS_TC d
       INNER JOIN (
         SELECT par, MAX(fecha) AS max_fecha FROM DIVISAS_TC GROUP BY par
       ) t ON d.par = t.par AND d.fecha = t.max_fecha
       ORDER BY d.par`
    )
    .all()) as TipoCambio[];
}

export async function upsertTipoCambio(db: Db, row: TipoCambioInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)
     ON CONFLICT(fecha, par) DO UPDATE SET valor = excluded.valor`
    )
    .run(row);
}

export async function insertTipoCambio(db: Db, row: TipoCambioInput): Promise<number> {
  const r = await db
    .prepare("INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)")
    .run(row);
  return Number(r.lastInsertRowid);
}

export async function updateTipoCambio(
  db: Db,
  id: number,
  row: TipoCambioInput
): Promise<boolean> {
  return (
    await db
      .prepare(
        "UPDATE DIVISAS_TC SET fecha = @fecha, par = @par, valor = @valor WHERE id = @id"
      )
      .run({ ...row, id })
  ).changes > 0;
}

export async function deleteTipoCambio(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM DIVISAS_TC WHERE id = ?").run(id)).changes > 0;
}

export async function getTipoCambioById(
  db: Db,
  id: number
): Promise<TipoCambio | undefined> {
  return (await db.prepare("SELECT * FROM DIVISAS_TC WHERE id = ?").get(id)) as
    | TipoCambio
    | undefined;
}

export async function existsTipoCambio(
  db: Db,
  fecha: string,
  par: ParDivisa
): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM DIVISAS_TC WHERE fecha = ? AND par = ? LIMIT 1")
    .get(fecha, par);
  return row !== undefined;
}

export interface DivisaIndicadores {
  ultimo: { fecha: string; valor: number } | null;
  promedio_mes: { mes: string; valor: number; dias: number } | null;
  cierre_mes_anterior: { mes: string; fecha: string; valor: number } | null;
}

function isoHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function monthRange(
  year: number,
  month1to12: number
): { desde: string; hasta: string; mes: string } {
  const mm = String(month1to12).padStart(2, "0");
  const ld = lastDayOfMonth(year, month1to12);
  const dd = String(ld).padStart(2, "0");
  return {
    mes: `${year}-${mm}`,
    desde: `${year}-${mm}-01`,
    hasta: `${year}-${mm}-${dd}`,
  };
}

function shiftMonth(year: number, month1to12: number, delta: number): {
  year: number;
  month: number;
} {
  let m = month1to12 + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

/** Último TC, promedio del mes en curso y cierre del último mes cerrado. */
export async function getIndicadoresPorPar(
  db: Db,
  par: ParDivisa
): Promise<DivisaIndicadores> {
  const ultimoRow = (await db
    .prepare(
      `SELECT fecha, valor FROM DIVISAS_TC WHERE par = ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par)) as { fecha: string; valor: number } | undefined;

  const hoy = isoHoyLocal();
  const [y, m] = hoy.split("-").map(Number);
  const mesActual = monthRange(y, m);

  const avgRow = (await db
    .prepare(
      `SELECT AVG(valor) AS promedio, COUNT(*) AS dias FROM DIVISAS_TC
       WHERE par = ? AND fecha >= ? AND fecha <= ?`
    )
    .get(par, mesActual.desde, mesActual.hasta)) as
    | { promedio: number | null; dias: number }
    | undefined;

  const prev = shiftMonth(y, m, -1);
  const mesAnterior = monthRange(prev.year, prev.month);
  const cierreRow = (await db
    .prepare(
      `SELECT fecha, valor FROM DIVISAS_TC
       WHERE par = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par, mesAnterior.desde, mesAnterior.hasta)) as
    | { fecha: string; valor: number }
    | undefined;

  return {
    ultimo: ultimoRow
      ? { fecha: ultimoRow.fecha, valor: ultimoRow.valor }
      : null,
    promedio_mes:
      avgRow && avgRow.dias > 0 && avgRow.promedio != null
        ? {
            mes: mesActual.mes,
            valor: Number(avgRow.promedio),
            dias: avgRow.dias,
          }
        : null,
    cierre_mes_anterior: cierreRow
      ? {
          mes: mesAnterior.mes,
          fecha: cierreRow.fecha,
          valor: cierreRow.valor,
        }
      : null,
  };
}

/** Fecha más reciente guardada para un par (undefined si no hay registros). */
export async function getMaxFechaPorPar(
  db: Db,
  par: ParDivisa
): Promise<string | undefined> {
  const row = (await db
    .prepare("SELECT MAX(fecha) AS max_fecha FROM DIVISAS_TC WHERE par = ?")
    .get(par)) as { max_fecha: string | null } | undefined;
  const f = row?.max_fecha?.trim();
  return f || undefined;
}

export async function importBatch(
  db: Db,
  rows: TipoCambioInput[],
  options?: { solo_nuevos?: boolean }
): Promise<{ insertados: number; actualizados: number; ignorados: number }> {
  const soloNuevos = options?.solo_nuevos === true;
  return db.transaction(async (tx) => {
    const existsStmt = await tx.prepare(
      "SELECT id FROM DIVISAS_TC WHERE fecha = ? AND par = ?"
    );
    const insertStmt = await tx.prepare(
      "INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)"
    );
    const upsertStmt = await tx.prepare(
      `INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)
       ON CONFLICT(fecha, par) DO UPDATE SET valor = excluded.valor`
    );
    let insertados = 0;
    let actualizados = 0;
    let ignorados = 0;
    for (const row of rows) {
      const prev = await existsStmt.get(row.fecha, row.par);
      if (soloNuevos) {
        if (prev) {
          ignorados++;
          continue;
        }
        await insertStmt.run(row);
        insertados++;
        continue;
      }
      await upsertStmt.run(row);
      if (prev) actualizados++;
      else insertados++;
    }
    return { insertados, actualizados, ignorados };
  });
}
