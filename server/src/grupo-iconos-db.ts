import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BANCO_ICONOS_RUBRO, isEmojiEnBanco } from "./grupo-iconos-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GRUPO_ICONOS_DIR = path.join(__dirname, "..", "..", "data", "grupo-iconos");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type GrupoIconoTipo = "imagen" | "emoji";

export interface GrupoIconoRow {
  id: number;
  grupo: string;
  tipo: GrupoIconoTipo;
  archivo: string;
  actualizado_en: string;
}

export type GrupoIconoDto =
  | { tipo: "imagen"; url: string }
  | { tipo: "emoji"; emoji: string };

function migrateTipoColumn(db: Database.Database): void {
  const cols = db
    .prepare("PRAGMA table_info(GRUPO_ICONOS)")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === "tipo")) {
    db.exec(
      `ALTER TABLE GRUPO_ICONOS ADD COLUMN tipo TEXT NOT NULL DEFAULT 'imagen'`
    );
  }
}

export function initGrupoIconosTable(db: Database.Database): void {
  fs.mkdirSync(GRUPO_ICONOS_DIR, { recursive: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS GRUPO_ICONOS (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo TEXT NOT NULL UNIQUE COLLATE NOCASE,
      tipo TEXT NOT NULL DEFAULT 'imagen',
      archivo TEXT NOT NULL,
      actualizado_en TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);
  migrateTipoColumn(db);
}

function getByGrupo(db: Database.Database, grupo: string): GrupoIconoRow | undefined {
  return db
    .prepare("SELECT * FROM GRUPO_ICONOS WHERE grupo = ? COLLATE NOCASE")
    .get(grupo.trim()) as GrupoIconoRow | undefined;
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

export function getGrupoIconosMap(db: Database.Database): Record<string, GrupoIconoDto> {
  const rows = db
    .prepare(
      "SELECT * FROM GRUPO_ICONOS ORDER BY grupo COLLATE NOCASE"
    )
    .all() as GrupoIconoRow[];
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

export function resolveIconFilePath(db: Database.Database, grupo: string): string | null {
  const row = getByGrupo(db, grupo);
  if (!row || row.tipo !== "imagen") return null;
  const full = path.join(GRUPO_ICONOS_DIR, row.archivo);
  return fs.existsSync(full) ? full : null;
}

export function saveGrupoIcono(
  db: Database.Database,
  grupo: string,
  buffer: Buffer,
  mime: string
): GrupoIconoDto {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");

  const ext = extFromMime(mime);
  let row = getByGrupo(db, g);

  if (row) {
    deleteIconFile(row);
    const archivo = `${row.id}.${ext}`;
    fs.writeFileSync(path.join(GRUPO_ICONOS_DIR, archivo), buffer);
    db.prepare(
      `UPDATE GRUPO_ICONOS SET tipo = 'imagen', archivo = @archivo,
       actualizado_en = datetime('now', 'localtime') WHERE id = @id`
    ).run({ archivo, id: row.id });
  } else {
    const ins = db
      .prepare(
        `INSERT INTO GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'imagen', 'pending')`
      )
      .run({ grupo: g });
    const id = Number(ins.lastInsertRowid);
    const archivo = `${id}.${ext}`;
    fs.writeFileSync(path.join(GRUPO_ICONOS_DIR, archivo), buffer);
    db.prepare(
      "UPDATE GRUPO_ICONOS SET archivo = @archivo WHERE id = @id"
    ).run({ archivo, id });
  }

  const saved = getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export function saveGrupoIconoEmoji(
  db: Database.Database,
  grupo: string,
  emoji: string
): GrupoIconoDto {
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
      `UPDATE GRUPO_ICONOS SET tipo = 'emoji', archivo = @emoji,
       actualizado_en = datetime('now', 'localtime') WHERE id = @id`
    ).run({ emoji: e, id: row.id });
  } else {
    db.prepare(
      `INSERT INTO GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'emoji', @emoji)`
    ).run({ grupo: g, emoji: e });
  }

  const saved = getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export function deleteGrupoIcono(db: Database.Database, grupo: string): void {
  const row = getByGrupo(db, grupo);
  if (!row) return;
  deleteIconFile(row);
  db.prepare("DELETE FROM GRUPO_ICONOS WHERE id = ?").run(row.id);
}

export function renameGrupoIcono(
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
    deleteGrupoIcono(db, next);
  }
  db.prepare("UPDATE GRUPO_ICONOS SET grupo = @next WHERE id = @id").run({
    next,
    id: row.id,
  });
}

export function listBancoIconos(): readonly string[] {
  return BANCO_ICONOS_RUBRO;
}
