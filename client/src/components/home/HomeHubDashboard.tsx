import { BarChart3, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { TabId } from "../Header";
import type { HomeInsight } from "../../hooks/useHomeDashboard";
import { formatUsdSafe } from "../../utils/home-kpi-normalize";
import HomeGanadoDashKpi, { HomeGanadoDashSkeleton } from "./HomeGanadoDashKpi";
import {
  HomeKpiStripBar,
  HomeKpiStripBarSkeleton,
  type HomeKpiStripCell,
  type HomeKpiStripTone,
} from "./HomeKpiStripBar";

interface Props {
  insights: HomeInsight[];
  loading?: boolean;
  onOpen: (tab: TabId) => void;
}

type Tile = {
  id: string;
  kicker: string;
  value: string;
  trend?: string;
  hint: string;
  tab: TabId;
  accent?: "lime" | "gold" | "ok";
};

function tileTone(accent?: Tile["accent"], trend?: string): HomeKpiStripTone {
  if (accent === "gold") return "gold";
  if (accent === "ok") return "up";
  if (accent === "lime") return "lime";
  if (trend?.startsWith("Cobr. ej.")) return "up";
  if (trend?.includes("Sin ")) return "neutral";
  return "neutral";
}

function tilesToStripCells(tiles: Tile[], onOpen: (tab: TabId) => void): HomeKpiStripCell[] {
  return tiles.map((tile) => ({
    id: tile.id,
    label: tile.kicker,
    value: tile.value,
    trend: tile.trend ?? tile.hint,
    tone: tileTone(tile.accent, tile.trend),
    onClick: () => onOpen(tile.tab),
    ariaLabel: `${tile.kicker}: ${tile.value}. ${tile.hint}`,
  }));
}

function insightById(insights: HomeInsight[], id: string): HomeInsight | undefined {
  return insights.find((item) => item.id === id);
}

function PanelHead({
  icon,
  kicker,
  title,
  subtitle,
  badge,
}: {
  icon: ReactNode;
  kicker: string;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <header className="home-hub-dashboard-panel__head">
      <div className="home-hub-dashboard-panel__brand">
        <span className="home-hub-dashboard-panel__icon" aria-hidden>
          {icon}
        </span>
        <div>
          <p className="home-hub-dashboard-panel__kicker">{kicker}</p>
          <p className="home-hub-dashboard-panel__title">{title}</p>
          <p className="home-hub-dashboard-panel__subtitle">{subtitle}</p>
        </div>
      </div>
      {badge ? (
        <span className="home-hub-dashboard-panel__badge">{badge}</span>
      ) : null}
    </header>
  );
}

function buildPorCobrarTiles(insights: HomeInsight[]): Tile[] {
  const tiles: Tile[] = [];
  const porCobrar = insightById(insights, "por-cobrar")?.porCobrar;
  if (!porCobrar) return tiles;

  const totalPendiente = porCobrar.totalUsd;
  tiles.push({
    id: "por-cobrar-total",
    kicker: "Por cobrar",
    value: formatUsdSafe(totalPendiente),
    trend: porCobrar.muestraCobradoEjercicio
      ? `Cobr. ej. ${formatUsdSafe(
          porCobrar.arrendamientos.cobradoEjercicioUsd +
            porCobrar.ganado.cobradoEjercicioUsd +
            porCobrar.agricultura.cobradoEjercicioUsd,
        )}`
      : "Tesorería",
    hint: porCobrar.ejercicioLabel,
    tab: "ingresos_ventas",
    accent: totalPendiente > 0.5 ? "gold" : "lime",
  });

  if (porCobrar.arrendamientos.tiene) {
    const { contratos, pendienteUsd, cobradoEjercicioUsd } = porCobrar.arrendamientos;
    tiles.push({
      id: "por-cobrar-arrend",
      kicker: "Arrendamientos",
      value: formatUsdSafe(pendienteUsd),
      trend: porCobrar.muestraCobradoEjercicio
        ? `Cobr. ej. ${formatUsdSafe(cobradoEjercicioUsd)}`
        : contratos != null && contratos > 0
          ? `${contratos} contrato(s)`
          : "Pendiente",
      hint: "Por cobrar",
      tab: "ingresos_ventas",
    });
  }

  if (porCobrar.ganado.tiene) {
    const { operaciones, pendienteUsd, cobradoEjercicioUsd } = porCobrar.ganado;
    tiles.push({
      id: "por-cobrar-ganado",
      kicker: "Ganado",
      value: formatUsdSafe(pendienteUsd),
      trend: porCobrar.muestraCobradoEjercicio
        ? `Cobr. ej. ${formatUsdSafe(cobradoEjercicioUsd)}`
        : operaciones != null && operaciones > 0
          ? `${operaciones} op.`
          : "Pendiente",
      hint: "Por cobrar",
      tab: "simulador_venta_ganado",
    });
  }

  if (porCobrar.agricultura.tiene) {
    const { ventas, pendienteUsd, cobradoEjercicioUsd } = porCobrar.agricultura;
    tiles.push({
      id: "por-cobrar-agric",
      kicker: "Agricultura",
      value: formatUsdSafe(pendienteUsd),
      trend: porCobrar.muestraCobradoEjercicio
        ? `Cobr. ej. ${formatUsdSafe(cobradoEjercicioUsd)}`
        : ventas != null && ventas > 0
          ? `${ventas} venta(s)`
          : "Pendiente",
      hint: "Por cobrar",
      tab: "ingresos_ventas",
    });
  }

  return tiles;
}

function buildFinancieroTiles(insights: HomeInsight[]): Tile[] {
  const resultado = insightById(insights, "ventas-ejercicio")?.resultadoEjercicio;
  const gastosMesInsight = insightById(insights, "gastos-mes");
  const gastosAnioInsight = insightById(insights, "gastos-anio");
  const ejercicioLabel =
    resultado?.ejercicioLabel ??
    gastosAnioInsight?.hint?.split(" · ")[0] ??
    gastosMesInsight?.hint ??
    "Ejercicio";

  const gastosMes = resultado?.gastosMes ?? gastosMesInsight?.amountUsd ?? 0;
  const gastosAnio = resultado?.gastosAnio ?? gastosAnioInsight?.amountUsd ?? 0;
  const ventasAnio = resultado?.ventasAnio ?? 0;

  const tiles: Tile[] = [];

  if (gastosMesInsight || resultado) {
    tiles.push({
      id: "gastos-mes",
      kicker: "Gastos del mes",
      value: formatUsdSafe(gastosMes),
      trend: "Mes actual",
      hint: gastosMesInsight?.hint ?? "Monto incluye UYU y BRL",
      tab: "listado",
    });
  }

  if (gastosAnioInsight || resultado) {
    tiles.push({
      id: "gastos-anio",
      kicker: "Gastos del año",
      value: formatUsdSafe(gastosAnio),
      trend: "Ejercicio en curso",
      hint: gastosAnioInsight?.hint ?? `${ejercicioLabel} · UYU y BRL en USD`,
      tab: "listado",
    });
  }

  if (resultado) {
    tiles.push({
      id: "ventas-anio",
      kicker: "Ventas del año",
      value: formatUsdSafe(ventasAnio),
      trend: "Ventas cobradas",
      hint: `${ejercicioLabel} · acumulado`,
      tab: "resumen",
      accent: "ok",
    });
  }

  return tiles;
}

function SkeletonPanel({ tiles }: { tiles: number }) {
  return <HomeKpiStripBarSkeleton count={tiles} />;
}

export default function HomeHubDashboard({ insights, loading = false, onOpen }: Props) {
  const ganado = insightById(insights, "ganado-stock")?.ganadoStock;
  const porCobrarInsight = insightById(insights, "por-cobrar");
  const showGanadoDash =
    ganado &&
    (ganado.tieneStock || ganado.tieneSimulador || ganado.tieneVendido);
  const porCobrarTiles = buildPorCobrarTiles(insights);
  const financieroTiles = buildFinancieroTiles(insights);

  const hasGanadoSlot = showGanadoDash || (loading && !ganado);

  if (!showGanadoDash && porCobrarTiles.length === 0 && financieroTiles.length === 0 && !loading) {
    return null;
  }

  return (
    <section
      className={`home-hub-dashboard${hasGanadoSlot ? " has-ganado" : ""}`}
      aria-label="Indicadores del inicio"
    >
      {hasGanadoSlot && (
        <div className="home-hub-dashboard__ganado">
          {loading && !ganado ? (
            <HomeGanadoDashSkeleton />
          ) : ganado ? (
            <HomeGanadoDashKpi data={ganado} onOpen={onOpen} />
          ) : null}
        </div>
      )}

      {porCobrarInsight && (porCobrarTiles.length > 0 || loading) && (
        <article className="home-hub-dashboard-panel home-hub-dashboard-panel--cobros">
          <PanelHead
            icon={<Wallet size={17} strokeWidth={1.75} />}
            kicker="Tesorería"
            title="Por cobrar"
            subtitle={
              insightById(insights, "por-cobrar")?.porCobrar?.ejercicioLabel ??
              "Cobros pendientes"
            }
            badge={
              porCobrarTiles[0]?.value
                ? porCobrarTiles[0].value
                : undefined
            }
          />
          {loading && porCobrarTiles.length === 0 ? (
            <SkeletonPanel tiles={3} />
          ) : (
            <HomeKpiStripBar
              cells={tilesToStripCells(porCobrarTiles, onOpen)}
              label="Por cobrar"
            />
          )}
        </article>
      )}

      {(financieroTiles.length > 0 || loading) && (
        <article className="home-hub-dashboard-panel home-hub-dashboard-panel--financiero">
          <PanelHead
            icon={<BarChart3 size={17} strokeWidth={1.75} />}
            kicker="Financiero"
            title="Gastos y ventas"
            subtitle={financieroTiles[0]?.hint?.split(" · ")[0] ?? "Acumulado del ejercicio"}
          />
          {loading && financieroTiles.length === 0 ? (
            <SkeletonPanel tiles={3} />
          ) : (
            <HomeKpiStripBar
              cells={tilesToStripCells(financieroTiles, onOpen)}
              label="Gastos y ventas"
            />
          )}
        </article>
      )}
    </section>
  );
}
