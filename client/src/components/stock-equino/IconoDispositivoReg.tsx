/** Icono registro / REG equino — filas y cabecera de edición */
export default function IconoDispositivoReg({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 80"
      aria-hidden
      focusable="false"
    >
      {/* Marco del dispositivo / formulario */}
      <rect
        x="4"
        y="2"
        width="56"
        height="76"
        rx="8"
        ry="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      {/* Barra superior */}
      <rect x="12" y="12" width="40" height="7" rx="1.5" fill="currentColor" />
      {/* Líneas de texto */}
      <rect x="12" y="24" width="40" height="2.8" rx="1" fill="currentColor" />
      <rect x="12" y="30" width="34" height="2.8" rx="1" fill="currentColor" />
      <rect x="12" y="36" width="38" height="2.8" rx="1" fill="currentColor" />
      <rect x="12" y="42" width="28" height="2.8" rx="1" fill="currentColor" />
      <rect x="12" y="48" width="36" height="2.8" rx="1" fill="currentColor" />
      {/* Pie con botón REGISTER */}
      <rect x="8" y="56" width="48" height="16" rx="2" fill="currentColor" />
      <rect x="16" y="59.5" width="32" height="9" rx="2.5" fill="#fff" />
      <text
        x="32"
        y="66.2"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="currentColor"
        fontSize="5.2"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="0.04em"
      >
        REGISTER
      </text>
    </svg>
  );
}
