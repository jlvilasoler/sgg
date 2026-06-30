interface Props {
  nombreCabana?: string;
  className?: string;
}

export default function IconoSeleccionCabanaEstrella({
  nombreCabana,
  className = "",
}: Props) {
  const nombre = nombreCabana?.trim();
  const title = nombre
    ? `Selección de cabaña · ${nombre}`
    : "Selección de cabaña";

  return (
    <span
      className={`stock-seleccion-cabana-star${className ? ` ${className}` : ""}`}
      title={title}
      aria-label={title}
    >
      <span aria-hidden>★</span>
    </span>
  );
}
