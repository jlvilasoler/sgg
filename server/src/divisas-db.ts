import type Database from "better-sqlite3";

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

export function initDivisasTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS DIVISAS_TC (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      par TEXT NOT NULL CHECK (par IN ('UYU_USD', 'BRL_USD')),
      valor REAL NOT NULL,
      creado_en TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE (fecha, par)
    );
    CREATE INDEX IF NOT EXISTS idx_divisas_fecha ON DIVISAS_TC(fecha);
    CREATE INDEX IF NOT EXISTS idx_divisas_par ON DIVISAS_TC(par);
  `);
}

export function listDivisas(
  db: Database.Database,
  filters: { par?: ParDivisa; fecha_desde?: string; fecha_hasta?: string } = {}
): TipoCambio[] {
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
  return db.prepare(query).all(params) as TipoCambio[];
}

/** TC vigente en una fecha: exacta o la más reciente anterior. */
export function getTipoCambioEnFecha(
  db: Database.Database,
  par: ParDivisa,
  fecha: string
): TipoCambio | undefined {
  const f = fecha.trim();
  if (!f) return undefined;
  const exact = db
    .prepare("SELECT * FROM DIVISAS_TC WHERE par = ? AND fecha = ?")
    .get(par, f) as TipoCambio | undefined;
  if (exact) return exact;
  return db
    .prepare(
      `SELECT * FROM DIVISAS_TC WHERE par = ? AND fecha <= ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par, f) as TipoCambio | undefined;
}

export function getUltimosPorPar(db: Database.Database): TipoCambio[] {
  return db
    .prepare(
      `SELECT d.* FROM DIVISAS_TC d
       INNER JOIN (
         SELECT par, MAX(fecha) AS max_fecha FROM DIVISAS_TC GROUP BY par
       ) t ON d.par = t.par AND d.fecha = t.max_fecha
       ORDER BY d.par`
    )
    .all() as TipoCambio[];
}

export function upsertTipoCambio(db: Database.Database, row: TipoCambioInput): void {
  db.prepare(
    `INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)
     ON CONFLICT(fecha, par) DO UPDATE SET valor = excluded.valor`
  ).run(row);
}

export function insertTipoCambio(db: Database.Database, row: TipoCambioInput): number {
  const r = db
    .prepare("INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)")
    .run(row);
  return Number(r.lastInsertRowid);
}

export function updateTipoCambio(
  db: Database.Database,
  id: number,
  row: TipoCambioInput
): boolean {
  return (
    db.prepare(
      "UPDATE DIVISAS_TC SET fecha = @fecha, par = @par, valor = @valor WHERE id = @id"
    ).run({ ...row, id }).changes > 0
  );
}

export function deleteTipoCambio(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM DIVISAS_TC WHERE id = ?").run(id).changes > 0;
}

export function getTipoCambioById(
  db: Database.Database,
  id: number
): TipoCambio | undefined {
  return db.prepare("SELECT * FROM DIVISAS_TC WHERE id = ?").get(id) as
    | TipoCambio
    | undefined;
}

export function existsTipoCambio(
  db: Database.Database,
  fecha: string,
  par: ParDivisa
): boolean {
  const row = db
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
export function getIndicadoresPorPar(
  db: Database.Database,
  par: ParDivisa
): DivisaIndicadores {
  const ultimoRow = db
    .prepare(
      `SELECT fecha, valor FROM DIVISAS_TC WHERE par = ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par) as { fecha: string; valor: number } | undefined;

  const hoy = isoHoyLocal();
  const [y, m] = hoy.split("-").map(Number);
  const mesActual = monthRange(y, m);

  const avgRow = db
    .prepare(
      `SELECT AVG(valor) AS promedio, COUNT(*) AS dias FROM DIVISAS_TC
       WHERE par = ? AND fecha >= ? AND fecha <= ?`
    )
    .get(par, mesActual.desde, mesActual.hasta) as
    | { promedio: number | null; dias: number }
    | undefined;

  const prev = shiftMonth(y, m, -1);
  const mesAnterior = monthRange(prev.year, prev.month);
  const cierreRow = db
    .prepare(
      `SELECT fecha, valor FROM DIVISAS_TC
       WHERE par = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha DESC LIMIT 1`
    )
    .get(par, mesAnterior.desde, mesAnterior.hasta) as
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
export function getMaxFechaPorPar(
  db: Database.Database,
  par: ParDivisa
): string | undefined {
  const row = db
    .prepare("SELECT MAX(fecha) AS max_fecha FROM DIVISAS_TC WHERE par = ?")
    .get(par) as { max_fecha: string | null } | undefined;
  const f = row?.max_fecha?.trim();
  return f || undefined;
}

export function importBatch(
  db: Database.Database,
  rows: TipoCambioInput[],
  options?: { solo_nuevos?: boolean }
): { insertados: number; actualizados: number; ignorados: number } {
  const soloNuevos = options?.solo_nuevos === true;
  const exists = db.prepare(
    "SELECT id FROM DIVISAS_TC WHERE fecha = ? AND par = ?"
  );
  const insert = db.prepare(
    "INSERT INTO DIVISAS_TC (fecha, par, valor) VALUES (@fecha, @par, @valor)"
  );
  const tx = db.transaction((items: TipoCambioInput[]) => {
    let insertados = 0;
    let actualizados = 0;
    let ignorados = 0;
    for (const row of items) {
      const prev = exists.get(row.fecha, row.par);
      if (soloNuevos) {
        if (prev) {
          ignorados++;
          continue;
        }
        insert.run(row);
        insertados++;
        continue;
      }
      upsertTipoCambio(db, row);
      if (prev) actualizados++;
      else insertados++;
    }
    return { insertados, actualizados, ignorados };
  });
  return tx(rows);
}
