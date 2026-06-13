import type { DispositivoEstado } from "../../types";
import { fmtEstadoDispositivo, normalizarEstadoDispositivo } from "./stock-ganadera-utils";

interface Props {
  estado: DispositivoEstado | undefined | null;
}

export default function BadgeEstadoDispositivo({ estado }: Props) {
  const norm = normalizarEstadoDispositivo(estado);
  return (
    <span className={`stock-badge-estado stock-badge-estado--${norm.toLowerCase()}`}>
      {fmtEstadoDispositivo(norm)}
    </span>
  );
}
