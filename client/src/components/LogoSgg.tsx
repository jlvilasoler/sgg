/**
 * Logo SAG: ícono del usuario dentro del escudo circular.
 * logo1 legacy → public/logo-hereford.png
 */
import { APP_FULL_NAME, APP_NAME } from "../brand";

type LogoVariant = "badge" | "mark";

interface Props {
  className?: string;
  /** badge = escudo verde + ícono; mark = solo ícono */
  variant?: LogoVariant;
  title?: string;
}

function VacaMarcaIcon({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <image
      href="/logo-vaca-marca.png"
      x={x}
      y={y}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

export default function LogoSgg({
  className = "",
  variant = "badge",
  title = `${APP_NAME} — ${APP_FULL_NAME}`,
}: Props) {
  const id = variant === "badge" ? "sgg-logo-badge" : "sgg-logo-mark";
  const rootClass = ["sgg-logo", className].filter(Boolean).join(" ");

  if (variant === "mark") {
    return (
      <svg
        className={rootClass}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <g className="sgg-logo__mark sgg-logo__mark--solo">
          <VacaMarcaIcon x={4} y={4} size={56} />
        </g>
      </svg>
    );
  }

  return (
    <svg
      className={rootClass}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`${id}-bg`} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1a3324" />
          <stop stopColor="#2d5a3d" />
          <stop offset="1" stopColor="#3d6b4a" />
        </linearGradient>
        <linearGradient id={`${id}-ring`} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fcd535" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#f0b90b" stopOpacity="0.65" />
          <stop offset="1" stopColor="#c9970a" stopOpacity="0.35" />
        </linearGradient>
        <clipPath id={`${id}-inner`}>
          <circle cx="32" cy="32" r="22" />
        </clipPath>
      </defs>

      <g className="sgg-logo__stage">
        <circle className="sgg-logo__bg" cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} />

        <circle
          className="sgg-logo__ring-gold"
          cx="32"
          cy="32"
          r="28.5"
          fill="none"
          stroke={`url(#${id}-ring)`}
          strokeWidth="1.35"
        />

        <circle
          className="sgg-logo__ring-soft"
          cx="32"
          cy="32"
          r="26"
          stroke="#f8f6f0"
          strokeOpacity="0.16"
          strokeWidth="0.9"
          fill="none"
        />

        <g className="sgg-logo__core">
          <circle className="sgg-logo__core-fill" cx="32" cy="32" r="22" fill="#eceae4" />
          <g className="sgg-logo__mark" clipPath={`url(#${id}-inner)`}>
            <VacaMarcaIcon x={11} y={11} size={42} />
          </g>
        </g>
      </g>
    </svg>
  );
}
