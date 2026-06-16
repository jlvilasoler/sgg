import type { Db } from "./db/pg-client.js";
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

export async function initVentaGrupoIconosTable(_db: Db): Promise<void> {
  fs.mkdirSync(VENTA_GRUPO_ICONOS_DIR, { recursive: true });
}

async function getByGrupo(db: Db, grupo: string): Promise<VentaGrupoIconoRow | undefined> {
  return (await db
    .prepare("SELECT * FROM VENTA_GRUPO_ICONOS WHERE LOWER(grupo) = LOWER(?)")
    .get(grupo.trim())) as VentaGrupoIconoRow | undefined;
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
  db: Db
): Promise<Record<string, VentaGrupoIconoDto>> {
  const rows = (await db
    .prepare("SELECT * FROM VENTA_GRUPO_ICONOS ORDER BY LOWER(grupo)")
    .all()) as VentaGrupoIconoRow[];
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
  grupo: string
): Promise<string | null> {
  const row = await getByGrupo(db, grupo);
  if (!row || row.tipo !== "imagen") return null;
  const full = path.join(VENTA_GRUPO_ICONOS_DIR, row.archivo);
  return fs.existsSync(full) ? full : null;
}

export async function saveVentaGrupoIcono(
  db: Db,
  grupo: string,
  buffer: Buffer,
  mime: string
): Promise<VentaGrupoIconoDto> {
  const g = grupo.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");

  const ext = extFromMime(mime);
  let row = await getByGrupo(db, g);

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
        `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'imagen', 'pending')`
      )
      .run({ grupo: g });
    const id = Number(ins.lastInsertRowid);
    const archivo = `${id}.${ext}`;
    fs.writeFileSync(path.join(VENTA_GRUPO_ICONOS_DIR, archivo), buffer);
    await db.prepare("UPDATE VENTA_GRUPO_ICONOS SET archivo = @archivo WHERE id = @id").run({
      archivo,
      id,
    });
  }

  const saved = await getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function saveVentaGrupoIconoEmoji(
  db: Db,
  grupo: string,
  emoji: string
): Promise<VentaGrupoIconoDto> {
  const g = grupo.trim();
  const e = emoji.trim();
  if (!g) throw new Error("El nombre del rubro (grupo) es obligatorio.");
  if (!e || !isEmojiEnBanco(e)) {
    throw new Error("Elegí un icono del banco disponible.");
  }

  let row = await getByGrupo(db, g);
  if (row) {
    deleteIconFile(row);
    await db.prepare(
      `UPDATE VENTA_GRUPO_ICONOS SET tipo = 'emoji', archivo = @emoji,
       actualizado_en = NOW() WHERE id = @id`
    ).run({ emoji: e, id: row.id });
  } else {
    await db.prepare(
      `INSERT INTO VENTA_GRUPO_ICONOS (grupo, tipo, archivo) VALUES (@grupo, 'emoji', @emoji)`
    ).run({ grupo: g, emoji: e });
  }

  const saved = await getByGrupo(db, g);
  if (!saved) throw new Error("No se pudo guardar el icono.");
  return rowToDto(saved);
}

export async function deleteVentaGrupoIcono(db: Db, grupo: string): Promise<void> {
  const row = await getByGrupo(db, grupo);
  if (!row) return;
  deleteIconFile(row);
  await db.prepare("DELETE FROM VENTA_GRUPO_ICONOS WHERE id = ?").run(row.id);
}

export async function renameVentaGrupoIcono(
  db: Db,
  grupoAnterior: string,
  grupoNuevo: string
): Promise<void> {
  const prev = grupoAnterior.trim();
  const next = grupoNuevo.trim();
  if (!prev || !next || prev.localeCompare(next, "es", { sensitivity: "accent" }) === 0) {
    return;
  }
  const row = await getByGrupo(db, prev);
  if (!row) return;
  const existing = await getByGrupo(db, next);
  if (existing && existing.id !== row.id) {
    await deleteVentaGrupoIcono(db, next);
  }
  await db.prepare("UPDATE VENTA_GRUPO_ICONOS SET grupo = @next WHERE id = @id").run({
    next,
    id: row.id,
  });
}

export function listVentaBancoIconos(): readonly string[] {
  return BANCO_ICONOS_RUBRO;
}
