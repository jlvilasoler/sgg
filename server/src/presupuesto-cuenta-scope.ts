import type { Db } from "./db/pg-client.js";

export async function migratePresupuestoCuentaScope(db: Db): Promise<void> {
  let added = false;
  try {
    await db
      .prepare(
        `ALTER TABLE PRESUPUESTO ADD COLUMN cuenta_id INTEGER REFERENCES EMPRESAS_CUENTA(id)`,
      )
      .run();
    added = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate column/i.test(msg)) throw err;
  }

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_presupuesto_cuenta_id ON PRESUPUESTO(cuenta_id)`)
    .run();

  if (added) {
    console.info("[SGG] Columna cuenta_id agregada a PRESUPUESTO");
  }

  await backfillPresupuestoCuentaId(db);
}

async function backfillPresupuestoCuentaId(db: Db): Promise<void> {
  await db
    .prepare(
      `UPDATE PRESUPUESTO p
       SET cuenta_id = sub.cuenta_id
       FROM (
         SELECT p2.id,
                MIN(eo.cuenta_id) AS cuenta_id
         FROM PRESUPUESTO p2
         INNER JOIN EMPRESAS_OPERATIVAS eo
           ON LOWER(TRIM(eo.nombre)) = LOWER(TRIM(p2.empresa))
          AND eo.activo = 1
         GROUP BY p2.id
         HAVING COUNT(DISTINCT eo.cuenta_id) = 1
       ) sub
       WHERE p.id = sub.id
         AND (p.cuenta_id IS NULL OR p.cuenta_id IS DISTINCT FROM sub.cuenta_id)`,
    )
    .run();

  const sinCuenta = (await db
    .prepare(`SELECT COUNT(*)::int AS n FROM PRESUPUESTO WHERE cuenta_id IS NULL`)
    .get()) as { n: number };
  if (Number(sinCuenta.n) <= 0) return;

  await db
    .prepare(
      `UPDATE PRESUPUESTO p
       SET cuenta_id = u.empresa_id
       FROM USERS u
       WHERE p.cuenta_id IS NULL
         AND u.empresa_id IS NOT NULL
         AND LOWER(TRIM(p.ingresado_por_email)) = LOWER(TRIM(u.email))`,
    )
    .run();

  const restantes = (await db
    .prepare(`SELECT COUNT(*)::int AS n FROM PRESUPUESTO WHERE cuenta_id IS NULL`)
    .get()) as { n: number };
  if (Number(restantes.n) > 0) {
    console.warn(
      `[SGG] PRESUPUESTO: ${restantes.n} fila(s) sin cuenta_id tras migración (revisar manualmente)`,
    );
  }
}
