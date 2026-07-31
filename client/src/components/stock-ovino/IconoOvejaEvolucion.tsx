/** Silueta de oveja � marcador bajo la l�nea de tiempo (hembras) */
export default function IconoOvejaEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/oveja-evolucion.png?v=5"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
