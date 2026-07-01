import type { ReactNode } from "react";
import { fmtEdadAniosDesdeMeses } from "./stock-ganadera-utils";
import { FichaLabelIconSvg } from "./StockEditarFichaLabel";

interface Props {
  meses: number;
  className?: string;
  extra?: ReactNode;
}

export default function StockEditarFichaEdadDisplay({
  meses,
  className = "",
  extra,
}: Props) {
  return (
    <div className={`stock-editar-ficha-edad-display ${className}`.trim()}>
      <strong className="num">{meses}</strong>
      <span className="stock-editar-ficha-edad-unit stock-editar-ficha-edad-unit--meses">
        meses
      </span>
      <span className="stock-editar-ficha-edad-sep" aria-hidden>
        ·
      </span>
      <strong className="num">{fmtEdadAniosDesdeMeses(meses)}</strong>
      <span className="stock-editar-ficha-edad-unit stock-editar-ficha-edad-unit--anios">
        <span className="stock-editar-ficha-edad-unit-icon" aria-hidden>
          <FichaLabelIconSvg icon="anio" />
        </span>
        años
      </span>
      {extra}
    </div>
  );
}
