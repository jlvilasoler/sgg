import type { Express, Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { CHAT_ATTACHMENTS_DIR } from "./chat-attachments-db.js";
import { getDb } from "./database.js";
import {
  CHAT_GENERAL_PEER_ID,
  addChatExternalContactByEmail,
  getChatUnreadSummary,
  listChatContacts,
  listChatExternalContacts,
  listChatMessages,
  listUserChatWallpapers,
  markChatRead,
  searchChatMessages,
  sendChatMessage,
  sendChatMessageWithAttachment,
  setUserChatWallpaper,
  userCanAccessChatMessage,
} from "./chat-db.js";
import {
  createChatChannel,
  ensureTeamChannelsSynced,
  listChatChannels,
  renameChatChannel,
} from "./chat-channels-db.js";
import { CHAT_WALLPAPER_PRESETS } from "./chat-wallpapers.js";
import { getUsersPresenceStatus, type UserPresenceStatus } from "./user-presence.js";

const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function requireUser(req: Request, res: Response): number | null {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "No autenticado" });
    return null;
  }
  return req.user.id;
}

function parsePeerId(raw: unknown): number | null {
  if (raw === "general" || raw === "0" || raw === 0) return CHAT_GENERAL_PEER_ID;
  const n = Number(raw);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.floor(n);
}

function defaultPresence(id: number): UserPresenceStatus {
  return {
    id,
    online: false,
    ultimo_visto: null,
    hace_segundos: null,
    online_desde_segundos: null,
  };
}

function summarizeChatUnread(
  channels: Awaited<ReturnType<typeof listChatChannels>>,
  contacts: Array<{ unread_count: number }>,
  externalContacts: Array<{ unread_count: number }> = []
): { total_unread: number; general_unread: number } {
  let total_unread = 0;
  let general_unread = 0;
  for (const c of channels) {
    total_unread += c.unread_count;
    if (c.peer_id === CHAT_GENERAL_PEER_ID) general_unread = c.unread_count;
  }
  for (const c of contacts) total_unread += c.unread_count;
  for (const c of externalContacts) total_unread += c.unread_count;
  return { total_unread, general_unread };
}

async function enrichContactsWithPresence(
  db: Awaited<ReturnType<typeof getDb>>,
  contacts: Awaited<ReturnType<typeof listChatContacts>>,
  externalContacts: Awaited<ReturnType<typeof listChatExternalContacts>>
) {
  const allIds = [...contacts.map((c) => c.id), ...externalContacts.map((c) => c.id)];
  const presenceMap = await getUsersPresenceStatus(db, allIds);
  const enriched = contacts.map((c) => ({
    ...c,
    presencia: presenceMap[c.id] ?? defaultPresence(c.id),
  }));
  const enrichedExternal = externalContacts.map((c) => ({
    ...c,
    presencia: presenceMap[c.id] ?? defaultPresence(c.id),
  }));
  const online_count = [...enriched, ...enrichedExternal].filter((c) => c.presencia.online).length;
  return { enriched, enrichedExternal, online_count };
}

