import type { DispositivoSexo } from "../../types";
import IconoCaponEvolucion from "./IconoCaponEvolucion";
import IconoOvejaEvolucion from "./IconoOvejaEvolucion";

interface Props {
  sexo: DispositivoSexo;
  className?: string;
}

/** Icono de animal bajo la línea de tiempo según sexo del dispositivo */
export default function IconoAnimalEvolucion({ sexo, className = "" }: Props) {
  if (sexo === "MACHO") {
    return <IconoCaponEvolucion className={className} />;
  }
  if (sexo === "HEMBRA") {
    return <IconoOvejaEvolucion className={className} />;
  }
  return null;
}
