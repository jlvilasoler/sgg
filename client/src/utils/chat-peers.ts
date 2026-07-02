export const CHAT_GENERAL_PEER_ID = 0;

export function isDirectMessagePeer(peerId: number): boolean {
  return peerId > 0;
}

/** Canal grupal por defecto del usuario (peer 0 solo en cuenta semilla). */
export function pickDefaultChatPeer(
  channels: Array<{ peer_id: number; es_sistema: boolean }>
): number {
  if (channels.some((c) => c.peer_id === CHAT_GENERAL_PEER_ID)) {
    return CHAT_GENERAL_PEER_ID;
  }
  const system = channels.find((c) => c.es_sistema) ?? channels[0];
  return system?.peer_id ?? CHAT_GENERAL_PEER_ID;
}

export function isGroupPeerAccessible(
  peerId: number,
  channels: Array<{ peer_id: number }>
): boolean {
  return channels.some((c) => c.peer_id === peerId);
}

export function isGroupChannelPeer(peerId: number): boolean {
  return peerId <= 0;
}

export function peerTabLabel(
  peerId: number,
  channels: Array<{ peer_id: number; nombre: string }>,
  contacts: Array<{ id: number; nombre: string }>,
  externalContacts: Array<{ id: number; nombre: string }> = []
): string {
  if (isDirectMessagePeer(peerId)) {
    return (
      contacts.find((c) => c.id === peerId)?.nombre ??
      externalContacts.find((c) => c.id === peerId)?.nombre ??
      "Chat"
    );
  }
  return channels.find((c) => c.peer_id === peerId)?.nombre ?? "Canal";
}
