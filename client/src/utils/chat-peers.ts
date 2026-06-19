export function isDirectMessagePeer(peerId: number): boolean {
  return peerId > 0;
}

export function isGroupChannelPeer(peerId: number): boolean {
  return peerId <= 0;
}

export function peerTabLabel(
  peerId: number,
  channels: Array<{ peer_id: number; nombre: string }>,
  contacts: Array<{ id: number; nombre: string }>
): string {
  if (isDirectMessagePeer(peerId)) {
    return contacts.find((c) => c.id === peerId)?.nombre ?? "Chat";
  }
  return channels.find((c) => c.peer_id === peerId)?.nombre ?? "Canal";
}
