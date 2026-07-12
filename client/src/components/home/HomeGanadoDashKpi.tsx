import { Beef } from "lucide-react";
import type { TabId } from "../Header";
import type { HomeGanadoStockData } from "../../hooks/useHomeDashboard";
import { formatEnteroSafe } from "../../utils/home-kpi-normalize";
import { HomeKpiStripBar, HomeKpiStripBarSkeleton, type HomeKpiStripCell } from "./HomeKpiStripBar";

interface Props {
  data: HomeGanadoStockData;
  onOpen: (tab: TabId) => void;
}

export function HomeGanadoDashSkeleton() {
  return (
    <article className="home-ganado-dash home-ganado-dash--skeleton" aria-hidden>
      <div className="home-ganado-dash__head">
        <div className="home-hub-kpi-skeleton-kicker" />
      </div>
      <div className="home-ganado-dash__strips">
        <div className="home-ganado-dash__strip-group home-ganado-dash__strip-group--stock">
          <HomeKpiStripBarSkeleton count={3} />
        </div>
        <div className="home-ganado-dash__strip-group home-ganado-dash__strip-group--ventas">
          <HomeKpiStripBarSkeleton count={2} />
        </div>
      </div>
    </article>
  );
}

export default function HomeGanadoDashKpi({ data, onOpen }: Props) {
  const {
    activos,
    lotes,
    machos,
    hembras,
    ejercicioLabel,
    tieneStock,
    tieneSimulador,
    tieneVendido,
    animalesPorVender,
    porVenderOperaciones,
    animalesVendidosEjercicio,
    vendidoOperacionesEjercicio,
    stockEjercicioAnterior,
    crecimientoStockPct,
    tieneComparacionStock,
  } = data;

  const stockCells: HomeKpiStripCell[] = [];
  const ventasCells: HomeKpiStripCell[] = [];

  if (tieneStock) {
    const pctSobreStock = (cantidad: number) =>
      activos > 0 ? Math.round((cantidad / activos) * 100) : 0;
    const pctMachos = pctSobreStock(machos);
    const pctHembras = pctSobreStock(hembras);

    stockCells.push({
      id: "stock",
      label: "En stock",
      value: formatEnteroSafe(activos),
      trend: lotes > 0 ? `${lotes} lote(s)` : "Activos vivos",
      tone: "lime",
      stockGrowth: {
        pct: crecimientoStockPct,
        anterior: stockEjercicioAnterior,
        actual: activos,
        disponible: tieneComparacionStock,
      },
      onClick: () => onOpen("stock_ganadero"),
      ariaLabel:
        tieneComparacionStock && crecimientoStockPct != null
          ? `En stock: ${formatEnteroSafe(activos)}. Variación ${crecimientoStockPct > 0 ? "+" : ""}${crecimientoStockPct}% vs ejercicio anterior`
          : `En stock: ${formatEnteroSafe(activos)}. ${lotes > 0 ? `${lotes} lote(s)` : "Activos vivos"}`,
    });

    stockCells.push({
      id: "machos",
      label: "Machos",
      value: formatEnteroSafe(machos),
      valueAside: `${pctMachos}%`,
      sharePct: pctMachos,
      shareTone: "macho",
      trend: "♂ En stock",
      tone: "neutral",
      onClick: () => onOpen("stock_ganadero"),
      ariaLabel: `Machos en stock: ${formatEnteroSafe(machos)} (${pctMachos}% del total)`,
    });

    stockCells.push({
      id: "hembras",
      label: "Hembras",
      value: formatEnteroSafe(hembras),
      valueAside: `${pctHembras}%`,
      sharePct: pctHembras,
      shareTone: "hembra",
      trend: "♀ En stock",
      tone: "neutral",
      onClick: () => onOpen("stock_ganadero"),
      ariaLabel: `Hembras en stock: ${formatEnteroSafe(hembras)} (${pctHembras}% del total)`,
    });
  }

  if (tieneVendido) {
    ventasCells.push({
      id: "vendidos",
      label: "Vendidos",
      value: formatEnteroSafe(animalesVendidosEjercicio),
      trend:
        vendidoOperacionesEjercicio > 0
          ? `${vendidoOperacionesEjercicio} venta(s) en ej.`
          : "Sin ventas en ej.",
      tone: vendidoOperacionesEjercicio > 0 ? "up" : "neutral",
      onClick: () => onOpen("simulador_venta_ganado"),
    });
  }

  if (tieneSimulador) {
    ventasCells.push({
      id: "por-vender",
      label: "Por vender",
      value: formatEnteroSafe(animalesPorVender),
      trend:
        porVenderOperaciones > 0
          ? `${porVenderOperaciones} op. abierta(s)`
          : "Sin operaciones abiertas",
      tone: porVenderOperaciones > 0 ? "gold" : "neutral",
      onClick: () => onOpen("simulador_venta_ganado"),
    });
  }

  if (stockCells.length === 0 && ventasCells.length === 0) return null;

  return (
    <article className="home-ganado-dash" aria-label="Dashboard de ganado">
      <header className="home-ganado-dash__head">
        <div className="home-ganado-dash__brand">
          <span className="home-ganado-dash__icon" aria-hidden>
            <Beef size={15} strokeWidth={1.75} />
          </span>
          <p className="home-ganado-dash__title-row">
            <span className="home-ganado-dash__kicker">Ganado</span>
            <span className="home-ganado-dash__subtitle">{ejercicioLabel}</span>
          </p>
        </div>
        {tieneStock ? (
          <span className="home-ganado-dash__badge">{formatEnteroSafe(activos)} cab.</span>
        ) : null}
      </header>

      <div
        className={`home-ganado-dash__strips${stockCells.length > 0 && ventasCells.length > 0 ? " is-split" : ""}`}
      >
        {stockCells.length > 0 ? (
          <section
            className="home-ganado-dash__strip-group home-ganado-dash__strip-group--stock"
            aria-label="Stock en campo"
          >
            <HomeKpiStripBar cells={stockCells} label="Stock en campo" />
          </section>
        ) : null}
        {ventasCells.length > 0 ? (
          <section
            className="home-ganado-dash__strip-group home-ganado-dash__strip-group--ventas"
            aria-label="Ventas y operaciones"
          >
            <HomeKpiStripBar cells={ventasCells} label="Ventas y operaciones" />
          </section>
        ) : null}
      </div>
    </article>
  );
}
