import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  Loader2,
  Sun,
} from "lucide-react";
import { fetchOperativaLluvia } from "../../api";
import type { AuthUser, OperativaLluviaDia } from "../../types";
import { toIsoDate } from "../operaciones/tareas-calendario";
import {
  ejercicioConfigFromUser,
  ejercicioVigente,
} from "../../utils/ejercicio-contable";

interface Props {
  apiOnline: boolean;
  user: AuthUser;
  onOpen: () => void;
}

type ClimaNivel = "clear" | "mist" | "drizzle" | "rain" | "heavy" | "storm";

interface MesBucket {
  key: string;
  label: string;
  short: string;
}

interface EstacionRow {
  key: string;
  nombre: string;
  mesMm: number;
  ejercicioMm: number;
  mensual: number[];
  promedioAcum: (number | null)[];
}

function formatMm(mm: number): string {
  if (!Number.isFinite(mm) || mm <= 0) return "0";
  const rounded = Math.round(mm * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function climaNivel(mm: number): ClimaNivel {
  if (mm <= 0) return "clear";
  if (mm < 0.5) return "mist";
  if (mm < 2) return "drizzle";
  if (mm < 8) return "rain";
  if (mm < 20) return "heavy";
  return "storm";
}

function climaIcon(nivel: ClimaNivel, size = 14): ReactNode {
  const stroke = 1.75;
  switch (nivel) {
    case "clear":
      return <Sun size={size} strokeWidth={stroke} />;
    case "mist":
      return <CloudFog size={size} strokeWidth={stroke} />;
    case "drizzle":
      return <CloudDrizzle size={size} strokeWidth={stroke} />;
    case "rain":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "heavy":
      return <CloudRain size={size} strokeWidth={stroke} />;
    case "storm":
      return <CloudLightning size={size} strokeWidth={stroke} />;
  }
}

function monthYearLabel(d: Date): string {
  const mes = d.toLocaleDateString("es-UY", { month: "long" });
  const anio = d.getFullYear();
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${anio}`;
}

/** Primera palabra arriba, resto abajo (p. ej. Estancia / Quitute). */
function nombreEnDosFilas(nombre: string): { linea1: string; linea2: string | null } {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { linea1: nombre.trim(), linea2: null };
  return { linea1: parts[0]!, linea2: parts.slice(1).join(" ") };
}

/** 12 meses del ejercicio contable vigente. */
function mesesDelEjercicio(desdeIso: string): MesBucket[] {
  const [y0, m0] = desdeIso.split("-").map(Number);
  const out: MesBucket[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(y0!, (m0! - 1) + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    out.push({
      key: `${y}-${pad2(m)}`,
      label: d.toLocaleDateString("es-UY", { month: "long", year: "numeric" }),
      short: d.toLocaleDateString("es-UY", { month: "narrow" }).toUpperCase(),
    });
  }
  return out;
}

function acumularPorEstablecimiento(
  rows: OperativaLluviaDia[],
  desde: string,
  hasta: string,
): Map<string, { nombre: string; mm: number }> {
  const byEst = new Map<string, { nombre: string; mm: number }>();
  for (const row of rows) {
    if (row.fecha < desde || row.fecha > hasta) continue;
    const mm = Number.isFinite(row.mm) ? row.mm : 0;
    if (mm < 0) continue;
    const key = String(row.marcador_id ?? 0);
    const prev = byEst.get(key) ?? {
      nombre: row.marcador_nombre?.trim() || "Campo",
      mm: 0,
    };
    prev.mm += mm;
    byEst.set(key, prev);
  }
  for (const [k, v] of byEst) {
    byEst.set(k, { ...v, mm: Math.round(v.mm * 10) / 10 });
  }
  return byEst;
}

function mensualPorEstablecimiento(
  rows: OperativaLluviaDia[],
  estKey: string,
  meses: MesBucket[],
): number[] {
  const totals = new Map(meses.map((m) => [m.key, 0]));
  for (const row of rows) {
    if (String(row.marcador_id ?? 0) !== estKey) continue;
    const mk = row.fecha.slice(0, 7);
    if (!totals.has(mk)) continue;
    const mm = Number.isFinite(row.mm) ? row.mm : 0;
    if (mm <= 0) continue;
    totals.set(mk, (totals.get(mk) ?? 0) + mm);
  }
  return meses.map((m) => Math.round((totals.get(m.key) ?? 0) * 10) / 10);
}

/** Promedio acumulado mes a mes (solo hasta el índice vigente). */
function promedioAcumulado(mensual: number[], hastaIdx: number): (number | null)[] {
  let sum = 0;
  return mensual.map((mm, i) => {
    if (i > hastaIdx) return null;
    sum += mm;
    return Math.round((sum / (i + 1)) * 10) / 10;
  });
}

function LluviaMesChart({
  meses,
  mensual,
  promedio,
  mesActualKey,
}: {
  meses: MesBucket[];
  mensual: number[];
  promedio: (number | null)[];
  mesActualKey: string;
}) {
  const gid = useId().replace(/:/g, "");
  const W = 168;
  const H = 34;
  const padT = 3;
  const padB = 11;
  const padL = 2;
  const padR = 2;
  const chartH = H - padT - padB;
  const chartW = W - padL - padR;
  const n = meses.length;
  const gap = 2.2;
  const barW = Math.max(4, (chartW - gap * (n - 1)) / n);
  const maxVal = Math.max(1, ...mensual, ...promedio.filter((v): v is number => v != null));

  const barPts = mensual.map((mm, i) => {
    const x = padL + i * (barW + gap);
    const h = Math.max(mm > 0 ? 2 : 0, (mm / maxVal) * chartH);
    const y = padT + chartH - h;
    const isCurrent = meses[i]?.key === mesActualKey;
    const isFuture = promedio[i] == null;
    return { x, y, h, mm, isCurrent, isFuture, label: meses[i]! };
  });

  const linePts = promedio
    .map((avg, i) => {
      if (avg == null) return null;
      const cx = padL + i * (barW + gap) + barW / 2;
      const cy = padT + chartH - (avg / maxVal) * chartH;
      return { cx, cy, avg, i };
    })
    .filter((p): p is { cx: number; cy: number; avg: number; i: number } => p != null);

  const linePath = linePts
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
    .join(" ");

  const areaPath =
    linePts.length > 1
      ? `${linePath} L ${linePts[linePts.length - 1]!.cx.toFixed(1)} ${(padT + chartH).toFixed(1)} L ${linePts[0]!.cx.toFixed(1)} ${(padT + chartH).toFixed(1)} Z`
      : "";

  return (
    <svg
      className="wx-loc-chart"
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Precipitación mensual y promedio acumulado del ejercicio"
    >
      <defs>
        <linearGradient id={`wxBar-${gid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`wxBarCur-${gid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`wxArea-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line
        x1={padL}
        y1={padT + chartH}
        x2={W - padR}
        y2={padT + chartH}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1"
      />

      {barPts.map((b) => (
        <g key={b.label.key}>
          <title>
            {b.label.label}: {formatMm(b.mm)} mm
            {b.isCurrent ? " · mes actual" : ""}
          </title>
          <rect
            x={b.x}
            y={b.isFuture ? padT + chartH - 1.5 : b.y}
            width={barW}
            height={b.isFuture ? 1.5 : Math.max(b.h, b.mm > 0 ? 2 : 1.2)}
            rx={1.4}
            fill={
              b.isFuture
                ? "rgba(255,255,255,0.08)"
                : b.isCurrent
                  ? `url(#wxBarCur-${gid})`
                  : `url(#wxBar-${gid})`
            }
            opacity={b.isFuture ? 0.7 : 1}
          />
          <text
            x={b.x + barW / 2}
            y={H - 2}
            textAnchor="middle"
            className={`wx-loc-chart-lbl${b.isCurrent ? " is-current" : ""}`}
          >
            {b.label.short}
          </text>
        </g>
      ))}

      {areaPath ? <path d={areaPath} fill={`url(#wxArea-${gid})`} /> : null}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="#c4b5fd"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {linePts.map((p) => (
        <g key={`avg-${p.i}`}>
          <title>
            Prom. acum. {meses[p.i]?.label}: {formatMm(p.avg)} mm/mes
          </title>
          <circle cx={p.cx} cy={p.cy} r={1.7} fill="#ede9fe" stroke="#8b5cf6" strokeWidth="0.8" />
        </g>
      ))}
    </svg>
  );
}

export default function HomeLluviaDashboardPanel({ apiOnline, user, onOpen }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OperativaLluviaDia[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hoy = useMemo(() => toIsoDate(new Date()), []);
  const now = useMemo(() => new Date(), []);
  const mes = now.getMonth();
  const desdeMes = `${now.getFullYear()}-${String(mes + 1).padStart(2, "0")}-01`;
  const mesActualKey = `${now.getFullYear()}-${pad2(mes + 1)}`;

  const ejercicio = useMemo(
    () => ejercicioVigente(now, ejercicioConfigFromUser(user)),
    [now, user.ejercicio_inicio_mes, user.ejercicio_inicio_dia],
  );
  const desdeEjercicio = ejercicio.desde;
  const hastaEjercicio = hoy <= ejercicio.hasta ? hoy : ejercicio.hasta;
  const mesesEjercicio = useMemo(() => mesesDelEjercicio(desdeEjercicio), [desdeEjercicio]);
  const mesActualIdx = (() => {
    const found = mesesEjercicio.findIndex((m) => m.key === mesActualKey);
    return found >= 0 ? found : Math.max(0, mesesEjercicio.length - 1);
  })();

  const load = useCallback(async () => {
    if (!apiOnline) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOperativaLluvia({
        desde: desdeEjercicio,
        hasta: hastaEjercicio,
      });
      setRows(data);
    } catch {
      setError("No se pudo cargar el clima.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, desdeEjercicio, hastaEjercicio]);

  useEffect(() => {
    void load();
  }, [load]);

  const mesPorEst = useMemo(
    () => acumularPorEstablecimiento(rows, desdeMes, hoy),
    [rows, desdeMes, hoy],
  );
  const ejercicioPorEst = useMemo(
    () => acumularPorEstablecimiento(rows, desdeEjercicio, hastaEjercicio),
    [rows, desdeEjercicio, hastaEjercicio],
  );

  const estaciones = useMemo((): EstacionRow[] => {
    const keys = new Set<string>([...mesPorEst.keys(), ...ejercicioPorEst.keys()]);
    return [...keys]
      .map((key) => {
        const mesMm = mesPorEst.get(key)?.mm ?? 0;
        const ejercicioMm = ejercicioPorEst.get(key)?.mm ?? 0;
        const nombre =
          mesPorEst.get(key)?.nombre ??
          ejercicioPorEst.get(key)?.nombre ??
          "Establecimiento";
        const mensual = mensualPorEstablecimiento(rows, key, mesesEjercicio);
        const promedioAcum = promedioAcumulado(mensual, mesActualIdx >= 0 ? mesActualIdx : 11);
        return { key, nombre, mesMm, ejercicioMm, mensual, promedioAcum };
      })
      .sort((a, b) => b.mesMm - a.mesMm || a.nombre.localeCompare(b.nombre));
  }, [mesPorEst, ejercicioPorEst, rows, mesesEjercicio, mesActualIdx]);

  const topMm = Math.max(0, ...estaciones.map((e) => e.mesMm));
  const nivel = climaNivel(topMm);
  const showRain =
    nivel === "drizzle" || nivel === "rain" || nivel === "heavy" || nivel === "storm";

  return (
    <section className="home-wx-wrap home-wx-wrap--compact home-wx-wrap--wide" aria-label="Precipitaciones por localización">
      <div
        className={`wx-board wx-board--home wx-board--compact is-${nivel}${topMm > 0 ? " is-confirmed" : ""}`}
      >
        <div className="wx-board-sky" aria-hidden>
          {showRain ? (
            <div className="wx-rain">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={`wx-drop wx-drop--${(i % 5) + 1}`} />
              ))}
            </div>
          ) : null}
          <div className="wx-glow" />
        </div>

        <div className="wx-compact-top">
          <div className="wx-compact-top-main">
            <p className="wx-kicker">
              {loading ? (
                <>
                  <Loader2 size={11} className="wx-spin" aria-hidden />
                  Clima…
                </>
              ) : (
                <>Precipitaciones - {monthYearLabel(now)}</>
              )}
            </p>
            {!loading && !error ? (
              <span className="wx-ejercicio-range" title={`Ejercicio ${ejercicio.label}`}>
                {ejercicio.label}
              </span>
            ) : null}
          </div>
          <button type="button" className="wx-compact-link" onClick={onOpen}>
            Almanaque
            <ArrowRight size={12} strokeWidth={2.4} aria-hidden />
          </button>
        </div>

        {!loading && estaciones.length > 0 ? (
          <div className="wx-loc-list" role="list">
            {estaciones.slice(0, 6).map((est) => {
              const estNivel = climaNivel(est.mesMm);
              const nombre = nombreEnDosFilas(est.nombre);
              return (
                <article key={est.key} className={`wx-loc-row is-${estNivel}`} role="listitem">
                  <div className="wx-loc-name">
                    <span className={`wx-loc-icon wx-loc-icon--${estNivel}`} aria-hidden>
                      {climaIcon(estNivel)}
                    </span>
                    <strong title={est.nombre} className="wx-loc-name-text">
                      <span>{nombre.linea1}</span>
                      {nombre.linea2 ? <span>{nombre.linea2}</span> : null}
                    </strong>
                  </div>

                  <div className="wx-loc-chart-wrap">
                    <LluviaMesChart
                      meses={mesesEjercicio}
                      mensual={est.mensual}
                      promedio={est.promedioAcum}
                      mesActualKey={mesActualKey}
                    />
                  </div>

                  <div
                    className="wx-loc-metrics"
                    aria-label={`${est.nombre}: mes y ejercicio contable`}
                  >
                    <div className="wx-loc-metric wx-loc-metric--mes">
                      <span className="wx-loc-metric-label">Mes</span>
                      <span className="wx-loc-metric-value">
                        {formatMm(est.mesMm)}
                        <small>mm</small>
                      </span>
                    </div>
                    <div
                      className="wx-loc-metric wx-loc-metric--anio"
                      title={`Ejercicio ${ejercicio.label}`}
                    >
                      <span className="wx-loc-metric-label">Ejerc.</span>
                      <span className="wx-loc-metric-value">
                        {formatMm(est.ejercicioMm)}
                        <small>mm</small>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {loading ? <p className="wx-hint">Cargando localizaciones…</p> : null}
        {!loading && error ? <p className="wx-hint">{error}</p> : null}
        {!loading && !error && estaciones.length === 0 ? (
          <p className="wx-hint">Sin registros aún</p>
        ) : null}
      </div>
    </section>
  );
}
