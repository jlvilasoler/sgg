import { useId } from "react";

type Mood = "idle" | "listening" | "speaking" | "thinking";

type Props = {
  mood?: Mood;
  className?: string;
};

/** Avatar vivo de la asistente (SVG + CSS). */
export default function AsistenteAvatar({ mood = "idle", className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  const skin = `asistente-skin-${uid}`;
  const hair = `asistente-hair-${uid}`;
  const cheek = `asistente-cheek-${uid}`;
  const bg = `asistente-bg-${uid}`;
  const clip = `asistente-face-clip-${uid}`;

  return (
    <div
      className={`asistente-avatar asistente-avatar--${mood}${className ? ` ${className}` : ""}`}
      aria-hidden
      title={
        mood === "listening"
          ? "Escuchando…"
          : mood === "speaking"
            ? "Hablando…"
            : mood === "thinking"
              ? "Pensando…"
              : "Asistente"
      }
    >
      <span className="asistente-avatar-glow" />
      <span className="asistente-avatar-ring" />
      <svg
        className="asistente-avatar-svg"
        viewBox="0 0 96 96"
        width="56"
        height="56"
        role="img"
        aria-label="Asistente"
      >
        <defs>
          <linearGradient id={skin} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde4d0" />
            <stop offset="55%" stopColor="#f5c9a8" />
            <stop offset="100%" stopColor="#e8b08a" />
          </linearGradient>
          <linearGradient id={hair} x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#3d2314" />
            <stop offset="45%" stopColor="#6b3a22" />
            <stop offset="100%" stopColor="#2a160c" />
          </linearGradient>
          <linearGradient id={cheek} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id={bg} cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="55%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </radialGradient>
          <clipPath id={clip}>
            <circle cx="48" cy="48" r="44" />
          </clipPath>
        </defs>

        <circle cx="48" cy="48" r="46" fill={`url(#${bg})`} />
        <circle
          cx="48"
          cy="48"
          r="44"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1.5"
        />

        <g clipPath={`url(#${clip})`}>
          <ellipse
            className="asistente-avatar-hair-back"
            cx="48"
            cy="52"
            rx="38"
            ry="42"
            fill={`url(#${hair})`}
          />

          <ellipse cx="48" cy="92" rx="28" ry="14" fill="#0d9488" opacity="0.35" />
          <path d="M22 96 C28 78, 68 78, 74 96" fill="#ccfbf1" opacity="0.9" />

          <g className="asistente-avatar-face">
            <ellipse cx="48" cy="50" rx="24" ry="28" fill={`url(#${skin})`} />

            <path
              className="asistente-avatar-bangs"
              d="M24 42 C28 18, 68 18, 72 42 C64 28, 56 26, 48 28 C40 26, 32 28, 24 42 Z"
              fill={`url(#${hair})`}
            />
            <path
              className="asistente-avatar-strand"
              d="M20 48 C18 62, 22 78, 28 88"
              fill="none"
              stroke="#6b3a22"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              className="asistente-avatar-strand asistente-avatar-strand--r"
              d="M76 48 C78 62, 74 78, 68 88"
              fill="none"
              stroke="#6b3a22"
              strokeWidth="5"
              strokeLinecap="round"
            />

            <ellipse
              className="asistente-avatar-cheek"
              cx="32"
              cy="56"
              rx="5.5"
              ry="3.5"
              fill={`url(#${cheek})`}
            />
            <ellipse
              className="asistente-avatar-cheek"
              cx="64"
              cy="56"
              rx="5.5"
              ry="3.5"
              fill={`url(#${cheek})`}
            />

            <path
              className="asistente-avatar-brow"
              d="M33 42 Q38 39 43 42"
              fill="none"
              stroke="#4a2c1a"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              className="asistente-avatar-brow asistente-avatar-brow--r"
              d="M53 42 Q58 39 63 42"
              fill="none"
              stroke="#4a2c1a"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            <g className="asistente-avatar-eyes">
              <g className="asistente-avatar-eye">
                <ellipse cx="38" cy="48" rx="5.2" ry="5.8" fill="#fff" />
                <circle className="asistente-avatar-iris" cx="38.5" cy="48.5" r="3.1" fill="#0f766e" />
                <circle cx="39.4" cy="47.4" r="1.1" fill="#fff" />
                <rect
                  className="asistente-avatar-lid"
                  x="32.5"
                  y="42"
                  width="11"
                  height="12"
                  fill={`url(#${skin})`}
                />
              </g>
              <g className="asistente-avatar-eye">
                <ellipse cx="58" cy="48" rx="5.2" ry="5.8" fill="#fff" />
                <circle className="asistente-avatar-iris" cx="58.5" cy="48.5" r="3.1" fill="#0f766e" />
                <circle cx="59.4" cy="47.4" r="1.1" fill="#fff" />
                <rect
                  className="asistente-avatar-lid"
                  x="52.5"
                  y="42"
                  width="11"
                  height="12"
                  fill={`url(#${skin})`}
                />
              </g>
            </g>

            <path
              d="M48 50 Q49.5 55 47.5 57"
              fill="none"
              stroke="#d4a07a"
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            <path
              className="asistente-avatar-mouth"
              d="M42 64 Q48 69 54 64"
              fill="none"
              stroke="#c2410c"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <ellipse
              className="asistente-avatar-mouth-open"
              cx="48"
              cy="65.5"
              rx="4.2"
              ry="3.2"
              fill="#9f1239"
            />
          </g>
        </g>

        <circle className="asistente-avatar-spark" cx="70" cy="22" r="2.2" fill="#fde68a" />
        <circle
          className="asistente-avatar-spark asistente-avatar-spark--b"
          cx="24"
          cy="28"
          r="1.6"
          fill="#fff"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}
