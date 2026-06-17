import { GRUPO_PREFIX } from "./stock-ganadera-utils";

interface Props {
  anio: number | null;
  disabled?: boolean;
  id?: string;
}

/** Generación GEN + año, derivada automáticamente del año de nacimiento. */
export default function SelectGrupoDispositivo({
  anio,
  disabled: _disabled = false,
  id,
}: Props) {
  return (
    <div
      id={id}
      className="stock-grupo-row stock-grupo-row--auto"
      aria-live="polite"
    >
      <span className="stock-grupo-prefix" aria-hidden>
        {GRUPO_PREFIX}
      </span>
      <div
        className={`stock-grupo-auto-valor${anio === null ? " stock-grupo-auto-valor--empty" : ""}`}
        aria-label={anio ? `Generación ${GRUPO_PREFIX}${anio}` : "Generación sin definir"}
      >
        {anio ?? "Sin año de nacimiento"}
      </div>
    </div>
  );
}
