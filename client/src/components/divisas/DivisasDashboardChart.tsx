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
import { DIVISAS_MONEDAS } from "./divisas-config";
import { fmtDate, fmtNum } from "./divisas-utils";

export type DivisasDashboardChartRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

const RANGE_OPTIONS: Array<{ id: DivisasDashboardChartRange; label: string }> = [
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

interface Props {
  uyuRows: TipoCambio[];
  brlRows: TipoCambio[];
  refreshing?: boolean;
}

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

function fmtAxisDate(fecha: string, range: DivisasDashboardChartRange): string {
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

function lastFecha(rows: TipoCambio[]): string | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)!.fecha;
}

function mergedLastFecha(uyuRows: TipoCambio[], brlRows: TipoCambio[]): string | null {
  const fechas = [lastFecha(uyuRows), lastFecha(brlRows)].filter(Boolean) as string[];
  if (fechas.length === 0) return null;
  return fechas.sort().at(-1)!;
}

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

function applyChartView(
  chart: IChartApi,
  uyuSeries: ISeriesApi<"Area">,
  brlSeries: ISeriesApi<"Area">,
  uyuRows: TipoCambio[],
  brlRows: TipoCambio[],
  range: DivisasDashboardChartRange
) {
  const uyuData = buildSeriesData(uyuRows);
  const brlData = buildSeriesData(brlRows);
  uyuSeries.setData(uyuData);
  brlSeries.setData(brlData);

  const anchor = mergedLastFecha(uyuRows, brlRows);
  const timeScale = chart.timeScale();
  timeScale.applyOptions({
    barSpacing: 8,
    minBarSpacing: 4,
    rightOffset: 6,
    fixLeftEdge: false,
    fixRightEdge: false,
  });

  if (!anchor || (uyuData.length === 0 && brlData.length === 0)) return;

  if (uyuData.length === 1 && brlData.length <= 1) {
    const fecha = anchor;
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

  const months =
    range === "1M" ? 1 : range === "3M" ? 3 : range === "6M" ? 6 : 12;
  let from = subtractMonthsIso(anchor, months);
  const earliest = [uyuRows, brlRows]
    .flat()
    .map((r) => r.fecha)
    .sort()[0];
  if (earliest && from < earliest) from = earliest;
  timeScale.setVisibleRange({ from, to: anchor });
}

export default function DivisasDashboardChart({ uyuRows, brlRows, refreshing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const uyuSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const brlSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const rangeRef = useRef<DivisasDashboardChartRange>("6M");
  const [range, setRange] = useState<DivisasDashboardChartRange>("6M");

  rangeRef.current = range;

  const uyuColor = DIVISAS_MONEDAS.dolares.chartColor;
  const brlColor = DIVISAS_MONEDAS.reales.chartColor;

  const ultimoUyu = useMemo(
    () => (uyuRows.length ? [...uyuRows].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)! : null),
    [uyuRows]
  );
  const ultimoBrl = useMemo(
    () => (brlRows.length ? [...brlRows].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1)! : null),
    [brlRows]
  );

  const hasData = uyuRows.length > 0 || brlRows.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
      leftPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.06 },
        minimumWidth: 52,
        entireTextOnly: true,
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.06 },
        minimumWidth: 58,
        entireTextOnly: true,
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

    const brlSeries = chart.addSeries(AreaSeries, {
      priceScaleId: "left",
      lineColor: brlColor,
      topColor: hexAlpha(brlColor, 0.28),
      bottomColor: hexAlpha(brlColor, 0.02),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: "Reales",
    });

    const uyuSeries = chart.addSeries(AreaSeries, {
      priceScaleId: "right",
      lineColor: uyuColor,
      topColor: hexAlpha(uyuColor, 0.28),
      bottomColor: hexAlpha(uyuColor, 0.02),
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      title: "Dólares",
    });

    chartRef.current = chart;
    uyuSeriesRef.current = uyuSeries;
    brlSeriesRef.current = brlSeries;
    applyChartView(chart, uyuSeries, brlSeries, uyuRows, brlRows, rangeRef.current);

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
      uyuSeriesRef.current = null;
      brlSeriesRef.current = null;
    };
  }, [brlColor, uyuColor]);

  useEffect(() => {
    if (!chartRef.current || !uyuSeriesRef.current || !brlSeriesRef.current) return;
    applyChartView(
      chartRef.current,
      uyuSeriesRef.current,
      brlSeriesRef.current,
      uyuRows,
      brlRows,
      range
    );
  }, [uyuRows, brlRows, range]);

  return (
    <div className="card precios-ganado-chart-panel divisas-chart-panel divisas-dashboard-chart-panel">
      <div className="precios-ganado-chart-card">
        <div className="precios-ganado-chart-header divisas-chart-header divisas-dashboard-chart-header">
          <div className="precios-ganado-chart-header-main">
            <h3>Evolución de tipos de cambio</h3>
            <p className="muted">Dólares (eje derecho) y reales (eje izquierdo) por 1 USD</p>
          </div>
          <div className="divisas-dashboard-chart-legend" aria-label="Últimas cotizaciones">
            {ultimoUyu ? (
              <div className="divisas-dashboard-chart-legend-item">
                <span
                  className="divisas-dashboard-chart-legend-dot"
                  style={{ background: uyuColor }}
                  aria-hidden
                />
                <span className="divisas-dashboard-chart-legend-label">Dólares</span>
                <strong>{fmtNum(ultimoUyu.valor, 4)}</strong>
                <span className="muted">{fmtDate(ultimoUyu.fecha)}</span>
              </div>
            ) : null}
            {ultimoBrl ? (
              <div className="divisas-dashboard-chart-legend-item">
                <span
                  className="divisas-dashboard-chart-legend-dot"
                  style={{ background: brlColor }}
                  aria-hidden
                />
                <span className="divisas-dashboard-chart-legend-label">Reales</span>
                <strong>{fmtNum(ultimoBrl.valor, 4)}</strong>
                <span className="muted">{fmtDate(ultimoBrl.fecha)}</span>
              </div>
            ) : null}
          </div>
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
          }${!hasData ? " precios-ganado-chart-wrap--empty" : ""}`}
        >
          <div ref={containerRef} className="precios-ganado-chart-canvas" />
          {!hasData && (
            <p className="precios-ganado-chart-empty muted">
              Sin datos para graficar. Importá cotizaciones en Dólares o Reales.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
