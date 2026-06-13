/** Guarda y restaura scroll de ventana tras actualizaciones que re-renderizan listas largas. */
export function captureScrollY(): number {
  return window.scrollY;
}

export function restoreScrollY(y: number): void {
  if (y <= 0) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "instant" });
    });
  });
}

export async function withScrollPreserve<T>(fn: () => Promise<T>): Promise<T> {
  const y = captureScrollY();
  try {
    return await fn();
  } finally {
    restoreScrollY(y);
  }
}
