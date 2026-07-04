export function saludoPorHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function formatFechaRelativa(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "Ayer";
  if (diffD < 7) return `Hace ${diffD} días`;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

export function previewNotaTexto(titulo: string, contenido: string): string {
  const body = contenido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => l.toLowerCase() !== titulo.trim().toLowerCase());
  return (body ?? "").slice(0, 100);
}

export function tituloNotaVisible(titulo: string): string {
  const t = titulo.trim();
  if (!t || /^sin\s*t[ií]tulo$/i.test(t)) return "Sin título";
  return t;
}
