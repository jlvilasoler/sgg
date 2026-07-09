import type { Db } from "./db/pg-client.js";
import fs from "fs";
import path from "path";
import { scgDataPath } from "./data-dir.js";
import {
  appendGastosRubrosReadWhere,
  migrateAddCuentaIdColumnSagCatalog,
  type GastosRubrosReadScope,
} from "./gastos-rubros-scope.js";
import { BANCO_ICONOS_RUBRO, isEmojiEnBanco } from "./grupo-iconos-data.js";

export const GRUPO_ICONOS_DIR = scgDataPath("grupo-iconos");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type GrupoIconoTipo = "imagen" | "emoji";

export interface GrupoIconoRow {
  id: number;
  cuenta_id?: number | null;
  grupo: string;
  tipo: GrupoIconoTipo;
  archivo: string;
  actualizado_en: string;
}

export type GrupoIconoDto =
  | { tipo: "imagen"; url: string }
  | { tipo: "emoji"; emoji: string };

export async function initGrupoIconosTable(db: Db): Promise<void> {
  scgDataPath("grupo-iconos");
  await migrateAddCuentaIdColumnSagCatalog(db, "GRUPO_ICONOS");
}

async function getByGrupo(
  db: Db,
  grupo: string,
  cuentaId: number | null = null
): Promise<GrupoIconoRow | undefined> {
  let query = "SELECT * FROM GRUPO_ICONOS WHERE LOWER(grupo) = LOWER(@grupo)";
  const params: Record<string, string | number> = { grupo: grupo.trim() };
  if (cuentaId != null) {
    query += " AND (cuenta_id IS NULL OR cuenta_id = @cuentaId)";
    params.cuentaId = cuentaId;
    query += " ORDER BY cuenta_id DESC NULLS LAST LIMIT 1";
    return (await db.prepare(query).get(params)) as GrupoIconoRow | undefined;
  }
  query += " AND cuenta_id IS NULL LIMIT 1";
  return (await db.prepare(query).get(params)) as GrupoIconoRow | undefined;
}

function extFromMime(mime: string): string {
  const ext = MIME_EXT[mime.toLowerCase()];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
  return ext;
}

function deleteIconFile(row: GrupoIconoRow): void {
  if (row.tipo !== "imagen") return;
  const full = path.join(GRUPO_ICONOS_DIR, row.archivo);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export function publicIconUrl(grupo: string, version?: string): string {
  const base = `/api/grupo-iconos/${encodeURIComponent(grupo.trim())}/imagen`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

function rowToDto(row: GrupoIconoRow): GrupoIconoDto {
  if (row.tipo === "emoji") {
    return { tipo: "emoji", emoji: row.archivo };
  }
  return { tipo: "imagen", url: publicIconUrl(row.grupo, row.actualizado_en) };
}

export async function getGrupoIconosMap(
  db: Db,
  readScope?: GastosRubrosReadScope
): Promise<Record<string, GrupoIconoDto>> {
  let query = "SELECT * FROM GRUPO_ICONOS WHERE 1=1";
  const params: Record<string, string | number> = {};
  if (readScope) {
    query = appendGastosRubrosReadWhere(query, params, readScope);
  }
  query += " ORDER BY cuenta_id NULLS FIRST, LOWER(grupo)";
  const rows = (await db.prepare(query).all(params)) as GrupoIconoRow[];
  const map: Record<string, GrupoIconoDto> = {};
  for (const r of rows) {
    if (r.tipo === "imagen") {
      const full = path.join(GRUPO_ICONOS_DIR, r.archivo);
      if (!fs.existsSync(full)) continue;
    }
    map[r.grupo] = rowToDto(r);
  }
  return map;
}

export async function resolveIconFilePath(
  db: Db,
  grupo: string,
  cuentaId: number | null = null
): Promise<string | null> {
  const row = await getByGrupo(db, grupo, cuentaId);
  if (!row || row.tipo !== "imagen") return null;
  const full = path.join(GRUPO_ICONOS_DIR, row.archivo);
  return fs.existsSync(full) ? full : null;
}

export async function saveGrupoIcono(
  db: Db,
  grupo: string,
  buffer: Buffer,
  mime: string,
  cuentaId: number | null = null
): Promise<GrupoIconoDto> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");

  const ext = extFromMime(mime);
  let row = await getByGrupo(db, g, cuentaId);
  if (row && row.cuenta_id == null && cuentaId != null) {
    row = undefined;
  }

  if (row && row.cuenta_id === (cuentaId ?? null)) {
    deleteIconFile(row);
    const archivo = `${row.id}.${ext}`;
    fs.writeFileSync(path.join(GRUPO_ICONOS_DIR, archivo), buffer);
    await db.prepare(
      `UPDATE GRUPO_ICONOS SET tipo = 'imagen', archivo = @archivo,
       actualizado_en = NOW() WHERE id = @id`
    ).run({ archivo, id: row.id });
  } else {
    const ins = await db
      .prepare(
        `INSERT INTO GRUPO_ICONOS (grupo, tipo, archivo, cuenta_id)
         VALUES (@grupo, 'imagen', 'pending', @cuenta_id)`
      )
      .run({ grupo: g, cuenta_id: cuentaId });
    const id = Number(ins.lastInsertRowid);
    const archivo = `${id}.${ext}`;
    fs.writeFileSync(path.join(GRUPO_ICONOS_DIR, archivo), buffer);
    await db.prepare("UPDATE GRUPO_ICONOS SET archivo = @archivo WHERE id = @id").run({
      archivo,
      id,
    });
  }

  const saved = await getByGrupo(db, g, cuentaId);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function saveGrupoIconoEmoji(
  db: Db,
  grupo: string,
  emoji: string,
  cuentaId: number | null = null
): Promise<GrupoIconoDto> {
  const g = grupo.trim();
  const e = emoji.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  if (!e || !isEmojiEnBanco(e)) {
    throw new Error("Elegí un icono del banco disponible.");
  }

  let row = await getByGrupo(db, g, cuentaId);
  if (row && row.cuenta_id == null && cuentaId != null) {
    row = undefined;
  }

  if (row && row.cuenta_id === (cuentaId ?? null)) {
    deleteIconFile(row);
    await db.prepare(
      `UPDATE GRUPO_ICONOS SET tipo = 'emoji', archivo = @emoji,
       actualizado_en = NOW() WHERE id = @id`
    ).run({ emoji: e, id: row.id });
  } else {
    await db.prepare(
      `INSERT INTO GRUPO_ICONOS (grupo, tipo, archivo, cuenta_id)
       VALUES (@grupo, 'emoji', @emoji, @cuenta_id)`
    ).run({ grupo: g, emoji: e, cuenta_id: cuentaId });
  }

  const saved = await getByGrupo(db, g, cuentaId);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function deleteGrupoIcono(
  db: Db,
  grupo: string,
  cuentaId: number | null = null
): Promise<void> {
  const row = await getByGrupo(db, grupo, cuentaId);
  if (!row) return;
  if (row.cuenta_id == null && cuentaId != null) return;
  deleteIconFile(row);
  await db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
}

export async function renameGrupoIcono(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string,
  cuentaId: number | null = null
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
    await deleteGrupoIcono(db, next, cuentaId);
  }
  await db.prepare("UPDATE GRUPO_ICONOS SET grupo = @next WHERE id = @id").run({
    next,
    id: row.id,
  });
}

export function listBancoIconos(): readonly string[] {
  return BANCO_ICONOS_RUBRO;
}
