interface Props {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Cabeza equina en perfil (basado en Lucide Lab horse-head, ISC).
 * Diseñado para leerse bien en menú principal y títulos (~24–30px).
 */
export default function IconoCaballoEquinoSvg({
  className = "",
  size = 24,
  strokeWidth = 1.65,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M11.5 12H11" />
      <path d="M5 15a4 4 0 0 0 4 4h7.8l.3.3a3 3 0 0 0 4-4.46L12 7c0-3-1-5-1-5S8 3 8 7c-4 1-6 3-6 3" />
      <path d="M6.14 17.8S4 19 2 22" />
    </svg>
  );
}
