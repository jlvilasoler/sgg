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

      <HomeKpiStripBarSkeleton count={3} />

    </article>

  );

}



export default function HomeGanadoDashKpi({ data, onOpen }: Props) {

  const {

    activos,

    lotes,

    ejercicioLabel,

    tieneStock,

    tieneSimulador,

    tieneVendido,

    animalesPorVender,

    porVenderOperaciones,

    animalesVendidosEjercicio,

    vendidoOperacionesEjercicio,

  } = data;



  const cells: HomeKpiStripCell[] = [];



  if (tieneStock) {

    cells.push({

      id: "stock",

      label: "En stock",

      value: formatEnteroSafe(activos),

      trend: lotes > 0 ? `${lotes} lote(s)` : "Activos vivos",

      tone: "lime",

      onClick: () => onOpen("stock_ganadero"),

      ariaLabel: `En stock: ${formatEnteroSafe(activos)}. ${lotes > 0 ? `${lotes} lote(s)` : "Activos vivos"}`,

    });

  }



  if (tieneVendido) {

    cells.push({

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

    cells.push({

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



  if (cells.length === 0) return null;



  return (

    <article className="home-ganado-dash" aria-label="Dashboard de ganado">

      <header className="home-ganado-dash__head">

        <div className="home-ganado-dash__brand">

          <span className="home-ganado-dash__icon" aria-hidden>

            <Beef size={16} strokeWidth={1.75} />

          </span>

          <div>

            <p className="home-ganado-dash__kicker">Ganado</p>

            <p className="home-ganado-dash__subtitle">{ejercicioLabel}</p>

          </div>

        </div>

        {tieneStock ? (

          <span className="home-ganado-dash__badge">{formatEnteroSafe(activos)} cab.</span>

        ) : null}

      </header>



      <HomeKpiStripBar cells={cells} label="Indicadores de ganado" />

    </article>

  );

}


