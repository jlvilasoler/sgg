import type { Db } from "./db/pg-client.js";
import { ROL_LABELS } from "./auth-db.js";
import {
  attachmentDtoFromRow,
  migrateChatAttachmentColumns,
  previewTextFromRow,
  saveChatAttachmentFile,
  type ChatAttachmentDto,
} from "./chat-attachments-db.js";
import {
  assertUserCanAccessGroupPeer,
  getChannelNameByPeer,
  initChatChannelTables,
} from "./chat-channels-db.js";
import { isValidChatWallpaperId } from "./chat-wallpapers.js";
import { avatarDtoFromRow } from "./user-avatar-db.js";
import type { UserAvatarDto } from "./user-avatar-db.js";
import type { UserPresenceStatus } from "./user-presence.js";

/** 0 = canal general del equipo */
export const CHAT_GENERAL_PEER_ID = 0;

export interface ChatMessageRow {
  id: number;
  sender_id: number;
  recipient_id: number;
  body: string;
  creado_en: string;
}

export interface ChatMessageDto {
  id: number;
  sender_id: number;
  sender_nombre: string;
  sender_avatar: UserAvatarDto;
  recipient_id: number;
  body: string;
  creado_en: string;
  es_propio: boolean;
  attachment: ChatAttachmentDto | null;
}

