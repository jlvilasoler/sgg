import { IconInfo } from "./icons/ActionIcons";

interface Props {
  /** Texto accesible del botón de información */
  label: string;
  children: string;
  className?: string;
}

export default function VencImpInfoTip({ label, children, className = "" }: Props) {
  const text = children.trim();
  if (!text) return null;

  return (
    <span
      className={`venc-imp-info-tip${className ? ` ${className}` : ""}`}
      tabIndex={0}
      aria-label={label}
    >
      <IconInfo size={14} className="venc-imp-info-tip-icon" aria-hidden />
      <span className="venc-imp-info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
