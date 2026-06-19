import type { Db } from "./db/pg-client.js";
import { ROL_LABELS } from "./auth-db.js";

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
  recipient_id: number;
  body: string;
  creado_en: string;
  es_propio: boolean;
}

export interface ChatContactDto {
  id: number;
  nombre: string;
  rol_label: string;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

function iniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function trimBody(body: string): string {
  const t = body.trim();
  if (!t) throw new Error("El mensaje no puede estar vacío");
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
}

async function getLastReadId(db: Db, userId: number, peerId: number): Promise<number> {
  const row = (await db
    .prepare("SELECT last_read_message_id FROM CHAT_READ_STATE WHERE user_id = ? AND peer_id = ?")
    .get(userId, peerId)) as { last_read_message_id: number } | undefined;
  return row?.last_read_message_id ?? 0;
}

async function rowToDto(
  row: ChatMessageRow & { sender_nombre: string },
  currentUserId: number
): Promise<ChatMessageDto> {
  return {
    id: row.id,
    sender_id: row.sender_id,
    sender_nombre: row.sender_nombre,
    recipient_id: row.recipient_id,
    body: row.body,
    creado_en: row.creado_en,
    es_propio: row.sender_id === currentUserId,
  };
}

export async function listChatMessages(
  db: Db,
  userId: number,
  peerId: number,
  opts?: { since_id?: number; before_id?: number; limit?: number }
): Promise<ChatMessageDto[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 120);
  const sinceId = Math.max(0, opts?.since_id ?? 0);
  const beforeId = opts?.before_id ?? 0;

  let rows: Array<ChatMessageRow & { sender_nombre: string }>;

  if (peerId === CHAT_GENERAL_PEER_ID) {
    if (beforeId > 0) {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id = 0 AND m.id < ?
           ORDER BY m.id DESC LIMIT ?`
        )
        .all(beforeId, limit)) as Array<ChatMessageRow & { sender_nombre: string }>;
      rows.reverse();
    } else if (sinceId > 0) {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id = 0 AND m.id > ?
           ORDER BY m.id ASC LIMIT ?`
        )
        .all(sinceId, limit)) as Array<ChatMessageRow & { sender_nombre: string }>;
    } else {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id = 0
           ORDER BY m.id DESC LIMIT ?`
        )
        .all(limit)) as Array<ChatMessageRow & { sender_nombre: string }>;
      rows.reverse();
    }
  } else {
    if (beforeId > 0) {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id > 0
             AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
             AND m.id < ?
           ORDER BY m.id DESC LIMIT ?`
        )
        .all(userId, peerId, peerId, userId, beforeId, limit)) as Array<
        ChatMessageRow & { sender_nombre: string }
      >;
      rows.reverse();
    } else if (sinceId > 0) {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id > 0
             AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
             AND m.id > ?
           ORDER BY m.id ASC LIMIT ?`
        )
        .all(userId, peerId, peerId, userId, sinceId, limit)) as Array<
        ChatMessageRow & { sender_nombre: string }
      >;
    } else {
      rows = (await db
        .prepare(
          `SELECT m.*, u.nombre AS sender_nombre
           FROM CHAT_MESSAGES m
           JOIN USERS u ON u.id = m.sender_id
           WHERE m.recipient_id > 0
             AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
           ORDER BY m.id DESC LIMIT ?`
        )
        .all(userId, peerId, peerId, userId, limit)) as Array<
        ChatMessageRow & { sender_nombre: string }
      >;
      rows.reverse();
    }
  }

  const result: ChatMessageDto[] = [];
  for (const row of rows) {
    result.push(await rowToDto(row, userId));
  }
  return result;
}

export async function sendChatMessage(
  db: Db,
  senderId: number,
  recipientId: number,
  body: string
): Promise<ChatMessageDto> {
  const text = trimBody(body);
  if (recipientId !== CHAT_GENERAL_PEER_ID) {
    const peer = (await db
      .prepare("SELECT id FROM USERS WHERE id = ? AND activo = 1")
      .get(recipientId)) as { id: number } | undefined;
    if (!peer || peer.id === senderId) {
      throw new Error("Usuario no válido para mensaje directo");
    }
  }

  const result = await db
    .prepare(`INSERT INTO CHAT_MESSAGES (sender_id, recipient_id, body) VALUES (?, ?, ?)`)
    .run(senderId, recipientId, text);

  const id = Number(result.lastInsertRowid);
  const row = (await db
    .prepare(
      `SELECT m.*, u.nombre AS sender_nombre
       FROM CHAT_MESSAGES m
       JOIN USERS u ON u.id = m.sender_id
       WHERE m.id = ?`
    )
    .get(id)) as (ChatMessageRow & { sender_nombre: string }) | undefined;

  if (!row) throw new Error("No se pudo guardar el mensaje");
  return rowToDto(row, senderId);
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

  if (peerId === CHAT_GENERAL_PEER_ID) {
    const row = (await db
      .prepare(
        `SELECT COUNT(*) AS n FROM CHAT_MESSAGES
         WHERE recipient_id = 0 AND id > ? AND sender_id != ?`
      )
      .get(lastRead, userId)) as { n: number };
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
  const general = await unreadCountForPeer(db, userId, CHAT_GENERAL_PEER_ID);

  const dmRows = (await db
    .prepare(
      `SELECT DISTINCT
         CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS peer_id
       FROM CHAT_MESSAGES
       WHERE recipient_id > 0 AND (sender_id = ? OR recipient_id = ?)`
    )
    .all(userId, userId, userId)) as Array<{ peer_id: number }>;

  let dmTotal = 0;
  for (const r of dmRows) {
    dmTotal += await unreadCountForPeer(db, userId, r.peer_id);
  }

  return { total: general + dmTotal, general };
}

export async function listChatContacts(db: Db, userId: number): Promise<ChatContactDto[]> {
  const users = (await db
    .prepare(
      `SELECT u.id, u.nombre, u.rol FROM USERS u
       WHERE u.activo = 1 AND u.id != ?
       ORDER BY LOWER(u.nombre) ASC`
    )
    .all(userId)) as Array<{ id: number; nombre: string; rol: string }>;

  const contacts: ChatContactDto[] = [];
  for (const u of users) {
    const last = (await db
      .prepare(
        `SELECT body, creado_en FROM CHAT_MESSAGES
         WHERE recipient_id > 0
           AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
         ORDER BY id DESC LIMIT 1`
      )
      .get(userId, u.id, u.id, userId)) as { body: string; creado_en: string } | undefined;

    const unread = await unreadCountForPeer(db, userId, u.id);
    const rol = u.rol as keyof typeof ROL_LABELS;

    contacts.push({
      id: u.id,
      nombre: u.nombre,
      rol_label: ROL_LABELS[rol] ?? u.rol,
      unread_count: unread,
      last_message: last?.body ?? null,
      last_message_at: last?.creado_en ?? null,
    });
  }

  contacts.sort((a, b) => {
    if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    if (ta !== tb) return tb - ta;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return contacts;
}

export function senderIniciales(nombre: string): string {
  return iniciales(nombre);
}
