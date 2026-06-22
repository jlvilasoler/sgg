import { useCallback, useEffect, useState } from "react";
import { fetchSimuladorVentaDispositivos } from "../../api";
import { useHeaderBackStep } from "../../header-back";
import type { SimuladorVentaGanadoRow, SimuladorVentaDispositivoRow } from "../../types";
import { fmtNum } from "../divisas/divisas-utils";
import { etiquetaCaravana } from "../stock/stock-ganadera-utils";
import type { SimuladorVentaTipoConfig } from "./simulador-venta-config";

interface Props {
  row: SimuladorVentaGanadoRow;
  config: SimuladorVentaTipoConfig;
  apiOnline: boolean;
  onVolver: () => void;
  onError: (msg: string) => void;
}

export default function SimuladorVentaDispositivosVerPanel({
  row,
  config,
  apiOnline,
  onVolver,
  onError,
}: Props) {
  useHeaderBackStep(true, onVolver, "Simulador de ventas");
  const [items, setItems] = useState<SimuladorVentaDispositivoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const catLabel = config.labels[row.categoria] ?? row.categoria;
  const opCode = row.numero_operacion || `#${row.id}`;
  const cabVenta =
    row.real_cantidad_animales != null ? Math.round(row.real_cantidad_animales) : null;

  const load = useCallback(async () => {
    if (!apiOnline) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSimuladorVentaDispositivos(row.id);
      setItems(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar dispositivos");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError, row.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver al simulador
      </button>

      <div className="card subseccion-inline-card sim-disp-ver-inline">
        <div className="sim-audit-modal sim-disp-ver-modal sim-disp-ver-modal--inline">
        <header className="sim-audit-head">
          <div className="sim-audit-head-main">
            <div className="sim-audit-head-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
              </svg>
            </div>
            <div className="sim-audit-head-text">
              <p className="sim-audit-kicker">Venta cerrada · Dispositivos</p>
              <h2 id="sim-disp-ver-titulo">Dispositivos vinculados</h2>
              <div className="sim-disp-ver-meta">
                <span className="sim-audit-op-badge num">{opCode}</span>
                <span className="sim-disp-ver-cat">{catLabel}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="sim-disp-ver-body">
          <div className="sim-disp-ver-kpis">
            <div className="sim-disp-ver-kpi">
              <span className="sim-disp-ver-kpi-label">Vinculadas</span>
              <strong>{loading ? "…" : fmtNum(items.length, 0)}</strong>
            </div>
            {cabVenta != null && (
              <div className="sim-disp-ver-kpi">
                <span className="sim-disp-ver-kpi-label">Cab. venta</span>
                <strong>{fmtNum(cabVenta, 0)}</strong>
              </div>
            )}
          </div>

          {loading ? (
            <div className="sim-audit-state">
              <span className="sim-audit-spinner" aria-hidden />
              <p>Cargando dispositivos…</p>
            </div>
          ) : items.length === 0 ? (
            <p className="stock-import-queue-empty muted sim-disp-ver-empty">
              No hay dispositivos vinculados a esta operación.
            </p>
          ) : (
            <div className="stock-import-queue sim-disp-ver-queue">
              <ul className="stock-import-numero-lista sim-disp-ver-lista">
                {items.map((d) => (
                  <li key={d.clave} className="stock-import-numero-item">
                    <div className="stock-import-numero-item-body">
                      <span className="stock-import-numero-valor num">
                        {etiquetaCaravana(d)}
                      </span>
                      <span className="muted sim-caravanas-item-clave">Clave {d.clave}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="sim-disp-ver-foot subseccion-inline-foot">
          <button type="button" className="btn btn-ghost" onClick={onVolver}>
            Volver
          </button>
        </footer>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Usar SimuladorVentaDispositivosVerPanel */
export { SimuladorVentaDispositivosVerPanel as SimuladorVentaDispositivosVerModal };
