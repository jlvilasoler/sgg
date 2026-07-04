import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import type { TipoCambio } from "../../types";
import { PAR_DIVISA_TC_LABEL } from "../../types";
import type { DivisasMonedaConfig } from "./divisas-config";
import { fmtDate, fmtNum } from "./divisas-utils";

interface Props {
  rows: TipoCambio[];
  config: DivisasMonedaConfig;
  refreshing?: boolean;
}

export type DivisasChartRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_OPTIONS: Array<{ id: DivisasChartRange; label: string }> = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "1Y", label: "1A" },
  { id: "ALL", label: "Todo" },
];

const BN = {
  bg: "#ffffff",
  text: "#848e9c",
  grid: "#f5f5f5",
  crosshair: "#b7bdc6",
  crosshairLabelBg: "#1e2329",
} as const;

const MESES_CORTO = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

function timeToFecha(time: Time): string {
  if (typeof time === "string") return time;
  if (typeof time === "number") {
    return new Date(time * 1000).toISOString().slice(0, 10);
  }
  const month = String(time.month).padStart(2, "0");
  const day = String(time.day).padStart(2, "0");
  return `${time.year}-${month}-${day}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subtractMonthsIso(iso: string, months: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function fmtPriceAxis(price: number): string {
  return price.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function fmtAxisDate(fecha: string, range: DivisasChartRange): string {
  const [y, m, d] = fecha.split("-");
  const mi = Number(m) - 1;
  if (range === "1M" || range === "3M") {
    return `${d}/${m}`;
  }
  if (range === "6M") {
    return `${MESES_CORTO[mi] ?? m} ${y.slice(2)}`;
  }
  return `${MESES_CORTO[mi] ?? m} ${y}`;
}

function buildSeriesData(rows: TipoCambio[]): LineData<Time>[] {
  return [...rows]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((r) => ({ time: r.fecha as Time, value: r.valor }));
}

function rowsInRange(rows: TipoCambio[], range: DivisasChartRange): TipoCambio[] {
  if (range === "ALL" || rows.length === 0) return rows;
  const sorted = [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const last = sorted[sorted.length - 1]!.fecha;
  const months =
    range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : 12;
  const desde = subtractMonthsIso(last, months);
  return sorted.filter((r) => r.fecha >= desde);
}

function variacionPct(rows: TipoCambio[]): number | null {
  if (rows.length < 2) return null;
  const sorted = [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const first = sorted[0]!.valor;
  const last = sorted[sorted.length - 1]!.valor;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

function applyChartView(
  chart: IChartApi,
  series: ISeriesApi<"Area">,
  allRows: TipoCambio[],
  range: DivisasChartRange
) {
  const data = buildSeriesData(allRows);
  const visibleRows = rowsInRange(allRows, range);
  const pointCount = visibleRows.length;
  const pocosPuntos = pointCount <= 3;

  series.setData(data);
  series.applyOptions({
    lineVisible: !pocosPuntos,
    pointMarkersVisible: pointCount <= 24,
    pointMarkersRadius: pocosPuntos ? 5 : 2,
    crosshairMarkerRadius: 5,
    crosshairMarkerBorderColor: "#ffffff",
    crosshairMarkerBorderWidth: 2,
    lastValueVisible: true,
    priceLineVisible: false,
  });

  const timeScale = chart.timeScale();
  timeScale.applyOptions({
    barSpacing: pointCount <= 8 ? 22 : pointCount <= 30 ? 12 : 6,
    minBarSpacing: 4,
    rightOffset: 6,
    fixLeftEdge: false,
    fixRightEdge: false,
  });

  if (data.length === 0) return;

  if (data.length === 1) {
    const fecha = data[0]!.time as string;
    timeScale.setVisibleRange({
      from: addDaysIso(fecha, -10),
      to: addDaysIso(fecha, 10),
    });
    return;
  }

  if (range === "ALL") {
    timeScale.fitContent();
    return;
  }

  const sorted = [...allRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const last = sorted[sorted.length - 1]!.fecha;
  const months =
    range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : 12;
  let from = subtractMonthsIso(last, months);
  if (from < sorted[0]!.fecha) from = sorted[0]!.fecha;

  timeScale.setVisibleRange({ from, to: last });
}

export default function DivisasChart({ rows, config, refreshing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const rangeRef = useRef<DivisasChartRange>("6M");
  const [range, setRange] = useState<DivisasChartRange>("6M");

  rangeRef.current = range;

  const chartRows = useMemo(
    () => [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [rows]
  );

  const visibleRows = useMemo(() => rowsInRange(chartRows, range), [chartRows, range]);
  const ultimo = chartRows.length > 0 ? chartRows[chartRows.length - 1]! : null;
  const cambio = useMemo(() => variacionPct(visibleRows), [visibleRows]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const color = config.chartColor;

    const chart = createChart(el, {
      height: 380,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BN.bg },
        textColor: BN.text,
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: BN.grid, style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: BN.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: true,
          labelBackgroundColor: BN.crosshairLabelBg,
        },
        horzLine: {
          color: BN.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: true,
          labelBackgroundColor: BN.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.06 },
        minimumWidth: 58,
        entireTextOnly: true,
        ticksVisible: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          const fecha = timeToFecha(time);
          if (tickMarkType === TickMarkType.Year) return fecha.slice(0, 4);
          return fmtAxisDate(fecha, rangeRef.current);
        },
      },
      localization: {
        locale: "es-UY",
        dateFormat: "dd/MM/yyyy",
        priceFormatter: fmtPriceAxis,
        timeFormatter: (time: Time) => fmtDate(timeToFecha(time)),
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: hexAlpha(color, 0.28),
      bottomColor: hexAlpha(color, 0.02),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      title: "",
    });

    chartRef.current = chart;
    seriesRef.current = series;
    applyChartView(chart, series, chartRows, rangeRef.current);

    const hideTvLogo = () => {
      el.querySelectorAll("a#tv-attr-logo").forEach((node) => node.remove());
    };
    hideTvLogo();
    const logoObserver = new MutationObserver(hideTvLogo);
    logoObserver.observe(el, { childList: true, subtree: true });

    return () => {
      logoObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [config.id, config.chartColor]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    applyChartView(chartRef.current, seriesRef.current, chartRows, range);
  }, [chartRows, range]);

  return (
    <div className="card precios-ganado-chart-panel divisas-chart-panel">
      <div className="precios-ganado-chart-card">
        <div className="precios-ganado-chart-header divisas-chart-header">
          <div className="precios-ganado-chart-header-main">
            <h3>Evolución del tipo de cambio</h3>
            <p className="muted">{PAR_DIVISA_TC_LABEL[config.par]}</p>
          </div>
          {ultimo && (
            <div className="divisas-chart-quote" aria-live="polite">
              <div className="divisas-chart-quote-row">
                <span className="divisas-chart-quote-value">{fmtNum(ultimo.valor, 4)}</span>
                {cambio != null && (
                  <span
                    className={`divisas-chart-quote-var${
                      cambio > 0
                        ? " divisas-chart-quote-var--up"
                        : cambio < 0
                          ? " divisas-chart-quote-var--down"
                          : ""
                    }`}
                  >
                    {cambio > 0 ? "+" : ""}
                    {cambio.toFixed(2)}%
                  </span>
                )}
              </div>
              <span className="divisas-chart-quote-date">{fmtDate(ultimo.fecha)}</span>
            </div>
          )}
        </div>

        <div
          className="divisas-chart-ranges"
          role="tablist"
          aria-label="Temporalidad del gráfico"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={range === opt.id}
              className={`divisas-chart-range-btn${range === opt.id ? " is-active" : ""}`}
              onClick={() => setRange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div
          className={`precios-ganado-chart-wrap divisas-chart-wrap${
            refreshing ? " is-refreshing" : ""
          }${chartRows.length === 0 ? " precios-ganado-chart-wrap--empty" : ""}`}
        >
          <div ref={containerRef} className="precios-ganado-chart-canvas" />
          {chartRows.length === 0 && (
            <p className="precios-ganado-chart-empty muted">
              Sin datos para graficar. Importá o ampliá el rango de fechas.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
