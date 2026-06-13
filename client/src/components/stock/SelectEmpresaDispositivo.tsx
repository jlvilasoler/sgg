import type { DispositivoEmpresa } from "../../types";

interface Props {
  value: DispositivoEmpresa;
  onChange: (empresa: DispositivoEmpresa) => void;
  disabled?: boolean;
  id?: string;
}

export default function SelectEmpresaDispositivo({
  value,
  onChange,
  disabled = false,
  id,
}: Props) {
  return (
    <select
      id={id}
      className="stock-empresa-select stock-edit-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DispositivoEmpresa)}
    >
      <option value="">Seleccionar empresa</option>
      <option value="GUAVIYU">GUAVIYU</option>
      <option value="CHIVILCOY">CHIVILCOY</option>
    </select>
  );
}
