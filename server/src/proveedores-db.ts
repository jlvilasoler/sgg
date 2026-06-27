import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getSeedCuentaMadreId,
  migrateAddCuentaIdColumn,
} from "./empresas-cuenta-db.js";

export interface Proveedor {
  id: number;
  cuenta_id?: number | null;
  cod: number;
  razon_social: string;
  rut: string;
  direccion: string;
  ciudad: string;
  creado_en?: string;
}

export interface ProveedorInput {
  cod: number;
  razon_social: string;
  rut?: string;
  direccion?: string;
  ciudad?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initProveedoresTable(db: Db): Promise<void> {
  await migrateAddCuentaIdColumn(db, "PROVEEDORES");
  await migrateProveedorCodUniquePorCuenta(db);
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

function scopeCuenta(
  query: string,
  params: Record<string, string | number>,
  cuentaId?: number | null
): string {
  if (cuentaId != null) {
    query += " AND cuenta_id = @cuentaId";
    params.cuentaId = cuentaId;
  }
  return query;
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
  return (await db.prepare(query).all(params)) as Proveedor[];
}

export async function getProveedorByCod(
  db: Db,
  cod: number,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  let query = "SELECT * FROM PROVEEDORES WHERE cod = @cod";
  const params: Record<string, string | number> = { cod };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Proveedor | undefined;
}

export async function getProveedorById(
  db: Db,
  id: number,
  cuentaId?: number | null
): Promise<Proveedor | undefined> {
  let query = "SELECT * FROM PROVEEDORES WHERE id = @id";
  const params: Record<string, string | number> = { id };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as Proveedor | undefined;
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
