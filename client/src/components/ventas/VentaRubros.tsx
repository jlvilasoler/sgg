import SubRubroListado from "../rubros/SubRubroListado";
import { VENTAS_RUBROS_API, VENTAS_RUBROS_COPY } from "../rubros/rubrosListadoConfig";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
  puedeEditar?: boolean;
  embedded?: boolean;
}

export default function VentaRubros({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  puedeEditar = true,
  embedded = false,
}: Props) {
  return (
    <SubRubroListado
      apiOnline={apiOnline}
      onError={onError}
      onSuccess={onSuccess}
      onVolver={onVolver}
      puedeEditar={puedeEditar}
      embedded={embedded}
      hubLayout={embedded}
      volverLabel="a Ingresos por ventas"
      rubrosApi={VENTAS_RUBROS_API}
      copy={VENTAS_RUBROS_COPY}
    />
  );
}
