import type { ReactNode } from "react";
import {
  StockControlSanitarioIconSvg,
  StockGanaderoModuleIcon,
} from "./StockControlSanitarioSectionTitle";
interface Props {
  modulo: "ganadero" | "equino";
  children: ReactNode;
  className?: string;
}

export default function StockModuloHeading({
  modulo,
  children,
  className = "",
}: Props) {
  return (
    <h2
      className={`stock-module-heading stock-module-heading--${modulo} ${className}`.trim()}
    >
      <span className="stock-module-heading-icon" aria-hidden>
        {modulo === "ganadero" ? (
          <StockGanaderoModuleIcon size={14} />
        ) : (
          <StockControlSanitarioIconSvg icon="modulo-equino" size={14} />
        )}
      </span>
      {children}
    </h2>
  );
}
