import type { Db } from "./db/pg-client.js";

export const POTRERO_MAX = 48;

export function normalizarPotrero(val: string | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.\-']/g, "")
    .slice(0, POTRERO_MAX);
}

function clavePotrero(nombre: string): string {
  return normalizarPotrero(nombre).toLocaleLowerCase("es");
}

/** Entre variantes solo por mayúsculas, preferí la más legible (no TODO MAYÚSCULAS). */
function preferirNombrePotrero(candidato: string, actual: string): boolean {
  const cand = normalizarPotrero(candidato);
  const cur = normalizarPotrero(actual);
  if (!cand) return false;
  if (!cur) return true;
  const candAllCaps = cand === cand.toLocaleUpperCase("es") && /[a-záéíóúñü]/i.test(cand);
  const curAllCaps = cur === cur.toLocaleUpperCase("es") && /[a-záéíóúñü]/i.test(cur);
  if (candAllCaps !== curAllCaps) return !candAllCaps;
  return cand.localeCompare(cur, "es") < 0;
}

/** Une variantes que solo cambian mayúsculas/minúsculas (p. ej. Pradera / PRADERA). */
export function deduplicarPotreros(nombres: Iterable<string>): string[] {
  const byKey = new Map<string, string>();
  for (const raw of nombres) {
    const nombre = normalizarPotrero(raw);
    if (!nombre) continue;
    const key = clavePotrero(nombre);
    const prev = byKey.get(key);
    if (!prev || preferirNombrePotrero(nombre, prev)) byKey.set(key, nombre);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export async function migratePotreroColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'potrero_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_GANADERO_DISPOSITIVO ADD COLUMN potrero TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'potrero_col', '', '', '')`
    )
    .run();
}

export async function migrateEquinoPotreroColumn(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_EQUINO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'potrero_col' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;
  if (done) return;

  try {
    await db
      .prepare(
        `ALTER TABLE STOCK_EQUINO_DISPOSITIVO ADD COLUMN potrero TEXT NOT NULL DEFAULT ''`
      )
      .run();
  } catch {
    /* columna ya existe */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_EQUINO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'potrero_col', '', '', '')`
    )
    .run();
}

export async function migratePotreroCatalogTable(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'potrero_catalog_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_GANADERO_POTRERO (
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         nombre TEXT NOT NULL,
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         PRIMARY KEY (cuenta_id, nombre)
       )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_stock_ganadero_potrero_cuenta
       ON STOCK_GANADERO_POTRERO(cuenta_id)`
    )
    .run();

  if (done) return;

  try {
    await db
      .prepare(
        `INSERT INTO STOCK_GANADERO_POTRERO (cuenta_id, nombre)
         SELECT DISTINCT op.cuenta_id, TRIM(d.potrero)
         FROM STOCK_GANADERO_DISPOSITIVO d
         INNER JOIN EMPRESAS_OPERATIVAS op
           ON UPPER(TRIM(op.codigo)) = UPPER(TRIM(d.empresa))
         WHERE TRIM(COALESCE(d.potrero, '')) <> ''
         ON CONFLICT (cuenta_id, nombre) DO NOTHING`
      )
      .run();
  } catch {
    /* tabla dispositivo o empresas aún no lista */
  }

  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_DISPOSITIVO_HISTORIAL
         (clave, campo, etiqueta, valor_anterior, valor_nuevo)
       VALUES ('__meta__', 'potrero_catalog_v1', '', '', '')`
    )
    .run();
}

export async function getCuentaIdPorEmpresaCodigo(
  db: Db,
  codigoEmpresa: string
): Promise<number | null> {
  const emp = String(codigoEmpresa ?? "").trim();
  if (!emp) return null;
  const row = (await db
    .prepare(
      `SELECT op.cuenta_id
       FROM EMPRESAS_OPERATIVAS op
       WHERE UPPER(TRIM(op.codigo)) = UPPER(TRIM(?))
       LIMIT 1`
    )
    .get(emp)) as { cuenta_id: number } | undefined;
  const id = Number(row?.cuenta_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function listStockGanaderoPotreros(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT nombre FROM STOCK_GANADERO_POTRERO
       WHERE cuenta_id = ?
       ORDER BY LOWER(nombre) ASC, creado_en ASC NULLS LAST, nombre ASC`
    )
    .all(cuentaId)) as { nombre: string }[];
  return deduplicarPotreros(rows.map((r) => r.nombre));
}

export async function createStockGanaderoPotrero(
  db: Db,
  cuentaId: number,
  raw: string
): Promise<string> {
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    throw new Error("Cuenta inválida para registrar el potrero.");
  }
  const nombre = normalizarPotrero(raw);
  if (!nombre) {
    throw new Error("Ingresá un nombre de potrero válido.");
  }
  const existente = (await db
    .prepare(
      `SELECT nombre FROM STOCK_GANADERO_POTRERO
       WHERE cuenta_id = ? AND LOWER(nombre) = LOWER(?)
       ORDER BY creado_en ASC NULLS LAST, nombre ASC
       LIMIT 1`
    )
    .get(cuentaId, nombre)) as { nombre: string } | undefined;
  if (existente?.nombre) {
    return normalizarPotrero(existente.nombre) || nombre;
  }
  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_POTRERO (cuenta_id, nombre)
       VALUES (?, ?)
       ON CONFLICT (cuenta_id, nombre) DO NOTHING`
    )
    .run(cuentaId, nombre);
  return nombre;
}

export async function ensurePotreroEnCatalogo(
  db: Db,
  cuentaId: number | null,
  potrero: string
): Promise<void> {
  if (!cuentaId || !potrero) return;
  await createStockGanaderoPotrero(db, cuentaId, potrero);
}
