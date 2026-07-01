import type { HubIconId } from "../icons/HubMenuIcons";
import { PageModuleHeadRow } from "../PageModuleHead";

interface Props {
  titulo: string;
  descripcion: string;
  onVolver: () => void;
  hubIcon?: HubIconId;
}

export default function VentasIngresosSeccion({
  titulo,
  descripcion,
  onVolver,
  hubIcon = "ventas_ingresar",
}: Props) {
  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a Ingresos por ventas
      </button>
      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: hubIcon }}
            title={titulo}
            subtitle={descripcion}
          />
        </div>
      </div>
    </div>
  );
}
