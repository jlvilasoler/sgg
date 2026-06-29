import type { DispositivoSexo } from "../../types";
import IconoCaballoEvolucion from "./IconoCaballoEvolucion";
import IconoYeguaEvolucion from "./IconoYeguaEvolucion";

interface Props {
  sexo: DispositivoSexo;
  className?: string;
}

/** Icono de animal bajo la línea de tiempo según sexo del dispositivo */
export default function IconoAnimalEvolucion({ sexo, className = "" }: Props) {
  if (sexo === "MACHO") {
    return <IconoCaballoEvolucion className={className} />;
  }
  if (sexo === "HEMBRA") {
    return <IconoYeguaEvolucion className={className} />;
  }
  return null;
}
