import type { TcTendencia } from "./divisas-utils";
import { fmtNum } from "./divisas-utils";

const TREND_META: Record<
  TcTendencia,
  { symbol: string; label: string; className: string }
> = {
  up: { symbol: "▲", label: "Subió respecto al día anterior", className: "tc-trend-up" },
  down: {
    symbol: "▼",
    label: "Bajó respecto al día anterior",
    className: "tc-trend-down",
  },
  equal: {
    symbol: "→",
    label: "Igual al día anterior",
    className: "tc-trend-equal",
  },
  none: { symbol: "", label: "Sin día anterior en el histórico", className: "" },
};

interface Props {
  valor: number;
  tendencia: TcTendencia;
  decimals?: number;
}

export default function TcValorConTendencia({
  valor,
  tendencia,
  decimals = 4,
}: Props) {
  const meta = TREND_META[tendencia];
  return (
    <span className="tc-valor-con-tendencia">
      <span className="tc-valor-num">{fmtNum(valor, decimals)}</span>
      {tendencia !== "none" && (
        <span
          className={`tc-trend ${meta.className}`}
          title={meta.label}
          aria-label={meta.label}
        >
          {meta.symbol}
        </span>
      )}
    </span>
  );
}
