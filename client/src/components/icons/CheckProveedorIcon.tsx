/** Círculo verde + tilde blanco (como referencia), sin imagen con marca de agua. */
export default function CheckProveedorIcon({ size = 30 }: { size?: number }) {
  return (
    <svg
      className="check-proveedor-svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="32" r="32" fill="#43B049" />
      <path
        d="M18 33 L28 43 L48 21"
        stroke="#FFFFFF"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
