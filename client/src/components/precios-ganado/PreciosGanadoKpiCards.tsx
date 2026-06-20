import { useMemo, type CSSProperties } from "react";
import type { SemanaPreciosGanado } from "../../types";
import { fmtDate, fmtNum } from "../divisas/divisas-utils";
import type { PreciosGanadoSegmentoConfig } from "./precios-ganado-config";

interface Props {
  config: PreciosGanadoSegmentoConfig;
  ultima: SemanaPreciosGanado | null;
  semanas: SemanaPreciosGanado[];
  refreshing?: boolean;
}

function fmtSemanaRango(s: SemanaPreciosGanado): string {
  return `${fmtDate(s.fecha_desde)} → ${fmtDate(s.fecha_hasta)}`;
}

function seriesPrecios(semanas: SemanaPreciosGanado[], cat: string): number[] {
  return [...semanas]
    .filter((s) => s.precios[cat as keyof typeof s.precios] != null)
    .sort((a, b) => a.fecha_hasta.localeCompare(b.fecha_hasta))
    .map((s) => s.precios[cat as keyof typeof s.precios] as number);
}

function variacionSemanal(puntos: number[]): number | null {
  if (puntos.length < 2) return null;
  const prev = puntos[puntos.length - 2]!;
  const last = puntos[puntos.length - 1]!;
  if (prev === 0) return null;
  return ((last - prev) / prev) * 100;
}

function MiniSparkline({
  points,
  color,
  width = 92,
  height = 36,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (points.length === 0) {
    return <svg className="pg-kpi-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const padY = 3;

  const coords = points.map((v, i) => {
    const x = points.length === 1 ? width / 2 : (i / (points.length - 1)) * width;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return `${x},${y}`;
  });

  const last = coords[coords.length - 1]!.split(",");
  const lx = Number(last[0]);
  const ly = Number(last[1]);

  return (
    <svg className="pg-kpi-spark" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {points.length >= 2 && (
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <circle cx={lx} cy={ly} r="2.75" fill={color} />
    </svg>
  );
}

function VariacionBadge({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="pg-kpi-var pg-kpi-var--neutral">— vs sem. ant.</span>;
  }

  const up = pct > 0;
  const down = pct < 0;
  const cls = up ? "pg-kpi-var--up" : down ? "pg-kpi-var--down" : "pg-kpi-var--neutral";
  const arrow = up ? "▲" : down ? "▼" : "—";
  const sign = up ? "+" : "";

  return (
    <span className={`pg-kpi-var ${cls}`}>
      <span className="pg-kpi-var-arrow" aria-hidden>
        {arrow}
      </span>
      {sign}
      {fmtNum(pct, 2)}% vs sem. ant.
    </span>
  );
}

export default function PreciosGanadoKpiCards({
  config,
  ultima,
  semanas,
  refreshing,
}: Props) {
  const cards = useMemo(
    () =>
      config.categorias.map((cat) => {
        const puntos = seriesPrecios(semanas, cat);
        const valor = ultima?.precios[cat as keyof typeof ultima.precios] ?? null;
        const pct = variacionSemanal(puntos);
        return {
          cat,
          label: config.labels[cat],
          color: config.chartColors[cat] ?? "#848e9c",
          valor,
          puntos,
          pct,
        };
      }),
    [config.categorias, config.labels, config.chartColors, semanas, ultima]
  );

  return (
    <section
      className={`pg-kpi-board${refreshing ? " is-refreshing" : ""}`}
      aria-label={`Precios ${config.titulo}`}
    >
      <header className="pg-kpi-board-head">
        <div className="pg-kpi-board-titles">
          <h2 className="pg-kpi-board-title">Precios de Ganado — {config.titulo}</h2>
          <p className="pg-kpi-board-desc">{config.descripcion}</p>
        </div>
        <div className="pg-kpi-board-meta">
          {ultima ? (
            <span className="pg-kpi-week-badge">
              Semana N°{ultima.semana}
              <span className="pg-kpi-week-range">{fmtSemanaRango(ultima)}</span>
            </span>
          ) : (
            <span className="pg-kpi-week-badge pg-kpi-week-badge--idle" aria-hidden>
              Semana N°—
            </span>
          )}
        </div>
      </header>

      <div className="pg-kpi-grid">
        {cards.map(({ cat, label, color, valor, puntos, pct }) => (
          <article
            key={cat}
            className="pg-kpi-card"
            style={{ "--pg-kpi-accent": color } as CSSProperties}
          >
            <div className="pg-kpi-card-top">
              <div className="pg-kpi-card-symbol">
                <span className="pg-kpi-dot" aria-hidden />
                <span className="pg-kpi-name">{label}</span>
              </div>
              <MiniSparkline points={puntos} color={color} />
            </div>
            <div className="pg-kpi-price-row">
              <strong className={`pg-kpi-price${valor == null ? " pg-kpi-price--idle" : ""}`}>
                {valor != null ? fmtNum(valor, 2) : "—"}
              </strong>
              <span className="pg-kpi-unit">{config.unidadLabel}</span>
            </div>
            <VariacionBadge pct={pct} />
          </article>
        ))}
      </div>
    </section>
  );
}
