import type { DispositivoEstado } from "../../types";
import { fmtGeneracionRango, GRUPO_PREFIX } from "./stock-ganadera-utils";
import SelectEstadoDispositivo from "./SelectEstadoDispositivo";
import StockEditarFichaEdadDisplay from "./StockEditarFichaEdadDisplay";
import StockEditarFichaLabel, { FichaLabelIconSvg } from "./StockEditarFichaLabel";

interface Props {
  edadMeses: number | null;
  edadId: string;
  grupoId: string;
  estadoId: string;
  nacimientoMes: number | null;
  nacimientoAnio: number | null;
  estado: DispositivoEstado;
  disabled?: boolean;
  onEstadoChange: (estado: DispositivoEstado) => void;
}

export default function StockEditarFichaStats({
  edadMeses,
  edadId,
  grupoId,
  estadoId,
  nacimientoMes,
  nacimientoAnio,
  estado,
  disabled = false,
  onEstadoChange,
}: Props) {
  const generacionRango = fmtGeneracionRango(nacimientoMes, nacimientoAnio);

  return (
    <div className="stock-editar-ficha-stats" aria-label="Resumen del animal">
      <div className="stock-editar-ficha-stat stock-editar-ficha-stat--edad">
        <StockEditarFichaLabel icon="edad" as="span" variant="stat">
          Edad
        </StockEditarFichaLabel>
        <div id={edadId} className="stock-editar-ficha-stat-body">
          {edadMeses === null ? (
            <span className="stock-editar-ficha-stat-empty">Sin fecha</span>
          ) : (
            <StockEditarFichaEdadDisplay meses={edadMeses} />
          )}
        </div>
      </div>

      <div
        className="stock-editar-ficha-stat stock-editar-ficha-stat--gen"
        aria-label="Generación"
      >
        <div id={grupoId} className="stock-editar-ficha-stat-body" aria-live="polite">
          {generacionRango === "—" ? (
            <span className="stock-editar-ficha-stat-empty">—</span>
          ) : (
            <span className="stock-editar-ficha-stat-gen">
              <span className="stock-editar-ficha-stat-gen-icon" aria-hidden>
                <FichaLabelIconSvg icon="generacion" />
              </span>
              <span className="stock-editar-ficha-stat-gen-prefix">{GRUPO_PREFIX}</span>
              <span className="stock-editar-ficha-stat-value num">{generacionRango}</span>
            </span>
          )}
        </div>
      </div>

      <div className="stock-editar-ficha-stat stock-editar-ficha-stat--estado">
        <StockEditarFichaLabel icon="estado" htmlFor={estadoId} variant="stat">
          Estado
        </StockEditarFichaLabel>
        <div className="stock-editar-ficha-stat-body stock-editar-ficha-stat-body--control">
          <SelectEstadoDispositivo
            id={estadoId}
            value={estado}
            disabled={disabled}
            onChange={onEstadoChange}
          />
        </div>
      </div>
    </div>
  );
}
