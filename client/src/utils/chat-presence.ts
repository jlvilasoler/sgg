import type { ChatUserPresence } from "../types";

export function formatChatPresence(p: ChatUserPresence | undefined): string {
  if (!p) return "Desconectado";
  if (p.online) {
    const secs = p.online_desde_segundos ?? 0;
    if (secs < 60) return "En línea";
    if (secs < 3600) {
      const min = Math.floor(secs / 60);
      return `En línea · ${min} min`;
    }
    const h = Math.floor(secs / 3600);
    const min = Math.floor((secs % 3600) / 60);
    return min > 0 ? `En línea · ${h} h ${min} min` : `En línea · ${h} h`;
  }

  const hace = p.hace_segundos;
  if (hace == null) return "Desconectado";
  if (hace < 60) return "Desconectado · recién";
  if (hace < 3600) return `Desconectado · hace ${Math.floor(hace / 60)} min`;
  if (hace < 86400) return `Desconectado · hace ${Math.floor(hace / 3600)} h`;
  return `Desconectado · hace ${Math.floor(hace / 86400)} d`;
}

export function presenceStatusClass(p: ChatUserPresence | undefined): string {
  if (!p || !p.online) return "chat-presence--offline";
  return "chat-presence--online";
}
