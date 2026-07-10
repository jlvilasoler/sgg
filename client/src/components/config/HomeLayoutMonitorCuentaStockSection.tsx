import { useCallback, useEffect, useState } from "react";
import { Beef, RefreshCw } from "lucide-react";
import { fetchHomeLayoutMonitorStockCuenta } from "../../api";
import type { HomeLayoutMonitorStockCuentaDetalle } from "../../types";
import { HomeLayoutMonitorEspecieStockBlock } from "./HomeLayoutMonitorStockBlocks";

interface Props {
  apiOnline: boolean;
  cuentaId: number | null | undefined;
  cuentaNombre?: string | null;
  onError: (msg: string) => void;
  refreshKey?: number;
}

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

export default function HomeLayoutMonitorCuentaStockSection({
  apiOnline,
  cuentaId,
  cuentaNombre,
  onError,
  refreshKey = 0,
}: Props) {
  const [data, setData] = useState<HomeLayoutMonitorStockCuentaDetalle | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!apiOnline || cuentaId == null || cuentaId <= 0) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await fetchHomeLayoutMonitorStockCuenta(cuentaId));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar stock de la cuenta");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiOnline, cuentaId, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (cuentaId == null || cuentaId <= 0) {
    return (
      <section className="home-layout-monitor-cuenta-stock is-empty" aria-label="Stock de la cuenta">
        <p className="muted">Este usuario no tiene cuenta madre asociada para consultar stock.</p>
      </section>
    );
  }

  const label = cuentaNombre ?? data?.nombre ?? "Cuenta seleccionada";

  return (
    <section
      className="home-layout-monitor-cuenta-stock"
      aria-labelledby="home-layout-monitor-cuenta-stock-title"
    >
      <header className="home-layout-monitor-stock-head">
        <div>
          <p className="sg-hub-panel-kicker">Stock de la cuenta</p>
          <h3 id="home-layout-monitor-cuenta-stock-title" className="home-layout-monitor-stock-title">
            {label}
          </h3>
          <p className="muted home-layout-monitor-stock-lead">
            Animales activos (ganadero y equino) de la cuenta del usuario seleccionado: totales, sexo
            y categoría etaria.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary home-layout-users-monitor-refresh"
          onClick={() => void load()}
          disabled={!apiOnline || loading}
        >
          <RefreshCw size={15} aria-hidden />
          Actualizar stock
        </button>
      </header>

      {loading ? (
        <p className="home-layout-users-monitor-empty muted">Cargando stock de la cuenta…</p>
      ) : !data ? (
        <div className="home-layout-monitor-stock-empty">
          <Beef size={26} strokeWidth={1.5} aria-hidden />
          <p className="muted">No se pudo cargar el stock de esta cuenta.</p>
        </div>
      ) : (
        <>
          <div className="home-layout-monitor-cuenta-stock-summary">
            <span>
              <strong>{fmtEntero(data.total_animales)}</strong> animales activos
            </span>
            <span className="muted">
              Ganadero {fmtEntero(data.ganadero.total)} · Equino {fmtEntero(data.equino.total)}
            </span>
            {data.codigo ? (
              <span className="muted">
                {data.codigo} · Nº {data.cuenta_numero}
              </span>
            ) : null}
          </div>

          <div className="home-layout-monitor-cuenta-stock-grid">
            <HomeLayoutMonitorEspecieStockBlock
              kicker="Ganadero"
              titulo="Stock ganadero"
              especie={data.ganadero}
            />
            <HomeLayoutMonitorEspecieStockBlock
              kicker="Equino"
              titulo="Stock equino"
              especie={data.equino}
            />
          </div>
        </>
      )}
    </section>
  );
}
