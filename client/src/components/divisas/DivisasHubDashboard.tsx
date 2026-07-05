import { TrendingUp } from "lucide-react";
import { useDivisasHubDashboard } from "../../hooks/useDivisasHubDashboard";
import { DIVISAS_MONEDAS, type DivisasMonedaId } from "./divisas-config";
import { fmtDate, fmtMesAnio, fmtNum } from "./divisas-utils";
import { formatFechaRelativa } from "../home/home-dashboard-format";
import DivisasDashboardChart from "./DivisasDashboardChart";
import SgHubModuleGrid from "../hub/SgHubModuleGrid";
import { DIVISAS_HUB_ITEMS } from "./divisas-hub-items";
import { SgHubKpi, SgMiniBars } from "../stock/SgHubUi";

interface Props {
  apiOnline: boolean;
  onNavigate: (id: DivisasMonedaId) => void;
}

export default function DivisasHubDashboard({ apiOnline, onNavigate }: Props) {
  const {
    loading,
    uyuRows,
    brlRows,
    promUyu,
    promBrl,
    promAnualUyu,
    promAnualBrl,
    novedades,
  } = useDivisasHubDashboard(apiOnline);

  function trendMes(prom: typeof promUyu): string | undefined {
    if (!apiOnline || loading || !prom) return undefined;
    const mes = fmtMesAnio(prom.mes);
    const dias = `${prom.dias} día${prom.dias === 1 ? "" : "s"} cotizados`;
    return prom.esMesActual ? dias : `${mes} · ${dias}`;
  }

  function hintMes(esUsd: boolean, prom: typeof promUyu): string {
    const par = esUsd ? "USD → pesos uruguayos" : "USD → reales brasileños";
    if (prom && !prom.esMesActual) {
      return `Promedio ${par} en ${fmtMesAnio(prom.mes)} (último mes con cotizaciones; sin datos en el mes actual).`;
    }
    return `Promedio del tipo de cambio ${par} en el mes calendario actual.`;
  }

  return (
    <div className="divisas-hub-dashboard">
      <section className="sg-hub-kpi-strip divisas-hub-kpi-strip" aria-label="Promedios mensuales">
        <SgHubKpi
          variant="dark"
          kicker="Dólar · mes"
          value={loading || !apiOnline || !promUyu ? "—" : fmtNum(promUyu.valor, 4)}
          hint={hintMes(true, promUyu)}
          trend={trendMes(promUyu)}
          bars={<SgMiniBars highlight="last" />}
        />
        <SgHubKpi
          kicker="Dólar · año"
          value={loading || !apiOnline || !promAnualUyu ? "—" : fmtNum(promAnualUyu.valor, 4)}
          hint="Promedio del tipo de cambio USD → pesos uruguayos en el año calendario actual."
          trend={
            apiOnline && !loading && promAnualUyu
              ? `${promAnualUyu.dias} día${promAnualUyu.dias === 1 ? "" : "s"} en ${promAnualUyu.anio}`
              : undefined
          }
          bars={<SgMiniBars highlight="mid" />}
        />
        <SgHubKpi
          kicker="Real · mes"
          value={loading || !apiOnline || !promBrl ? "—" : fmtNum(promBrl.valor, 4)}
          hint={hintMes(false, promBrl)}
          trend={trendMes(promBrl)}
          bars={<SgMiniBars />}
        />
        <SgHubKpi
          variant="light"
          kicker="Real · año"
          value={loading || !apiOnline || !promAnualBrl ? "—" : fmtNum(promAnualBrl.valor, 4)}
          hint="Promedio del tipo de cambio USD → reales brasileños en el año calendario actual."
          trend={
            apiOnline && !loading && promAnualBrl
              ? `${promAnualBrl.dias} día${promAnualBrl.dias === 1 ? "" : "s"} en ${promAnualBrl.anio}`
              : undefined
          }
          bars={<SgMiniBars highlight="last" />}
        />
      </section>

      <DivisasDashboardChart uyuRows={uyuRows} brlRows={brlRows} refreshing={loading} />

      <div className="divisas-hub-dashboard-panels sg-hub-panels">
        <SgHubModuleGrid
          items={DIVISAS_HUB_ITEMS}
          onSelect={(id) => onNavigate(id as DivisasMonedaId)}
          title="Monedas"
          kicker="Tipos de cambio"
          className="divisas-hub-dashboard-modules"
        />

        <section
          className="sg-hub-panel divisas-hub-novedades-panel"
          aria-label="Novedades de la actividad en Divisas"
        >
          <div className="sg-hub-panel-head divisas-hub-panel-head-row">
            <div>
              <p className="sg-hub-panel-kicker">Divisas</p>
              <h2 className="sg-hub-panel-title">Novedades de la actividad</h2>
              <p className="divisas-hub-novedades-hint muted">
                Avisos al cargar o importar nuevas cotizaciones.
              </p>
            </div>
          </div>

          {loading && novedades.length === 0 ? (
            <ul className="divisas-hub-novedades-skeleton-list" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={`div-skel-${i}`}>
                  <div className="divisas-hub-novedades-skeleton-row" aria-hidden>
                    <span className="divisas-hub-novedades-skeleton-icon" />
                    <span className="divisas-hub-novedades-skeleton-lines">
                      <span />
                      <span />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : novedades.length === 0 ? (
            <div className="divisas-hub-novedades-empty">
              <p className="divisas-hub-novedades-empty-text">
                Todavía no hay cotizaciones cargadas. Cuando importes o registres tipos de cambio,
                aparecerán acá.
              </p>
            </div>
          ) : (
            <ul className="divisas-hub-novedades-list">
              {novedades.map((item, index) => {
                const esUltimo = index === 0;
                const color =
                  item.par === "UYU_USD"
                    ? DIVISAS_MONEDAS.dolares.chartColor
                    : DIVISAS_MONEDAS.reales.chartColor;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`divisas-hub-novedades-item${
                        esUltimo ? " divisas-hub-novedades-item--latest" : ""
                      }`}
                      onClick={() =>
                        onNavigate(item.par === "UYU_USD" ? "dolares" : "reales")
                      }
                    >
                      <span
                        className="divisas-hub-novedades-icon"
                        style={{ color, borderColor: `${color}55`, background: `${color}18` }}
                        aria-hidden
                      >
                        <TrendingUp size={15} />
                      </span>
                      <span className="divisas-hub-novedades-body">
                        <span className="divisas-hub-novedades-top">
                          <span className="divisas-hub-novedades-title">{item.titulo}</span>
                          {esUltimo ? (
                            <span className="divisas-hub-novedades-badge">Última carga</span>
                          ) : null}
                        </span>
                        <span className="divisas-hub-novedades-meta">{item.subtitulo}</span>
                        <span className="divisas-hub-novedades-foot">
                          <span>
                            Cotización {fmtDate(item.fecha)}
                            {item.creadoEn ? ` · ${formatFechaRelativa(item.creadoEn)}` : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
