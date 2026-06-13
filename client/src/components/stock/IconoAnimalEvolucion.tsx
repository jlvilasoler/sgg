import type { DispositivoSexo } from "../../types";
import IconoToroEvolucion from "./IconoToroEvolucion";
import IconoVacaEvolucion from "./IconoVacaEvolucion";

interface Props {
  sexo: DispositivoSexo;
  className?: string;
}

/** Icono de animal bajo la línea de tiempo según sexo del dispositivo */
export default function IconoAnimalEvolucion({ sexo, className = "" }: Props) {
  if (sexo === "MACHO") {
    return <IconoToroEvolucion className={className} />;
  }
  if (sexo === "HEMBRA") {
    return <IconoVacaEvolucion className={className} />;
  }
  return null;
}
