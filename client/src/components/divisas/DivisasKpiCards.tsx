import { useMemo, type CSSProperties } from "react";
import type { DivisaIndicadores, TipoCambio } from "../../types";
import { PAR_DIVISA_LABELS, PAR_DIVISA_TC_LABEL } from "../../types";
import type { DivisasMonedaConfig } from "./divisas-config";
import { fmtDate, fmtMesAnio, fmtNum } from "./divisas-utils";

interface Props {
  config: DivisasMonedaConfig;
  indicadores: DivisaIndicadores;
  rows: TipoCambio[];
  refreshing?: boolean;
}

const CARD_ACCENTS = ["#f0b90b", "#5b8def", "#8b5cf6"] as const;

function sortedRows(rows: TipoCambio[]): TipoCambio[] {
  return [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function lastNValues(rows: TipoCambio[], n: number): number[] {
  return sortedRows(rows)
    .slice(-n)
    .map((r) => r.valor);
}

function valuesInMonth(rows: TipoCambio[], ym: string): number[] {
  return sortedRows(rows)
    .filter((r) => r.fecha.startsWith(ym))
    .map((r) => r.valor);
}

function pctChange(actual: number, base: number | null | undefined): number | null {
  if (base == null || base === 0) return null;
  return ((actual - base) / base) * 100;
}

function MiniSparkline({
  points,
  color,
  width = 168,
  height = 76,
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

function VariacionBadge({
  pct,
  label,
}: {
  pct: number | null;
  label: string;
}) {
  if (pct == null) {
    return <span className="pg-kpi-var pg-kpi-var--neutral">— {label}</span>;
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
      {fmtNum(pct, 2)}% {label}
    </span>
  );
}

export default function DivisasKpiCards({
  config,
  indicadores,
  rows,
  refreshing,
}: Props) {
  const cards = useMemo(() => {
    const sorted = sortedRows(rows);
    const prevDay = sorted.length >= 2 ? sorted[sorted.length - 2]!.valor : null;

    const ultimo = indicadores.ultimo;
    const prom = indicadores.promedio_mes;
    const cierre = indicadores.cierre_mes_anterior;

    const promSpark = prom ? valuesInMonth(rows, prom.mes) : lastNValues(rows, 30);
    const cierreSpark = cierre
      ? valuesInMonth(rows, cierre.mes)
      : lastNValues(rows, 60).slice(0, 30);

    const cierrePrevMes = cierre
      ? (() => {
          const [y, m] = cierre.mes.split("-").map(Number);
          const d = new Date(y, m - 2, 1);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const vals = valuesInMonth(rows, ym);
          if (vals.length === 0) return null;
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        })()
      : null;

    return [
      {
        id: "ultimo",
        label: "Último TC",
        color: config.chartColor,
        valor: ultimo?.valor ?? null,
        unit: PAR_DIVISA_TC_LABEL[config.par],
        meta: ultimo ? fmtDate(ultimo.fecha) : "—",
        puntos: lastNValues(rows, 30),
        pct: ultimo ? pctChange(ultimo.valor, prevDay) : null,
        pctLabel: "vs día ant.",
      },
      {
        id: "promedio",
        label: "Promedio del mes",
        color: CARD_ACCENTS[1],
        valor: prom?.valor ?? null,
        unit: prom ? fmtMesAnio(prom.mes) : "Mes en curso",
        meta: prom
          ? `${prom.dias} día${prom.dias === 1 ? "" : "s"} cotizados`
          : "Sin datos del mes",
        puntos: promSpark,
        pct: prom && cierre ? pctChange(prom.valor, cierre.valor) : null,
        pctLabel: "vs cierre ant.",
      },
      {
        id: "cierre",
        label: "Cierre mes anterior",
        color: CARD_ACCENTS[2],
        valor: cierre?.valor ?? null,
        unit: cierre ? fmtMesAnio(cierre.mes) : "Mes cerrado",
        meta: cierre ? fmtDate(cierre.fecha) : "Sin cierre previo",
        puntos: cierreSpark,
        pct: cierre ? pctChange(cierre.valor, cierrePrevMes) : null,
        pctLabel: "vs mes ant.",
      },
    ];
  }, [config, indicadores, rows]);

  if (!indicadores.ultimo) return null;

  return (
    <section
      className={`precios-ganado-ultimos pg-kpi-board divisas-kpi-board${
        refreshing ? " is-refreshing" : ""
      }`}
      aria-label={`Indicadores ${config.titulo}`}
    >
      <header className="pg-kpi-board-head">
        <div className="pg-kpi-board-titles">
          <h2 className="pg-kpi-board-title">
            Indicadores — {PAR_DIVISA_LABELS[config.par]}
          </h2>
          <p className="pg-kpi-board-desc">{PAR_DIVISA_TC_LABEL[config.par]}</p>
        </div>
        <div className="pg-kpi-board-meta">
          <span className="pg-kpi-week-badge">
            Última cotización
            <span className="pg-kpi-week-range">
              {fmtDate(indicadores.ultimo.fecha)}
            </span>
          </span>
        </div>
      </header>

      <div className="pg-kpi-grid">
        {cards.map((card, idx) => (
          <article
            key={card.id}
            className="pg-kpi-card"
            style={{ "--pg-kpi-accent": card.color ?? CARD_ACCENTS[idx] } as CSSProperties}
          >
            <div className="pg-kpi-card-body">
              <div className="pg-kpi-card-symbol">
                <span className="pg-kpi-dot" aria-hidden />
                <span className="pg-kpi-name">{card.label}</span>
              </div>
              <div className="pg-kpi-price-row">
                <strong className={`pg-kpi-price${card.valor == null ? " pg-kpi-price--idle" : ""}`}>
                  {card.valor != null ? fmtNum(card.valor, 4) : "—"}
                </strong>
                <span className="pg-kpi-unit">{card.unit}</span>
              </div>
              <span className="pg-kpi-meta muted">{card.meta}</span>
              <VariacionBadge pct={card.pct} label={card.pctLabel} />
            </div>
            <div className="pg-kpi-card-chart">
              <MiniSparkline points={card.puntos} color={card.color} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
