import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { fetchCampoPotrerosMapa, fetchStockEquinaDispositivos } from "../../api";
import type { AuthUser, CampoPotreroMapa, StockEquinaDispositivo } from "../../types";
import { fmtDate } from "../../utils/format";
import { todayIso } from "../../utils";
import { StockEquinoModuleIcon } from "../stock/StockControlSanitarioSectionTitle";
import { SgMiniBars } from "../stock/SgHubUi";
import StockDashSexoBreakdown from "../stock/StockDashSexoBreakdown";
import {
  buildHomeStockEquinoPotreroSnapshot,
  formatAreaCeldaEquino,
  formatDensidadPromedioEquino,
  formatDotacionCeldaEquino,
  formatOcupacionCeldaEquino,
  formatOcupacionPromedioEquino,
  potreroStockEquinoEsSinAsignar,
  type PotreroStockEquinoResumenHome,
} from "./home-stock-equino-potrero-resumen";

interface Props {
  user: AuthUser;
  apiOnline: boolean;
  onOpenStock: () => void;
  onOpenMapa?: () => void;
}

const HOME_STOCK_EQUINO_POTRERO_CACHE_KEY = "sag.home.stock-equino-potrero.v1";

type HomeStockEquinoPotreroCache = {
  scopeKey: string;
  potrerosMapa: CampoPotreroMapa[];
  equino: StockEquinaDispositivo[];
};

let homeStockEquinoPotreroMemoryCache: HomeStockEquinoPotreroCache | null = null;

