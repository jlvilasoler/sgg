import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  titulo: string;
  descripcion: string;
  onVolver: () => void;
  volverLabel?: string;
}

export default function SimuladorVentasSeccion({
  titulo,
  descripcion,
  onVolver,
  volverLabel = "Volver al simulador de ventas",
}: Props) {
  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>
      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "app", id: "simulador_venta_ganado" }}
            title={titulo}
            subtitle={descripcion}
          />
        </div>
      </div>
    </div>
  );
}
