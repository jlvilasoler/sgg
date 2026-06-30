import type { DispositivoEstado } from "../../types";
import { GRUPO_PREFIX } from "./stock-ganadera-utils";
import SelectEstadoDispositivo from "./SelectEstadoDispositivo";

interface Props {
  edadMeses: number | null;
  edadId: string;
  grupoId: string;
  estadoId: string;
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
  nacimientoAnio,
  estado,
  disabled = false,
  onEstadoChange,
}: Props) {
  return (
    <div className="stock-editar-ficha-stats" aria-label="Resumen del animal">
      <div className="stock-editar-ficha-stat stock-editar-ficha-stat--edad">
        <span className="stock-editar-ficha-stat-label">Edad</span>
        <div id={edadId} className="stock-editar-ficha-stat-body">
          {edadMeses === null ? (
            <span className="stock-editar-ficha-stat-empty">Sin fecha</span>
          ) : (
            <>
              <span className="stock-editar-ficha-stat-value num">{edadMeses}</span>
              <span className="stock-editar-ficha-stat-unit">meses</span>
            </>
          )}
        </div>
      </div>

      <div className="stock-editar-ficha-stat stock-editar-ficha-stat--gen">
        <span className="stock-editar-ficha-stat-label">Generación</span>
        <div id={grupoId} className="stock-editar-ficha-stat-body" aria-live="polite">
          {nacimientoAnio === null ? (
            <span className="stock-editar-ficha-stat-empty">—</span>
          ) : (
            <>
              <span className="stock-editar-ficha-stat-gen-prefix">{GRUPO_PREFIX}</span>
              <span className="stock-editar-ficha-stat-value num">{nacimientoAnio}</span>
            </>
          )}
        </div>
      </div>

      <div className="stock-editar-ficha-stat stock-editar-ficha-stat--estado">
        <label className="stock-editar-ficha-stat-label" htmlFor={estadoId}>
          Estado
        </label>
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
