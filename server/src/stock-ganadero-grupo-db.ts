import type { Db } from "./db/pg-client.js";
import { getCuentaIdPorEmpresaCodigo } from "./stock-ganadero-potrero-db.js";

export const GRUPO_LIBRE_MAX = 48;

export function normalizarGrupoCatalogo(val: string | undefined | null): string {
  return String(val ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, "")
    .slice(0, GRUPO_LIBRE_MAX);
}

export async function migrateGrupoCatalogTable(db: Db): Promise<void> {
  const done = (await db
    .prepare(
      `SELECT 1 AS ok FROM STOCK_GANADERO_DISPOSITIVO_HISTORIAL
       WHERE clave = '__meta__' AND campo = 'grupo_catalog_v1' LIMIT 1`
    )
    .get()) as { ok: number } | undefined;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS STOCK_GANADERO_GRUPO (
         cuenta_id INTEGER NOT NULL REFERENCES EMPRESAS_CUENTA(id) ON DELETE CASCADE,
         nombre TEXT NOT NULL,
         creado_en TIMESTAMPTZ DEFAULT NOW(),
         PRIMARY KEY (cuenta_id, nombre)
       )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_stock_ganadero_grupo_cuenta
       ON STOCK_GANADERO_GRUPO(cuenta_id)`
    )
    .run();

  if (done) return;

  try {
    await db
      .prepare(
        `INSERT INTO STOCK_GANADERO_GRUPO (cuenta_id, nombre)
         SELECT DISTINCT op.cuenta_id, TRIM(d.grupo_libre)
         FROM STOCK_GANADERO_DISPOSITIVO d
         INNER JOIN EMPRESAS_OPERATIVAS op
           ON UPPER(TRIM(op.codigo)) = UPPER(TRIM(d.empresa))
         WHERE TRIM(COALESCE(d.grupo_libre, '')) <> ''
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
       VALUES ('__meta__', 'grupo_catalog_v1', '', '', '')`
    )
    .run();
}

export async function listStockGanaderoGrupos(
  db: Db,
  cuentaId: number
): Promise<string[]> {
  const rows = (await db
    .prepare(
      `SELECT nombre FROM STOCK_GANADERO_GRUPO
       WHERE cuenta_id = ?
       ORDER BY LOWER(nombre) ASC`
    )
    .all(cuentaId)) as { nombre: string }[];
  return rows.map((r) => normalizarGrupoCatalogo(r.nombre)).filter(Boolean);
}

export async function createStockGanaderoGrupo(
  db: Db,
  cuentaId: number,
  raw: string
): Promise<string> {
  if (!Number.isFinite(cuentaId) || cuentaId <= 0) {
    throw new Error("Cuenta inválida para registrar el grupo.");
  }
  const nombre = normalizarGrupoCatalogo(raw);
  if (!nombre) {
    throw new Error("Ingresá un nombre de grupo válido.");
  }
  await db
    .prepare(
      `INSERT INTO STOCK_GANADERO_GRUPO (cuenta_id, nombre)
       VALUES (?, ?)
       ON CONFLICT (cuenta_id, nombre) DO NOTHING`
    )
    .run(cuentaId, nombre);
  return nombre;
}

export async function ensureGrupoEnCatalogo(
  db: Db,
  cuentaId: number | null,
  grupo: string
): Promise<void> {
  if (!cuentaId || !grupo) return;
  await createStockGanaderoGrupo(db, cuentaId, grupo);
}

export { getCuentaIdPorEmpresaCodigo };
