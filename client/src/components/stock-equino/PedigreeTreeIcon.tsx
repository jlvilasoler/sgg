/** Ícono de árbol genealógico: sujeto → padres → abuelos. */
export default function PedigreeTreeIcon({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
    >
      {/* Conectores tipo pedigree horizontal */}
      <path
        d="M6.8 12H10
           M10 12V7h3.2
           M10 12v5h3.2
           M13.2 7h2.6
           M13.2 17h2.6
           M15.8 7V4.6h3
           M15.8 7v2.4h3
           M15.8 17v-2.4h3
           M15.8 17v2.4h3"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Sujeto */}
      <circle cx="4.6" cy="12" r="2.2" fill="currentColor" />
      {/* Padres */}
      <circle cx="13.2" cy="7" r="1.75" fill="currentColor" />
      <circle cx="13.2" cy="17" r="1.75" fill="currentColor" />
      {/* Abuelos */}
      <circle cx="20" cy="4.6" r="1.25" fill="currentColor" />
      <circle cx="20" cy="9.4" r="1.25" fill="currentColor" />
      <circle cx="20" cy="14.6" r="1.25" fill="currentColor" />
      <circle cx="20" cy="19.4" r="1.25" fill="currentColor" />
    </svg>
  );
}