export interface ChatContactDto {
  id: number;
  nombre: string;
  rol_label: string;
  avatar: UserAvatarDto;
  presencia: UserPresenceStatus;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export interface ChatSearchHitDto extends ChatMessageDto {
  peer_id: number;
  peer_label: string;
}

const MESSAGES_DEFAULT_LIMIT = 50;

const SENDER_JOIN_FIELDS = `u.nombre AS sender_nombre, u.avatar_tipo, u.avatar_archivo, u.actualizado_en`;

type SenderRow = ChatMessageRow & {
  sender_nombre: string;
  avatar_tipo?: string;
  avatar_archivo?: string;
  actualizado_en?: string;
  attachment_tipo?: string | null;
  attachment_nombre?: string | null;
  attachment_mime?: string | null;
  attachment_tamano?: number | null;
  attachment_archivo?: string | null;
};

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function trimBody(body: string, allowEmpty = false): string {
  const t = body.trim();
  if (!t && !allowEmpty) throw new Error("El mensaje no puede estar vacío");
  if (t.length > 2000) throw new Error("El mensaje es demasiado largo (máx. 2000 caracteres)");
  return t;
}

export async function initChatTables(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS CHAT_MESSAGES (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_general
     ON CHAT_MESSAGES(creado_en DESC) WHERE recipient_id = 0`
  ).run();

  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_dm
     ON CHAT_MESSAGES(sender_id, recipient_id, creado_en DESC)`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS CHAT_READ_STATE (
      user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      peer_id INTEGER NOT NULL DEFAULT 0,
      last_read_message_id INTEGER NOT NULL DEFAULT 0,
      actualizado_en TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, peer_id)
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS CHAT_WALLPAPER (
      user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      peer_id INTEGER NOT NULL DEFAULT 0,
      wallpaper_id TEXT NOT NULL DEFAULT 'default',
      actualizado_en TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, peer_id)
    )`
  ).run();

  await migrateChatAttachmentColumns(db);
  await initChatChannelTables(db);
}

async function getLastReadId(db: Db, userId: number, peerId: number): Promise<number> {
  const row = (await db
    .prepare("SELECT last_read_message_id FROM CHAT_READ_STATE WHERE user_id = ? AND peer_id = ?")
    .get(userId, peerId)) as { last_read_message_id: number } | undefined;
  return row?.last_read_message_id ?? 0;
}

function rowToDto(row: SenderRow, currentUserId: number): ChatMessageDto {
  return {
    id: row.id,
    sender_id: row.sender_id,
    sender_nombre: row.sender_nombre,
    sender_avatar: avatarDtoFromRow(row.sender_id, row),
    recipient_id: row.recipient_id,
    body: row.body,
    creado_en: row.creado_en,
    es_propio: row.sender_id === currentUserId,
    attachment: attachmentDtoFromRow(row.id, row),
  };
}

async function assertValidPeer(db: Db, senderId: number, recipientId: number): Promise<void> {
  if (recipientId <= 0) {
    await assertUserCanAccessGroupPeer(db, senderId, recipientId);
    return;
  }
  const peer = (await db
    .prepare("SELECT id FROM USERS WHERE id = ? AND activo = 1")
    .get(recipientId)) as { id: number } | undefined;
  if (!peer || peer.id === senderId) {
    throw new Error("Usuario no válido para mensaje directo");
  }
}

function peerMessageFilter(peerId: number, userId: number): { clause: string; binds: number[] } {
  if (peerId > 0) {
    return {
      clause:
        "m.recipient_id > 0 AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))",
      binds: [userId, peerId, peerId, userId],
    };
  }
  return { clause: "m.recipient_id = ?", binds: [peerId] };
}

async function fetchMessageRow(db: Db, id: number): Promise<SenderRow | undefined> {
  return (await db
    .prepare(
      `SELECT m.*, ${SENDER_JOIN_FIELDS}
       FROM CHAT_MESSAGES m
       JOIN USERS u ON u.id = m.sender_id
       WHERE m.id = ?`
    )
    .get(id)) as SenderRow | undefined;
}

export async function listChatMessages(
  db: Db,
  userId: number,
  peerId: number,
  opts?: { since_id?: number; before_id?: number; around_id?: number; limit?: number }
): Promise<ChatMessageDto[]> {
  const limit = Math.min(Math.max(opts?.limit ?? MESSAGES_DEFAULT_LIMIT, 1), 120);
  const sinceId = Math.max(0, opts?.since_id ?? 0);
  const beforeId = opts?.before_id ?? 0;
  const aroundId = opts?.around_id ?? 0;
  const filter = peerMessageFilter(peerId, userId);

  if (aroundId > 0) {
    const beforeLimit = Math.min(Math.max(Math.floor(limit * 0.65), 20), limit - 1);
    const afterLimit = Math.max(limit - beforeLimit, 10);

    const anchorRow = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause} AND m.id = ?`
      )
      .get(...filter.binds, aroundId)) as SenderRow | undefined;

    if (!anchorRow) return [];

    const beforeRows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause} AND m.id < ?
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(...filter.binds, aroundId, beforeLimit)) as SenderRow[];
    beforeRows.reverse();

    const afterRows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause} AND m.id > ?
         ORDER BY m.id ASC LIMIT ?`
      )
      .all(...filter.binds, aroundId, afterLimit)) as SenderRow[];

    return [...beforeRows, anchorRow, ...afterRows].map((row) => rowToDto(row, userId));
  }

  let rows: SenderRow[];

  if (beforeId > 0) {
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause} AND m.id < ?
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(...filter.binds, beforeId, limit)) as SenderRow[];
    rows.reverse();
  } else if (sinceId > 0) {
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause} AND m.id > ?
         ORDER BY m.id ASC LIMIT ?`
      )
      .all(...filter.binds, sinceId, limit)) as SenderRow[];
  } else {
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE ${filter.clause}
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(...filter.binds, limit)) as SenderRow[];
    rows.reverse();
  }

  return rows.map((row) => rowToDto(row, userId));
}

export async function sendChatMessage(
  db: Db,
  senderId: number,
  recipientId: number,
  body: string
): Promise<ChatMessageDto> {
  const text = trimBody(body);
  await assertValidPeer(db, senderId, recipientId);

  const result = await db
    .prepare(`INSERT INTO CHAT_MESSAGES (sender_id, recipient_id, body) VALUES (?, ?, ?)`)
    .run(senderId, recipientId, text);

  const id = Number(result.lastInsertRowid);
  const row = await fetchMessageRow(db, id);

  if (!row) throw new Error("No se pudo guardar el mensaje");
  return rowToDto(row, senderId);
}

