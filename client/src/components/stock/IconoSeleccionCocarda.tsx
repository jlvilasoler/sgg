/** Cocarda roja — marca de selección de cabaña (fondo transparente) */
export default function IconoSeleccionCocarda({
  className = "",
}: {
  className?: string;
}) {
  return (
    <img
      src="/icons/seleccion-cocarda.png"
      className={`stock-seleccion-cocarda${className ? ` ${className}` : ""}`}
      alt=""
      width={26}
      height={32}
      decoding="async"
      draggable={false}
    />
  );
}
