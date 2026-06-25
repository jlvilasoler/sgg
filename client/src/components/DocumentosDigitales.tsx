import DocumentosDigitalesHub from "./documentos-digitales/DocumentosDigitalesHub";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

export default function DocumentosDigitales(props: Props) {
  return <DocumentosDigitalesHub {...props} />;
}
