import { fetchChatContacts } from "../api";
import type { ChatChannel, ChatContact } from "../types";

export interface ChatSidebarCache {
  channels: ChatChannel[];
  contacts: ChatContact[];
  external_contacts: ChatContact[];
  general_unread: number;
  total_unread: number;
  online_count: number;
  fetchedAt: number;
}

const TTL_MS = 45_000;
let cache: ChatSidebarCache | null = null;
let inflight: Promise<ChatSidebarCache> | null = null;

export function getChatSidebarCache(): ChatSidebarCache | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > TTL_MS) return null;
  return cache;
}

export function setChatSidebarCache(data: Omit<ChatSidebarCache, "fetchedAt">): void {
  cache = { ...data, fetchedAt: Date.now() };
}

export function invalidateChatSidebarCache(): void {
  cache = null;
}

export async function prefetchChatSidebar(force = false): Promise<ChatSidebarCache | null> {
  if (!force) {
    const hit = getChatSidebarCache();
    if (hit) return hit;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    const data = await fetchChatContacts();
    const entry: ChatSidebarCache = {
      channels: data.channels,
      contacts: data.contacts,
      external_contacts: data.external_contacts ?? [],
      general_unread: data.general_unread,
      total_unread: data.total_unread,
      online_count: data.online_count,
      fetchedAt: Date.now(),
    };
    cache = entry;
    return entry;
  })();
  try {
    return await inflight;
  } catch {
    return null;
  } finally {
    inflight = null;
  }
}
