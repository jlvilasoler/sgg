/** Misma silueta de pin que en el mapa de campo (Google Maps–style). */
export const CAMPO_MAPA_PIN_PATH =
  "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z";

export function CampoMapaPinMark({
  color,
  className = "",
  size = 22,
}: {
  color: string | null;
  className?: string;
  size?: number;
}) {
  const empty = !color;
  return (
    <span
      className={`campo-mapa-pin-mark${empty ? " campo-mapa-pin-mark--empty" : ""}${
        className ? ` ${className}` : ""
      }`}
      style={{ width: size, height: Math.round(size * 1.22) }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          fill={empty ? "transparent" : color!}
          stroke={empty ? "rgba(100, 116, 139, 0.55)" : "#ffffff"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          d={CAMPO_MAPA_PIN_PATH}
        />
        <circle
          cx="12"
          cy="10"
          r="2.5"
          fill={empty ? "transparent" : "#ffffff"}
          fillOpacity={empty ? 0 : 0.92}
          stroke={empty ? "rgba(100, 116, 139, 0.45)" : "none"}
          strokeWidth={empty ? 1.2 : 0}
        />
      </svg>
    </span>
  );
}
