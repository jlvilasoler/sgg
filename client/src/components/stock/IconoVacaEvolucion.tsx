/** Silueta de vaca — marcador bajo la línea de tiempo (hembras) */
export default function IconoVacaEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/vaca-evolucion.png"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
