import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getSeedCuentaMadreId,
  migrateAddCuentaIdColumn,
} from "./empresas-cuenta-db.js";

import type { ClasificacionResultado } from "./clasificacion-resultado.js";
import {
  clasificarRubroEnResultado,
  parseClasificacionResultado,
} from "./clasificacion-resultado.js";

export interface Proveedor {
  id: number;
  cuenta_id?: number | null;
  cod: number;
  razon_social: string;
  rut: string;
  direccion: string;
  ciudad: string;
  rubro: string;
  sub_rubro: string;
  clasificacion_resultado: ClasificacionResultado | null;
  creado_en?: string;
}

export interface ProveedorRubroClasificacionInput {
  rubro: string;
  sub_rubro: string;
}

export interface ProveedorInput {
  cod: number;
  razon_social: string;
  rut?: string;
  direccion?: string;
  ciudad?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function proveedorColumnExists(db: Db, column: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT 1 AS ok FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'proveedores' AND column_name = @col
       LIMIT 1`
    )
    .get({ col: column.toLowerCase() })) as { ok: number } | undefined;
  return row != null;
}

export async function initProveedoresTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "PROVEEDORES");
  await migrateProveedorCodUniquePorCuenta(db);
  await backfillProveedoresCuentaNulos(db);

  const columnMigrations: Array<{ name: string; ddl: string }> = [
    {
      name: "clasificacion_resultado",
      ddl: "ALTER TABLE PROVEEDORES ADD COLUMN clasificacion_resultado TEXT",
    },
    { name: "rubro", ddl: "ALTER TABLE PROVEEDORES ADD COLUMN rubro TEXT" },
    { name: "sub_rubro", ddl: "ALTER TABLE PROVEEDORES ADD COLUMN sub_rubro TEXT" },
  ];

  for (const col of columnMigrations) {
    if (await proveedorColumnExists(db, col.name)) continue;
    await db.prepare(col.ddl).run();
    console.info(`[SGG] Migración: columna ${col.name} agregada a proveedores`);
  }
}

/** El código deja de ser único global para serlo por cuenta. */
async function migrateProveedorCodUniquePorCuenta(db: Db): Promise<void> {
  for (const stmt of [
    "ALTER TABLE PROVEEDORES DROP CONSTRAINT IF EXISTS proveedores_cod_key",
    "DROP INDEX IF EXISTS idx_proveedores_cod",
  ]) {
    try {
      await db.prepare(stmt).run();
    } catch {
      /* ignore */
    }
  }
  try {
    await db
      .prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_cuenta_cod ON PROVEEDORES(cuenta_id, cod)"
      )
      .run();
  } catch {
    /* ignore */
  }
}

/** Filas legacy sin cuenta: asignar a cuenta semilla (solo migración). */
async function backfillProveedoresCuentaNulos(db: Db): Promise<void> {
  const seedId = await getSeedCuentaMadreId(db);
  if (!seedId) return;
  await db
    .prepare("UPDATE PROVEEDORES SET cuenta_id = @seedId WHERE cuenta_id IS NULL")
    .run({ seedId });
}

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null
): string {
  if (cuentaId === 0) {
    return `${query} AND 1=0`;
  }
  if (cuentaId != null && cuentaId > 0) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  }
  return query;
}

function mapProveedorRow(row: Record<string, unknown>): Proveedor {
  return {
    id: Number(row.id),
    cuenta_id: row.cuenta_id != null ? Number(row.cuenta_id) : null,
    cod: Number(row.cod),
    razon_social: String(row.razon_social ?? ""),
    rut: String(row.rut ?? ""),
    direccion: String(row.direccion ?? ""),
    ciudad: String(row.ciudad ?? ""),
    rubro: String(row.rubro ?? ""),
    sub_rubro: String(row.sub_rubro ?? ""),
    clasificacion_resultado: parseClasificacionResultado(row.clasificacion_resultado),
    creado_en: row.creado_en != null ? String(row.creado_en) : undefined,
  };
}

export async function seedProveedoresIfEmpty(db: Db): Promise<number> {
  const { n } = (await db.prepare("SELECT COUNT(*) AS n FROM PROVEEDORES").get()) as {
    n: number;
  };
  if (n > 0) return 0;

  const seedId = await getSeedCuentaMadreId(db);

  const seedPath = path.join(__dirname, "proveedores-seed.json");
  if (!fs.existsSync(seedPath)) {
    console.warn("proveedores-seed.json no encontrado — tabla PROVEEDORES vacía");
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(seedPath, "utf8")) as ProveedorInput[];

  await db.transaction(async (tx) => {
    const ins = await tx.prepare(`
      INSERT INTO PROVEEDORES (cuenta_id, cod, razon_social, rut, direccion, ciudad)
      VALUES (@cuenta_id, @cod, @razon_social, @rut, @direccion, @ciudad)
      ON CONFLICT (cuenta_id, cod) DO NOTHING
    `);
    for (const p of rows) {
      await ins.run({
        cuenta_id: seedId ?? null,
        cod: p.cod,
        razon_social: p.razon_social.trim(),
        rut: (p.rut ?? "").trim(),
        direccion: (p.direccion ?? "").trim(),
        ciudad: (p.ciudad ?? "").trim(),
      });
    }
  });
  const inserted = (
    await db.prepare("SELECT COUNT(*) AS n FROM PROVEEDORES").get()
  ) as { n: number };
  console.log(`Proveedores cargados: ${inserted.n}`);
  return inserted.n;
}

export async function listProveedores(
  db: Db,
  busqueda?: string,
  cuentaId?: number | null
): Promise<Proveedor[]> {
  let query = "SELECT * FROM PROVEEDORES WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  if (busqueda?.trim()) {
    query += ` AND (
      CAST(cod AS TEXT) LIKE @term
      OR razon_social LIKE @term
      OR rut LIKE @term
      OR ciudad LIKE @term
    )`;
    params.term = `%${busqueda.trim()}%`;
  }
  query += " ORDER BY cod ASC";
  const rows = (await db.prepare(query).all(params)) as Record<string, unknown>[];
  return rows.map(mapProveedorRow);
}

export async function getProveedorByCod(
  db: Db,
  cod: number,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  let query = "SELECT * FROM PROVEEDORES WHERE cod = @cod";
  const params: Record<string, string | number> = { cod };
  query = scopeCuenta(query, params, cuentaId);
  const row = (await db.prepare(query).get(params)) as Record<string, unknown> | undefined;
  return row ? mapProveedorRow(row) : undefined;
}

export async function getProveedorById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  let query = "SELECT * FROM PROVEEDORES WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  const row = (await db.prepare(query).get(params)) as Record<string, unknown> | undefined;
  return row ? mapProveedorRow(row) : undefined;
}

export async function getNextCod(db: Db, cuentaId?: number | null): Promise<number> {
  let query = "SELECT COALESCE(MAX(cod), 0) + 1 AS next FROM PROVEEDORES WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  const row = (await db.prepare(query).get(params)) as { next: number };
  return row.next;
}

export async function insertProveedor(
  db: Db,
  data: ProveedorInput,
  cuentaId?: number | null
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO PROVEEDORES (cuenta_id, cod, razon_social, rut, direccion, ciudad)
       VALUES (@cuenta_id, @cod, @razon_social, @rut, @direccion, @ciudad)`
    )
    .run({
      cuenta_id: cuentaId ?? null,
      cod: data.cod,
      razon_social: data.razon_social.trim(),
      rut: (data.rut ?? "").trim(),
      direccion: (data.direccion ?? "").trim(),
      ciudad: (data.ciudad ?? "").trim(),
    });
  return Number(result.lastInsertRowid);
}