function readHomeStockEquinoPotreroCache(scopeKey: string): HomeStockEquinoPotreroCache | null {
  if (homeStockEquinoPotreroMemoryCache?.scopeKey === scopeKey) {
    return homeStockEquinoPotreroMemoryCache;
  }
  try {
    const raw = sessionStorage.getItem(HOME_STOCK_EQUINO_POTRERO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeStockEquinoPotreroCache;
    if (
      parsed?.scopeKey !== scopeKey ||
      !Array.isArray(parsed?.potrerosMapa) ||
      !Array.isArray(parsed?.equino)
    ) {
      return null;
    }
    homeStockEquinoPotreroMemoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function writeHomeStockEquinoPotreroCache(payload: HomeStockEquinoPotreroCache) {
  homeStockEquinoPotreroMemoryCache = payload;
  try {
    sessionStorage.setItem(HOME_STOCK_EQUINO_POTRERO_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function clearHomeStockEquinoPotreroCache(): void {
  homeStockEquinoPotreroMemoryCache = null;
  try {
    sessionStorage.removeItem(HOME_STOCK_EQUINO_POTRERO_CACHE_KEY);
  } catch {
    /* noop */
  }
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
      <article className="sg-hub-kpi sg-hub-kpi--dark home-stock-potrero-kpi-combined home-stock-equino-potrero-kpi-combined">
        <div className="sg-hub-kpi-top">
          <div>
            <p className="sg-hub-kpi-kicker">Total activos</p>
            <p className="sg-hub-kpi-value">{total}</p>
            <p className="sg-hub-kpi-trend">En stock</p>
          </div>
          <SgMiniBars highlight="last" />
        </div>
        <p className="sg-hub-kpi-hint">Equinos vivos en stock equino</p>
        <div className="home-stock-potrero-kpi-combined-sub">
          <div className="home-stock-potrero-kpi-combined-sub-copy">
            <p className="home-stock-potrero-kpi-sub-kicker">Potreros con stock</p>
            <p className="home-stock-potrero-kpi-sub-value">
              {potrerosConStock}
              <span className="home-stock-potrero-kpi-sub-suffix">
                {" "}
                / {potrerosEnMapa}
              </span>
            </p>
            <p className="home-stock-potrero-kpi-sub-hint">Con equinos del total en mapa</p>
          </div>
          <div
            className="home-stock-potrero-kpi-sub-ring home-stock-equino-potrero-kpi-sub-ring"
            aria-hidden
          >
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
                  className="home-stock-potrero-kpi-sub-ring-fg home-stock-equino-potrero-kpi-sub-ring-fg"
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
  resumen: PotreroStockEquinoResumenHome;
  sinAsignar: boolean;
}) {
  if (sinAsignar) {
    return (
      <td className="home-stock-potrero-tabla-ocupacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  const ocupacion = formatOcupacionCeldaEquino(resumen.dotacion);
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
  resumen: PotreroStockEquinoResumenHome;
  sinAsignar: boolean;
}) {
  if (sinAsignar) {
    return (
      <td className="home-stock-potrero-tabla-dotacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  const formatted = formatDotacionCeldaEquino(resumen.dotacion);
  if (resumen.dotacion.uePorHa == null) {
    return (
      <td className="home-stock-potrero-tabla-dotacion is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  return (
    <td
      className={`home-stock-potrero-tabla-dotacion is-dotacion-${resumen.dotacion.nivel}`}
      title={resumen.dotacion.tooltip}
    >
      <span className="home-stock-potrero-dotacion-valor">{formatted.principal}</span>
    </td>
  );
}

function AreaCelda({ resumen }: { resumen: PotreroStockEquinoResumenHome }) {
  const area = formatAreaCeldaEquino(resumen.dotacion);
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
  resumen: PotreroStockEquinoResumenHome;
  sinAsignar: boolean;
}) {
  if (sinAsignar || resumen.dotacion.uePorHa == null) {
    return (
      <td className="home-stock-potrero-tabla-nivel is-dotacion-sin-dato">
        <span className="home-stock-potrero-dotacion-vacio">—</span>
      </td>
    );
  }

  return (
    <td
      className={`home-stock-potrero-tabla-nivel is-dotacion-${resumen.dotacion.nivel}`}
      title={resumen.dotacion.consejo}
    >
      <span className="home-stock-potrero-nivel-badge">{resumen.dotacion.etiqueta}</span>
    </td>
  );
}

function PotreroTabla({
  potreros,
  totalGeneral,
  densidadPromedio,
}: {
  potreros: PotreroStockEquinoResumenHome[];
  totalGeneral: number;
  densidadPromedio: number | null;
}) {
  const pieOcupacion = formatOcupacionPromedioEquino(densidadPromedio);
  const pieDotacion = formatDensidadPromedioEquino(densidadPromedio);

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
            <th scope="col" className="home-stock-potrero-tabla-th-ocupacion" title="UE ÷ ha">
              Ocupación
            </th>
            <th scope="col" className="home-stock-potrero-tabla-th-dotacion" title="Unidades equinas por hectárea">
              Dotación
            </th>
            <th scope="col" className="home-stock-potrero-tabla-th-area">
              Área
            </th>
            <th scope="col" className="home-stock-potrero-tabla-th-nivel">
              Nivel
            </th>
          </tr>
        </thead>
        <tbody>
          {potreros.map((resumen) => {
            const sinAsignar = potreroStockEquinoEsSinAsignar(resumen);
            return (
              <tr
                key={`${resumen.potreroId ?? "x"}-${resumen.potreroNombre}`}
                className={sinAsignar ? "is-sin-potrero" : undefined}
              >
                <th scope="row" className="home-stock-potrero-tabla-potrero">
                  {resumen.potreroNombre}
                </th>
                <td className="home-stock-potrero-tabla-num home-stock-potrero-tabla-row-total">
                  {resumen.total}
                </td>
                <OcupacionCelda resumen={resumen} sinAsignar={sinAsignar} />
                <DotacionCelda resumen={resumen} sinAsignar={sinAsignar} />
                <AreaCelda resumen={resumen} />
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
            >
              {pieDotacion ? (
                <span className="home-stock-potrero-dotacion-valor">{pieDotacion.principal}</span>
              ) : (
                <span className="home-stock-potrero-dotacion-vacio">—</span>
              )}
            </td>
            <td className="home-stock-potrero-tabla-area home-stock-potrero-tabla-foot-area">
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

export default function HomeStockEquinoPotreroPanel({
  user,
  apiOnline,
  onOpenStock,
  onOpenMapa,
}: Props) {
  const scopeKey = `${user.id}:${user.login_mode ?? "consolidado"}:${
    user.empresa_operativa_activa_id ?? "todas"
  }`;
  const [loading, setLoading] = useState(() => !readHomeStockEquinoPotreroCache(scopeKey));
  const [ready, setReady] = useState(() => Boolean(readHomeStockEquinoPotreroCache(scopeKey)));
  const [potrerosMapa, setPotrerosMapa] = useState<CampoPotreroMapa[]>(() => {
    return readHomeStockEquinoPotreroCache(scopeKey)?.potrerosMapa ?? [];
  });
  const [equino, setEquino] = useState<StockEquinaDispositivo[]>(() => {
    return readHomeStockEquinoPotreroCache(scopeKey)?.equino ?? [];
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scopedCache = readHomeStockEquinoPotreroCache(scopeKey);
    setPotrerosMapa(scopedCache?.potrerosMapa ?? []);
    setEquino(scopedCache?.equino ?? []);
    setReady(Boolean(scopedCache));

    if (!apiOnline) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([fetchCampoPotrerosMapa(), fetchStockEquinaDispositivos({})])
      .then(([potrerosData, equinoData]) => {
        if (cancelled) return;
        const next = { scopeKey, potrerosMapa: potrerosData, equino: equinoData };
        writeHomeStockEquinoPotreroCache(next);
        setPotrerosMapa(potrerosData);
        setEquino(equinoData);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (!readHomeStockEquinoPotreroCache(scopeKey)) {
          setError("No se pudo cargar el stock equino.");
          setPotrerosMapa([]);
          setEquino([]);
          setReady(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, scopeKey]);

  const snapshot = useMemo(
    () => buildHomeStockEquinoPotreroSnapshot(potrerosMapa, equino),
    [equino, potrerosMapa],
  );

  const fechaHoy = fmtDate(todayIso());
  const showLoadingPlaceholder = loading && !ready;

  return (
    <section
      className="sg-hub-panel home-hub-panel--stock-potrero home-hub-panel--stock-equino-potrero"
      aria-label="Stock equino por potrero"
      aria-busy={loading}
    >
      <div className="sg-hub-panel-head home-hub-panel-head-row">
        <div>
          <p className="sg-hub-panel-kicker home-stock-equino-potrero-kicker">
            <StockEquinoModuleIcon size={14} strokeWidth={1.75} />
            Stock Equinos
          </p>
          <h2 className="sg-hub-panel-title">Equinos por potrero</h2>
          <p className="home-stock-potrero-sub muted">
            Resumen al {fechaHoy} · ocupación % (UE ÷ ha del mapa) y dotación UE/ha · solo
            activos
          </p>
        </div>
        <button type="button" className="home-hub-link" onClick={onOpenStock}>
          Abrir stock
          <ArrowRight size={14} aria-hidden />
        </button>
      </div>

      {showLoadingPlaceholder ? (
        <p className="home-hub-empty">Cargando stock equino por potrero…</p>
      ) : error && !ready ? (
        <p className="home-hub-empty">{error}</p>
      ) : snapshot.totales.total === 0 ? (
        <div className="home-stock-potrero-empty">
          <StockEquinoModuleIcon size={28} strokeWidth={1.5} />
          <p>No hay equinos activos en stock.</p>
          <button type="button" className="sg-hub-cta sg-hub-cta--compact" onClick={onOpenStock}>
            Ir a Stock Equinos
          </button>
        </div>
      ) : (
        <>
          <section
            className="sg-hub-kpi-strip home-hub-kpi-strip home-stock-potrero-kpi-strip"
            aria-label="Totales del stock equino"
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
              {snapshot.totales.sinPotrero} equino
              {snapshot.totales.sinPotrero === 1 ? "" : "s"} sin potrero asignado en el mapa.
              {onOpenMapa ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="home-hub-link home-hub-link--inline"
                    onClick={onOpenMapa}
                  >
                    Ver mapa
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {snapshot.potreros.length === 0 ? (
            <p className="home-hub-empty">
              Hay {snapshot.totales.total} equinos en stock pero ninguno vinculado a un potrero del
              mapa.
              {onOpenMapa ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="home-hub-link home-hub-link--inline"
                    onClick={onOpenMapa}
                  >
                    Dibujar potreros
                  </button>
                </>
              ) : null}
            </p>
          ) : (
            <PotreroTabla
              potreros={snapshot.potreros}
              totalGeneral={snapshot.totales.total}
              densidadPromedio={snapshot.densidadPromedio}
            />
          )}
        </>
      )}
    </section>
  );
}
