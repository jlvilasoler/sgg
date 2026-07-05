const KEY_PREFIX = "scg_chat_ext_req_snoozed_v1";

export function readSnoozedIds(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}_${userId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((n): n is number => typeof n === "number" && Number.isFinite(n)));
  } catch {
    return new Set();
  }
}

export function writeSnoozedIds(userId: number, ids: Set<number>): void {
  localStorage.setItem(`${KEY_PREFIX}_${userId}`, JSON.stringify([...ids]));
}

export function snoozeRequest(userId: number, requestId: number): void {
  const ids = readSnoozedIds(userId);
  ids.add(requestId);
  writeSnoozedIds(userId, ids);
}

export function unsnoozeRequest(userId: number, requestId: number): void {
  const ids = readSnoozedIds(userId);
  ids.delete(requestId);
  writeSnoozedIds(userId, ids);
}

/** Quita IDs que ya no existen en el servidor. */
export function pruneSnoozedIds(userId: number, validIds: number[]): void {
  const valid = new Set(validIds);
  const ids = readSnoozedIds(userId);
  let changed = false;
  for (const id of ids) {
    if (!valid.has(id)) {
      ids.delete(id);
      changed = true;
    }
  }
  if (changed) writeSnoozedIds(userId, ids);
}
