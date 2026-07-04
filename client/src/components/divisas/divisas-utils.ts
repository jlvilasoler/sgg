import { APP_LOCALE, fmtDate, fmtDateHora, fmtNum, parseLocalDateFromIso } from "../../utils/format";

export { fmtDate, fmtDateHora, fmtNum, parseLocalDateFromIso };

/** "2026-05-15" → "Jueves" */
export function fmtDiaSemana(iso: string): string {
  const d = parseLocalDateFromIso(iso);
  if (!d) return "";
  const nombre = d.toLocaleDateString(APP_LOCALE, { weekday: "long" });
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/** Número de semana ISO del año (lunes = inicio de semana). "2026-05-15" → "Semana 20" */
export function fmtSemanaAnio(iso: string): string {
  const d = parseLocalDateFromIso(iso);
  if (!d) return "";
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `Semana ${week}`;
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

type TcRow = { id: number; par: string; fecha: string; valor: number };

/** Comparación vs el registro anterior del mismo par (fecha inmediatamente menor). */
export function buildTcComparacionMaps(rows: TcRow[]): {
  tendencia: Map<number, TcTendencia>;
  variacionPct: Map<number, number | null>;
} {
  const byPar = new Map<string, TcRow[]>();
  for (const r of rows) {
    const list = byPar.get(r.par) ?? [];
    list.push(r);
    byPar.set(r.par, list);
  }

  const tendencia = new Map<number, TcTendencia>();
  const variacionPct = new Map<number, number | null>();

  for (const list of byPar.values()) {
    list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]!;
      const anterior = list[i + 1];
      if (!anterior) {
        tendencia.set(cur.id, "none");
        variacionPct.set(cur.id, null);
        continue;
      }
      const diff = cur.valor - anterior.valor;
      if (Math.abs(diff) < 1e-6) tendencia.set(cur.id, "equal");
      else if (diff > 0) tendencia.set(cur.id, "up");
      else tendencia.set(cur.id, "down");

      variacionPct.set(
        cur.id,
        anterior.valor === 0 ? null : (cur.valor / anterior.valor - 1) * 100
      );
    }
  }

  return { tendencia, variacionPct };
}

export function buildTcTendenciaMap(rows: TcRow[]): Map<number, TcTendencia> {
  return buildTcComparacionMaps(rows).tendencia;
}

export function fmtTcVariacionPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}
