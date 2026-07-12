import { Beef, Building2, Sprout, Wallet } from "lucide-react";
import type { TabId } from "../Header";
import type { HomePorCobrarData, HomePorCobrarModuloData } from "../../hooks/useHomeDashboard";
import { formatUsdSafe, pctSeguro } from "../../utils/home-kpi-normalize";
import { SgMiniBars } from "../stock/SgHubUi";

interface Props {
  data: HomePorCobrarData;
  onOpen: (tab: TabId) => void;
}

type Zona = {
  key: "arrendamientos" | "ganado" | "agricultura";
  label: string;
  mod: HomePorCobrarModuloData;
  tab: TabId;
  icon: typeof Building2;
  accentClass: string;
  foot: string;
  status: "ok" | "warn" | "idle";
};

function statusModulo(pendiente: number, cobrado: number): Zona["status"] {
  if (pendiente > 0.5) return pendiente > Math.max(cobrado, 1) ? "warn" : "ok";
  return "idle";
}

export default function HomePorCobrarKpi({ data, onOpen }: Props) {
  const zonas: Zona[] = [];

  if (data.arrendamientos.tiene) {
    const { contratos, pendienteUsd, cobradoEjercicioUsd } = data.arrendamientos;
    zonas.push({
      key: "arrendamientos",
      label: "Arrend.",
      mod: data.arrendamientos,
      tab: "ingresos_ventas",
      icon: Building2,
      accentClass: "home-por-cobrar-kpi-zone--arrend",
      foot:
        contratos != null && contratos > 0
          ? `${contratos} contrato(s)`
          : pendienteUsd > 0.5
            ? "Cobro pendiente"
            : "Al día",
      status: statusModulo(pendienteUsd, cobradoEjercicioUsd),
    });
  }

  if (data.ganado.tiene) {
    const { operaciones, pendienteUsd, cobradoEjercicioUsd } = data.ganado;
    zonas.push({
      key: "ganado",
      label: "Ganado",
      mod: data.ganado,
      tab: "simulador_venta_ganado",
      icon: Beef,
      accentClass: "home-por-cobrar-kpi-zone--ganado",
      foot:
        operaciones != null && operaciones > 0
          ? `${operaciones} op.`
          : pendienteUsd > 0.5
            ? "Cobro pendiente"
            : "Al día",
      status: statusModulo(pendienteUsd, cobradoEjercicioUsd),
    });
  }

  if (data.agricultura.tiene) {
    const { ventas, pendienteUsd, cobradoEjercicioUsd } = data.agricultura;
    zonas.push({
      key: "agricultura",
      label: "Agric.",
      mod: data.agricultura,
      tab: "ingresos_ventas",
      icon: Sprout,
      accentClass: "home-por-cobrar-kpi-zone--agric",
      foot:
        ventas != null && ventas > 0
          ? `${ventas} venta(s)`
          : pendienteUsd > 0.5
            ? "Cobro pendiente"
            : "Al día",
      status: statusModulo(pendienteUsd, cobradoEjercicioUsd),
    });
  }

  const totalPendiente = zonas.reduce((s, z) => s + z.mod.pendienteUsd, 0);
  const totalCobrado = zonas.reduce((s, z) => s + z.mod.cobradoEjercicioUsd, 0);
  const carteraTotal = totalPendiente + totalCobrado;
  const recoveryPct = pctSeguro(totalCobrado, carteraTotal);

  const ratioSegs = zonas.map((z) => ({
    key: z.key,
    pct: pctSeguro(z.mod.pendienteUsd, Math.max(totalPendiente, 1)),
    accentClass: `home-por-cobrar-kpi-ratio-seg--${z.key}`,
  }));

  const muestraCobradoEj = data.muestraCobradoEjercicio;

  return (
    <article className="sg-hub-kpi sg-hub-kpi--light home-por-cobrar-kpi home-exec-kpi home-exec-kpi--treasury">
      <div className="home-por-cobrar-kpi-head">
        <div className="home-por-cobrar-kpi-brand">
          <span className="home-por-cobrar-kpi-icon" aria-hidden>
            <Wallet size={18} strokeWidth={1.75} />
          </span>
          <div>
            <p className="home-por-cobrar-kpi-kicker">Por cobrar</p>
            <p className="home-por-cobrar-kpi-subtitle">
              {data.ejercicioLabel} · tesorería
            </p>
          </div>
        </div>
        <div className="home-por-cobrar-kpi-head-end">
          <div className="home-exec-kpi-treasury-totals">
            <span className="home-por-cobrar-kpi-head-total">{formatUsdSafe(totalPendiente)}</span>
            {muestraCobradoEj ? (
              <span className="home-exec-kpi-treasury-sub">
                Cobrado {formatUsdSafe(totalCobrado)} · {recoveryPct}% del ciclo
              </span>
            ) : null}
          </div>
          <SgMiniBars highlight="mid" />
        </div>
      </div>

      <div className={`home-por-cobrar-kpi-split is-count-${zonas.length}`}>
        {zonas.map((zona) => {
          const Icon = zona.icon;
          const { pendienteUsd, cobradoEjercicioUsd } = zona.mod;
          const modRecovery = pctSeguro(
            cobradoEjercicioUsd,
            pendienteUsd + cobradoEjercicioUsd,
          );
          return (
            <button
              key={zona.key}
              type="button"
              className={`home-por-cobrar-kpi-zone ${zona.accentClass}`}
              onClick={() => onOpen(zona.tab)}
              aria-label={`${zona.label}: pendiente ${formatUsdSafe(pendienteUsd)}, cobrado ejercicio ${formatUsdSafe(cobradoEjercicioUsd)}`}
            >
              <span className="home-por-cobrar-kpi-zone-top">
                <Icon size={13} strokeWidth={2} aria-hidden />
                <span className="home-por-cobrar-kpi-zone-eyebrow">{zona.label}</span>
                <span className={`home-exec-kpi-status home-exec-kpi-status--${zona.status}`}>
                  {zona.status === "warn" ? "Pend." : zona.status === "ok" ? "Mixto" : "Al día"}
                </span>
              </span>
              <span className="home-por-cobrar-kpi-zone-row">
                <span className="home-por-cobrar-kpi-zone-pair">
                  <span className="home-por-cobrar-kpi-zone-pair-label">Pend.</span>
                  <span className="home-por-cobrar-kpi-zone-value">
                    {formatUsdSafe(pendienteUsd)}
                  </span>
                </span>
                {muestraCobradoEj ? (
                  <span className="home-por-cobrar-kpi-zone-pair home-por-cobrar-kpi-zone-pair--ej">
                    <span className="home-por-cobrar-kpi-zone-pair-label">Cobr. ej.</span>
                    <span className="home-por-cobrar-kpi-zone-value home-por-cobrar-kpi-zone-value--ej">
                      {formatUsdSafe(cobradoEjercicioUsd)}
                    </span>
                  </span>
                ) : null}
              </span>
              <span className="home-por-cobrar-kpi-zone-hint">
                {zona.foot}
                {muestraCobradoEj && modRecovery > 0 ? ` · ${modRecovery}% cobrado` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {zonas.length > 1 && totalPendiente > 0 ? (
        <div className="home-por-cobrar-kpi-ratio" aria-hidden>
          {ratioSegs.map((seg) => (
            <span
              key={seg.key}
              className={`home-por-cobrar-kpi-ratio-seg ${seg.accentClass}`}
              style={{ width: `${Math.max(seg.pct, seg.pct > 0 ? 4 : 0)}%` }}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
