/** Silueta de cap�n/carnero � marcador bajo la l�nea de tiempo (machos) */
export default function IconoCaponEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/capon-evolucion.png?v=5"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
