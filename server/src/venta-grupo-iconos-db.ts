import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";
import { migrateAddCuentaIdColumn } from "./empresas-cuenta-db.js";
import { BANCO_ICONOS_RUBRO, isEmojiEnBanco } from "./grupo-iconos-data.js";

export const VENTA_GRUPO_ICONOS_DIR = scgDataPath("venta-grupo-iconos");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type VentaGrupoIconoTipo = "imagen" | "emoji";

export interface VentaGrupoIconoRow {
  id: number;
  cuenta_id?: number | null;
  grupo: string;
  tipo: VentaGrupoIconoTipo;
  archivo: string;
  actualizado_en: string;
}

export type VentaGrupoIconoDto =
  | { tipo: "imagen"; url: string }
  | { tipo: "emoji"; emoji: string };

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

async function migrateVentaGrupoIconosUniquePorCuenta(db: Db): Promise<void> {
  for (const stmt of [
    "DROP INDEX IF EXISTS idx_venta_grupo_iconos_grupo",
    "ALTER TABLE VENTA_GRUPO_ICONOS DROP CONSTRAINT IF EXISTS venta_grupo_iconos_grupo_key",
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
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_venta_grupo_iconos_cuenta_grupo ON VENTA_GRUPO_ICONOS(cuenta_id, LOWER(grupo))"
      )
      .run();
  } catch {
    /* ignore */
  }
}

export async function initVentaGrupoIconosTable(db: Db): Promise<void> {
  scgDataPath("venta-grupo-iconos");
  await migrateAddCuentaIdColumn(db, "VENTA_GRUPO_ICONOS");
  await migrateVentaGrupoIconosUniquePorCuenta(db);
}

async function getByGrupo(
  db: Db,
  grupo: string,
  cuentaId?: number | null
): Promise<VentaGrupoIconoRow | undefined> {
  let query = "SELECT * FROM VENTA_GRUPO_ICONOS WHERE LOWER(grupo) = LOWER(@grupo)";
  const params: Record<string, string | number> = { grupo: grupo.trim() };
  query = scopeCuenta(query, params, cuentaId);
  return (await db.prepare(query).get(params)) as VentaGrupoIconoRow | undefined;
}

function extFromMime(mime: string): string {
  const ext = MIME_EXT[mime.toLowerCase()];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
  return ext;
}

