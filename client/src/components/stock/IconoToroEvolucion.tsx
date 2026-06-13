/** Silueta de toro — marcador bajo la línea de tiempo (machos) */
export default function IconoToroEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/toro-evolucion.png"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
