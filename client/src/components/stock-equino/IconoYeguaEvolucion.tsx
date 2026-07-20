/** Silueta de yegua/caballo — marcador bajo la línea de tiempo (hembras) */
export default function IconoYeguaEvolucion({ className = "" }: { className?: string }) {
  return (
    <img
      src="/icons/yegua-evolucion.png?v=3"
      className={className}
      alt=""
      width={40}
      height={28}
      decoding="async"
      draggable={false}
    />
  );
}
