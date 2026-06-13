import SubRubroListado from "./rubros/SubRubroListado";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  volverLabel?: string;
}

export default function Rubros({
  apiOnline,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
  volverLabel,
}: Props) {
  return (
    <SubRubroListado
      apiOnline={apiOnline}
      onError={onError}
      onSuccess={onSuccess}
      onCatalogosChanged={onCatalogosChanged}
      onVolver={onVolver}
      volverLabel={volverLabel}
    />
  );
}