export async function sendChatMessageWithAttachment(
  db: Db,
  senderId: number,
  recipientId: number,
  body: string,
  file: { buffer: Buffer; mime: string; originalName: string }
): Promise<ChatMessageDto> {
  const text = trimBody(body, true);
  await assertValidPeer(db, senderId, recipientId);

  const insert = await db
    .prepare(`INSERT INTO CHAT_MESSAGES (sender_id, recipient_id, body) VALUES (?, ?, ?)`)
    .run(senderId, recipientId, text);

  const id = Number(insert.lastInsertRowid);
  try {
    const saved = await saveChatAttachmentFile(
      id,
      file.buffer,
      file.mime,
      file.originalName
    );
    await db
      .prepare(
        `UPDATE CHAT_MESSAGES SET
           attachment_tipo = ?,
           attachment_nombre = ?,
           attachment_mime = ?,
           attachment_tamano = ?,
           attachment_archivo = ?
         WHERE id = ?`
      )
      .run(
        saved.tipo,
        saved.nombre,
        file.mime,
        saved.tamano,
        saved.archivo,
        id
      );
  } catch (e) {
    await db.prepare("DELETE FROM CHAT_MESSAGES WHERE id = ?").run(id);
    throw e;
  }

  const row = await fetchMessageRow(db, id);
  if (!row) throw new Error("No se pudo guardar el mensaje");
  return rowToDto(row, senderId);
}

export async function userCanAccessChatMessage(
  db: Db,
  userId: number,
  messageId: number
): Promise<SenderRow | null> {
  const row = await fetchMessageRow(db, messageId);
  if (!row) return null;
  if (row.recipient_id <= 0) {
    try {
      await assertUserCanAccessGroupPeer(db, userId, row.recipient_id);
      return row;
    } catch {
      return null;
    }
  }
  if (row.sender_id === userId || row.recipient_id === userId) return row;
  return null;
}

export async function markChatRead(
  db: Db,
  userId: number,
  peerId: number,
  lastMessageId: number
): Promise<void> {
  const lastId = Math.max(0, lastMessageId);
  const existing = await getLastReadId(db, userId, peerId);
  if (lastId <= existing) return;

  await db
    .prepare(
      `INSERT INTO CHAT_READ_STATE (user_id, peer_id, last_read_message_id, actualizado_en)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (user_id, peer_id) DO UPDATE SET
         last_read_message_id = EXCLUDED.last_read_message_id,
         actualizado_en = NOW()`
    )
    .run(userId, peerId, lastId);
}

async function unreadCountForPeer(
  db: Db,
  userId: number,
  peerId: number
): Promise<number> {
  const lastRead = await getLastReadId(db, userId, peerId);

  if (peerId <= 0) {
    const row = (await db
      .prepare(
        `SELECT COUNT(*) AS n FROM CHAT_MESSAGES
         WHERE recipient_id = ? AND id > ? AND sender_id != ?`
      )
      .get(peerId, lastRead, userId)) as { n: number };
    return Number(row?.n ?? 0);
  }

  const row = (await db
    .prepare(
      `SELECT COUNT(*) AS n FROM CHAT_MESSAGES
       WHERE recipient_id > 0
         AND id > ?
         AND sender_id != ?
         AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`
    )
    .get(lastRead, userId, userId, peerId, peerId, userId)) as { n: number };
  return Number(row?.n ?? 0);
}

export async function getChatUnreadSummary(
  db: Db,
  userId: number
): Promise<{ total: number; general: number }> {
  const channelRows = (await db
    .prepare(
      `SELECT c.peer_id, COUNT(msg.id) AS n
       FROM CHAT_CHANNELS c
       JOIN CHAT_CHANNEL_MEMBERS cm ON cm.channel_id = c.id AND cm.user_id = ?
       LEFT JOIN CHAT_READ_STATE rs ON rs.user_id = ? AND rs.peer_id = c.peer_id
       LEFT JOIN CHAT_MESSAGES msg ON msg.recipient_id = c.peer_id
         AND msg.id > COALESCE(rs.last_read_message_id, 0)
         AND msg.sender_id != ?
       GROUP BY c.peer_id`
    )
    .all(userId, userId, userId)) as Array<{ peer_id: number; n: number | string }>;

  const dmRows = (await db
    .prepare(
      `SELECT
         CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS peer_id,
         COUNT(*) AS n
       FROM CHAT_MESSAGES m
       LEFT JOIN CHAT_READ_STATE rs ON rs.user_id = ?
         AND rs.peer_id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
       WHERE m.recipient_id > 0
         AND (m.sender_id = ? OR m.recipient_id = ?)
         AND m.id > COALESCE(rs.last_read_message_id, 0)
         AND m.sender_id != ?
       GROUP BY CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END`
    )
    .all(userId, userId, userId, userId, userId, userId, userId)) as Array<{
    peer_id: number;
    n: number | string;
  }>;

  let total = 0;
  let general = 0;
  for (const r of channelRows) {
    const n = Number(r.n ?? 0);
    total += n;
    if (r.peer_id === CHAT_GENERAL_PEER_ID) general = n;
  }
  for (const r of dmRows) total += Number(r.n ?? 0);
  return { total, general };
}

