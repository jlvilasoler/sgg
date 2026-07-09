import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Beef } from "lucide-react";
import {
  fetchCampoPotrerosMapa,
  fetchStockGanaderaDispositivos,
} from "../../api";
import type { CampoPotreroMapa, StockGanaderaDispositivo } from "../../types";
import { fmtDate } from "../../utils/format";
import { todayIso } from "../../utils";
import { SgMiniBars } from "../stock/SgHubUi";
import StockDashSexoBreakdown from "../stock/StockDashSexoBreakdown";
import {
  buildHomeStockPotreroSnapshot,
  potreroStockCardEsSinAsignar,
  type PotreroStockResumenHome,
} from "./home-stock-potrero-resumen";
import {
  formatAreaCelda,
  formatDotacionCelda,
  formatDotacionPromedio,
  formatOcupacionCelda,
  formatOcupacionPromedio,
} from "./home-stock-potrero-dotacion";

interface Props {
  apiOnline: boolean;
  onOpenStock: () => void;
  onOpenMapa?: () => void;
}

function TotalActivosDash({
  total,
  potrerosConStock,
  potrerosEnMapa,
  onOpenStock,
}: {
  total: number;
  potrerosConStock: number;
  potrerosEnMapa: number;
  onOpenStock: () => void;
}) {
  return (
    <button
      type="button"
      className="home-hub-kpi-btn home-stock-potrero-kpi-combined-btn"
      onClick={onOpenStock}
      aria-label={`Total activos: ${total}. Potreros con stock: ${potrerosConStock} de ${potrerosEnMapa}`}
    >
      <article className="sg-hub-kpi sg-hub-kpi--dark home-stock-potrero-kpi-combined">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Total activos</p>
            <p className="sg-hub-kpi-value">{total}</p>
            <p className="sg-hub-kpi-trend">En stock</p>
          </div>
          <SgMiniBars highlight="last" />
        </div>
        <p className="sg-hub-kpi-hint">Animales vivos en stock ganadero</p>
        <div className="home-stock-potrero-kpi-combined-sub">
          <div className="home-stock-potrero-kpi-combined-sub-copy">
            <p className="home-stock-potrero-kpi-sub-kicker">Potreros con stock</p>
            <p className="home-stock-potrero-kpi-sub-value">
              {potrerosConStock}
              <span className="home-stock-potrero-kpi-sub-suffix">
                / {potrerosEnMapa || "—"}
              </span>
            </p>
            <p className="home-stock-potrero-kpi-sub-hint">Con animales del total en mapa</p>
          </div>
          <div className="home-stock-potrero-kpi-sub-ring" aria-hidden>
            <svg viewBox="0 0 36 36" className="home-stock-potrero-kpi-sub-ring-svg">
              <circle
                className="home-stock-potrero-kpi-sub-ring-bg"
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                strokeWidth="3"
              />
              {potrerosEnMapa > 0 ? (
                <circle
                  className="home-stock-potrero-kpi-sub-ring-fg"
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray={`${(potrerosConStock / potrerosEnMapa) * 97.4} 97.4`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              ) : null}
            </svg>
          </div>
        </div>
      </article>
    </button>
  );
}

function OcupacionCelda({
  resumen,
  sinAsignar,
}: {
  resumen: PotreroStockResumenHome;
  sinAsignar: boolean;
}) {
  if (sinAsignar) {
    return (
      <td className="home-stock-potrero-tabla-ocupacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  const ocupacion = formatOcupacionCelda(resumen.dotacion);
  if (!ocupacion) {
    return (
      <td className="home-stock-potrero-tabla-ocupacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  return (
    <td
      className={`home-stock-potrero-tabla-ocupacion is-dotacion-${ocupacion.nivel}`}
      title={ocupacion.tooltip}
    >
      <span className="home-stock-potrero-dotacion-valor">{ocupacion.principal}</span>
    </td>
  );
}

function DotacionCelda({
  resumen,
  sinAsignar,
}: {
  resumen: PotreroStockResumenHome;
  sinAsignar: boolean;
}) {
  if (sinAsignar) {
    return (
      <td className="home-stock-potrero-tabla-dotacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  const { principal } = formatDotacionCelda(resumen.dotacion);

  return (
    <td
      className={`home-stock-potrero-tabla-dotacion is-dotacion-${resumen.dotacion.nivel}`}
      title={resumen.dotacion.tooltip}
    >
      <span className="home-stock-potrero-dotacion-valor">{principal}</span>
    </td>
  );
}

function AreaCelda({
  resumen,
  sinAsignar,
}: {
  resumen: PotreroStockResumenHome;
  sinAsignar: boolean;
}) {
  const area = sinAsignar ? null : formatAreaCelda(resumen.dotacion);

  return (
    <td className="home-stock-potrero-tabla-area" title={resumen.dotacion.tooltip}>
      {area ? (
        <span className="home-stock-potrero-dotacion-meta">{area}</span>
      ) : (
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      )}
    </td>
  );
}

function NivelCelda({
  resumen,
  sinAsignar,
}: {
  resumen: PotreroStockResumenHome;
  sinAsignar: boolean;
}) {
  const mostrarNivel = !sinAsignar && resumen.dotacion.ugPorHa != null;

  return (
    <td
      className={`home-stock-potrero-tabla-nivel is-dotacion-${resumen.dotacion.nivel}`}
      title={resumen.dotacion.tooltip}
    >
      {mostrarNivel ? (
        <span className="home-stock-potrero-nivel-badge">{resumen.dotacion.etiqueta}</span>
      ) : (
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      )}
    </td>
  );
}

function PotreroTabla({
  potreros,
  totalGeneral,
  dotacionPromedio,
}: {
  potreros: PotreroStockResumenHome[];
  totalGeneral: number;
  dotacionPromedio: number | null;
}) {
  const pieDotacion = formatDotacionPromedio(dotacionPromedio);
  const pieOcupacion = formatOcupacionPromedio(dotacionPromedio);

  return (
    <div className="home-stock-potrero-tabla-wrap">
      <table className="home-stock-potrero-tabla home-stock-potrero-tabla--simple">
        <thead>
          <tr>
            <th scope="col" className="home-stock-potrero-tabla-th-potrero">
              Potrero
            </th>
            <th scope="col" className="home-stock-potrero-tabla-th-total">
              Total
            </th>
            <th
              scope="col"
              className="home-stock-potrero-tabla-th-ocupacion"
              title="UG del stock ÷ hectáreas del potrero en el mapa (referencia 1 UG/ha = 100%)"
            >
              Ocupación
            </th>
            <th
              scope="col"
              className="home-stock-potrero-tabla-th-dotacion"
              title="Unidades ganaderas por hectárea según categoría etaria (Configuración SAG)"
            >
              Dotación
            </th>
            <th
              scope="col"
              className="home-stock-potrero-tabla-th-area"
              title="Superficie del potrero en el mapa satelital"
            >
              Área
            </th>
            <th
              scope="col"
              className="home-stock-potrero-tabla-th-nivel"
              title="Nivel de carga según la dotación"
            >
              Nivel
            </th>
          </tr>
        </thead>
        <tbody>
          {potreros.map((resumen) => {
            const sinAsignar = potreroStockCardEsSinAsignar(resumen);
            return (
              <tr
                key={resumen.potreroId ?? resumen.potreroNombre}
                className={sinAsignar ? "is-sin-asignar" : undefined}
              >
                <th scope="row" className="home-stock-potrero-tabla-potrero">
                  {resumen.potreroNombre}
                </th>
                <td className="home-stock-potrero-tabla-num home-stock-potrero-tabla-row-total">
                  {resumen.total}
                </td>
                <OcupacionCelda resumen={resumen} sinAsignar={sinAsignar} />
                <DotacionCelda resumen={resumen} sinAsignar={sinAsignar} />
                <AreaCelda resumen={resumen} sinAsignar={sinAsignar} />
                <NivelCelda resumen={resumen} sinAsignar={sinAsignar} />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="home-stock-potrero-tabla-foot-label">
              Total
            </th>
            <td className="home-stock-potrero-tabla-foot-total">{totalGeneral}</td>
            <td
              className={`home-stock-potrero-tabla-ocupacion home-stock-potrero-tabla-foot-ocupacion${
                pieOcupacion ? ` is-dotacion-${pieOcupacion.nivel}` : " is-dotacion-sin-dato"
              }`}
              title={pieOcupacion?.tooltip}
            >
              {pieOcupacion ? (
                <span className="home-stock-potrero-dotacion-valor">{pieOcupacion.principal}</span>
              ) : (
                <span className="home-stock-potrero-dotacion-vacio">—</span>
              )}
            </td>
            <td
              className={`home-stock-potrero-tabla-dotacion home-stock-potrero-tabla-foot-dotacion${
                pieDotacion ? ` is-dotacion-${pieDotacion.nivel}` : " is-dotacion-sin-dato"
              }`}
              title={pieDotacion?.tooltip}
            >
              {pieDotacion ? (
                <span className="home-stock-potrero-dotacion-valor">{pieDotacion.principal}</span>
              ) : (
                <span className="home-stock-potrero-dotacion-vacio">—</span>
              )}
            </td>
            <td
              className="home-stock-potrero-tabla-area home-stock-potrero-tabla-foot-area"
              title={pieDotacion?.tooltip}
            >
              {pieDotacion ? (
                <span className="home-stock-potrero-dotacion-meta">Prom. ponderada</span>
              ) : (
                <span className="home-stock-potrero-dotacion-vacio">—</span>
              )}
            </td>
            <td
              className={`home-stock-potrero-tabla-nivel home-stock-potrero-tabla-foot-nivel${
                pieDotacion ? ` is-dotacion-${pieDotacion.nivel}` : " is-dotacion-sin-dato"
              }`}
              title={pieDotacion?.tooltip}
            >
              {pieDotacion ? (
                <span className="home-stock-potrero-nivel-badge">{pieDotacion.etiqueta}</span>
              ) : (
                <span className="home-stock-potrero-dotacion-vacio">—</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function HomeStockPotreroPanel({ apiOnline, onOpenStock, onOpenMapa }: Props) {
  const [loading, setLoading] = useState(true);
  const [potrerosMapa, setPotrerosMapa] = useState<CampoPotreroMapa[]>([]);
  const [ganadero, setGanadero] = useState<StockGanaderaDispositivo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([fetchCampoPotrerosMapa(), fetchStockGanaderaDispositivos({})])
      .then(([potrerosData, ganaderoData]) => {
        if (cancelled) return;
        setPotrerosMapa(potrerosData);
        setGanadero(ganaderoData);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudo cargar el stock ganadero.");
        setPotrerosMapa([]);
        setGanadero([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline]);

  const snapshot = useMemo(
    () => buildHomeStockPotreroSnapshot(potrerosMapa, ganadero),
    [ganadero, potrerosMapa],
  );

  const fechaHoy = fmtDate(todayIso());

  return (
    <section
      className="sg-hub-panel home-hub-panel--stock-potrero"
      aria-label="Stock ganadero por potrero"
    >
      <div className="sg-hub-panel-head home-hub-panel-head-row">
        <div>
          <p className="sg-hub-panel-kicker">Stock ganadero</p>
          <h2 className="sg-hub-panel-title">Animales por potrero</h2>
          <p className="home-stock-potrero-sub muted">
            Resumen al {fechaHoy} · ocupación % (UG ÷ ha del mapa) y dotación UG/ha · solo animales activos
          </p>
        </div>
        <button type="button" className="home-hub-link" onClick={onOpenStock}>
          Abrir stock
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      {loading ? (
        <p className="home-hub-empty">Cargando stock por potrero…</p>
      ) : error ? (
        <p className="home-hub-empty">{error}</p>
      ) : snapshot.totales.total === 0 ? (
        <div className="home-stock-potrero-empty">
          <Beef size={28} strokeWidth={1.5} aria-hidden />
          <p>No hay animales activos en stock ganadero.</p>
          <button type="button" className="sg-hub-cta sg-hub-cta--compact" onClick={onOpenStock}>
            Ir a Stock Ganadero
          </button>
        </div>
      ) : (
        <>
          <section
            className="sg-hub-kpi-strip home-hub-kpi-strip home-stock-potrero-kpi-strip"
            aria-label="Totales del stock"
            style={{ "--home-hub-kpi-cols": "2" } as CSSProperties}
          >
            <TotalActivosDash
              total={snapshot.totales.total}
              potrerosConStock={snapshot.potrerosConStock}
              potrerosEnMapa={snapshot.potrerosEnMapa}
              onOpenStock={onOpenStock}
            />
            <article className="sg-hub-kpi sg-hub-kpi--light home-stock-potrero-kpi-sexo">
              <div className="sg-hub-kpi-top">
                <div>
                  <p className="sg-hub-kpi-kicker">Por sexo</p>
                  <p className="sg-hub-kpi-value">
                    {snapshot.totales.machos + snapshot.totales.hembras}
                  </p>
                  <p className="sg-hub-kpi-trend">Machos y hembras</p>
                </div>
                <SgMiniBars highlight="mid" />
              </div>
              <p className="sg-hub-kpi-hint">Distribución del stock activo</p>
              <div className="sg-hub-kpi-sexo">
                <StockDashSexoBreakdown stats={snapshot.totales} variant="compact" />
              </div>
            </article>
          </section>

          {snapshot.totales.sinPotrero > 0 && snapshot.potreros.length === 0 ? (
            <p className="home-stock-potrero-alert" role="status">
              {snapshot.totales.sinPotrero} animal
              {snapshot.totales.sinPotrero === 1 ? "" : "es"} sin potrero asignado en el mapa.
              {onOpenMapa ? (
                <>
                  {" "}
                  <button type="button" className="home-hub-link home-hub-link--inline" onClick={onOpenMapa}>
                    Ver mapa
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {snapshot.potreros.length === 0 ? (
            <p className="home-hub-empty">
              Hay {snapshot.totales.total} animales en stock pero ninguno vinculado a un potrero del
              mapa.
              {onOpenMapa ? (
                <>
                  {" "}
                  <button type="button" className="home-hub-link home-hub-link--inline" onClick={onOpenMapa}>
                    Dibujar potreros
                  </button>
                </>
              ) : null}
            </p>
          ) : (
            <PotreroTabla
              potreros={snapshot.potreros}
              totalGeneral={snapshot.totales.total}
              dotacionPromedio={snapshot.dotacionPromedio}
            />
          )}
        </>
      )}
    </section>
  );
}
