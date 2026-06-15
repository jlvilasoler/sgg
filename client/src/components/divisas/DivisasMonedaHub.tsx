import { useState } from "react";
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
  const [refreshKey] = useState(0);

  return (
    <DivisasHistorial
      key={refreshKey}
      config={config}
      apiOnline={apiOnline}
      onError={onError}
      onSuccess={onSuccess}
      onVolver={onVolverDivisas}
    />
  );
}
