import type { Express, Request, Response } from "express";
import { getDb } from "./database.js";
import {
  CHAT_GENERAL_PEER_ID,
  getChatUnreadSummary,
  listChatContacts,
  listChatMessages,
  markChatRead,
  sendChatMessage,
} from "./chat-db.js";

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
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function registerChatRoutes(app: Express): void {
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
    const limit = Math.min(Math.max(Number(req.query.limit) || 80, 1), 120);

    try {
      const messages = await listChatMessages(getDb(), userId, peerId, {
        since_id: sinceId || undefined,
        before_id: beforeId || undefined,
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
      const contacts = await listChatContacts(getDb(), userId);
      const unread = await getChatUnreadSummary(getDb(), userId);
      res.json({
        ok: true,
        data: {
          contacts,
          general_unread: unread.general,
          total_unread: unread.total,
        },
      });
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : "Error al cargar contactos",
      });
    }
  });
}
