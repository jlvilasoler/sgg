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

export interface UserAvatarDto {
  tipo: AvatarTipo;
  url: string | null;
}

function extFromMime(mime: string): string {
  const ext = MIME_EXT[mime.toLowerCase()];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
  return ext;
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
    const full = path.join(USER_AVATARS_DIR, row.avatar_archivo);
    if (fs.existsSync(full)) {
      return {
        tipo: "foto",
        url: publicUserAvatarUrl(userId, row.actualizado_en),
      };
    }
  }
  return { tipo: "iniciales", url: null };
}

function deleteAvatarFile(archivo: string): void {
  if (!archivo) return;
  const full = path.join(USER_AVATARS_DIR, archivo);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

export async function resolveUserAvatarFilePath(
  db: Db,
  userId: number
): Promise<string | null> {
  const row = (await db
    .prepare(
      `SELECT avatar_archivo FROM USERS WHERE id = ? AND avatar_tipo = 'foto'`
    )
    .get(userId)) as { avatar_archivo: string } | undefined;
  if (!row?.avatar_archivo) return null;
  const full = path.join(USER_AVATARS_DIR, row.avatar_archivo);
  return fs.existsSync(full) ? full : null;
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
  fs.writeFileSync(path.join(USER_AVATARS_DIR, archivo), buffer);
  await db
    .prepare(
      `UPDATE USERS SET avatar_tipo = 'foto', avatar_archivo = ?,
       actualizado_en = NOW() WHERE id = ?`
    )
    .run(archivo, userId);

  const updated = (await db
    .prepare("SELECT avatar_tipo, avatar_archivo, actualizado_en FROM USERS WHERE id = ?")
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