export async function listChatContacts(
  db: Db,
  userId: number
): Promise<Array<Omit<ChatContactDto, "presencia">>> {
  const rows = (await db
    .prepare(
      `SELECT u.id, u.nombre, u.rol, u.avatar_tipo, u.avatar_archivo, u.actualizado_en,
              lm.body AS last_body,
              lm.creado_en AS last_creado_en,
              lm.attachment_tipo AS last_attachment_tipo,
              lm.attachment_nombre AS last_attachment_nombre,
              lm.attachment_mime AS last_attachment_mime,
              lm.attachment_tamano AS last_attachment_tamano,
              lm.attachment_archivo AS last_attachment_archivo,
              COALESCE(ur.unread_n, 0) AS unread_n
       FROM USERS u
       LEFT JOIN LATERAL (
         SELECT m.body, m.creado_en, m.attachment_tipo, m.attachment_nombre,
                m.attachment_mime, m.attachment_tamano, m.attachment_archivo
         FROM CHAT_MESSAGES m
         WHERE m.recipient_id > 0
           AND ((m.sender_id = ? AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = ?))
         ORDER BY m.id DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::bigint AS unread_n
         FROM CHAT_MESSAGES m
         WHERE m.recipient_id > 0
           AND m.id > COALESCE((
             SELECT rs.last_read_message_id
             FROM CHAT_READ_STATE rs
             WHERE rs.user_id = ? AND rs.peer_id = u.id
           ), 0)
           AND m.sender_id != ?
           AND ((m.sender_id = ? AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = ?))
       ) ur ON TRUE
       WHERE u.activo = 1 AND u.id != ?
       ORDER BY LOWER(u.nombre) ASC`
    )
    .all(userId, userId, userId, userId, userId, userId, userId)) as Array<{
    id: number;
    nombre: string;
    rol: string;
    avatar_tipo?: string;
    avatar_archivo?: string;
    actualizado_en?: string;
    last_body: string | null;
    last_creado_en: string | null;
    last_attachment_tipo: string | null;
    last_attachment_nombre: string | null;
    last_attachment_mime: string | null;
    last_attachment_tamano: number | null;
    last_attachment_archivo: string | null;
    unread_n: number | string;
  }>;

  const contacts: Array<Omit<ChatContactDto, "presencia">> = rows.map((u) => {
    const last =
      u.last_body != null
        ? {
            body: u.last_body,
            creado_en: u.last_creado_en ?? "",
            attachment_tipo: u.last_attachment_tipo,
            attachment_nombre: u.last_attachment_nombre,
            attachment_mime: u.last_attachment_mime,
            attachment_tamano: u.last_attachment_tamano,
            attachment_archivo: u.last_attachment_archivo,
          }
        : null;
    const rol = u.rol as keyof typeof ROL_LABELS;
    return {
      id: u.id,
      nombre: u.nombre,
      rol_label: ROL_LABELS[rol] ?? u.rol,
      avatar: avatarDtoFromRow(u.id, u),
      unread_count: Number(u.unread_n ?? 0),
      last_message: last ? previewTextFromRow(last) : null,
      last_message_at: last?.creado_en ?? null,
    };
  });

  contacts.sort((a, b) => {
    if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    if (ta !== tb) return tb - ta;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return contacts;
}

export async function searchChatMessages(
  db: Db,
  userId: number,
  query: string,
  opts?: { peer_id?: number; limit?: number }
): Promise<ChatSearchHitDto[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 80);
  const peerId = opts?.peer_id;
  const pattern = `%${term.replace(/[%_\\]/g, "\\$&")}%`;

  let rows: Array<
    SenderRow & { peer_id: number; peer_label: string }
  >;

  if (peerId !== undefined && peerId <= 0) {
    const label = (await getChannelNameByPeer(db, peerId)) ?? "Canal";
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}, ? AS peer_id, ? AS peer_label
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE m.recipient_id = ? AND m.body ILIKE ? ESCAPE '\\'
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(peerId, label, peerId, pattern, limit)) as Array<
      SenderRow & { peer_id: number; peer_label: string }
    >;
  } else if (peerId !== undefined && peerId > 0) {
    const peer = (await db
      .prepare("SELECT nombre FROM USERS WHERE id = ?")
      .get(peerId)) as { nombre: string } | undefined;
    const label = peer?.nombre ?? "Mensaje directo";
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS}, ? AS peer_id, ? AS peer_label
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         WHERE m.recipient_id > 0
           AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
           AND m.body ILIKE ? ESCAPE '\\'
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(peerId, label, userId, peerId, peerId, userId, pattern, limit)) as Array<
      SenderRow & { peer_id: number; peer_label: string }
    >;
  } else {
    rows = (await db
      .prepare(
        `SELECT m.*, ${SENDER_JOIN_FIELDS},
           CASE
             WHEN m.recipient_id <= 0 THEN m.recipient_id
             WHEN m.sender_id = ? THEN m.recipient_id
             ELSE m.sender_id
           END AS peer_id,
           CASE
             WHEN m.recipient_id <= 0 THEN COALESCE(ch.nombre, 'Canal')
             ELSE COALESCE(p.nombre, 'Mensaje directo')
           END AS peer_label
         FROM CHAT_MESSAGES m
         JOIN USERS u ON u.id = m.sender_id
         LEFT JOIN CHAT_CHANNELS ch ON ch.peer_id = m.recipient_id AND m.recipient_id <= 0
         LEFT JOIN USERS p ON p.id = CASE
           WHEN m.recipient_id > 0 AND m.sender_id = ? THEN m.recipient_id
           WHEN m.recipient_id > 0 THEN m.sender_id
           ELSE NULL END
         WHERE (
           (m.recipient_id <= 0 AND EXISTS (
             SELECT 1 FROM CHAT_CHANNEL_MEMBERS cm
             JOIN CHAT_CHANNELS c2 ON c2.id = cm.channel_id
             WHERE c2.peer_id = m.recipient_id AND cm.user_id = ?
           ))
           OR m.sender_id = ?
           OR m.recipient_id = ?
         )
         AND m.body ILIKE ? ESCAPE '\\'
         ORDER BY m.id DESC LIMIT ?`
      )
      .all(userId, userId, userId, userId, userId, pattern, limit)) as Array<
      SenderRow & { peer_id: number; peer_label: string }
    >;
  }

  return rows.map((row) => ({
    ...rowToDto(row, userId),
    peer_id: Number(row.peer_id),
    peer_label: row.peer_label,
  }));
}

