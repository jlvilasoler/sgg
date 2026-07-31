/** Silueta de capón — marcador bajo la línea de tiempo (machos) */
export default function IconoCaponEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/capón-evolucion.png?v=3"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
