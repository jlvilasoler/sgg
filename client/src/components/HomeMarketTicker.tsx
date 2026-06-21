import { useCallback, useEffect, useState } from "react";
import { fetchDivisas, fetchPreciosGanado } from "../api";
import {
  buildHomeTickerItems,
  homeTickerFetchDesde,
  type HomeTickerItem,
} from "../utils/home-market-ticker-data";
import { getHomeTickerCache, setHomeTickerCache } from "../utils/home-market-ticker-cache";

interface Props {
  apiOnline: boolean;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="home-ticker-change home-ticker-change--na">—</span>;
  }
  const sign = pct > 0 ? "+" : "";
  const cls =
    pct > 0
      ? "home-ticker-change home-ticker-change--up"
      : pct < 0
        ? "home-ticker-change home-ticker-change--down"
        : "home-ticker-change home-ticker-change--flat";
  return (
    <span className={cls}>
      {sign}
      {pct.toFixed(2)}%
    </span>
  );
}

function TickerStrip({ items }: { items: HomeTickerItem[] }) {
  return (
    <>
      {items.map((item, idx) => (
        <span key={`${item.id}-${idx}`} className="home-ticker-item" data-group={item.group}>
          <span className="home-ticker-label">{item.label}</span>
          <ChangeBadge pct={item.changePct} />
          <span className="home-ticker-value">{item.value}</span>
          <span className="home-ticker-sep" aria-hidden />
        </span>
      ))}
    </>
  );
}

export default function HomeMarketTicker({ apiOnline }: Props) {
  const [items, setItems] = useState<HomeTickerItem[]>(() => getHomeTickerCache());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline) return;

    const hadCache = getHomeTickerCache().length > 0;
    if (!hadCache) setRefreshing(true);

    try {
      const desde = homeTickerFetchDesde();
      const [divisas, gordo, reposicion] = await Promise.all([
        fetchDivisas({ fecha_desde: desde }),
        fetchPreciosGanado({ segmento: "GORDO" }),
        fetchPreciosGanado({ segmento: "REPOSICION" }),
      ]);
      const next = buildHomeTickerItems({
        ultimosDivisas: divisas.ultimos,
        historialDivisas: divisas.data,
        semanasGordo: gordo.semanas,
        semanasReposicion: reposicion.semanas,
      });
      if (next.length > 0) {
        setItems(next);
        setHomeTickerCache(next);
      }
    } catch {
      /* mantener caché visible */
    } finally {
      setRefreshing(false);
    }
  }, [apiOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  if (items.length === 0) {
    return null;
  }

  const doubled = [...items, ...items];

  return (
    <div className="home-market-ticker" aria-label="Cotizaciones y precios de mercado">
      <div className="home-market-ticker-viewport">
        <div
          className={`home-market-ticker-track${refreshing ? " home-market-ticker-track--refreshing" : ""}`}
        >
          <TickerStrip items={doubled} />
        </div>
      </div>
    </div>
  );
}
