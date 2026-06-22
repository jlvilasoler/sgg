export function fmtNum(n: number, decimals = 2): string {
  return (n ?? 0).toLocaleString("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const head = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    const [y, m, d] = head.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-UY", {
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
    fecha: d.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  };
}

const MESES_ES = [
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
];

/** "2026-05" → "Mayo 2026" */
export function fmtMesAnio(ym: string): string {
  if (!ym || ym.length < 7) return ym;
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${MESES_ES[idx]} ${y}`;
}

export type TcTendencia = "up" | "down" | "equal" | "none";

/** Comparación vs el registro anterior del mismo par (fecha inmediatamente menor). */
export function buildTcTendenciaMap(
  rows: { id: number; par: string; fecha: string; valor: number }[]
): Map<number, TcTendencia> {
  const byPar = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byPar.get(r.par) ?? [];
    list.push(r);
    byPar.set(r.par, list);
  }

  const map = new Map<number, TcTendencia>();
  for (const list of byPar.values()) {
    list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const anterior = list[i + 1];
      if (!anterior) {
        map.set(cur.id, "none");
        continue;
      }
      const diff = cur.valor - anterior.valor;
      if (Math.abs(diff) < 1e-6) map.set(cur.id, "equal");
      else if (diff > 0) map.set(cur.id, "up");
      else map.set(cur.id, "down");
    }
  }
  return map;
}
