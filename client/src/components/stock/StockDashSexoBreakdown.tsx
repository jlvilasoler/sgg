import type { SexoDispositivoCounts } from "./stock-ganadera-utils";

interface Props {
  stats: SexoDispositivoCounts;
  loading?: boolean;
  variant?: "inline" | "pills" | "compact";
}

export default function StockDashSexoBreakdown({
  stats,
  loading = false,
  variant = "inline",
}: Props) {
  if (loading) {
    if (variant === "compact") {
      return (
        <div className="sg-kpi-sexo-compact" aria-hidden>
          <div className="sg-kpi-sexo-bar">
            <span className="sg-kpi-sexo-bar-seg sg-kpi-sexo-bar-seg--empty" />
          </div>
          <div className="sg-kpi-sexo-legend">
            <span className="sg-kpi-sexo-legend-item">—</span>
          </div>
        </div>
      );
    }
    const cls =
      variant === "pills"
        ? "sg-kpi-sexo"
        : "stock-dash-sexo";
    return <div className={cls}>—</div>;
  }

  if (variant === "compact") {
    const total = stats.machos + stats.hembras + stats.sinDefinir;

    return (
      <div
        className="sg-kpi-sexo-compact"
        aria-label={`${stats.machos} machos, ${stats.hembras} hembras, ${stats.sinDefinir} sin definir`}
      >
        <div className="sg-kpi-sexo-bar" aria-hidden>
          {total > 0 ? (
            <>
              {stats.machos > 0 && (
                <span
                  className="sg-kpi-sexo-bar-seg sg-kpi-sexo-bar-seg--macho"
                  style={{ flexGrow: stats.machos }}
                />
              )}
              {stats.hembras > 0 && (
                <span
                  className="sg-kpi-sexo-bar-seg sg-kpi-sexo-bar-seg--hembra"
                  style={{ flexGrow: stats.hembras }}
                />
              )}
              {stats.sinDefinir > 0 && (
                <span
                  className="sg-kpi-sexo-bar-seg sg-kpi-sexo-bar-seg--sin"
                  style={{ flexGrow: stats.sinDefinir }}
                />
              )}
            </>
          ) : (
            <span className="sg-kpi-sexo-bar-seg sg-kpi-sexo-bar-seg--empty" />
          )}
        </div>
        <div className="sg-kpi-sexo-legend">
          <span className="sg-kpi-sexo-legend-item sg-kpi-sexo-legend-item--macho">
            <span className="sg-kpi-sexo-legend-dot" aria-hidden />
            Machos <strong>{stats.machos}</strong>
          </span>
          <span className="sg-kpi-sexo-legend-item sg-kpi-sexo-legend-item--hembra">
            <span className="sg-kpi-sexo-legend-dot" aria-hidden />
            Hembras <strong>{stats.hembras}</strong>
          </span>
          {stats.sinDefinir > 0 ? (
            <span className="sg-kpi-sexo-legend-item sg-kpi-sexo-legend-item--sin">
              <span className="sg-kpi-sexo-legend-dot" aria-hidden />
              S/D <strong>{stats.sinDefinir}</strong>
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "pills") {
    return (
      <div
        className="sg-kpi-sexo"
        aria-label={`${stats.machos} machos, ${stats.hembras} hembras, ${stats.sinDefinir} sin definir`}
      >
        <span className="sg-kpi-sexo-pill sg-kpi-sexo-pill--macho">
          <span className="sg-kpi-sexo-pill-label">Machos</span>
          <span className="sg-kpi-sexo-pill-val">{stats.machos}</span>
        </span>
        <span className="sg-kpi-sexo-pill sg-kpi-sexo-pill--hembra">
          <span className="sg-kpi-sexo-pill-label">Hembras</span>
          <span className="sg-kpi-sexo-pill-val">{stats.hembras}</span>
        </span>
        <span className="sg-kpi-sexo-pill sg-kpi-sexo-pill--sin">
          <span className="sg-kpi-sexo-pill-label">Sin definir</span>
          <span className="sg-kpi-sexo-pill-val">{stats.sinDefinir}</span>
        </span>
      </div>
    );
  }

  return (
    <span
      className="stock-dash-sexo"
      aria-label={`${stats.machos} machos, ${stats.hembras} hembras, ${stats.sinDefinir} sin definir`}
    >
      <span className="stock-dash-sexo-part stock-dash-sexo-part--macho">
        {stats.machos} macho{stats.machos !== 1 ? "s" : ""}
      </span>
      <span className="stock-dash-sexo-sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      <span className="stock-dash-sexo-part stock-dash-sexo-part--hembra">
        {stats.hembras} hembra{stats.hembras !== 1 ? "s" : ""}
      </span>
      <span className="stock-dash-sexo-sep" aria-hidden>
        {" "}
        ·{" "}
      </span>
      <span className="stock-dash-sexo-part stock-dash-sexo-part--sin">
        {stats.sinDefinir} sin definir
      </span>
    </span>
  );
}
