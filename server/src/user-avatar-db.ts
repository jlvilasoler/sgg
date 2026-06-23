import fs from "fs";
import path from "path";
import type { Db } from "./db/pg-client.js";
import { scgDataPath } from "./data-dir.js";

export const USER_AVATARS_DIR = scgDataPath("user-avatars");

export type AvatarTipo = "iniciales" | "foto";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export interface UserAvatarDto {
  tipo: AvatarTipo;
  url: string | null;
}

export interface UserAvatarImage {
  buffer: Buffer;
  mime: string;
}

function extFromMime(mime: string): string {
  const ext = MIME_EXT[mime.toLowerCase()];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
  return ext;
}

function mimeFromArchivo(archivo: string): string {
  const ext = path.extname(archivo).replace(/^\./, "").toLowerCase();
  return EXT_MIME[ext] ?? "image/jpeg";
}

export function publicUserAvatarUrl(userId: number, version?: string): string {
  const base = `/api/auth/avatar/${userId}/imagen`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}

export function avatarDtoFromRow(
  userId: number,
  row: {
    avatar_tipo?: string;
    avatar_archivo?: string;
    actualizado_en?: string;
  } | null
): UserAvatarDto {
  const tipo = (row?.avatar_tipo as AvatarTipo) || "iniciales";
  if (tipo === "foto" && row?.avatar_archivo) {
    return {
      tipo: "foto",
      url: publicUserAvatarUrl(userId, row.actualizado_en),
    };
  }
  return { tipo: "iniciales", url: null };
}

function deleteAvatarFile(archivo: string): void {
  if (!archivo) return;
  const full = path.join(USER_AVATARS_DIR, archivo);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

function bufferFromDbValue(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value.length > 0 ? value : null;
  if (value instanceof Uint8Array) {
    const buf = Buffer.from(value);
    return buf.length > 0 ? buf : null;
  }
  return null;
}

async function backfillAvatarDatosFromDisk(
  db: Db,
  userId: number,
  archivo: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE USERS SET avatar_datos = ?, avatar_mime = ?, actualizado_en = NOW()
       WHERE id = ? AND (avatar_datos IS NULL OR octet_length(avatar_datos) = 0)`
    )
    .run(buffer, mime, userId);
}

export async function loadUserAvatarImage(
  db: Db,
  userId: number
): Promise<UserAvatarImage | null> {
  const row = (await db
    .prepare(
      `SELECT avatar_tipo, avatar_archivo, avatar_datos, avatar_mime
       FROM USERS WHERE id = ?`
    )
    .get(userId)) as
    | {
        avatar_tipo: string;
        avatar_archivo: string;
        avatar_datos: unknown;
        avatar_mime: string;
      }
    | undefined;

  if (!row || row.avatar_tipo !== "foto" || !row.avatar_archivo) return null;

  const dbBuffer = bufferFromDbValue(row.avatar_datos);
  if (dbBuffer) {
    return {
      buffer: dbBuffer,
      mime: row.avatar_mime?.trim() || mimeFromArchivo(row.avatar_archivo),
    };
  }

  const full = path.join(USER_AVATARS_DIR, row.avatar_archivo);
  if (!fs.existsSync(full)) return null;

  const buffer = fs.readFileSync(full);
  const mime = row.avatar_mime?.trim() || mimeFromArchivo(row.avatar_archivo);
  try {
    await backfillAvatarDatosFromDisk(db, userId, row.avatar_archivo, buffer, mime);
  } catch (e) {
    console.warn("[SGG Auth] No se pudo migrar avatar a la base:", e);
  }
  return { buffer, mime };
}

export async function saveUserAvatarFoto(
  db: Db,
  userId: number,
  buffer: Buffer,
  mime: string
): Promise<UserAvatarDto> {
  if (!fs.existsSync(USER_AVATARS_DIR)) {
    fs.mkdirSync(USER_AVATARS_DIR, { recursive: true });
  }

  const ext = extFromMime(mime);
  const prev = (await db
    .prepare("SELECT avatar_archivo FROM USERS WHERE id = ?")
    .get(userId)) as { avatar_archivo: string } | undefined;
  if (prev?.avatar_archivo) deleteAvatarFile(prev.avatar_archivo);

  const archivo = `${userId}.${ext}`;
  try {
    fs.writeFileSync(path.join(USER_AVATARS_DIR, archivo), buffer);
  } catch (e) {
    console.warn("[SGG Auth] No se pudo guardar avatar en disco (se usa solo DB):", e);
  }

  await db
    .prepare(
      `UPDATE USERS SET avatar_tipo = 'foto', avatar_archivo = ?,
       avatar_datos = ?, avatar_mime = ?,
       actualizado_en = NOW() WHERE id = ?`
    )
    .run(archivo, buffer, mime, userId);

  const updated = (await db
    .prepare(
      "SELECT avatar_tipo, avatar_archivo, actualizado_en FROM USERS WHERE id = ?"
    )
    .get(userId)) as {
    avatar_tipo: string;
    avatar_archivo: string;
    actualizado_en: string;
  };
  return avatarDtoFromRow(userId, updated);
}

export async function clearUserAvatar(db: Db, userId: number): Promise<UserAvatarDto> {
  const prev = (await db
    .prepare("SELECT avatar_archivo FROM USERS WHERE id = ?")
    .get(userId)) as { avatar_archivo: string } | undefined;
  if (prev?.avatar_archivo) deleteAvatarFile(prev.avatar_archivo);

  await db
    .prepare(
      `UPDATE USERS SET avatar_tipo = 'iniciales', avatar_archivo = '',
       avatar_datos = NULL, avatar_mime = '',
       actualizado_en = NOW() WHERE id = ?`
    )
    .run(userId);

  return { tipo: "iniciales", url: null };
}

export async function migrateUserAvatarColumns(db: Db): Promise<void> {
  const cols: Array<{ name: string; ddl: string }> = [
    {
      name: "avatar_tipo",
      ddl: `ALTER TABLE users ADD COLUMN avatar_tipo TEXT NOT NULL DEFAULT 'iniciales'`,
    },
    {
      name: "avatar_archivo",
      ddl: `ALTER TABLE users ADD COLUMN avatar_archivo TEXT NOT NULL DEFAULT ''`,
    },
    {
      name: "avatar_datos",
      ddl: `ALTER TABLE users ADD COLUMN avatar_datos BYTEA`,
    },
    {
      name: "avatar_mime",
      ddl: `ALTER TABLE users ADD COLUMN avatar_mime TEXT NOT NULL DEFAULT ''`,
    },
  ];
  for (const col of cols) {
    const r = await db.prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users' AND column_name = ?`
    ).get(col.name);
    if (r) continue;
    await db.prepare(col.ddl).run();
    console.info(`[SGG Auth] Migración: columna users.${col.name} agregada`);
  }
}
