import { useEffect } from "react";

interface Props {
  sectionName: string;
  onClose: () => void;
}

function ConstructionSiteIcon() {
  return (
    <svg
      className="under-construction-icon-svg"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="8" y="52" width="64" height="8" rx="2" fill="#e8c547" />
      <rect x="12" y="56" width="8" height="4" fill="#1a2e1f" opacity="0.35" />
      <rect x="28" y="56" width="8" height="4" fill="#1a2e1f" opacity="0.35" />
      <rect x="44" y="56" width="8" height="4" fill="#1a2e1f" opacity="0.35" />
      <rect x="60" y="56" width="8" height="4" fill="#1a2e1f" opacity="0.35" />
      <path
        d="M18 52V34l8-6 8 6v18"
        stroke="#2d5a3d"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M26 28v24" stroke="#2d5a3d" strokeWidth="2" />
      <path
        d="M54 52V22l-14-10-14 10v30"
        stroke="#c47a2c"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M40 12v40" stroke="#c47a2c" strokeWidth="2" />
      <path
        d="M26 22h28M22 30h36M18 38h44"
        stroke="#c47a2c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="58" cy="18" r="10" fill="#f4a825" />
      <path
        d="M58 12v6M55 15h6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 44l6-10 6 10"
        fill="#f4a825"
        stroke="#d4881f"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="8" y="44" width="16" height="3" rx="1" fill="#1a2e1f" opacity="0.2" />
    </svg>
  );
}

export default function UnderConstructionModal({ sectionName, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pd-overlay under-construction-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="under-construction-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="under-construction-title"
        aria-describedby="under-construction-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="under-construction-icon-wrap" aria-hidden>
          <ConstructionSiteIcon />
        </div>
        <p className="under-construction-kicker">{sectionName}</p>
        <h2 id="under-construction-title" className="under-construction-title">
          Sección en construcción
        </h2>
        <p id="under-construction-message" className="under-construction-message">
          Estamos desarrollando este módulo para ofrecerle una experiencia completa y
          confiable. Por el momento, <strong>{sectionName}</strong> no se encuentra
          disponible.
        </p>
        <p className="under-construction-note muted">
          Agradecemos su comprensión. Estará habilitada próximamente.
        </p>
        <button type="button" className="btn btn-primary under-construction-btn" onClick={onClose}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
