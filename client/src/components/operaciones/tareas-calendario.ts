export const DIAS_SEMANA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export const MESES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function buildMonthCells(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startOffset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= lastDay; day += 1) {
    cells.push(toIsoDate(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthRange(year: number, month: number): { desde: string; hasta: string } {
  const desde = toIsoDate(new Date(year, month, 1));
  const hasta = toIsoDate(new Date(year, month + 1, 0));
  return { desde, hasta };
}

export function formatFechaCorta(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

export function formatFechaLarga(iso: string): string {
  const d = parseIsoDate(iso);
  return d.toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isSameMonth(iso: string, year: number, month: number): boolean {
  const d = parseIsoDate(iso);
  return d.getFullYear() === year && d.getMonth() === month;
}

export function isoWeekday(iso: string): number {
  const d = parseIsoDate(iso);
  return (d.getDay() + 6) % 7;
}

export function isToday(iso: string): boolean {
  return iso === toIsoDate(new Date());
}
