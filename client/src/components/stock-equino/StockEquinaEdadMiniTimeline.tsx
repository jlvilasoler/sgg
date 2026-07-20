import { useMemo } from "react";
import type { DispositivoEstado, DispositivoSexo } from "../../types";
import {
  calcularEdadMeses,
  calcularMesesEntreFechas,
  etapaHembraDesdeMeses,
  etapaMachoDesdeMeses,
  pctEscalaMeses,
  pctHembraVisual,
  pctMachoVisual,
  requiereFechaBaja,
} from "./stock-equina-utils";

const MAX_MESES_GENERAL = 720;

interface Props {
  sexo: DispositivoSexo;
  nacimientoMes: number | null;
  nacimientoAnio: number | null;
  estado?: DispositivoEstado;
  bajaMes?: number | null;
  bajaAnio?: number | null;
}

function pctVisual(
  meses: number,
  sexo: DispositivoSexo
): number {
  if (sexo === "MACHO") return pctMachoVisual(meses);
  if (sexo === "HEMBRA") return pctHembraVisual(meses);
  return pctEscalaMeses(meses, MAX_MESES_GENERAL);
}

export default function StockEquinaEdadMiniTimeline({
  sexo,
  nacimientoMes,
  nacimientoAnio,
  estado = "VIVO",
  bajaMes = null,
  bajaAnio = null,
}: Props) {
  const edadMeses = useMemo(
    () => calcularEdadMeses(nacimientoMes, nacimientoAnio),
    [nacimientoMes, nacimientoAnio]
  );

  const variant = sexo === "MACHO" ? "macho" : sexo === "HEMBRA" ? "hembra" : "general";

  const { posicionPct, etapaLabel, ariaLabel } = useMemo(() => {
    if (edadMeses === null) {
      return { posicionPct: 0, etapaLabel: "", ariaLabel: "Sin fecha de nacimiento" };
    }
    if (sexo === "MACHO") {
      const etapa = etapaMachoDesdeMeses(edadMeses);
      return {
        posicionPct: pctMachoVisual(edadMeses),
        etapaLabel: etapa.titulo,
        ariaLabel: `${etapa.titulo}, ${edadMeses} meses`,
      };
    }
    if (sexo === "HEMBRA") {
      const etapa = etapaHembraDesdeMeses(edadMeses);
      return {
        posicionPct: pctHembraVisual(edadMeses),
        etapaLabel: etapa.titulo,
        ariaLabel: `${etapa.titulo}, ${edadMeses} meses`,
      };
    }
    return {
      posicionPct: pctEscalaMeses(edadMeses, MAX_MESES_GENERAL),
      etapaLabel: `${edadMeses} m`,
      ariaLabel: `${edadMeses} meses`,
    };
  }, [edadMeses, sexo]);

  const bajaPct = useMemo(() => {
    if (!requiereFechaBaja(estado) || !bajaMes || !bajaAnio) return null;
    const mesesBaja = calcularMesesEntreFechas(
      nacimientoMes,
      nacimientoAnio,
      bajaMes,
      bajaAnio
    );
    if (mesesBaja === null) return null;
    return pctVisual(mesesBaja, sexo);
  }, [estado, bajaMes, bajaAnio, nacimientoMes, nacimientoAnio, sexo]);

  if (edadMeses === null) {
    return (
      <div className="stock-edad-mini stock-edad-mini--empty">
        <span className="stock-edad-mini-empty">Sin fecha</span>
        <div
          className="stock-edad-mini-track stock-edad-mini-track--empty"
          role="img"
          aria-label="Sin fecha de nacimiento"
        />
      </div>
    );
  }

  return (
    <div
      className={`stock-edad-mini stock-edad-mini--${variant}${
        requiereFechaBaja(estado) ? ` stock-edad-mini--${estado.toLowerCase()}` : ""
      }`}
      title={ariaLabel}
    >
      <div className="stock-edad-mini-head">
        <span className="stock-edad-mini-edad">{edadMeses} m</span>
        <span className="stock-edad-mini-etapa">{etapaLabel}</span>
      </div>
      <div
        className={`stock-edad-mini-track stock-edad-mini-track--${variant}`}
        role="img"
        aria-label={`Evolución: ${ariaLabel}`}
      >
        {variant === "hembra" && (
          <>
            <span className="stock-edad-mini-div stock-edad-mini-div--25" />
            <span className="stock-edad-mini-div stock-edad-mini-div--50" />
            <span className="stock-edad-mini-div stock-edad-mini-div--75" />
          </>
        )}
        {variant === "macho" && (
          <>
            <span className="stock-edad-mini-div stock-edad-mini-div--33" />
            <span className="stock-edad-mini-div stock-edad-mini-div--66" />
          </>
        )}
        <div
          className="stock-edad-mini-fill"
          style={{ width: `${posicionPct}%` }}
        />
        <div
          className={`stock-edad-mini-pin${
            posicionPct < 3 ? " stock-edad-mini-pin--inicio" : ""
          }`}
          style={{ left: `${posicionPct}%` }}
        />
        {bajaPct !== null && (
          <div
            className={`stock-edad-mini-pin stock-edad-mini-pin--baja stock-edad-mini-pin--baja-${estado.toLowerCase()}${
              bajaPct < 3 ? " stock-edad-mini-pin--inicio" : ""
            }`}
            style={{ left: `${bajaPct}%` }}
            title="Fecha de baja"
          />
        )}
      </div>
    </div>
  );
}
