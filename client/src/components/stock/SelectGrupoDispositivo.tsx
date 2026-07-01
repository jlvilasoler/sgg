import { fmtGeneracionRango, GRUPO_PREFIX } from "./stock-ganadera-utils";

interface Props {
  mes: number | null;
  anio: number | null;
  disabled?: boolean;
  id?: string;
}

/** Generación GEN + rango jul–jun, derivada del nacimiento. */
export default function SelectGrupoDispositivo({
  mes,
  anio,
  disabled: _disabled = false,
  id,
}: Props) {
  const rango = fmtGeneracionRango(mes, anio);
  const vacio = rango === "—";

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
        className={`stock-grupo-auto-valor${vacio ? " stock-grupo-auto-valor--empty" : ""}`}
        aria-label={
          vacio
            ? "Generación sin definir"
            : `Generación ${GRUPO_PREFIX}${rango}`
        }
      >
        {vacio ? "Sin fecha de nacimiento" : rango}
      </div>
    </div>
  );
}
