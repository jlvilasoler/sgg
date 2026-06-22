import type { Db } from "./db/pg-client.js";
import type { SimuladorVentaTipo } from "./simulador-venta-ganado-db.js";

export interface SimuladorVentaDispositivoRow {
  id: number;
  simulacion_id: number;
  clave: string;
  eid: string;
  vid: string;
  creado_en: string;
}

export interface SimuladorVentaDispositivoInput {
  clave: string;
  eid: string;
  vid: string;
}

export async function initSimuladorVentaDispositivosTable(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS SIMULADOR_VENTA_GANADO_DISPOSITIVO (
      id SERIAL PRIMARY KEY,
      simulacion_id INTEGER NOT NULL,
      clave TEXT NOT NULL,
      eid TEXT NOT NULL DEFAULT '',
      vid TEXT NOT NULL DEFAULT '',
      creado_en TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (simulacion_id, clave)
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sim_venta_disp_sim
     ON SIMULADOR_VENTA_GANADO_DISPOSITIVO(simulacion_id)`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_sim_venta_disp_clave
     ON SIMULADOR_VENTA_GANADO_DISPOSITIVO(clave)`
  ).run();
}

function mapRow(row: Record<string, unknown>): SimuladorVentaDispositivoRow {
  return {
    id: Number(row.id),
    simulacion_id: Number(row.simulacion_id),
    clave: String(row.clave ?? ""),
    eid: String(row.eid ?? ""),
    vid: String(row.vid ?? ""),
    creado_en: String(row.creado_en ?? ""),
  };
}

export async function listDispositivosBySimulacion(
  db: Db,
  simulacionId: number
): Promise<SimuladorVentaDispositivoRow[]> {
  const rows = (await db
    .prepare(
      `SELECT id, simulacion_id, clave, eid, vid, creado_en
       FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO
       WHERE simulacion_id = ?
       ORDER BY creado_en ASC, id ASC`
    )
    .all(simulacionId)) as Record<string, unknown>[];
  return rows.map(mapRow);
}

export async function countDispositivosBySimulacion(db: Db, simulacionId: number): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO WHERE simulacion_id = ?`
    )
    .get(simulacionId)) as { n: number };
  return Number(row?.n ?? 0);
}

const VENTAS_CERRADAS_WHERE = `s.real_total_usd IS NOT NULL`;

export async function countDispositivosEnVentasCerradas(db: Db): Promise<number> {
  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO d
       INNER JOIN SIMULADOR_VENTA_GANADO s ON s.id = d.simulacion_id
       WHERE ${VENTAS_CERRADAS_WHERE}`
    )
    .get()) as { n: number };
  return Number(row?.n ?? 0);
}

export interface DispositivoVentaCerradaDetalle {
  clave: string;
  eid: string;
  vid: string;
  simulacion_id: number;
  tipo: SimuladorVentaTipo;
  venta_realizada_en: string | null;
  numero_operacion: string;
}

export async function listDispositivosVentasCerradasDetalle(
  db: Db
): Promise<DispositivoVentaCerradaDetalle[]> {
  const rows = (await db
    .prepare(
      `SELECT d.clave, d.eid, d.vid, s.id AS simulacion_id, s.tipo, s.venta_realizada_en, s.numero_operacion
       FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO d
       INNER JOIN SIMULADOR_VENTA_GANADO s ON s.id = d.simulacion_id
       WHERE ${VENTAS_CERRADAS_WHERE}
       ORDER BY s.venta_realizada_en DESC NULLS LAST, d.clave`
    )
    .all()) as Record<string, unknown>[];
  return rows.map((r) => ({
    clave: String(r.clave ?? "").trim(),
    eid: String(r.eid ?? "").trim(),
    vid: String(r.vid ?? "").trim(),
    simulacion_id: Number(r.simulacion_id),
    tipo: (String(r.tipo ?? "EN_PIE").trim() || "EN_PIE") as SimuladorVentaTipo,
    venta_realizada_en:
      r.venta_realizada_en != null ? String(r.venta_realizada_en) : null,
    numero_operacion: String(r.numero_operacion ?? "").trim(),
  }));
}

export async function listClavesDispositivosEnVentasCerradas(db: Db): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT d.clave
       FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO d
       INNER JOIN SIMULADOR_VENTA_GANADO s ON s.id = d.simulacion_id
       WHERE ${VENTAS_CERRADAS_WHERE}
       ORDER BY d.clave`
    )
    .all()) as { clave: string }[];
  return rows.map((r) => String(r.clave ?? "").trim()).filter(Boolean);
}

export async function clearDispositivosBySimulacion(db: Db, simulacionId: number): Promise<void> {
  await db
    .prepare(`DELETE FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO WHERE simulacion_id = ?`)
    .run(simulacionId);
}

export async function replaceDispositivosBySimulacionInTx(
  tx: Db,
  simulacionId: number,
  normalized: SimuladorVentaDispositivoInput[]
): Promise<void> {
  await tx
    .prepare(`DELETE FROM SIMULADOR_VENTA_GANADO_DISPOSITIVO WHERE simulacion_id = ?`)
    .run(simulacionId);

  const ins = tx.prepare(
    `INSERT INTO SIMULADOR_VENTA_GANADO_DISPOSITIVO (simulacion_id, clave, eid, vid)
     VALUES (?, ?, ?, ?)`
  );
  for (const item of normalized) {
    await ins.run(simulacionId, item.clave, item.eid, item.vid);
  }
}

export async function replaceDispositivosBySimulacion(
  db: Db,
  simulacionId: number,
  items: SimuladorVentaDispositivoInput[]
): Promise<SimuladorVentaDispositivoRow[]> {
  const seen = new Set<string>();
  const normalized: SimuladorVentaDispositivoInput[] = [];
  for (const item of items) {
    const clave = String(item.clave ?? "").trim();
    if (!clave || seen.has(clave)) continue;
    seen.add(clave);
    normalized.push({
      clave,
      eid: String(item.eid ?? "").trim(),
      vid: String(item.vid ?? "").trim(),
    });
  }

  await db.transaction(async (tx) => {
    await replaceDispositivosBySimulacionInTx(tx, simulacionId, normalized);
  });

  return listDispositivosBySimulacion(db, simulacionId);
}
