import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BANCO_ICONOS_RUBRO, isEmojiEnBanco } from "./grupo-iconos-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENTA_GRUPO_ICONOS_DIR = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "venta-grupo-iconos"
);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type VentaGrupoIconoTipo = "imagen" | "emoji";

export interface VentaGrupoIconoRow {
  id: number;
  grupo: string;
  tipo: VentaGrupoIconoTipo;
  archivo: string;
  actualizado_en: string;
}

export type VentaGrupoIconoDto =
  | { tipo: "imagen"; url: string }
  | { tipo: "emoji"; emoji: string };

export function initVentaGrupoIconosTable(db: Database.Database): void {
  fs.mkdirSync(VENTA_GRUPO_ICONOS_DIR, { recursive: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS VENTA_GRUPO_ICONOS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      tipo TEXT NOT NULL DEFAULT 'imagen',
      archivo TEXT NOT NULL,
      actualizado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
}

function getByGrupo(db: Database.Database, grupo: string): VentaGrupoIconoRow | undefined {
  return db
    .prepare("SELECT * FROM VENTA_GRUPO_ICONOS WHERE grupo = ? COLLATE NOCASE")
    .get(grupo.trim()) as VentaGrupoIconoRow | undefined;
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

export function getVentaGrupoIconosMap(
  db: Database.Database
): Record<string, VentaGrupoIconoDto> {
  const rows = db
    .prepare("SELECT * FROM VENTA_GRUPO_ICONOS ORDER BY grupo COLLATE NOCASE")
    .all() as VentaGrupoIconoRow[];
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

export function resolveVentaIconFilePath(
  db: Database.Database,
  grupo: string
): string | null {
  const row = getByGrupo(db, grupo);
  if (!row || row.tipo !== "imagen") return null;
  const full = path.join(VENTA_GRUPO_ICONOS_DIR, row.archivo);
  return fs.existsSync(full) ? full : null;
}

export function saveVentaGrupoIcono(
  db: Database.Database,
  grupo: string,
  buffer: Buffer,
  mime: string
): VentaGrupoIconoDto {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");

  const ext = extFromMime(mime);
  let row = getByGrupo(db, g);

  if (row) {
    deleteIconFile(row);
    const archivo = `${row.id}.${ext}`;
    fs.writeFileSync(path.join(VENTA_GRUPO_ICONOS_DIR, archivo), buffer);
    db.prepare(
      `UPDATE VENTA_GRUPO_ICONOS SET tipo = 'imagen', archivo = @archivo,
       actualizado_en = datetime('now', 'localtime') WHERE id = @id`
    ).run({ archivo, id: row.id });
  } else {
    const ins = db
      .prepare(
        `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'imagen', 'pending')`
      )
      .run({ grupo: g });
    const id = Number(ins.lastInsertRowid);
    const archivo = `${id}.${ext}`;
    fs.writeFileSync(path.join(VENTA_GRUPO_ICONOS_DIR, archivo), buffer);
    db.prepare("UPDATE VENTA_GRUPO_ICONOS SET archivo = @archivo WHERE id = @id").run({
      archivo,
      id,
    });
  }

  const saved = getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export function saveVentaGrupoIconoEmoji(
  db: Database.Database,
  grupo: string,
  emoji: string
): VentaGrupoIconoDto {
  const g = grupo.trim();
  const e = emoji.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  if (!e || !isEmojiEnBanco(e)) {
    throw new Error("Elegí un icono del banco disponible.");
  }

  let row = getByGrupo(db, g);
  if (row) {
    deleteIconFile(row);
    db.prepare(
      `UPDATE VENTA_GRUPO_ICONOS SET tipo = 'emoji', archivo = @emoji,
       actualizado_en = datetime('now', 'localtime') WHERE id = @id`
    ).run({ emoji: e, id: row.id });
  } else {
    db.prepare(
      `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'emoji', @emoji)`
    ).run({ grupo: g, emoji: e });
  }

  const saved = getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export function deleteVentaGrupoIcono(db: Database.Database, grupo: string): void {
  const row = getByGrupo(db, grupo);
  if (!row) return;
  deleteIconFile(row);
  db.prepare("DELETE FROM VENTA_GRUPO_ICONOS WHERE id = ?").run(row.id);
}

export function renameVentaGrupoIcono(
  db: Database.Database,
  grupoAnterior: string,
  grupoNuevo: string
): void {
  const prev = grupoAnterior.trim();
  const next = grupoNuevo.trim();
  if (!prev || !next || prev.localeCompare(next, "es", { sensitivity: "accent" }) === 0) {
    return;
  }
  const row = getByGrupo(db, prev);
  if (!row) return;
  const existing = getByGrupo(db, next);
  if (existing && existing.id !== row.id) {
    deleteVentaGrupoIcono(db, next);
  }
  db.prepare("UPDATE VENTA_GRUPO_ICONOS SET grupo = @next WHERE id = @id").run({
    next,
    id: row.id,
  });
}

export function listVentaBancoIconos(): readonly string[] {
  return BANCO_ICONOS_RUBRO;
}