export async function listUserChatWallpapers(
  db: Db,
  userId: number
): Promise<Record<number, string>> {
  const rows = (await db
    .prepare("SELECT peer_id, wallpaper_id FROM CHAT_WALLPAPER WHERE user_id = ?")
    .all(userId)) as { peer_id: number; wallpaper_id: string }[];

  const map: Record<number, string> = {};
  for (const row of rows) {
    const id = String(row.wallpaper_id ?? "default");
    map[Number(row.peer_id)] = isValidChatWallpaperId(id) ? id : "default";
  }
  return map;
}

export async function getUserChatWallpaper(
  db: Db,
  userId: number,
  peerId: number
): Promise<string> {
  const row = (await db
    .prepare("SELECT wallpaper_id FROM CHAT_WALLPAPER WHERE user_id = ? AND peer_id = ?")
    .get(userId, peerId)) as { wallpaper_id: string } | undefined;
  const id = String(row?.wallpaper_id ?? "default");
  return isValidChatWallpaperId(id) ? id : "default";
}

export async function setUserChatWallpaper(
  db: Db,
  userId: number,
  peerId: number,
  wallpaperId: string
): Promise<string> {
  if (!isValidChatWallpaperId(wallpaperId)) {
    throw new Error("Fondo no válido");
  }
  await db
    .prepare(
      `INSERT INTO CHAT_WALLPAPER (user_id, peer_id, wallpaper_id, actualizado_en)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (user_id, peer_id) DO UPDATE SET
         wallpaper_id = EXCLUDED.wallpaper_id,
         actualizado_en = NOW()`
    )
    .run(userId, peerId, wallpaperId);
  return wallpaperId;
}

export function senderIniciales(nombre: string): string {
  return iniciales(nombre);
}
