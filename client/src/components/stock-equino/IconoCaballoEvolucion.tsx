/** Silueta de caballo — marcador bajo la línea de tiempo (machos) */
export default function IconoCaballoEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/caballo-evolucion.png?v=3"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
