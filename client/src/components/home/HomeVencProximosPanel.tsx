import { ArrowRight } from "lucide-react";
import type { VencImpCuotaConsolidada } from "../../utils/vencimientos-impuestos-total";
import HomeVencProximoBanner from "./HomeVencProximoBanner";

interface Props {
  items: VencImpCuotaConsolidada[];
  loading?: boolean;
  onOpen: () => void;
}

export default function HomeVencProximosPanel({ items, loading = false, onOpen }: Props) {
  return (
    <section className="sg-hub-panel home-hub-panel--venc" aria-label="Próximos vencimientos">
      <div className="home-hub-venc-shell">
        <header className="home-hub-venc-head">
          <div className="home-hub-venc-head-main">
            <p className="home-hub-venc-head-kicker">Calendario tributario</p>
            <h2 className="home-hub-venc-head-title">Próximos vencimientos</h2>
          </div>
          <button type="button" className="home-hub-link home-hub-venc-head-link" onClick={onOpen}>
            Abrir
            <ArrowRight size={14} aria-hidden />
          </button>
        </header>

        <div className="home-hub-venc-body">
          {loading ? (
            <p className="home-hub-venc-empty">Cargando vencimientos…</p>
          ) : items.length === 0 ? (
            <p className="home-hub-venc-empty">
              No hay vencimientos urgentes en los próximos días.
            </p>
          ) : (
            <div className="home-hub-venc-proximos vencimientos-impuestos-page">
              <div className="venc-imp-user-banner-proximos-wrap">
                {items.map((item) => (
                  <div key={item.key} className="venc-imp-user-banner-proximo-box">
                    <HomeVencProximoBanner item={item} onClick={onOpen} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
