import type { DispositivoSexo } from "../../types";

interface Props {
  value: DispositivoSexo;
  onChange: (sexo: DispositivoSexo) => void;
  disabled?: boolean;
  id?: string;
}

export default function SelectSexoDispositivo({
  value,
  onChange,
  disabled = false,
  id,
}: Props) {
  return (
    <select
      id={id}
      className="stock-sexo-select stock-edit-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DispositivoSexo)}
    >
      <option value="">—</option>
      <option value="MACHO">MACHO</option>
      <option value="HEMBRA">HEMBRA</option>
    </select>
  );
}
