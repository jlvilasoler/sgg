import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface Proveedor {
  id: number;
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

export async function initProveedoresTable(_db: Db): Promise<void> {}

export async function seedProveedoresIfEmpty(db: Db): Promise<number> {
  const { n } = (await db.prepare("SELECT COUNT(*) AS n FROM PROVEEDORES").get()) as {
    n: number;
  };
  if (n > 0) return 0;

  const seedPath = path.join(__dirname, "proveedores-seed.json");
  if (!fs.existsSync(seedPath)) {
    console.warn("proveedores-seed.json no encontrado — tabla PROVEEDORES vacía");
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(seedPath, "utf8")) as ProveedorInput[];

  await db.transaction(async (tx) => {
    const ins = await tx.prepare(`
      INSERT INTO PROVEEDORES (cod, razon_social, rut, direccion, ciudad)
      VALUES (@cod, @razon_social, @rut, @direccion, @ciudad)
      ON CONFLICT (cod) DO NOTHING
    `);
    for (const p of rows) {
      await ins.run({
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
  busqueda?: string
): Promise<Proveedor[]> {
  if (busqueda?.trim()) {
    const term = `%${busqueda.trim()}%`;
    return (await db
      .prepare(
        `SELECT * FROM PROVEEDORES
         WHERE CAST(cod AS TEXT) LIKE @term
            OR razon_social LIKE @term
            OR rut LIKE @term
            OR ciudad LIKE @term
         ORDER BY cod ASC`
      )
      .all({ term })) as Proveedor[];
  }
  return (await db
    .prepare("SELECT * FROM PROVEEDORES ORDER BY cod ASC")
    .all()) as Proveedor[];
}

export async function getProveedorByCod(
  db: Db,
  cod: number
): Promise<Proveedor | undefined> {
  return (await db
    .prepare("SELECT * FROM PROVEEDORES WHERE cod = ?")
    .get(cod)) as Proveedor | undefined;
}

export async function getProveedorById(
  db: Db,
  id: number
): Promise<Proveedor | undefined> {
  return (await db
    .prepare("SELECT * FROM PROVEEDORES WHERE id = ?")
    .get(id)) as Proveedor | undefined;
}

export async function getNextCod(db: Db): Promise<number> {
  const row = (await db
    .prepare("SELECT COALESCE(MAX(cod), 0) + 1 AS next FROM PROVEEDORES")
    .get()) as { next: number };
  return row.next;
}

export async function insertProveedor(db: Db, data: ProveedorInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO PROVEEDORES (cod, razon_social, rut, direccion, ciudad)
       VALUES (@cod, @razon_social, @rut, @direccion, @ciudad)`
    )
    .run({
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
  data: ProveedorInput
): Promise<boolean> {
  return (
    await db
      .prepare(
        `UPDATE PROVEEDORES SET
          cod = @cod, razon_social = @razon_social,
          rut = @rut, direccion = @direccion, ciudad = @ciudad
         WHERE id = @id`
      )
      .run({
        id,
        cod: data.cod,
        razon_social: data.razon_social.trim(),
        rut: (data.rut ?? "").trim(),
        direccion: (data.direccion ?? "").trim(),
        ciudad: (data.ciudad ?? "").trim(),
      })
  ).changes > 0;
}

export async function deleteProveedor(db: Db, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM PROVEEDORES WHERE id = ?").run(id)).changes > 0;
}
