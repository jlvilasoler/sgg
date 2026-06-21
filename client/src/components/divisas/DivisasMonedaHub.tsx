import type { DivisasMonedaConfig } from "./divisas-config";
import DivisasHistorial from "./DivisasHistorial";

interface Props {
  config: DivisasMonedaConfig;
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolverDivisas: () => void;
}

export default function DivisasMonedaHub({
  config,
  apiOnline,
  onError,
  onSuccess,
  onVolverDivisas,
}: Props) {
  return (
    <DivisasHistorial
      key={config.id}
      config={config}
      apiOnline={apiOnline}
      onError={onError}
      onSuccess={onSuccess}
      onVolver={onVolverDivisas}
    />
  );
}
