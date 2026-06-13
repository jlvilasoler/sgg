import type Database from "better-sqlite3";
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

export function initProveedoresTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS PROVEEDORES (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod INTEGER NOT NULL UNIQUE,
      razon_social TEXT NOT NULL,
      rut TEXT DEFAULT '',
      direccion TEXT DEFAULT '',
      ciudad TEXT DEFAULT '',
      creado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_proveedores_cod ON PROVEEDORES(cod);
    CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON PROVEEDORES(razon_social);
  `);
}

export function seedProveedoresIfEmpty(db: Database.Database): number {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM PROVEEDORES").get() as {
    n: number;
  };
  if (n > 0) return 0;

  const seedPath = path.join(__dirname, "proveedores-seed.json");
  if (!fs.existsSync(seedPath)) {
    console.warn("proveedores-seed.json no encontrado — tabla PROVEEDORES vacía");
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(seedPath, "utf8")) as ProveedorInput[];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO PROVEEDORES (cod, razon_social, rut, direccion, ciudad)
    VALUES (@cod, @razon_social, @rut, @direccion, @ciudad)
  `);

  const tx = db.transaction((items: ProveedorInput[]) => {
    for (const p of items) {
      insert.run({
        cod: p.cod,
        razon_social: p.razon_social.trim(),
        rut: (p.rut ?? "").trim(),
        direccion: (p.direccion ?? "").trim(),
        ciudad: (p.ciudad ?? "").trim(),
      });
    }
  });
  tx(rows);
  const inserted = (
    db.prepare("SELECT COUNT(*) AS n FROM PROVEEDORES").get() as { n: number }
  ).n;
  console.log(`Proveedores cargados: ${inserted}`);
  return inserted;
}

export function listProveedores(
  db: Database.Database,
  busqueda?: string
): Proveedor[] {
  if (busqueda?.trim()) {
    const term = `%${busqueda.trim()}%`;
    return db
      .prepare(
        `SELECT * FROM PROVEEDORES
         WHERE CAST(cod AS TEXT) LIKE @term
            OR razon_social LIKE @term
            OR rut LIKE @term
            OR ciudad LIKE @term
         ORDER BY cod ASC`
      )
      .all({ term }) as Proveedor[];
  }
  return db
    .prepare("SELECT * FROM PROVEEDORES ORDER BY cod ASC")
    .all() as Proveedor[];
}

export function getProveedorByCod(
  db: Database.Database,
  cod: number
): Proveedor | undefined {
  return db
    .prepare("SELECT * FROM PROVEEDORES WHERE cod = ?")
    .get(cod) as Proveedor | undefined;
}

export function getProveedorById(
  db: Database.Database,
  id: number
): Proveedor | undefined {
  return db
    .prepare("SELECT * FROM PROVEEDORES WHERE id = ?")
    .get(id) as Proveedor | undefined;
}

export function getNextCod(db: Database.Database): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(cod), 0) + 1 AS next FROM PROVEEDORES")
    .get() as { next: number };
  return row.next;
}

export function insertProveedor(
  db: Database.Database,
  data: ProveedorInput
): number {
  const result = db
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

export function updateProveedor(
  db: Database.Database,
  id: number,
  data: ProveedorInput
): boolean {
  return (
    db
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
      }).changes > 0
  );
}

export function deleteProveedor(db: Database.Database, id: number): boolean {
  return db.prepare("DELETE FROM PROVEEDORES WHERE id = ?").run(id).changes > 0;
}
