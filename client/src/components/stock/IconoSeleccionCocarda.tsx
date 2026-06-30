/** Cocarda roja — marca de selección de cabaña (WebP optimizado + fallback PNG) */
export default function IconoSeleccionCocarda({
  className = "",
}: {
  className?: string;
}) {
  return (
    <picture>
      <source srcSet="/icons/seleccion-cocarda.webp" type="image/webp" />
      <img
        src="/icons/seleccion-cocarda.png"
        className={`stock-seleccion-cocarda${className ? ` ${className}` : ""}`}
        alt=""
        width={26}
        height={32}
        decoding="async"
        loading="eager"
        fetchPriority="high"
        draggable={false}
      />
    </picture>
  );
}