function deleteIconFile(row: VentaGrupoIconoRow): void {
  if (row.tipo !== "imagen") return;
  const full = path.join(VENTA_GRUPO_ICONOS_DIR, row.archivo);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export function publicVentaIconUrl(grupo: string, version?: string): string {
  const base = `/api/venta-grupo-iconos/${encodeURIComponent(grupo.trim())}/imagen`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

function rowToDto(row: VentaGrupoIconoRow): VentaGrupoIconoDto {
  if (row.tipo === "emoji") {
    return { tipo: "emoji", emoji: row.archivo };
  }
  return { tipo: "imagen", url: publicVentaIconUrl(row.grupo, row.actualizado_en) };
}

export async function getVentaGrupoIconosMap(
  db: Db,
  cuentaId?: number | null
): Promise<Record<string, VentaGrupoIconoDto>> {
  let query = "SELECT * FROM VENTA_GRUPO_ICONOS WHERE 1=1";
  const params: Record<string, string | number> = {};
  query = scopeCuenta(query, params, cuentaId);
  query += " ORDER BY LOWER(grupo)";
  const rows = (await db.prepare(query).all(params)) as VentaGrupoIconoRow[];
  const map: Record<string, VentaGrupoIconoDto> = {};
  for (const r of rows) {
    if (r.tipo === "imagen") {
      const full = path.join(VENTA_GRUPO_ICONOS_DIR, r.archivo);
      if (!fs.existsSync(full)) continue;
    }
    map[r.grupo] = rowToDto(r);
  }
  return map;
}

export async function resolveVentaIconFilePath(
  db: Db,
  grupo: string,
  cuentaId?: number | null
): Promise<string | null> {
  const row = await getByGrupo(db, grupo, cuentaId);
  if (!row || row.tipo !== "imagen") return null;
  const full = path.join(VENTA_GRUPO_ICONOS_DIR, row.archivo);
  return fs.existsSync(full) ? full : null;
}

export async function saveVentaGrupoIcono(
  db: Db,
  grupo: string,
  buffer: Buffer,
  mime: string,
  cuentaId?: number | null
): Promise<VentaGrupoIconoDto> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  if (cuentaId == null) throw new Error("No se pudo determinar la cuenta para este icono.");

  const ext = extFromMime(mime);
  let row = await getByGrupo(db, g, cuentaId);

  if (row) {
    deleteIconFile(row);
    const archivo = `${row.id}.${ext}`;
    fs.writeFileSync(path.join(VENTA_GRUPO_ICONOS_DIR, archivo), buffer);
    await db.prepare(
      `UPDATE VENTA_GRUPO_ICONOS SET tipo = 'imagen', archivo = @archivo,
       actualizado_en = NOW() WHERE id = @id`
    ).run({ archivo, id: row.id });
  } else {
    const ins = await db
      .prepare(
        `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo, cuenta_id)
         VALUES (@grupo, 'imagen', 'pending', @cuenta_id)`
      )
      .run({ grupo: g, cuenta_id: cuentaId });
    const id = Number(ins.lastInsertRowid);
    const archivo = `${id}.${ext}`;
    fs.writeFileSync(path.join(VENTA_GRUPO_ICONOS_DIR, archivo), buffer);
    await db.prepare("UPDATE VENTA_GRUPO_ICONOS SET archivo = @archivo WHERE id = @id").run({
      archivo,
      id,
    });
  }

  const saved = await getByGrupo(db, g, cuentaId);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function saveVentaGrupoIconoEmoji(
  db: Db,
  grupo: string,
  emoji: string,
  cuentaId?: number | null
): Promise<VentaGrupoIconoDto> {
  const g = grupo.trim();
  const e = emoji.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  if (cuentaId == null) throw new Error("No se pudo determinar la cuenta para este icono.");
  if (!e || !isEmojiEnBanco(e)) {
    throw new Error("Elegí un icono del banco disponible.");
  }

  let row = await getByGrupo(db, g, cuentaId);
  if (row) {
    deleteIconFile(row);
    await db.prepare(
      `UPDATE VENTA_GRUPO_ICONOS SET tipo = 'emoji', archivo = @emoji,
       actualizado_en = NOW() WHERE id = @id`
    ).run({ emoji: e, id: row.id });
  } else {
    await db.prepare(
      `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo, cuenta_id)
       VALUES (@grupo, 'emoji', @emoji, @cuenta_id)`
    ).run({ grupo: g, emoji: e, cuenta_id: cuentaId });
  }

  const saved = await getByGrupo(db, g, cuentaId);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function deleteVentaGrupoIcono(
  db: Db,
  grupo: string,
  cuentaId?: number | null
): Promise<void> {
  const row = await getByGrupo(db, grupo, cuentaId);
  if (!row) return;
  deleteIconFile(row);
  await db.prepare("DELETE FROM VENTA_GRUPO_ICONOS WHERE id = ?").run(row.id);
}

export async function renameVentaGrupoIcono(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string,
  cuentaId?: number | null
): Promise<void> {
  const prev = grupoAnterior.trim();
  const next = grupoNuevo.trim();
  if (!prev || !next || prev.localeCompare(next, "es", { sensitivity: "accent" }) === 0) {
    return;
  }
  const row = await getByGrupo(db, prev, cuentaId);
  if (!row) return;
  const existing = await getByGrupo(db, next, cuentaId);
  if (existing && existing.id !== row.id) {
    await deleteVentaGrupoIcono(db, next, cuentaId);
  }
  await db.prepare("UPDATE VENTA_GRUPO_ICONOS SET grupo = @next WHERE id = @id").run({
    next,
    id: row.id,
  });
}

export function listVentaBancoIconos(): readonly string[] {
  return BANCO_ICONOS_RUBRO;
}
