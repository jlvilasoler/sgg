import type { Db } from "./db/pg-client.js";
import { previewTextFromRow } from "./chat-attachments-db.js";
import { DEFAULT_TEAM_CHANNEL } from "./brand.js";

export const CHAT_GENERAL_PEER_ID = 0;

export interface ChatChannelDto {
  id: number;
  peer_id: number;
  nombre: string;
  es_sistema: boolean;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export function isDirectMessagePeer(peerId: number): boolean {
  return peerId > 0;
}

export function isGroupChannelPeer(peerId: number): boolean {
  return peerId <= 0;
}

export function channelIdFromPeer(peerId: number): number | null {
  if (peerId >= 0) return null;
  return -peerId;
}

function trimChannelName(nombre: string): string {
  const t = nombre.trim();
  if (t.length < 2) throw new Error("El nombre del canal debe tener al menos 2 caracteres");
  if (t.length > 60) throw new Error("El nombre del canal es demasiado largo (máx. 60)");
  return t;
}

export async function initChatChannelTables(db: Db): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS CHAT_CHANNELS (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      peer_id INTEGER NOT NULL UNIQUE,
      es_sistema INTEGER NOT NULL DEFAULT 0,
      creado_por INTEGER REFERENCES USERS(id) ON DELETE SET NULL,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ DEFAULT NOW()
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS CHAT_CHANNEL_MEMBERS (
      channel_id INTEGER NOT NULL REFERENCES CHAT_CHANNELS(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES USERS(id) ON DELETE CASCADE,
      PRIMARY KEY (channel_id, user_id)
    )`
  ).run();

  const general = (await db
    .prepare("SELECT id FROM CHAT_CHANNELS WHERE peer_id = 0")
    .get()) as { id: number } | undefined;

  let generalId = general?.id;
  if (!generalId) {
    const ins = await db
      .prepare(
        `INSERT INTO CHAT_CHANNELS (nombre, peer_id, es_sistema, creado_por)
         VALUES (?, 0, 1, NULL)`
      )
      .run(DEFAULT_TEAM_CHANNEL);
    generalId = Number(ins.lastInsertRowid);
  }

  await db
    .prepare(
      `UPDATE CHAT_CHANNELS SET nombre = ? WHERE peer_id = 0 AND nombre = 'Equipo SGG'`
    )
    .run(DEFAULT_TEAM_CHANNEL);

  await db
    .prepare(
      `INSERT INTO CHAT_CHANNEL_MEMBERS (channel_id, user_id)
       SELECT ?, u.id FROM USERS u WHERE u.activo = 1
       ON CONFLICT (channel_id, user_id) DO NOTHING`
    )
    .run(generalId);
}

async function addAllUsersToChannel(db: Db, channelId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO CHAT_CHANNEL_MEMBERS (channel_id, user_id)
       SELECT ?, u.id FROM USERS u WHERE u.activo = 1
       ON CONFLICT (channel_id, user_id) DO NOTHING`
    )
    .run(channelId);
}

export async function userIsChannelMember(
  db: Db,
  userId: number,
  channelId: number
): Promise<boolean> {
  const row = (await db
    .prepare(
      "SELECT 1 AS ok FROM CHAT_CHANNEL_MEMBERS WHERE channel_id = ? AND user_id = ?"
    )
    .get(channelId, userId)) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

export async function assertUserCanAccessGroupPeer(
  db: Db,
  userId: number,
  peerId: number
): Promise<void> {
  if (peerId === CHAT_GENERAL_PEER_ID) {
    const ok = await userIsChannelMember(
      db,
      userId,
      (await getChannelIdByPeer(db, peerId)) ?? 0
    );
    if (!ok) throw new Error("No tenés acceso a este canal");
    return;
  }
  if (peerId < 0) {
    const channelId = -peerId;
    if (!(await userIsChannelMember(db, userId, channelId))) {
      throw new Error("No tenés acceso a este canal");
    }
  }
}

async function getChannelIdByPeer(db: Db, peerId: number): Promise<number | null> {
  const row = (await db
    .prepare("SELECT id FROM CHAT_CHANNELS WHERE peer_id = ?")
    .get(peerId)) as { id: number } | undefined;
  return row?.id ?? null;
}

export async function getChannelNameByPeer(db: Db, peerId: number): Promise<string | null> {
  const row = (await db
    .prepare("SELECT nombre FROM CHAT_CHANNELS WHERE peer_id = ?")
    .get(peerId)) as { nombre: string } | undefined;
  return row?.nombre ?? null;
}

export async function listChatChannels(db: Db, userId: number): Promise<ChatChannelDto[]> {
  const rows = (await db
    .prepare(
      `SELECT c.id, c.nombre, c.peer_id, c.es_sistema,
              lm.body AS last_body,
              lm.creado_en AS last_creado_en,
              lm.attachment_tipo AS last_attachment_tipo,
              lm.attachment_nombre AS last_attachment_nombre,
              COALESCE(ur.unread_n, 0) AS unread_n
       FROM CHAT_CHANNELS c
       JOIN CHAT_CHANNEL_MEMBERS m ON m.channel_id = c.id AND m.user_id = ?
       LEFT JOIN LATERAL (
         SELECT msg.body, msg.creado_en, msg.attachment_tipo, msg.attachment_nombre
         FROM CHAT_MESSAGES msg
         WHERE msg.recipient_id = c.peer_id
         ORDER BY msg.id DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::bigint AS unread_n
         FROM CHAT_MESSAGES msg
         WHERE msg.recipient_id = c.peer_id
           AND msg.id > COALESCE((
             SELECT rs.last_read_message_id
             FROM CHAT_READ_STATE rs
             WHERE rs.user_id = ? AND rs.peer_id = c.peer_id
           ), 0)
           AND msg.sender_id != ?
       ) ur ON TRUE
       ORDER BY c.es_sistema DESC, LOWER(c.nombre) ASC`
    )
    .all(userId, userId, userId)) as Array<{
    id: number;
    nombre: string;
    peer_id: number;
    es_sistema: number;
    last_body: string | null;
    last_creado_en: string | null;
    last_attachment_tipo: string | null;
    last_attachment_nombre: string | null;
    unread_n: number | string;
  }>;

  return rows.map((c) => {
    const last =
      c.last_body != null
        ? {
            body: c.last_body,
            creado_en: c.last_creado_en ?? "",
            attachment_tipo: c.last_attachment_tipo,
            attachment_nombre: c.last_attachment_nombre,
          }
        : null;
    return {
      id: c.id,
      peer_id: c.peer_id,
      nombre: c.nombre,
      es_sistema: c.es_sistema === 1,
      unread_count: Number(c.unread_n ?? 0),
      last_message: last ? previewTextFromRow(last) : null,
      last_message_at: last?.creado_en ?? null,
    };
  });
}

export async function createChatChannel(
  db: Db,
  userId: number,
  nombre: string
): Promise<ChatChannelDto> {
  const label = trimChannelName(nombre);
  const dup = (await db
    .prepare("SELECT id FROM CHAT_CHANNELS WHERE LOWER(nombre) = LOWER(?)")
    .get(label)) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe un canal con ese nombre");

  const ins = await db
    .prepare(
      `INSERT INTO CHAT_CHANNELS (nombre, peer_id, es_sistema, creado_por)
       VALUES (?, 0, 0, ?)`
    )
    .run(label, userId);

  const id = Number(ins.lastInsertRowid);
  const peerId = -id;
  await db.prepare("UPDATE CHAT_CHANNELS SET peer_id = ? WHERE id = ?").run(peerId, id);
  await addAllUsersToChannel(db, id);

  return {
    id,
    peer_id: peerId,
    nombre: label,
    es_sistema: false,
    unread_count: 0,
    last_message: null,
    last_message_at: null,
  };
}

export async function renameChatChannel(
  db: Db,
  userId: number,
  channelId: number,
  nombre: string
): Promise<ChatChannelDto> {
  const label = trimChannelName(nombre);
  const channel = (await db
    .prepare("SELECT id, nombre, peer_id, es_sistema FROM CHAT_CHANNELS WHERE id = ?")
    .get(channelId)) as
    | { id: number; nombre: string; peer_id: number; es_sistema: number }
    | undefined;

  if (!channel) throw new Error("Canal no encontrado");
  if (!(await userIsChannelMember(db, userId, channelId))) {
    throw new Error("No tenés acceso a este canal");
  }

  const dup = (await db
    .prepare("SELECT id FROM CHAT_CHANNELS WHERE LOWER(nombre) = LOWER(?) AND id != ?")
    .get(label, channelId)) as { id: number } | undefined;
  if (dup) throw new Error("Ya existe un canal con ese nombre");

  await db
    .prepare(
      `UPDATE CHAT_CHANNELS SET nombre = ?, actualizado_en = NOW() WHERE id = ?`
    )
    .run(label, channelId);

  const listed = await listChatChannels(db, userId);
  const updated = listed.find((c) => c.id === channelId);
  if (!updated) throw new Error("No se pudo actualizar el canal");
  return updated;
}
