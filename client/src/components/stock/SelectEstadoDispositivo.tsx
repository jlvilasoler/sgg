import type { DispositivoEstado } from "../../types";
import { ESTADOS_DISPOSITIVO } from "./stock-ganadera-utils";

interface Props {
  value: DispositivoEstado;
  onChange: (estado: DispositivoEstado) => void;
  disabled?: boolean;
  id?: string;
}

export default function SelectEstadoDispositivo({
  value,
  onChange,
  disabled = false,
  id,
}: Props) {
  return (
    <select
      id={id}
      className="stock-estado-select"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as DispositivoEstado)}
    >
      {ESTADOS_DISPOSITIVO.map((e) => (
        <option key={e.value} value={e.value}>
          {e.label}
        </option>
      ))}
    </select>
  );
}
