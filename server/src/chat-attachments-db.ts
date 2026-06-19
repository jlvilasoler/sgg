import fs from "fs";
import path from "path";
import type { Db } from "./db/pg-client.js";
import { scgDataPath } from "./data-dir.js";

export const CHAT_ATTACHMENTS_DIR = scgDataPath("chat-attachments");

export const CHAT_ATTACHMENT_MAX_BYTES = 12 * 1024 * 1024;

export type ChatAttachmentTipo = "imagen" | "archivo";

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/octet-stream",
]);

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-rar-compressed": "rar",
  "application/vnd.rar": "rar",
};

export interface ChatAttachmentDto {
  tipo: ChatAttachmentTipo;
  nombre: string;
  mime: string;
  tamano: number;
  url: string;
}

export function publicChatAttachmentUrl(messageId: number): string {
  return `/api/chat/attachments/${messageId}`;
}

function extFromMime(mime: string, originalName: string): string {
  const lower = mime.toLowerCase();
  const fromMime = MIME_EXT[lower];
  if (fromMime) return fromMime;
  const fromName = path.extname(originalName).replace(/^\./, "").toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return "bin";
}

export function resolveAttachmentTipo(mime: string): ChatAttachmentTipo {
  if (IMAGE_MIMES.has(mime.toLowerCase())) return "imagen";
  return "archivo";
}

export function validateChatAttachmentFile(
  mime: string,
  size: number,
  originalName: string
): { tipo: ChatAttachmentTipo; nombre: string } {
  const nombre = path.basename(String(originalName || "archivo").trim()) || "archivo";
  if (nombre.length > 220) throw new Error("El nombre del archivo es demasiado largo");
  if (size <= 0) throw new Error("El archivo está vacío");
  if (size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error("El archivo supera el máximo de 12 MB");
  }

  const lower = mime.toLowerCase();
  if (IMAGE_MIMES.has(lower)) return { tipo: "imagen", nombre };
  if (FILE_MIMES.has(lower)) return { tipo: "archivo", nombre };
  throw new Error(
    "Formato no permitido. Usá imágenes (JPG, PNG, WebP, GIF) o documentos (PDF, Word, Excel, TXT, ZIP, etc.)."
  );
}

export async function migrateChatAttachmentColumns(db: Db): Promise<void> {
  const cols: Array<{ name: string; ddl: string }> = [
    {
      name: "attachment_tipo",
      ddl: `ALTER TABLE chat_messages ADD COLUMN attachment_tipo TEXT`,
    },
    {
      name: "attachment_nombre",
      ddl: `ALTER TABLE chat_messages ADD COLUMN attachment_nombre TEXT`,
    },
    {
      name: "attachment_mime",
      ddl: `ALTER TABLE chat_messages ADD COLUMN attachment_mime TEXT`,
    },
    {
      name: "attachment_tamano",
      ddl: `ALTER TABLE chat_messages ADD COLUMN attachment_tamano INTEGER`,
    },
    {
      name: "attachment_archivo",
      ddl: `ALTER TABLE chat_messages ADD COLUMN attachment_archivo TEXT`,
    },
  ];
  for (const col of cols) {
    const r = await db.prepare(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = ?`
    ).get(col.name);
    if (r) continue;
    await db.prepare(col.ddl).run();
    console.info(`[SGG Chat] Migración: columna chat_messages.${col.name} agregada`);
  }
}

export function attachmentDtoFromRow(
  messageId: number,
  row: {
    attachment_tipo?: string | null;
    attachment_nombre?: string | null;
    attachment_mime?: string | null;
    attachment_tamano?: number | null;
    attachment_archivo?: string | null;
  }
): ChatAttachmentDto | null {
  const tipo = row.attachment_tipo as ChatAttachmentTipo | null | undefined;
  const archivo = String(row.attachment_archivo ?? "").trim();
  if (!tipo || !archivo) return null;
  const full = path.join(CHAT_ATTACHMENTS_DIR, archivo);
  if (!fs.existsSync(full)) return null;
  return {
    tipo,
    nombre: String(row.attachment_nombre ?? "archivo"),
    mime: String(row.attachment_mime ?? "application/octet-stream"),
    tamano: Number(row.attachment_tamano ?? 0),
    url: publicChatAttachmentUrl(messageId),
  };
}

export async function saveChatAttachmentFile(
  messageId: number,
  buffer: Buffer,
  mime: string,
  originalName: string
): Promise<{ archivo: string; tipo: ChatAttachmentTipo; nombre: string; tamano: number }> {
  const { tipo, nombre } = validateChatAttachmentFile(mime, buffer.length, originalName);
  const ext = extFromMime(mime, nombre);
  const archivo = `${messageId}.${ext}`;
  fs.writeFileSync(path.join(CHAT_ATTACHMENTS_DIR, archivo), buffer);
  return { archivo, tipo, nombre, tamano: buffer.length };
}

export function readChatAttachmentFile(archivo: string): { full: string; mime: string } | null {
  const safe = path.basename(String(archivo ?? ""));
  if (!safe || safe !== archivo) return null;
  const full = path.join(CHAT_ATTACHMENTS_DIR, safe);
  if (!fs.existsSync(full)) return null;
  return { full, mime: "application/octet-stream" };
}

export function previewTextForMessage(
  body: string,
  attachment: Pick<ChatAttachmentDto, "tipo" | "nombre"> | null
): string {
  const text = body.trim();
  if (attachment?.tipo === "imagen") return text || "📷 Foto";
  if (attachment?.tipo === "archivo") return text || `📎 ${attachment.nombre}`;
  return text;
}

export function previewTextFromRow(row: {
  body: string;
  attachment_tipo?: string | null;
  attachment_nombre?: string | null;
}): string {
  const tipo = row.attachment_tipo as ChatAttachmentTipo | null | undefined;
  if (!tipo) return row.body.trim();
  return previewTextForMessage(row.body, {
    tipo,
    nombre: String(row.attachment_nombre ?? "archivo"),
  });
}
