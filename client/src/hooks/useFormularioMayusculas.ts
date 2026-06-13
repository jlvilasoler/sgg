import { useEffect } from "react";
import { aplicarMayusculasEnInput, estaEnAmbitoFormulario } from "../utils/formText";

/** Mayúsculas al escribir en inputs/textarea dentro de formularios y zonas `.mayusculas-auto`. */
export function useFormularioMayusculas() {
  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      if (!estaEnAmbitoFormulario(t)) return;
      aplicarMayusculasEnInput(t);
    };
    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);
}
