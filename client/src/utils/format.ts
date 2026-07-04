/** Locale único para números, fechas y moneda en toda la app (Uruguay). */
export const APP_LOCALE = "es-UY";

export function fmtNum(n: number, decimals = 2): string {
  return (n ?? 0).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function parseLocalDateFromIso(iso: string): Date | null {
  if (!iso) return null;
  const head = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    const [y, m, day] = head.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(iso: string): string {
  const d = parseLocalDateFromIso(iso);
  if (!d) return "";
  const head = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    const [y, m, day] = head.split("-");
    return `${day}/${m}/${y}`;
  }
  return d.toLocaleDateString(APP_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function fmtDateHora(iso: string): { fecha: string; hora: string } | null {
  if (!iso) return null;
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return {
    fecha: d.toLocaleDateString(APP_LOCALE, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString(APP_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}
