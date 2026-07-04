import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  TickMarkType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import type { SemanaPreciosGanado } from "../../types";
import { fmtDate } from "../divisas/divisas-utils";
import type { PreciosGanadoSegmentoConfig } from "./precios-ganado-config";
import { getPreciosGanadoSegmentoCache } from "./precios-ganado-cache";

interface Props {
  semanas: SemanaPreciosGanado[];
  config: PreciosGanadoSegmentoConfig;
  refreshing?: boolean;
}

const BN = {
  bg: "#ffffff",
  text: "#848e9c",
  grid: "#f5f5f5",
  crosshair: "#b7bdc6",
  crosshairLabelBg: "#1e2329",
} as const;

function fechaToTime(fecha: string): Time {
  return fecha;
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

function fmtPriceAxis(price: number): string {
  return price.toLocaleString("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildSeriesData(
  semanas: SemanaPreciosGanado[],
  categoria: string
): LineData<Time>[] {
  return [...semanas]
    .sort((a, b) => a.fecha_hasta.localeCompare(b.fecha_hasta))
    .flatMap((s) => {
      const valor = s.precios[categoria as keyof typeof s.precios];
      if (valor == null) return [];
      return [{ time: fechaToTime(s.fecha_hasta), value: valor }];
    });
}

function semanasOrdenadas(semanas: SemanaPreciosGanado[]): SemanaPreciosGanado[] {
  return [...semanas].sort((a, b) => a.fecha_hasta.localeCompare(b.fecha_hasta));
}

function formatAxisTick(time: Time, semanas: SemanaPreciosGanado[]): string {
  const fecha = timeToFecha(time);
  const semana = semanas.find((s) => s.fecha_hasta === fecha);
  if (semana) return `S${semana.semana} · ${fmtDate(fecha)}`;
  return fmtDate(fecha);
}

function formatCrosshairTime(time: Time, semanas: SemanaPreciosGanado[]): string {
  return formatAxisTick(time, semanas);
}

function applyChartData(
  chart: IChartApi,
  seriesMap: Map<string, ISeriesApi<"Line">>,
  semanas: SemanaPreciosGanado[],
  categorias: readonly string[],
  visible: Record<string, boolean>
) {
  const ordenadas = semanasOrdenadas(semanas);
  const semanasConValor = ordenadas.filter((s) =>
    categorias.some((c) => s.precios[c as keyof typeof s.precios] != null)
  );
  const pointCount = semanasConValor.length;
  const pocosPuntos = pointCount <= 2;

  for (const cat of categorias) {
    const series = seriesMap.get(cat);
    if (!series) continue;
    const data = buildSeriesData(semanas, cat);
    series.setData(data);
    series.applyOptions({
      visible: visible[cat] !== false,
      lineVisible: !pocosPuntos,
      pointMarkersVisible: true,
      pointMarkersRadius: pocosPuntos ? 6 : 3,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#ffffff",
      crosshairMarkerBorderWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
  }

  const timeScale = chart.timeScale();
  timeScale.applyOptions({
    barSpacing: pointCount <= 3 ? 28 : 12,
    minBarSpacing: 8,
    rightOffset: 8,
    fixLeftEdge: pointCount <= 4,
    fixRightEdge: pointCount <= 4,
  });

  if (pointCount === 0) return;

  if (pointCount === 1) {
    const fecha = semanasConValor[0]!.fecha_hasta;
    timeScale.setVisibleRange({
      from: addDaysIso(fecha, -35),
      to: addDaysIso(fecha, 35),
    });
    return;
  }

  timeScale.fitContent();
}

export default function PreciosGanadoChart({ semanas, config, refreshing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const semanasRef = useRef(semanas);
  const visibleRef = useRef<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(config.categorias.map((c) => [c, true]))
  );

  const displaySemanas = useMemo(() => {
    if (semanas.length > 0) return semanas;
    return getPreciosGanadoSegmentoCache(config.id)?.semanas ?? [];
  }, [semanas, config.id]);

  semanasRef.current = displaySemanas;
  visibleRef.current = visible;

  useEffect(() => {
    setVisible(Object.fromEntries(config.categorias.map((c) => [c, true])));
  }, [config.id, config.categorias]);

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
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.08 },
        minimumWidth: 56,
        entireTextOnly: true,
        ticksVisible: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => {
          if (tickMarkType === TickMarkType.Year) {
            return timeToFecha(time).slice(0, 4);
          }
          return formatAxisTick(time, semanasRef.current);
        },
      },
      localization: {
        locale: "es-UY",
        dateFormat: "dd/MM/yyyy",
        priceFormatter: fmtPriceAxis,
        timeFormatter: (time: Time) =>
          formatCrosshairTime(time, semanasRef.current),
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;
    const seriesMap = new Map<string, ISeriesApi<"Line">>();

    for (const cat of config.categorias) {
      const series = chart.addSeries(LineSeries, {
        color: config.chartColors[cat],
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 5,
        title: "",
      });
      seriesMap.set(cat, series);
    }
    seriesRef.current = seriesMap;

    applyChartData(chart, seriesMap, displaySemanas, config.categorias, visibleRef.current);

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
      seriesRef.current.clear();
    };
  }, [config.id, config.categorias, config.chartColors, config.labels]);

  useEffect(() => {
    if (!chartRef.current) return;
    applyChartData(
      chartRef.current,
      seriesRef.current,
      displaySemanas,
      config.categorias,
      visible
    );
  }, [displaySemanas, config.categorias, visible]);

  const toggleSerie = (cat: string) => {
    setVisible((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      const series = seriesRef.current.get(cat);
      series?.applyOptions({ visible: next[cat] });
      return next;
    });
  };

  return (
    <div className="precios-ganado-chart-card">
      <div className="precios-ganado-chart-header">
        <div className="precios-ganado-chart-header-main">
          <h3>Evolución de precios</h3>
          <p className="muted">{config.unidadLabel}</p>
        </div>
      </div>

      <div className="precios-ganado-chart-legend" role="group" aria-label="Series del gráfico">
        {config.categorias.map((cat) => {
          const on = visible[cat] !== false;
          return (
            <button
              key={cat}
              type="button"
              className={`precios-ganado-chart-legend-item${on ? "" : " is-off"}`}
              onClick={() => toggleSerie(cat)}
              aria-pressed={on}
            >
              <span
                className="precios-ganado-chart-legend-dot"
                style={{ backgroundColor: config.chartColors[cat] }}
              />
              {config.labels[cat]}
            </button>
          );
        })}
      </div>

      <div
        className={`precios-ganado-chart-wrap${refreshing ? " is-refreshing" : ""}`}
      >
        <div ref={containerRef} className="precios-ganado-chart-canvas" />
      </div>
    </div>
  );
}