export function registerChatRoutes(app: Express): void {
  app.get("/api/chat/bootstrap", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    let peerId = CHAT_GENERAL_PEER_ID;
    const peerRaw = req.query.peer_id;
    if (peerRaw !== undefined && peerRaw !== "") {
      const parsed = parsePeerId(peerRaw);
      if (parsed === null) {
        res.status(400).json({ ok: false, error: "Canal no válido" });
        return;
      }
      peerId = parsed;
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 120);

    try {
      const db = getDb();
      await ensureTeamChannelsSynced(db);
      const [channels, contacts, externalContacts, wallpapersByPeer, messages] = await Promise.all([
        listChatChannels(db, userId),
        listChatContacts(db, userId),
        listChatExternalContacts(db, userId),
        listUserChatWallpapers(db, userId),
        listChatMessages(db, userId, peerId, { limit }),
      ]);
      const { enriched, enrichedExternal, online_count } = await enrichContactsWithPresence(
        db,
        contacts,
        externalContacts
      );
      const { total_unread, general_unread } = summarizeChatUnread(
        channels,
        enriched,
        enrichedExternal
      );

      res.json({
        ok: true,
        data: {
          channels,
          contacts: enriched,
          external_contacts: enrichedExternal,
          wallpapers: { presets: CHAT_WALLPAPER_PRESETS, by_peer: wallpapersByPeer },
          messages,
          total_unread,
          general_unread,
          online_count,
          peer_id: peerId,
        },
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al iniciar chat",
      });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const peerId = parsePeerId(req.query.peer_id ?? req.query.channel);
    if (peerId === null) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const sinceId = Math.max(0, Number(req.query.since_id) || 0);
    const beforeId = Math.max(0, Number(req.query.before_id) || 0);
    const aroundId = Math.max(0, Number(req.query.around_id) || 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 120);

    try {
      const messages = await listChatMessages(getDb(), userId, peerId, {
        since_id: sinceId || undefined,
        before_id: beforeId || undefined,
        around_id: aroundId || undefined,
        limit,
      });
      res.json({ ok: true, data: { messages, peer_id: peerId } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar mensajes",
      });
    }
  });

  app.post("/api/chat/messages", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const peerId = parsePeerId(req.body?.peer_id ?? req.body?.channel);
    if (peerId === null) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const body = String(req.body?.body ?? "");
    try {
      const message = await sendChatMessage(getDb(), userId, peerId, body);
      res.status(201).json({ ok: true, data: message });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al enviar mensaje",
      });
    }
  });

  app.post("/api/chat/messages/attachment", chatAttachmentUpload.single("archivo"), async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const peerId = parsePeerId(req.body?.peer_id ?? req.body?.channel);
    if (peerId === null) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const file = req.file;
    if (!file?.buffer?.length) {
      res.status(400).json({ ok: false, error: "Seleccioná un archivo o foto" });
      return;
    }

    const body = String(req.body?.body ?? "");
    try {
      const message = await sendChatMessageWithAttachment(getDb(), userId, peerId, body, {
        buffer: file.buffer,
        mime: file.mimetype,
        originalName: file.originalname,
      });
      res.status(201).json({ ok: true, data: message });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al enviar adjunto",
      });
    }
  });

  app.get("/api/chat/attachments/:messageId", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const messageId = Math.max(0, Number(req.params.messageId) || 0);
    if (messageId <= 0) {
      res.status(400).json({ ok: false, error: "Adjunto no válido" });
      return;
    }

    try {
      const row = await userCanAccessChatMessage(getDb(), userId, messageId);
      if (!row?.attachment_archivo) {
        res.status(404).json({ ok: false, error: "Adjunto no encontrado" });
        return;
      }

      const archivo = path.basename(String(row.attachment_archivo));
      const full = path.join(CHAT_ATTACHMENTS_DIR, archivo);
      if (!fs.existsSync(full)) {
        res.status(404).json({ ok: false, error: "Archivo no disponible" });
        return;
      }

      const mime = String(row.attachment_mime ?? "application/octet-stream");
      const nombre = String(row.attachment_nombre ?? "archivo");
      const inline = String(row.attachment_tipo) === "imagen";
      res.setHeader("Content-Type", mime);
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(nombre)}"`
      );
      fs.createReadStream(full).pipe(res);
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al descargar adjunto",
      });
    }
  });

  app.post("/api/chat/read", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const peerId = parsePeerId(req.body?.peer_id ?? req.body?.channel);
    if (peerId === null) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const lastMessageId = Math.max(0, Number(req.body?.last_message_id) || 0);
    try {
      await markChatRead(getDb(), userId, peerId, lastMessageId);
      const unread = await getChatUnreadSummary(getDb(), userId);
      res.json({ ok: true, data: unread });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al marcar leído",
      });
    }
  });

  app.get("/api/chat/unread", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    try {
      const unread = await getChatUnreadSummary(getDb(), userId);
      res.json({ ok: true, data: unread });
    } catch (e) {
      console.error("[chat/unread] error:", e);
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al consultar no leídos",
      });
    }
  });

  app.get("/api/chat/contacts", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    try {
      const db = getDb();
      await ensureTeamChannelsSynced(db);
      const [contacts, externalContacts, channels] = await Promise.all([
        listChatContacts(db, userId),
        listChatExternalContacts(db, userId),
        listChatChannels(db, userId),
      ]);
      const { enriched, enrichedExternal, online_count } = await enrichContactsWithPresence(
        db,
        contacts,
        externalContacts
      );
      const { total_unread, general_unread } = summarizeChatUnread(
        channels,
        enriched,
        enrichedExternal
      );
      res.json({
        ok: true,
        data: {
          channels,
          contacts: enriched,
          external_contacts: enrichedExternal,
          general_unread,
          total_unread,
          online_count,
        },
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar contactos",
      });
    }
  });

  app.get("/api/chat/search", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.status(400).json({ ok: false, error: "Ingresá al menos 2 caracteres" });
      return;
    }

    const peerRaw = req.query.peer_id;
    let peerId: number | undefined;
    if (peerRaw !== undefined && peerRaw !== "") {
      const parsed = parsePeerId(peerRaw);
      if (parsed === null) {
        res.status(400).json({ ok: false, error: "Canal no válido" });
        return;
      }
      peerId = parsed;
    }

    const limite = Math.min(Math.max(Number(req.query.limit) || 40, 1), 80);

    try {
      const hits = await searchChatMessages(getDb(), userId, q, {
        peer_id: peerId,
        limit: limite,
      });
      res.json({ ok: true, data: { hits, query: q } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al buscar mensajes",
      });
    }
  });

  app.get("/api/chat/presence", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    try {
      const db = getDb();
      const [contacts, externalContacts] = await Promise.all([
        listChatContacts(db, userId),
        listChatExternalContacts(db, userId),
      ]);
      const ids = [...contacts.map((c) => c.id), ...externalContacts.map((c) => c.id)];
      const users = await getUsersPresenceStatus(db, ids);
      const online_count = Object.values(users).filter((p) => p.online).length;
      res.json({ ok: true, data: { users, online_count } });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al consultar presencia",
      });
    }
  });

  app.get("/api/chat/wallpapers", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    try {
      const db = getDb();
      const by_peer = await listUserChatWallpapers(db, userId);
      res.json({
        ok: true,
        data: { presets: CHAT_WALLPAPER_PRESETS, by_peer },
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar fondos",
      });
    }
  });

  app.put("/api/chat/wallpaper", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const peerId = parsePeerId(req.body?.peer_id ?? req.body?.channel);
    if (peerId === null) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const wallpaperId = String(req.body?.wallpaper_id ?? "default").trim();
    try {
      const saved = await setUserChatWallpaper(getDb(), userId, peerId, wallpaperId);
      res.json({ ok: true, data: { peer_id: peerId, wallpaper_id: saved } });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al guardar fondo",
      });
    }
  });

  app.post("/api/chat/contacts/external", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const email = String(req.body?.email ?? "").trim();
    try {
      const contact = await addChatExternalContactByEmail(getDb(), userId, email);
      const presenceMap = await getUsersPresenceStatus(getDb(), [contact.id]);
      res.status(201).json({
        ok: true,
        data: {
          contact: {
            ...contact,
            presencia: presenceMap[contact.id] ?? defaultPresence(contact.id),
          },
        },
      });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo agregar el contacto",
      });
    }
  });

  app.get("/api/chat/channels", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    try {
      const db = getDb();
      await ensureTeamChannelsSynced(db);
      const channels = await listChatChannels(db, userId);
      res.json({ ok: true, data: { channels } });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar canales",
      });
    }
  });

  app.post("/api/chat/channels", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const nombre = String(req.body?.nombre ?? "").trim();
    try {
      const channel = await createChatChannel(getDb(), userId, nombre);
      res.status(201).json({ ok: true, data: channel });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al crear canal",
      });
    }
  });

  app.put("/api/chat/channels/:id/rename", async (req, res) => {
    const userId = requireUser(req, res);
    if (userId === null) return;

    const channelId = Math.max(0, Number(req.params.id) || 0);
    if (channelId <= 0) {
      res.status(400).json({ ok: false, error: "Canal no válido" });
      return;
    }

    const nombre = String(req.body?.nombre ?? "").trim();
    try {
      const channel = await renameChatChannel(getDb(), userId, channelId, nombre);
      res.json({ ok: true, data: channel });
    } catch (e) {
      res.status(400).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al renombrar canal",
      });
    }
  });
}