export async function updateProveedor(
  db: Db,
  id: number,
  data: ProveedorInput,
  cuentaId?: number | null
): Promise<boolean> {
  let query = `UPDATE PROVEEDORES SET
          cod = @cod, razon_social = @razon_social,
          rut = @rut, direccion = @direccion, ciudad = @ciudad
         WHERE id = @id`;
  const params: Record<string, string | number> = {
    id,
    cod: data.cod,
    razon_social: data.razon_social.trim(),
    rut: (data.rut ?? "").trim(),
    direccion: (data.direccion ?? "").trim(),
    ciudad: (data.ciudad ?? "").trim(),
  };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).run(params)).changes > 0;
}

export async function updateProveedorRubroClasificacion(
  db: Db,
  id: number,
  data: ProveedorRubroClasificacionInput,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  const rubro = data.rubro.trim();
  const sub_rubro = rubro ? data.sub_rubro.trim() : "";
  const clasificacion = rubro ? clasificarRubroEnResultado(rubro) : null;
  let query = `UPDATE PROVEEDORES SET
      rubro = @rubro,
      sub_rubro = @sub_rubro,
      clasificacion_resultado = @clasificacion
    WHERE id = @id`;
  const params: Record<string, string | number | null> = {
    id,
    rubro: rubro || null,
    sub_rubro: sub_rubro || null,
    clasificacion,
  };
  query = scopeCuenta(query, params as Record<string, string | number>, cuentaId);
  const changes = (await db.prepare(query).run(params as Record<string, string | number>)).changes;
  if (!changes) return undefined;
  return getProveedorById(db, id, cuentaId);
}

export async function updateProveedorClasificacionResultado(
  db: Db,
  id: number,
  clasificacion: ClasificacionResultado | null,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  const parsed = clasificacion ? parseClasificacionResultado(clasificacion) : null;
  if (clasificacion && !parsed) {
    throw new Error("Clasificación inválida");
  }
  let query = `UPDATE PROVEEDORES SET clasificacion_resultado = @clasificacion WHERE id = @id`;
  const params: Record<string, string | number | null> = {
    id,
    clasificacion: parsed,
  };
  query = scopeCuenta(query, params as Record<string, string | number>, cuentaId);
  const changes = (await db.prepare(query).run(params as Record<string, string | number>)).changes;
  if (!changes) return undefined;
  return getProveedorById(db, id, cuentaId);
}

export async function deleteProveedor(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<boolean> {
  let query = "DELETE FROM PROVEEDORES WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).run(params)).changes > 0;
}
